const axios = require('axios');
const { generateChat: defaultGenerateChat } = require('./llmClient');
const defaultPineconeClient = require('./pineconeClient');

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

    const parsed = parseChatResponse(responseText, sessionId);
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
    const action = pendingActions.get(actionId) || payload.pendingAction || payload;
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
      return activeSessionSources(payload).filter((source) => source.text);
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
    } else {
      sources.push(...activeSessionSources(payload));
      sources.push(...pinnedKnowledgeSources(payload.settings));
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
    'For action requests, include a short confirmation label and summary. Do not mutate data yourself.',
    `Sources:\n${sourceText}`,
    `Calendar:\n${eventText}`
  ].join('\n\n');
}

function parseChatResponse(text, sessionId) {
  try {
    const parsed = JSON.parse(cleanJson(text));
    const message = parsed.message || {};
    const pendingAction = normalizePendingAction(parsed.pendingAction);
    return {
      sessionId,
      message: {
        role: 'assistant',
        content: clean(message.content || parsed.content) || 'I could not produce an answer.',
        citations: Array.isArray(message.citations) ? message.citations : []
      },
      pendingAction
    };
  } catch (_error) {
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

function normalizePendingAction(action) {
  if (!action || typeof action !== 'object' || !action.actionType) {
    return null;
  }
  return {
    id: clean(action.id) || `action-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    label: clean(action.label) || 'Confirm action',
    summary: clean(action.summary) || clean(action.label) || 'Confirm this action?',
    actionType: clean(action.actionType),
    payload: action.payload && typeof action.payload === 'object' ? action.payload : {}
  };
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
