const { generateChat } = require('./llmClient');

const DEFAULT_GMAIL_QUERY = '';

function createGoogleSyncService(options = {}) {
  const googleClient = options.googleClient;
  const syncStore = options.syncStore;
  const sessionManager = options.sessionManager;
  const calendarStore = options.calendarStore;
  const axiosClient = options.axiosClient;
  const chatGenerator = options.generateChat || generateChat;
  const now = typeof options.now === 'function' ? options.now : () => new Date();

  async function scan({ accessToken, settings = {} } = {}) {
    if (!accessToken) {
      throw new Error('Google is not connected.');
    }
    if (!googleClient) {
      throw new Error('Google client is unavailable.');
    }

    const calendarEvents = await googleClient.listCalendarEvents({
      accessToken,
      timeMin: now().toISOString(),
      orderBy: 'startTime',
      maxResults: Number(settings.googleSyncCalendarLimit || 25) || 25
    });

    const generatedRaw = await Promise.all(
      calendarEvents.map((event) => proposalsFromCalendarEvent(event, settings))
    );

    const generated = dedupeGeneratedProposals(generatedRaw.flat());
    dismissStalePendingProposals({
      scannedSources: calendarEvents.map((event) => sourceKey('calendar', event.id)),
      generated
    });

    const saved = generated.map((proposal) => syncStore.upsertProposal(proposal));
    syncStore.addAudit({
      type: 'sync-scan',
      status: 'success',
      message: `Scanned ${calendarEvents.length} Google Calendar events.`,
      result: { generated: saved.length }
    });
    return saved;
  }

  async function proposalsFromGmailMessage(message = {}, settings = {}) {
    const text = `${message.subject || ''}\n${message.snippet || ''}\n${message.body || ''}`;
    const normalized = normalizeText(text);
    const entity = findEntityInText(normalized, 'interview');
    const inferredCompanyName = extractNewCompanyName(message, text);
    const proposals = [];
    const processEmail = isJobProcessEmail(message, normalized);
    if (!processEmail) {
      return proposals;
    }

    const llmConfig = resolveSyncLlmConfig(settings);
    if (llmConfig && axiosClient) {
      try {
        const responseText = await chatGenerator({
          ...llmConfig,
          axiosClient,
          messages: [
            {
              role: 'system',
              content: 'You are an assistant that analyzes emails to determine if they represent an update to a job application or interview process. You must return a JSON object with the following fields:\n- isUpdate: boolean (true if the email is a status update, rejection, offer, or interview invitation for a job)\n- companyName: string (the name of the company, if applicable)\n- outcome: string ("applied", "advanced", "rejected", "offer", or null)\n\nSTRICT GUIDELINES:\n1. companyName must contain ONLY the actual name of the hiring company. Do NOT include any trailing punctuation, sentences, snippet text, or words (e.g. return "Miter", never "Miter. After reviewing your application"). Never set companyName to our own app name ("Clyde").\n2. outcome must be classified accurately based on the email content:\n   - Set to "applied" if the email is an application confirmation, submission receipt, or thank-you-for-applying confirmation.\n   - Set to "rejected" if the email contains rejection/negative language (e.g. "not moving forward", "decided to pass", "cannot proceed", "not proceeding", "unsuccessful", "unfortunately", "declined").\n   - Set to "advanced" if the email is positive or requests next steps (e.g. "moving forward", "schedule an interview", "invitation to interview", "next round", "onsite", "technical screen").\n   - Set to "offer" if the email represents a job offer.\n   - Otherwise, set to null.\n3. Make sure to distinguish between the sender and recipient roles.\n4. Safety Gating: The email MUST be strictly related to a professional corporate job application or recruiting process. Do NOT include loan applications, banking payments, apartment leases, software subscriptions, credit cards, retail purchases, or standard customer support tickets. If it is a non-job email, set isUpdate to false.'
            },
            {
              role: 'user',
              content: `Email Content:\nSubject: ${message.subject || ''}\nBody: ${message.body || message.snippet || ''}`
            }
          ],
          jsonSchema: {
            type: 'object',
            properties: {
              isUpdate: { type: 'boolean' },
              companyName: { type: 'string' },
              outcome: { type: 'string', enum: ['applied', 'advanced', 'rejected', 'offer'] }
            },
            required: ['isUpdate', 'companyName']
          }
        });

        const result = JSON.parse(responseText);

        if (result.isUpdate && !entity && result.companyName && isUsableCompanyName(result.companyName)) {
            proposals.push(buildProposal({
                sourceType: 'gmail',
                sourceId: message.id,
                actionType: 'createOpportunity',
                label: `Add ${result.companyName} to Clyde`,
                summary: `Gmail found a new interview opportunity with ${result.companyName}.`,
                source: gmailSource(message),
                payload: { name: result.companyName, company: result.companyName, outcome: result.outcome || 'active' }
            }));
        } else if (result.isUpdate && result.outcome && entity && shouldSuggestOutcome(entity, result.outcome)) {
            proposals.push(buildProposal({
                sourceType: 'gmail',
                sourceId: message.id,
                actionType: 'updateOpportunity',
                label: `Mark ${entity.name} ${result.outcome}`,
                summary: `Gmail suggests ${entity.name} ${result.outcome === 'rejected' ? 'is no longer moving forward' : 'moved forward'}.`,
                source: gmailSource(message),
                payload: { entityName: entity.name, outcome: result.outcome, outcomeReason: message.subject || 'Gmail update', outcomeDate: dateFromMessage(message) }
            }));
        } else if (result.isUpdate && !entity && result.companyName) {
           // It's an update, we know the company, but no specific outcome was returned 
           // and the company does not currently exist. Just create it!
           proposals.push(buildProposal({
                sourceType: 'gmail',
                sourceId: message.id,
                actionType: 'createOpportunity',
                label: `Add ${result.companyName} to Clyde`,
                summary: `Gmail found a new interview opportunity with ${result.companyName}.`,
                source: gmailSource(message),
                payload: { name: result.companyName, company: result.companyName }
            }));
        }
        return proposals;
      } catch (err) {
        logSyncLlmFallback('gmail', err);
      }
    }

    if (entity && shouldSuggestOutcome(entity, 'rejected') && /(not moving forward|will not be moving forward|won t be moving forward|no longer moving forward|move forward with other candidates|other candidates|not selected|not proceed|unfortunately|rejected|declined|pass|another candidate)/i.test(normalized)) {
      proposals.push(buildProposal({
        sourceType: 'gmail',
        sourceId: message.id,
        actionType: 'updateOpportunity',
        label: `Mark ${entity.name} rejected`,
        summary: `Gmail suggests ${entity.name} is no longer moving forward.`,
        source: gmailSource(message),
        payload: { entityName: entity.name, outcome: 'rejected', outcomeReason: message.subject || 'Gmail update', outcomeDate: dateFromMessage(message) }
      }));
    } else if (!entity && inferredCompanyName && isUsableCompanyName(inferredCompanyName) && /(not moving forward|will not be moving forward|won t be moving forward|no longer moving forward|move forward with other candidates|other candidates|not selected|not proceed|unfortunately|rejected|declined|pass|another candidate)/i.test(normalized)) {
      proposals.push(buildProposal({
        sourceType: 'gmail',
        sourceId: message.id,
        actionType: 'createOpportunity',
        label: `Add ${inferredCompanyName} as rejected`,
        summary: `Gmail suggests ${inferredCompanyName} is no longer moving forward.`,
        source: gmailSource(message),
        payload: { name: inferredCompanyName, company: inferredCompanyName, outcome: 'rejected' }
      }));
    } else if (entity && shouldSuggestOutcome(entity, 'advanced') 
               && /(next round|move forward|moving forward|advance|advanced|onsite|final round|technical screen|confirm|confirmed|scheduled)/i.test(normalized)
               && !/\b(thanks for applying|thank you for applying|received your application|application received|received application|application submission|confirmation of application|application was sent|application has been sent|successfully applied|applied to|submitted your application|thanks for your application|thank you for your application|applied for the role|applied for the position|confirm receipt of your application|not moving forward|will not be moving forward|won t be moving forward|no longer moving forward|move forward with other candidates|move forward with other applicants|other candidates|not selected|not proceed|unfortunately|rejected|declined|pass|another candidate)\b/i.test(normalized)) {
      proposals.push(buildProposal({
        sourceType: 'gmail',
        sourceId: message.id,
        actionType: 'updateOpportunity',
        label: `Mark ${entity.name} advanced`,
        summary: `Gmail suggests ${entity.name} moved forward.`,
        source: gmailSource(message),
        payload: { entityName: entity.name, outcome: 'advanced', outcomeReason: message.subject || 'Gmail update', outcomeDate: dateFromMessage(message) }
      }));
    } else if (!entity && inferredCompanyName && isUsableCompanyName(inferredCompanyName) 
               && /(next round|move forward|moving forward|advance|advanced|onsite|final round|technical screen|confirm|confirmed|scheduled)/i.test(normalized)
               && !/\b(thanks for applying|thank you for applying|received your application|application received|received application|application submission|confirmation of application|application was sent|application has been sent|successfully applied|applied to|submitted your application|thanks for your application|thank you for your application|applied for the role|applied for the position|confirm receipt of your application|not moving forward|will not be moving forward|won t be moving forward|no longer moving forward|move forward with other candidates|move forward with other applicants|other candidates|not selected|not proceed|unfortunately|rejected|declined|pass|another candidate)\b/i.test(normalized)) {
      proposals.push(buildProposal({
        sourceType: 'gmail',
        sourceId: message.id,
        actionType: 'createOpportunity',
        label: `Add ${inferredCompanyName} to Clyde`,
        summary: `Gmail found a new interview opportunity with ${inferredCompanyName}.`,
        source: gmailSource(message),
        payload: { name: inferredCompanyName, company: inferredCompanyName, outcome: 'advanced' }
      }));
    }

    if (entity && isInterviewMeetingRequest(normalized)) {
      const meeting = extractInterviewMeetingRequest(message, text, entity.name, now());
      if (meeting.date) {
        proposals.push(buildProposal({
          sourceType: 'gmail',
          sourceId: message.id,
          actionType: 'addInterviewMeetingRequest',
          label: `Add ${meeting.title} to Clyde calendar`,
          summary: `Gmail found an interview meeting request for ${entity.name}.`,
          source: gmailSource(message),
          payload: meeting
        }));
      }
    } else if (!entity && proposals.length === 0 && /(interview|schedule|next step|video meeting|zoom|google meet|interest in|thanks for applying|thank you for applying|received your application|application received|received application|application submission|confirmation of application|application was sent|application has been sent|successfully applied|applied to|submitted your application|thanks for your application|thank you for your application|applied for the role|applied for the position|confirm receipt of your application)/i.test(normalized)) {
      const newCompanyName = inferredCompanyName;
      if (newCompanyName && isUsableCompanyName(newCompanyName)) {
        const role = extractNewCompanyRole(message, text);
        const isAppliedConfirm = /(thanks for applying|thank you for applying|received your application|application received|received application|application submission|confirmation of application|application was sent|application has been sent|successfully applied|applied to|submitted your application|thanks for your application|thank you for your application|applied for the role|applied for the position|confirm receipt of your application)/i.test(normalized);
        
        proposals.push(buildProposal({
          sourceType: 'gmail',
          sourceId: message.id,
          actionType: 'createOpportunity',
          label: isAppliedConfirm ? `Add ${newCompanyName} as applied` : `Add ${newCompanyName} to Clyde`,
          summary: isAppliedConfirm 
            ? `Gmail found an application confirmation for ${newCompanyName}.`
            : `Gmail found a new interview opportunity with ${newCompanyName}.`,
          source: gmailSource(message),
          payload: { 
            name: newCompanyName, 
            company: newCompanyName,
            role: role || undefined,
            outcome: isAppliedConfirm ? 'applied' : 'active'
          }
        }));
      }
    }

    return proposals;
  }

  async function proposalsFromCalendarEvent(event = {}, settings = {}) {
    if (!event.start) {
      return [];
    }

    const cleanDescription = stripHtml(event.description);
    const normalized = normalizeText(`${event.title || ''} ${cleanDescription} ${event.attendees?.join(' ') || ''}`);
    const interviewRelevant = isCalendarInterviewRelevant(normalized);
    const interviewEntity = findEntityInText(normalized, 'interview');
    const meetingEntity = findEntityInText(normalized, 'meeting');
    if (!interviewRelevant && !interviewEntity && !meetingEntity) {
      return [];
    }

    const mode = interviewRelevant || interviewEntity ? 'interview' : 'meeting';
    const entity = mode === 'interview' ? interviewEntity : meetingEntity;
    let entityName = entity?.name || '';

    const llmConfig = resolveSyncLlmConfig(settings);
    if (llmConfig && !entityName && mode === 'interview' && axiosClient) {
       try {
        const responseText = await chatGenerator({
          ...llmConfig,
          axiosClient,
          messages: [
            {
              role: 'system',
              content: 'You are an assistant that analyzes calendar event details to determine the name of the company the user is interviewing with. Return a JSON object with a single "companyName" string field, or null if you cannot determine it.'
            },
            {
              role: 'user',
              content: `Title: ${event.title || ''}\nDescription: ${cleanDescription}`
            }
          ],
          jsonSchema: {
            type: 'object',
            properties: {
              companyName: { type: 'string' }
            }
          }
        });
        const result = JSON.parse(responseText);
        if (result.companyName) {
            entityName = result.companyName;
        }
       } catch (err) {
         logSyncLlmFallback('calendar event', err);
       }
    }

    const actionType = mode === 'meeting' && entityName ? 'saveCalendarEvent' : 'saveCalendarEvent';

    return [buildProposal({
      sourceType: 'calendar',
      sourceId: event.id,
      actionType,
      label: `Add ${event.title || 'Google event'} to Clyde calendar`,
      summary: `Google Calendar has ${event.title || 'an event'} on ${event.start}.`,
      source: {
        type: 'calendar',
        id: event.id,
        title: event.title,
        date: event.start,
        link: event.htmlLink
      },
      payload: {
        title: event.title || (mode === 'meeting' ? 'Meeting' : 'Interview'),
        date: event.start,
        mode,
        entityName,
        meetingName: mode === 'meeting' ? entityName : '',
        description: [cleanDescription, event.location].filter(Boolean).join('\n'),
        meetingUrl: extractMeetingUrl(event)
      }
    })];
  }

  function buildProposal({ sourceType, sourceId, actionType, label, summary, source, payload }) {
    const dedupeKey = proposalDedupeKey({ sourceType, sourceId, actionType, payload });
    return {
      dedupeKey,
      label,
      summary,
      status: 'pending',
      source,
      action: {
        id: `sync-action-${stableHash(dedupeKey)}`,
        label,
        summary,
        actionType,
        payload: {
          ...payload,
          originalUserMessage: summary
        },
        originalUserMessage: summary
      },
      createdAt: now().toISOString()
    };
  }

  function proposalDedupeKey({ sourceType, sourceId, actionType, payload = {} }) {
    if (actionType === 'createOpportunity') {
      const entity = normalizeText(payload.name || payload.entityName || payload.company);
      if (entity) {
        return `${sourceType}:create-opportunity:${entity}`;
      }
    }
    if (actionType === 'updateOpportunity') {
      const entity = normalizeText(payload.entityName || payload.entityId || payload.company || payload.name);
      const outcome = normalizeText(payload.outcome);
      if (entity && outcome) {
        return `${sourceType}:opportunity:${entity}:${outcome}`;
      }
    }
    if (actionType === 'addInterviewMeetingRequest') {
      const entity = normalizeText(payload.entityName || payload.company);
      const title = normalizeText(payload.title || payload.name);
      const date = clean(payload.date || payload.start || payload.startTime).slice(0, 16);
      if (entity && (date || title)) {
        return `${sourceType}:interview-meeting-request:${entity}:${date || title}`;
      }
    }
    return `${sourceType}:${sourceId}:${actionType}`;
  }

  function dedupeGeneratedProposals(proposals = []) {
    const byKey = new Map();
    for (const proposal of proposals) {
      if (!proposal?.dedupeKey) {
        continue;
      }
      if (!byKey.has(proposal.dedupeKey)) {
        byKey.set(proposal.dedupeKey, proposal);
      }
    }
    return [...byKey.values()];
  }

  function dismissStalePendingProposals({ scannedSources = [], generated = [] } = {}) {
    if (!syncStore?.dismissPendingProposals) {
      return [];
    }
    const scanned = new Set(scannedSources.filter(Boolean));
    const generatedKeys = new Set(generated.map((proposal) => proposal.dedupeKey).filter(Boolean));
    if (!scanned.size) {
      return [];
    }
    return syncStore.dismissPendingProposals((proposal) => {
      const proposalSource = sourceKey(proposal.source?.type, proposal.source?.id);
      return scanned.has(proposalSource) && !generatedKeys.has(proposal.dedupeKey);
    }, { reason: 'stale-after-rescan' });
  }

  function isInterviewMeetingRequest(normalizedText) {
    if (/\b(sent an invite|calendar invite|invitation)\b/.test(normalizedText)) {
      return false;
    }
    const hasInterview = /\b(interview|onsite|technical screen|final round|next round|next step|virtual onsite)\b/.test(normalizedText);
    const hasScheduling = /\b(availability|available|schedule|scheduling|zoom|google meet|meet with|meeting request)\b/.test(normalizedText);
    return hasInterview && hasScheduling;
  }

  function isJobProcessEmail(message = {}, normalizedText = '') {
    const subject = normalizeText(message.subject || '');
    const from = normalizeText(message.from || '');

    // Safety gate: completely ignore any automated job alerts/recommendations
    const isJobAlert = /\b(job alert|jobalert|jobalerts|job recommendations|new jobs|jobs alert)\b/i.test(subject)
      || /\b(jobalerts-noreply|jobalert|jobalerts|job-alerts|job-alert)\b/i.test(from);
    if (isJobAlert) {
      return false;
    }

    // Safety gate: completely exclude personal finance, loans, billing, transactions or other non-job terms
    const isFinancialOrNonJob = /\b(loan|loans|mortgage|credit card|credit score|debt|payment confirmation|loan payment|on-time payment|billing statement|payment on-time|scam|scams|scammer|scammers|fraud|beware|phishing|warning)\b/i.test(normalizedText)
      || /\b(loan|billing|invoice|payment|receipt|scam|scams|scammer|scammers|fraud|beware|phishing|warning)\b/i.test(subject);
    if (isFinancialOrNonJob) {
      return false;
    }

    const looksBulk = /\b(newsletter|digest|daily update|weekly update|auction|auctions|ending today|new jobs|more jobs|job alert|jobalert|jobs alert|hiring for|promoted|sponsored|unsubscribe|security issues|modern css)\b/.test(normalizedText)
      || /\b(linkedin|jobalert|job alert|themmbmarket|thembmarket|newsletter|newsletters)\b/.test(from);
    const strongProcessSignal = /\b(your application|application update|thank you for applying|thanks for applying|applied for|applying for|candidate|interview|onsite|technical screen|phone screen|final round|next round|next steps|availability|available|schedule|scheduling|recruiter|hiring manager|offer)\b/.test(normalizedText);
    const directThreadSignal = /\b(next steps|interview confirmation|invitation|virtual onsite|onsite|technical screen|phone screen)\b/.test(subject);
    if (looksBulk && !/\b(your application|application update|interview|onsite|technical screen|phone screen|final round|recruiter)\b/.test(normalizedText)) {
      return false;
    }
    return strongProcessSignal || directThreadSignal;
  }

  function shouldSuggestOutcome(entity = {}, outcome = '') {
    const current = normalizeOutcome(entity.outcome);
    const next = normalizeOutcome(outcome);
    return next && current !== next;
  }

  function isCalendarInterviewRelevant(normalizedText) {
    // Safety check: Exclude bulk/leads, marketing alerts, or general opportunities
    const isOpportunityOrAlert = /\b(opportunity|opportunities|alert|digest|newsletter|marketing|lead|leads|sponsored|promoted|new job|more jobs)\b/i.test(normalizedText);
    if (isOpportunityOrAlert) {
      return false;
    }

    const hasInterview = /\b(interview|onsite|technical screen|phone screen|final round|next round|recruiter|hiring manager|candidate|job)\b/.test(normalizedText);
    const hasMeetingSignal = /\b(zoom|google meet|teams|meet|meeting|call|screen|interview|onsite)\b/.test(normalizedText);
    return hasInterview && hasMeetingSignal;
  }

  function extractInterviewMeetingRequest(message, text, entityName, referenceDate) {
    const attendee = extractInterviewAttendee(text);
    const title = clean(message.subject).replace(/^(re|fwd):\s*/ig, '').replace(/^invitation:\s*/i, '') || `${entityName} interview`;
    return {
      title,
      date: extractMeetingDate(text, referenceDate),
      mode: 'interview',
      entityName,
      company: entityName,
      attendees: attendee ? [attendee] : [],
      durationMinutes: extractDurationMinutes(text),
      description: clean([message.body, message.snippet].filter(Boolean).join('\n')),
      sourceMessageId: clean(message.id)
    };
  }

  function extractInterviewAttendee(text) {
    const withMatch = clean(text).match(/\bwith\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/);
    return withMatch ? withMatch[1] : '';
  }

  function extractDurationMinutes(text) {
    const match = clean(text).match(/\b(\d{1,3})\s*(?:-| )?\s*minute\b/i);
    return match ? Number(match[1]) : '';
  }

  function extractMeetingDate(text, referenceDate) {
    const value = clean(text);
    const weekdayMatch = value.match(/\b(?:next\s+)?(Sunday|Sun|Monday|Mon|Tuesday|Tue|Tues|Wednesday|Wed|Thursday|Thu|Thur|Thurs|Friday|Fri|Saturday|Sat)\b/i);
    const time = value.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\s*(?:EDT|EST|CDT|CST|MDT|MST|PDT|PST|US\/Eastern|US\/Pacific|US\/Central|US\/Mountain)?\b/i);
    if (!weekdayMatch || !time) {
      return '';
    }
    const weekdayStr = weekdayMatch[1].toLowerCase();
    const base = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime()) ? new Date(referenceDate) : new Date();
    
    let target = -1;
    if (weekdayStr.startsWith('sun')) target = 0;
    else if (weekdayStr.startsWith('mon')) target = 1;
    else if (weekdayStr.startsWith('tue')) target = 2;
    else if (weekdayStr.startsWith('wed')) target = 3;
    else if (weekdayStr.startsWith('thu')) target = 4;
    else if (weekdayStr.startsWith('fri')) target = 5;
    else if (weekdayStr.startsWith('sat')) target = 6;
    
    if (target === -1) {
      return '';
    }

    let delta = (target - base.getDay() + 7) % 7;
    if (delta === 0) {
      delta = 7;
    }
    base.setDate(base.getDate() + delta);
    let hours = Number(time[1]);
    const minutes = Number(time[2] || 0);
    const meridiem = time[3].toLowerCase()[0];
    if (meridiem === 'p' && hours < 12) {
      hours += 12;
    }
    if (meridiem === 'a' && hours === 12) {
      hours = 0;
    }
    base.setHours(hours, minutes, 0, 0);
    return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}T${String(base.getHours()).padStart(2, '0')}:${String(base.getMinutes()).padStart(2, '0')}:00.000`;
  }

  function findEntityInText(normalizedText, mode) {
    if (!sessionManager?.getSessionEntities || !normalizedText) {
      return null;
    }
    const entities = sessionManager.getSessionEntities(mode);
    return entities
      .filter((entity) => {
        const id = normalizeText(entity.id);
        const name = normalizeText(entity.name);
        return (id && normalizedText.includes(id)) || (name && normalizedText.includes(name));
      })
      .sort((a, b) => String(b.name || b.id).length - String(a.name || a.id).length)[0] || null;
  }

  function inferEntityNameFromTitle(title = '', mode = 'meeting') {
    const cleanTitle = clean(title);
    if (!cleanTitle) {
      return '';
    }
    if (mode === 'meeting') {
      return cleanTitle.replace(/\b(meeting|sync|check-in|standup)\b/ig, '').replace(/[-:]+$/g, '').trim() || cleanTitle;
    }
    return '';
  }

function extractNewCompanyName(message, text) {
    const subjectPrefixMatch = clean(message.subject).match(/^(?:(?:re|fwd):\s*)?([A-Z][a-zA-Z0-9&.\- ]{1,60})\s*(?:\||-|:)\s*(?:next steps?|interview|onsite|confirmation|scheduling)\b/i);
    if (subjectPrefixMatch && subjectPrefixMatch[1]) {
      return subjectPrefixMatch[1].trim();
    }

    const subjectCompanyMatch = clean(message.subject).match(/^([A-Z][a-zA-Z0-9&.\- ]{1,60})\s+(application|candidate|interview|recruiting|hiring)\s+update\b/i);
    if (subjectCompanyMatch && subjectCompanyMatch[1]) {
      return subjectCompanyMatch[1].trim();
    }

    const appliedAtMatch = text.match(/\b(?:applying for|applied for|position at|role at|job at|opportunity at)\s+([A-Z][a-zA-Z0-9&.\- ]{1,60})\b/);
    if (appliedAtMatch && appliedAtMatch[1]) {
      return appliedAtMatch[1].trim().replace(/[.!,;:]+$/g, '');
    }

    const interviewWithCompanyMatch = text.match(/\b(?:interview|onsite|screen|round)\b.{0,80}\bwith\s+([A-Z][a-zA-Z0-9&.\- ]{1,60})\b/i);
    if (interviewWithCompanyMatch && interviewWithCompanyMatch[1]) {
      const name = interviewWithCompanyMatch[1].trim().replace(/[.!,;:]+$/g, '');
      if (!/\s/.test(name) || /\b(inc|labs|systems|software|technologies|tech|ai|io|co|corp|group)\b/i.test(name)) {
        return name;
      }
    }

    let domainCompany = null;
    const emailMatch = message.from?.match(/<([^>]+)>/) || message.from?.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const email = emailMatch ? emailMatch[1] : message.from;
    const domain = email?.split('@')[1];
    if (domain) {
      const IGNORED_DOMAINS = new Set(['mail', 'email', 'notification', 'notifications', 'jobvite', 'greenhouse', 'lever', 'ashby', 'ashbyco', 'smartrecruiters', 'workday', 'rippling', 'icims', 'taleo', 'adp', 'rooster', 'roosterinc']);
      const parts = domain.split('.');
      for (const part of parts) {
        const lower = part.toLowerCase();
        if (!IGNORED_DOMAINS.has(lower) && !['com', 'org', 'co', 'io', 'net', 'edu', 'gov', 'uk', 'de', 'fr', 'us', 'ca'].includes(lower)) {
          domainCompany = part;
          break;
        }
      }
    }

    const interestMatch = text.match(/interest in(?: the.*? at)?\s+([A-Z][a-zA-Z0-9]+)/);
    if (interestMatch && interestMatch[1]) {
      const name = interestMatch[1];
      if (!/^(the|our|your|a|an|this|my|our)$/i.test(name)) {
         return name;
      }
    }

    if (domainCompany) {
      const lower = domainCompany.toLowerCase();
      if (!['gmail', 'yahoo', 'hotmail', 'outlook', 'aol', 'mail', 'icloud'].includes(lower)) {
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      }
    }

    return null;
  }

  function extractNewCompanyRole(message, text) {
    const value = clean(text);
    
    // Pattern 1: ...for the [Role] role/position/job at [Company]
    const pattern1 = value.match(/\b(?:for the|for our)\s+([^,.\n]+?)\s+(?:role|position|job)\s+at\s+([A-Z][a-zA-Z0-9&.\- ]+)/i);
    if (pattern1 && pattern1[1]) {
      return pattern1[1].trim();
    }

    // Pattern 2: ...application for [Role] at [Company]
    const pattern2 = value.match(/\b(?:application for|applying for)\s+([^,.\n]+?)\s+at\s+([A-Z][a-zA-Z0-9&.\- ]+)/i);
    if (pattern2 && pattern2[1]) {
      return pattern2[1].trim();
    }

    // Pattern 3: ...fit for the [Role] position
    const pattern3 = value.match(/\bfit for the\s+([^,.\n]+?)\s+(?:role|position|job)\b/i);
    if (pattern3 && pattern3[1]) {
      return pattern3[1].trim();
    }

    // Pattern 4: Subject line matches: "Thanks for applying: [Role]" or similar
    const pattern4 = clean(message.subject || '').match(/^(?:(?:thanks for applying|application confirmation|submission confirmation|application received):\s*)?([^,.\n\-:|]+)/i);
    if (pattern4 && pattern4[1]) {
      const subjectTrimmed = pattern4[1].trim();
      // Verify it doesn't just equal the company name
      const company = extractNewCompanyName(message, text);
      if (company && subjectTrimmed.toLowerCase() !== company.toLowerCase() && !subjectTrimmed.toLowerCase().includes('thanks for') && !subjectTrimmed.toLowerCase().includes('thank you')) {
        return subjectTrimmed;
      }
    }

    return '';
  }

  return {
    proposalsFromCalendarEvent,
    proposalsFromGmailMessage,
    scan
  };
}

function gmailSource(message = {}) {
  return {
    type: 'gmail',
    id: clean(message.id),
    title: clean(message.subject),
    from: clean(message.from),
    date: dateFromMessage(message),
    snippet: clean(message.snippet)
  };
}

function dateFromMessage(message = {}) {
  if (message.internalDate && /^\d+$/.test(String(message.internalDate))) {
    return new Date(Number(message.internalDate)).toISOString();
  }
  const parsed = new Date(message.date);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function stableHash(value) {
  let hash = 0;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

function sourceKey(type, id) {
  const cleanType = clean(type);
  const cleanId = clean(id);
  return cleanType && cleanId ? `${cleanType}:${cleanId}` : '';
}

function normalizeText(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9#]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function resolveSyncLlmConfig(settings = {}) {
  const provider = clean(settings.llmProvider);
  const llmApiKey = clean(settings.llmApiKey || settings.openAiApiKey);

  if (provider === 'openai' && llmApiKey) {
    return { provider: 'openai', apiKey: llmApiKey, model: clean(settings.llmModel) || 'gpt-4o-mini' };
  }
  if (provider === 'anthropic' && llmApiKey) {
    return { provider: 'anthropic', apiKey: llmApiKey, model: clean(settings.llmModel) || 'claude-3-5-haiku-20241022' };
  }
  if (provider === 'gemini' && llmApiKey) {
    return { provider: 'gemini', apiKey: llmApiKey, model: clean(settings.llmModel) || 'gemini-2.5-flash' };
  }
  if (provider === 'local') {
    return {
      provider: 'local',
      apiKey: llmApiKey,
      model: clean(settings.llmModel),
      localUrl: clean(settings.localLlmUrl)
    };
  }
  return null;
}

function normalizeOutcome(value) {
  const normalized = normalizeText(value);
  if (['active', 'advanced', 'applied', 'rejected', 'offer'].includes(normalized)) {
    return normalized;
  }
  return '';
}

function isUsableCompanyName(value) {
  const name = clean(value);
  const normalized = normalizeText(name);
  if (!name || name.length < 2) {
    return false;
  }
  if (/^(hi|hello|jobs?|jobalert|linkedin|newsletter|digest|update|the|your|our|my)$/i.test(name)) {
    return false;
  }
  if (/\b(jobs?|newsletter|digest|daily update|auction|auctions)\b/.test(normalized)) {
    return false;
  }
  return true;
}

function logSyncLlmFallback(source, error) {
  if (isLocalConnectionRefused(error)) {
    return;
  }

  const status = error?.response?.status || error?.status;
  const code = clean(error?.code);
  const message = clean(error?.response?.data?.error?.message || error?.response?.data?.message || error?.message);
  const detail = [status ? `status ${status}` : '', code, message].filter(Boolean).join(' - ');
  console.warn(`LLM parsing for ${source} failed, falling back to regex${detail ? `: ${detail}` : '.'}`);
}

function isLocalConnectionRefused(error) {
  const url = clean(error?.config?.url);
  return error?.code === 'ECONNREFUSED' && (url.includes('127.0.0.1') || url.includes('localhost'));
}

function clean(value) {
  return String(value || '').trim();
}

function stripHtml(html = '') {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\r\n/g, '\n')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

function extractMeetingUrl(event = {}) {
  if (event.hangoutLink) {
    return clean(event.hangoutLink);
  }
  
  const location = String(event.location || '');
  if (location.includes('http://') || location.includes('https://')) {
    const urls = location.match(/https?:\/\/[^\s]+/gi);
    if (urls && urls.length > 0) {
      return clean(urls[0]);
    }
  }
  
  const description = String(event.description || '');
  if (description.includes('http://') || description.includes('https://')) {
    const urls = description.match(/https?:\/\/[^\s]+/gi);
    if (urls) {
      const meetingUrl = urls.find(url => 
        url.includes('zoom.us') || 
        url.includes('meet.google.com') || 
        url.includes('teams.live.com') || 
        url.includes('teams.microsoft.com') || 
        url.includes('webex.com')
      );
      if (meetingUrl) {
        return clean(meetingUrl);
      }
      return clean(urls[0]);
    }
  }
  
  return '';
}

module.exports = {
  DEFAULT_GMAIL_QUERY,
  createGoogleSyncService,
  resolveSyncLlmConfig
};
