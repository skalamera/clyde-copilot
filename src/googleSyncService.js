const DEFAULT_GMAIL_QUERY = 'newer_than:30d (interview OR recruiter OR hiring OR opportunity OR meeting OR calendar OR schedule)';

function createGoogleSyncService(options = {}) {
  const googleClient = options.googleClient;
  const syncStore = options.syncStore;
  const sessionManager = options.sessionManager;
  const calendarStore = options.calendarStore;
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
        maxResults: Number(settings.googleSyncGmailLimit || 10) || 10
      }),
      googleClient.listCalendarEvents({
        accessToken,
        timeMin: now().toISOString(),
        maxResults: Number(settings.googleSyncCalendarLimit || 25) || 25
      })
    ]);

    const generated = [
      ...gmailMessages.flatMap((message) => proposalsFromGmailMessage(message)),
      ...calendarEvents.flatMap((event) => proposalsFromCalendarEvent(event))
    ];

    const saved = generated.map((proposal) => syncStore.upsertProposal(proposal));
    syncStore.addAudit({
      type: 'sync-scan',
      status: 'success',
      message: `Scanned ${gmailMessages.length} Gmail messages and ${calendarEvents.length} Google Calendar events.`,
      result: { generated: saved.length }
    });
    return saved;
  }

  function proposalsFromGmailMessage(message = {}) {
    const text = `${message.subject || ''}\n${message.snippet || ''}`;
    const normalized = normalizeText(text);
    const entity = findEntityInText(normalized, 'interview');
    const proposals = [];

    if (entity && /(not moving forward|will not be moving forward|won t be moving forward|rejected|declined|pass|another candidate)/i.test(normalized)) {
      proposals.push(buildProposal({
        sourceType: 'gmail',
        sourceId: message.id,
        actionType: 'updateOpportunity',
        label: `Mark ${entity.name} rejected`,
        summary: `Gmail suggests ${entity.name} is no longer moving forward.`,
        source: gmailSource(message),
        payload: { entityName: entity.name, outcome: 'rejected', outcomeReason: message.subject || 'Gmail update', outcomeDate: dateFromMessage(message) }
      }));
    } else if (entity && /(next round|move forward|moving forward|advance|advanced|onsite|final round|technical screen)/i.test(normalized)) {
      proposals.push(buildProposal({
        sourceType: 'gmail',
        sourceId: message.id,
        actionType: 'updateOpportunity',
        label: `Mark ${entity.name} advanced`,
        summary: `Gmail suggests ${entity.name} moved forward.`,
        source: gmailSource(message),
        payload: { entityName: entity.name, outcome: 'advanced', outcomeReason: message.subject || 'Gmail update', outcomeDate: dateFromMessage(message) }
      }));
    }

    return proposals;
  }

  function proposalsFromCalendarEvent(event = {}) {
    if (!event.start) {
      return [];
    }

    const normalized = normalizeText(`${event.title || ''} ${event.description || ''} ${event.attendees?.join(' ') || ''}`);
    const mode = /interview|recruiter|hiring|onsite|screen/.test(normalized) ? 'interview' : 'meeting';
    const entity = findEntityInText(normalized, mode);
    const entityName = entity?.name || inferEntityNameFromTitle(event.title, mode);
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

function clean(value) {
  return String(value || '').trim();
}

module.exports = {
  DEFAULT_GMAIL_QUERY,
  createGoogleSyncService
};
