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

    const [gmailMessages, calendarEvents] = await Promise.all([
      googleClient.listGmailMessages({
        accessToken,
        query: settings.googleGmailQuery || DEFAULT_GMAIL_QUERY,
        maxResults: Number(settings.googleSyncGmailLimit || 15) || 15
      }),
      googleClient.listCalendarEvents({
        accessToken,
        timeMin: now().toISOString(),
        orderBy: 'startTime',
        maxResults: Number(settings.googleSyncCalendarLimit || 25) || 25
      })
    ]);

    const generatedRaw = await Promise.all([
      ...gmailMessages.map((message) => proposalsFromGmailMessage(message, settings)),
      ...calendarEvents.map((event) => proposalsFromCalendarEvent(event, settings))
    ]);

    const generated = generatedRaw.flat();

    const saved = generated.map((proposal) => syncStore.upsertProposal(proposal));
    syncStore.addAudit({
      type: 'sync-scan',
      status: 'success',
      message: `Scanned ${gmailMessages.length} Gmail messages and ${calendarEvents.length} Google Calendar events.`,
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

    const llmConfig = resolveSyncLlmConfig(settings);
    if (llmConfig && axiosClient) {
      try {
        const responseText = await chatGenerator({
          ...llmConfig,
          axiosClient,
          messages: [
            {
              role: 'system',
              content: 'You are an assistant that analyzes emails to determine if they represent an update to a job application or interview process (e.g., "advanced", "rejected", "offer", or an invitation to interview). You must return a JSON object with the following fields:\n- isUpdate: boolean (true if the email is a status update, rejection, offer, or interview invitation for a job)\n- companyName: string (the name of the company, if applicable)\n- outcome: string ("advanced", "rejected", "offer", or null)'
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
              outcome: { type: 'string', enum: ['advanced', 'rejected', 'offer'] }
            },
            required: ['isUpdate', 'companyName']
          }
        });

        const result = JSON.parse(responseText);

        if (result.isUpdate && result.outcome) {
            const targetEntityName = entity?.name || result.companyName;
            if (targetEntityName) {
                proposals.push(buildProposal({
                    sourceType: 'gmail',
                    sourceId: message.id,
                    actionType: 'updateOpportunity',
                    label: `Mark ${targetEntityName} ${result.outcome}`,
                    summary: `Gmail suggests ${targetEntityName} ${result.outcome === 'rejected' ? 'is no longer moving forward' : 'moved forward'}.`,
                    source: gmailSource(message),
                    payload: { entityName: targetEntityName, outcome: result.outcome, outcomeReason: message.subject || 'Gmail update', outcomeDate: dateFromMessage(message) }
                }));
            }
        } else if (result.isUpdate && !entity && result.companyName) {
            proposals.push(buildProposal({
                sourceType: 'gmail',
                sourceId: message.id,
                actionType: 'createOpportunity',
                label: `Add ${result.companyName} to Clyde`,
                summary: `Gmail found a new interview opportunity with ${result.companyName}.`,
                source: gmailSource(message),
                payload: { name: result.companyName, company: result.companyName }
            }));
        } else if (result.isUpdate && result.companyName) {
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

    if (entity && /(not moving forward|will not be moving forward|won t be moving forward|no longer moving forward|move forward with other candidates|other candidates|not selected|not proceed|unfortunately|rejected|declined|pass|another candidate)/i.test(normalized)) {
      proposals.push(buildProposal({
        sourceType: 'gmail',
        sourceId: message.id,
        actionType: 'updateOpportunity',
        label: `Mark ${entity.name} rejected`,
        summary: `Gmail suggests ${entity.name} is no longer moving forward.`,
        source: gmailSource(message),
        payload: { entityName: entity.name, outcome: 'rejected', outcomeReason: message.subject || 'Gmail update', outcomeDate: dateFromMessage(message) }
      }));
    } else if (!entity && inferredCompanyName && /(not moving forward|will not be moving forward|won t be moving forward|no longer moving forward|move forward with other candidates|other candidates|not selected|not proceed|unfortunately|rejected|declined|pass|another candidate)/i.test(normalized)) {
      proposals.push(buildProposal({
        sourceType: 'gmail',
        sourceId: message.id,
        actionType: 'createOpportunity',
        label: `Add ${inferredCompanyName} as rejected`,
        summary: `Gmail suggests ${inferredCompanyName} is no longer moving forward.`,
        source: gmailSource(message),
        payload: { name: inferredCompanyName, company: inferredCompanyName, outcome: 'rejected' }
      }));
    } else if (entity && /(next round|move forward|moving forward|advance|advanced|onsite|final round|technical screen|confirm|confirmed|scheduled)/i.test(normalized)) {
      proposals.push(buildProposal({
        sourceType: 'gmail',
        sourceId: message.id,
        actionType: 'updateOpportunity',
        label: `Mark ${entity.name} advanced`,
        summary: `Gmail suggests ${entity.name} moved forward.`,
        source: gmailSource(message),
        payload: { entityName: entity.name, outcome: 'advanced', outcomeReason: message.subject || 'Gmail update', outcomeDate: dateFromMessage(message) }
      }));
    } else if (!entity && /(interview|schedule|next step|video meeting|zoom|google meet|interest in)/i.test(normalized)) {
      const newCompanyName = inferredCompanyName;
      if (newCompanyName) {
        proposals.push(buildProposal({
          sourceType: 'gmail',
          sourceId: message.id,
          actionType: 'createOpportunity',
          label: `Add ${newCompanyName} to Clyde`,
          summary: `Gmail found a new interview opportunity with ${newCompanyName}.`,
          source: gmailSource(message),
          payload: { name: newCompanyName, company: newCompanyName }
        }));
      }
    }

    return proposals;
  }

  async function proposalsFromCalendarEvent(event = {}, settings = {}) {
    if (!event.start) {
      return [];
    }

    const normalized = normalizeText(`${event.title || ''} ${event.description || ''} ${event.attendees?.join(' ') || ''}`);
    const mode = /interview|recruiter|hiring|onsite|screen/.test(normalized) ? 'interview' : 'meeting';
    const entity = findEntityInText(normalized, mode);
    let entityName = entity?.name || inferEntityNameFromTitle(event.title, mode);

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
              content: `Title: ${event.title || ''}\nDescription: ${event.description || ''}`
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
        description: [event.description, event.location].filter(Boolean).join('\n')
      }
    })];
  }

  function buildProposal({ sourceType, sourceId, actionType, label, summary, source, payload }) {
    const dedupeKey = `${sourceType}:${sourceId}:${actionType}`;
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
    const subjectCompanyMatch = clean(message.subject).match(/^([A-Z][a-zA-Z0-9&.\- ]{1,60})\s+(application|candidate|interview|recruiting|hiring)\s+update\b/i);
    if (subjectCompanyMatch && subjectCompanyMatch[1]) {
      return subjectCompanyMatch[1].trim();
    }

    const appliedAtMatch = text.match(/\b(?:applying for|applied for|position at|role at|job at|opportunity at)\s+([A-Z][a-zA-Z0-9&.\- ]{1,60})\b/);
    if (appliedAtMatch && appliedAtMatch[1]) {
      return appliedAtMatch[1].trim().replace(/[.!,;:]+$/g, '');
    }

    const fromMatch = message.from?.match(/@([a-zA-Z0-9-]+)\./);
    const domainCompany = fromMatch ? fromMatch[1] : null;

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

module.exports = {
  DEFAULT_GMAIL_QUERY,
  createGoogleSyncService,
  resolveSyncLlmConfig
};
