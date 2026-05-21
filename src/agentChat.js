const axios = require('axios');
const { generateChat: defaultGenerateChat } = require('./llmClient');
const defaultPineconeClient = require('./pineconeClient');
const {
  CALENDAR_EVENTS_ID,
  OPPORTUNITIES_STATUS_ID
} = require('./systemKnowledge');

const MAX_HISTORY_MESSAGES = 8;

function createAgentChat(options = {}) {
  const settings = options.settings || {};
  const knowledgeManager = options.knowledgeManager;
  const sessionManager = options.sessionManager;
  const calendarStore = options.calendarStore;
  const actionRegistry = options.actionRegistry;
  const pineconeClient = options.pineconeClient || defaultPineconeClient;
  const generateChat = options.generateChat || defaultGenerateChat;
  const axiosClient = options.axiosClient || axios;
  const histories = new Map();
  const pendingActions = new Map();

  async function sendMessage(payload = {}) {
    const sessionId = clean(payload.sessionId) || `chat-${Date.now()}`;
    const messageText = clean(payload.message);
    if (!messageText) {
      return {
        sessionId,
        message: { role: 'assistant', content: 'Ask Clyde a question first.', citations: [] },
        pendingAction: null
      };
    }

    const effectiveSettings = { ...settings, ...(payload.settings || {}) };
    const sources = await retrieveSources({ ...payload, message: messageText, settings: effectiveSettings });
    const history = histories.get(sessionId) || [];
    const responseText = await generateChat({
      provider: effectiveSettings.llmProvider || 'local',
      apiKey: effectiveSettings.llmApiKey || '',
      model: effectiveSettings.llmModel || '',
      temperature: 0.2,
      maxTokens: 1200,
      axiosClient,
      localUrl: effectiveSettings.localLlmUrl,
      jsonSchema: chatJsonSchema(),
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt({ sources, mode: payload.mode, calendarEvents: calendarStore?.listEvents?.() || [] })
        },
        ...history,
        { role: 'user', content: messageText }
      ]
    });

    const parsed = parseChatResponse(responseText, sessionId, messageText);
    const nextHistory = [
      ...history,
      { role: 'user', content: messageText },
      { role: 'assistant', content: parsed.message.content }
    ].slice(-MAX_HISTORY_MESSAGES);
    histories.set(sessionId, nextHistory);

    if (parsed.pendingAction) {
      pendingActions.set(parsed.pendingAction.id, parsed.pendingAction);
    }

    return parsed;
  }

  async function confirmAction(payload = {}) {
    const actionId = clean(payload.actionId || payload.id);
    const action = payload.pendingAction || pendingActions.get(actionId) || payload;
    if (!action || !action.actionType) {
      return { ok: false, changed: false, message: 'No pending action found.' };
    }
    const result = actionRegistry?.confirmAction
      ? await actionRegistry.confirmAction(action)
      : { ok: false, changed: false, message: 'Agent actions are unavailable.' };
    if (result.ok || payload.decline) {
      pendingActions.delete(actionId);
    }
    return result;
  }

  function startChat(payload = {}) {
    const sessionId = clean(payload.sessionId) || `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    if (!histories.has(sessionId)) {
      histories.set(sessionId, []);
    }
    return { sessionId, messages: histories.get(sessionId) };
  }

  async function listSources(filters = {}) {
    const query = clean(filters.query);
    const tier = filters.tier || filters.settings?.userTier || settings.userTier || 'free';
    if (!sessionManager?.getSessions) {
      return [];
    }

    const sessionFilters = tier === 'pro'
      ? [{ mode: 'interview' }, { mode: 'meeting' }]
      : [{ mode: filters.mode === 'meeting' ? 'meeting' : 'interview', entityId: filters.activeEntityId || filters.entityId || '' }];
    const sessions = sessionFilters.flatMap((filter) => sessionManager.getSessions(filter));
    const normalizedQuery = query.toLowerCase();

    return uniqueSources(sessions.map((session) => ({
          id: sessionSourceId(session),
          label: sessionSourceLabel(session),
          type: 'session',
          metadata: {
            mode: session.mode,
            entityId: session.entity?.id,
            sessionId: session.id
          }
        })))
      .filter((source) => (
        !normalizedQuery
        || source.label.toLowerCase().includes(normalizedQuery)
      ))
      .slice(0, 80);
  }

  async function retrieveSources(payload = {}) {
    const selectedSourceIds = Array.isArray(payload.selectedSourceIds) ? payload.selectedSourceIds.filter(Boolean) : [];
    const tier = payload.tier || payload.settings?.userTier || settings.userTier || 'free';
    const sources = [];

    if (tier !== 'pro') {
      return [
        ...activeSessionSources(payload),
        ...activeEntityKnowledgeSources(payload)
      ].filter((source) => source.text);
    }

    if (payload.sourceMode === 'selected') {
      for (const id of selectedSourceIds) {
        const session = findSessionBySourceId(id);
        if (session) {
          sources.push(sourceFromSession(session));
        }
      }
    } else if (payload.sourceMode === 'all') {
      sources.push(...allSessionSources());
      sources.push(...pinnedKnowledgeSources(payload.settings));
      sources.push(...systemKnowledgeSources());
    } else {
      sources.push(...activeSessionSources(payload));
      sources.push(...activeEntityKnowledgeSources(payload));
      sources.push(...pinnedKnowledgeSources(payload.settings));
      sources.push(...systemKnowledgeSources());
    }

    if (tier === 'pro' && canSearchPinecone(payload.settings)) {
      const matches = await pineconeClient.searchKnowledgeVectors(payload.message, payload.settings, { topK: 5 });
      for (const match of matches) {
        sources.push({
          id: match.knowledgeId || match.source || `pinecone-${sources.length}`,
          label: match.source || 'Pinecone result',
          text: match.text || '',
          type: 'pinecone'
        });
      }
    }

    return uniqueSources(sources).filter((source) => source.text).slice(0, 40);
  }

  function activeSessionSources(payload = {}) {
    if (!sessionManager?.getSessions) {
      return [];
    }
    const mode = payload.mode === 'meeting' ? 'meeting' : 'interview';
    return sessionManager.getSessions({ mode, entityId: payload.activeEntityId || '' }).map(sourceFromSession);
  }

  function activeEntityKnowledgeSources(payload = {}) {
    if (!knowledgeManager?.listEntityKnowledge || !payload.activeEntityId) {
      return [];
    }
    const mode = payload.mode === 'meeting' ? 'meeting' : 'interview';
    return knowledgeManager.listEntityKnowledge({ mode, entityId: payload.activeEntityId })
      .map((item) => ({
        ...sourceFromKnowledge(item),
        id: `entity-file:${item.id}`,
        type: 'entity-file'
      }));
  }

  function allSessionSources() {
    if (!sessionManager?.getSessions) {
      return [];
    }
    return [
      ...sessionManager.getSessions({ mode: 'interview' }),
      ...sessionManager.getSessions({ mode: 'meeting' })
    ].map(sourceFromSession);
  }

  function pinnedKnowledgeSources(effectiveSettings = {}) {
    if (!knowledgeManager?.getKnowledgeItem) {
      return [];
    }
    const pinnedIds = Array.isArray(effectiveSettings.pinnedKnowledgeIds) ? effectiveSettings.pinnedKnowledgeIds : [];
    return pinnedIds
      .map((id) => knowledgeManager.getKnowledgeItem(id))
      .filter(Boolean)
      .map(sourceFromKnowledge);
  }

  function systemKnowledgeSources() {
    if (!knowledgeManager?.getKnowledgeItem) {
      return [];
    }
    return [OPPORTUNITIES_STATUS_ID, CALENDAR_EVENTS_ID]
      .map((id) => knowledgeManager.getKnowledgeItem(id))
      .filter(Boolean)
      .map(sourceFromKnowledge);
  }

  function findSessionBySourceId(id) {
    const parts = clean(id).split(':');
    if (parts[0] !== 'session' || parts.length < 4 || !sessionManager?.getSessions) {
      return null;
    }
    const [, mode, entityId, sessionId] = parts;
    return sessionManager.getSessions({ mode, entityId }).find((session) => session.id === sessionId) || null;
  }

  return {
    confirmAction,
    listSources,
    sendMessage,
    startChat
  };
}

function buildSystemPrompt({ sources = [], mode = 'interview', calendarEvents = [] } = {}) {
  const sourceText = sources.length
    ? sources.map((source, index) => `[${index + 1}] ${source.label}\n${source.text}`).join('\n\n')
    : 'No sources found.';
  const eventText = calendarEvents.length
    ? calendarEvents.slice(0, 10).map((event) => `${event.id}: ${event.title} at ${event.date}`).join('\n')
    : 'No calendar events.';

  return [
    `You are Clyde, an agentic ${mode === 'meeting' ? 'meeting' : 'interview'} assistant.`,
    'Answer from the provided sources when possible. Keep answers concise and cite sources by id when used.',
    'If the user asks to change app data, return a pendingAction instead of saying you completed it.',
    'Supported actionType values: updateOpportunity, createOpportunity, deleteOpportunity, createMeeting, updateMeeting, deleteMeeting, saveCalendarEvent, deleteCalendarEvent, deleteSession, setActiveContext.',
    'Canonical updateOpportunity payload: { "entityName": "Sage", "entityId": "sage", "outcome": "advanced", "role": "Staff TechOps Manager" }.',
    'Canonical saveCalendarEvent payload: { "title": "Google interview", "date": "2026-05-26T15:00:00-04:00", "entityName": "Google", "entityId": "google", "mode": "interview" }.',
    'Canonical deleteCalendarEvent payload: { "id": "evt-123", "title": "Etsy interview", "date": "2026-05-26", "entityName": "Etsy" }.',
    'If the user asks to add or schedule an interview, use saveCalendarEvent with mode "interview". If the user asks to add or schedule a meeting with a date, use saveCalendarEvent with mode "meeting".',
    'Calendar action dates may come from natural user wording such as "tomorrow", "next Tuesday", or "5/27"; preserve the user intent in the payload if a full ISO date is not certain.',
    'Map phrases such as "not moving forward" to rejected and "move forward" or "advanced" to advanced.',
    'For action requests, include a short confirmation label and summary. Do not mutate data yourself.',
    `Sources:\n${sourceText}`,
    `Calendar:\n${eventText}`
  ].join('\n\n');
}

function parseChatResponse(text, sessionId, userMessage = '') {
  try {
    const parsed = JSON.parse(cleanJson(text));
    const message = parsed.message || {};
    const pendingAction = normalizePendingAction(parsed.pendingAction, userMessage);
    const messageContent = pendingAction
      ? buildPendingActionMessage(pendingAction)
      : clean(message.content || parsed.content) || 'I could not produce an answer.';
    return {
      sessionId,
      message: {
        role: 'assistant',
        content: messageContent,
        citations: Array.isArray(message.citations) ? message.citations : []
      },
      pendingAction
    };
  } catch (_error) {
    if (process?.env?.CLYDE_DEBUG_CHAT_PARSE === '1') {
      console.error(_error);
    }
    return {
      sessionId,
      message: {
        role: 'assistant',
        content: 'Clyde could not parse the model response. Try again with a shorter request.',
        citations: []
      },
      pendingAction: null
    };
  }
}

function normalizePendingAction(action, userMessage = '') {
  if (!action || typeof action !== 'object' || !action.actionType) {
    return null;
  }
  const payload = action.payload && typeof action.payload === 'object' ? action.payload : {};
  const normalizedPayload = {
    ...payload,
    originalUserMessage: clean(payload.originalUserMessage || action.originalUserMessage || userMessage)
  };
  const generatedLabel = buildPendingActionLabel(action.actionType, normalizedPayload);
  const generatedSummary = buildPendingActionSummary(action.actionType, normalizedPayload);
  return {
    id: clean(action.id) || `action-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    label: clean(action.label) || generatedLabel,
    summary: generatedSummary || clean(action.summary) || clean(action.label) || 'Confirm this action?',
    actionType: clean(action.actionType),
    originalUserMessage: normalizedPayload.originalUserMessage,
    payload: normalizedPayload
  };
}

function buildPendingActionMessage(action = {}) {
  const summary = clean(buildPendingActionSummary(action.actionType, action.payload || {}));
  if (!summary || /^confirm this action\.?$/i.test(summary)) {
    return 'Review the action below to confirm.';
  }
  const normalized = summary.replace(/^I can\s+/i, '').replace(/\.$/, '');
  const sentence = normalized.charAt(0).toLowerCase() + normalized.slice(1);
  return `I can ${sentence}. Review the action below to confirm.`;
}

function buildPendingActionLabel(actionType, payload = {}) {
  const type = clean(actionType);
  const mode = normalizeCalendarMode(payload.mode, payload.originalUserMessage);
  if (type === 'saveCalendarEvent' || type === 'createMeeting' || type === 'updateMeeting') {
    return mode === 'meeting' ? 'Schedule meeting' : mode === 'generic' ? 'Schedule event' : 'Schedule interview';
  }
  if (type === 'updateOpportunity') {
    return 'Update opportunity';
  }
  if (type === 'createOpportunity') {
    return 'Create opportunity';
  }
  if (type === 'deleteOpportunity') {
    return 'Delete opportunity';
  }
  if (type === 'deleteMeeting' || type === 'deleteCalendarEvent') {
    return 'Delete event';
  }
  if (type === 'setActiveContext') {
    return 'Set active context';
  }
  return 'Confirm action';
}

function buildPendingActionSummary(actionType, payload = {}) {
  const type = clean(actionType);
  const entityName = resolvePendingActionEntityName(payload);
  const dateText = formatConversationDateTime(payload.date || payload.start || payload.startTime);
  const mode = normalizeCalendarMode(payload.mode, payload.originalUserMessage);

  if (type === 'saveCalendarEvent' || type === 'createMeeting' || type === 'updateMeeting') {
    const subject = mode === 'meeting'
      ? 'meeting'
      : mode === 'generic'
        ? 'calendar event'
        : 'interview';
    const target = entityName ? ` with ${entityName}` : '';
    const scheduleText = dateText ? ` for ${dateText}` : '';
    return `Schedule ${subject}${target}${scheduleText}`;
  }

  if (type === 'updateOpportunity') {
    const outcome = clean(payload.outcome);
    const target = entityName ? `${entityName} ` : '';
    return outcome ? `Update ${target}to ${outcome}`.replace(/\s+/g, ' ').trim() : `Update ${target}opportunity`.replace(/\s+/g, ' ').trim();
  }

  if (type === 'createOpportunity') {
    return entityName ? `Create opportunity for ${entityName}` : 'Create opportunity';
  }

  if (type === 'deleteOpportunity') {
    return entityName ? `Delete opportunity for ${entityName}` : 'Delete opportunity';
  }

  if (type === 'deleteMeeting' || type === 'deleteCalendarEvent') {
    const target = entityName ? ` for ${entityName}` : '';
    const when = dateText ? ` on ${dateText}` : '';
    return `Delete event${target}${when}`;
  }

  if (type === 'setActiveContext') {
    return mode === 'meeting'
      ? `Set active meeting to ${entityName || clean(payload.meetingTitle || payload.name || 'selected meeting')}`
      : `Set active interview to ${entityName || clean(payload.company || payload.name || 'selected opportunity')}`;
  }

  return clean(payload.summary || payload.label || 'Confirm this action');
}

function resolvePendingActionEntityName(payload = {}) {
  return clean(
    payload.entityName
    || payload.entityId
    || payload.company
    || payload.meetingName
    || payload.meetingTitle
    || extractEntityFromRequest(payload.originalUserMessage)
  );
}

function extractEntityFromRequest(text) {
  const value = clean(text);
  if (!value) {
    return '';
  }
  const patterns = [
    /\b(?:of|for|with|about)\s+(?:the\s+|a\s+|an\s+)?(.+?)(?:\s+(?:opportunity|meeting|interview|event)\b|$)/i,
    /\b(?:change|update|delete|schedule|create)\s+(?:the\s+)?(.+?)(?:\s+(?:opportunity|meeting|interview|event)\b|$)/i
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match && clean(match[1])) {
      return clean(match[1]).replace(/\s+(?:to|for|with|on)\s+.*$/i, '');
    }
  }
  return '';
}

function normalizeCalendarMode(value, text = '') {
  const explicit = clean(value).toLowerCase();
  if (explicit === 'meeting') {
    return 'meeting';
  }
  if (explicit === 'interview') {
    return 'interview';
  }
  if (explicit === 'generic') {
    return 'generic';
  }
  const normalized = clean(text).toLowerCase();
  if (/\bmeeting\b/.test(normalized)) {
    return 'meeting';
  }
  if (/\binterview\b/.test(normalized)) {
    return 'interview';
  }
  return 'interview';
}

function formatConversationDateTime(rawDate) {
  const value = clean(rawDate);
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const datePart = new Intl.DateTimeFormat([], {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
  const timePart = new Intl.DateTimeFormat([], {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
  return `${datePart} at ${timePart}`;
}

function chatJsonSchema() {
  return {
    name: 'agent_chat_response',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'object',
          properties: {
            content: { type: 'string' },
            citations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  sourceId: { type: 'string' },
                  label: { type: 'string' }
                },
                required: ['sourceId', 'label'],
                additionalProperties: false
              }
            }
          },
          required: ['content', 'citations'],
          additionalProperties: false
        },
        pendingAction: {
          anyOf: [
            { type: 'null' },
            {
              type: 'object',
              properties: {
                id: { type: 'string' },
                label: { type: 'string' },
                summary: { type: 'string' },
                actionType: { type: 'string' },
                payload: { type: 'object', additionalProperties: true }
              },
              required: ['label', 'summary', 'actionType', 'payload'],
              additionalProperties: false
            }
          ]
        }
      },
      required: ['message', 'pendingAction'],
      additionalProperties: false
    }
  };
}

function sourceFromKnowledge(item = {}) {
  return {
    id: item.id,
    label: item.filename || item.id,
    text: item.content || '',
    type: item.type || 'knowledge'
  };
}

function sourceFromSession(session = {}) {
  return {
    id: sessionSourceId(session),
    label: sessionSourceLabel(session),
    text: [
      session.notes?.summary ? `Summary: ${session.notes.summary}` : '',
      Array.isArray(session.transcript)
        ? session.transcript.map((turn) => `${turn.speaker || 'Unknown'}: ${turn.text || ''}`).join('\n')
        : ''
    ].filter(Boolean).join('\n\n'),
    type: 'session'
  };
}

function sessionSourceLabel(session = {}) {
  const modeLabel = session.mode === 'meeting' ? 'Meeting' : 'Interview';
  const entityName = clean(session.entity?.name || session.entity?.id);
  const sessionTitle = clean(session.title || session.phase);
  return [modeLabel, entityName, sessionTitle].filter(Boolean).join(' / ') || 'Session';
}

function sessionSourceId(session = {}) {
  return `session:${session.mode || 'interview'}:${session.entity?.id || session.entity?.name || 'general'}:${session.id}`;
}

function uniqueSources(sources = []) {
  const seen = new Set();
  const unique = [];
  for (const source of sources) {
    const id = clean(source?.id);
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    unique.push(source);
  }
  return unique;
}

function canSearchPinecone(settings = {}) {
  return Boolean(
    settings
    && (settings.pineconeApiKey || process.env.PINECONE_API_KEY)
    && (settings.pineconeHost || process.env.PINECONE_HOST)
  );
}

function cleanJson(text) {
  return clean(text).replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
}

function clean(value) {
  return String(value || '').trim();
}

module.exports = {
  buildSystemPrompt,
  createAgentChat,
  parseChatResponse
};
