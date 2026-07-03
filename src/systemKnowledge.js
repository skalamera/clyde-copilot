const OPPORTUNITIES_STATUS_ID = 'system:opportunities-status';
const CALENDAR_EVENTS_ID = 'system:calendar-events';

function buildOpportunitiesStatusKnowledge({ opportunities = [], activeInterviewId = '' } = {}) {
  const now = new Date().toISOString();
  const activeId = clean(activeInterviewId).toLowerCase();
  const lines = normalizeArray(opportunities).map((opportunity) => {
    const id = clean(opportunity.id || opportunity.name);
    const name = clean(opportunity.name || id) || 'Unknown opportunity';
    const role = clean(opportunity.role || opportunity.title);
    const status = clean(opportunity.outcome || opportunity.status || 'active').toLowerCase();
    const updated = clean(opportunity.outcomeUpdatedAt || opportunity.outcomeDate || opportunity.updated_at || opportunity.updatedAt);
    const isActive = activeId && [id, name].map((value) => value.toLowerCase()).includes(activeId);
    return [
      `Opportunity: ${name}`,
      id ? `id: ${id}` : '',
      role ? `role: ${role}` : '',
      `status: ${status}`,
      `active interview: ${isActive ? 'yes' : 'no'}`,
      updated ? `updated: ${updated}` : ''
    ].filter(Boolean).join(' | ');
  });

  return {
    id: OPPORTUNITIES_STATUS_ID,
    filename: 'Opportunities status.txt',
    file_path: '',
    content: lines.length
      ? ['System document: current opportunity statuses.', ...lines].join('\n')
      : 'System document: current opportunity statuses.\nNo opportunities found.',
    type: 'system',
    metadata: {
      source: 'system',
      systemId: OPPORTUNITIES_STATUS_ID,
      updatedAt: now,
      count: lines.length
    },
    now
  };
}

function buildCalendarEventsKnowledge({ events = [] } = {}) {
  const now = new Date().toISOString();
  const lines = normalizeArray(events).map((event) => {
    const id = clean(event.id);
    const title = clean(event.title || event.name) || 'Untitled event';
    const date = clean(event.date || event.start || event.startTime);
    const entityId = clean(event.entityId || event.companyId || event.meetingId);
    const entityName = clean(event.entityName || event.company || event.meetingName || event.entity?.name);
    const mode = clean(event.mode || event.type);
    return [
      `Event: ${id || title}`,
      `title: ${title}`,
      date ? `date: ${date}` : '',
      entityName || entityId ? `entity: ${entityName || entityId}${entityId ? ` (${entityId})` : ''}` : '',
      mode ? `mode: ${mode}` : ''
    ].filter(Boolean).join(' | ');
  });

  return {
    id: CALENDAR_EVENTS_ID,
    filename: 'Calendar events.txt',
    file_path: '',
    content: lines.length
      ? ['System document: current calendar events.', ...lines].join('\n')
      : 'System document: current calendar events.\nNo calendar events found.',
    type: 'system',
    metadata: {
      source: 'system',
      systemId: CALENDAR_EVENTS_ID,
      updatedAt: now,
      count: lines.length
    },
    now
  };
}

async function refreshSystemKnowledge({
  settings = {},
  sessionManager,
  calendarStore,
  knowledgeManager,
  activeInterviewId = ''
} = {}) {
  if (!knowledgeManager?.upsertKnowledgeItem) {
    return [];
  }

  const opportunities = sessionManager?.getSessionEntities
    ? normalizeArray(sessionManager.getSessionEntities('interview'))
    : [];
  const events = calendarStore?.listEvents ? normalizeArray(calendarStore.listEvents()) : [];
  const items = [
    buildOpportunitiesStatusKnowledge({ opportunities, activeInterviewId }),
    buildCalendarEventsKnowledge({ events })
  ];

  const saved = items.map((item) => knowledgeManager.upsertKnowledgeItem(item));

  if (shouldIndex(settings) && typeof knowledgeManager.uploadToPinecone === 'function') {
    for (const item of items) {
      await knowledgeManager.uploadToPinecone(item.id, settings);
    }
  }

  return saved;
}

function shouldIndex(settings = {}) {
  return Boolean(
    settings
    && (settings.userTier === 'pro' || settings.proAgentEnabled || settings.pineconeApiKey || process.env.PINECONE_API_KEY)
    && (settings.pineconeApiKey || process.env.PINECONE_API_KEY)
    && (settings.pineconeHost || process.env.PINECONE_HOST)
  );
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function clean(value) {
  return String(value || '').trim();
}

module.exports = {
  CALENDAR_EVENTS_ID,
  OPPORTUNITIES_STATUS_ID,
  buildCalendarEventsKnowledge,
  buildOpportunitiesStatusKnowledge,
  refreshSystemKnowledge
};
