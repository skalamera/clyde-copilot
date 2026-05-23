const WebSocket = require('ws');
const {
  buildProAgentInstructions,
  buildProAgentUserMessage,
  getProAgentTools
} = require('./proAgentPrompts');
const defaultPineconeClient = require('./pineconeClient');

const DEFAULT_MODEL = 'gpt-realtime-2';
const DEFAULT_TIMEOUT_MS = 30000;

function createProRealtimeAgent(options = {}) {
  const WebSocketImpl = options.WebSocketImpl || WebSocket;
  const settings = options.settings || {};
  const knowledgeManager = options.knowledgeManager;
  const pineconeClient = options.pineconeClient || defaultPineconeClient;
  const logger = options.logger || console;
  const sendStatus = options.sendStatus || (() => {});
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const eagerToolOutputs = Boolean(options.eagerToolOutputs || WebSocketImpl !== WebSocket);
  const openReadyState = WebSocketImpl.OPEN ?? WebSocket.OPEN ?? 1;
  let socket = null;
  let connectPromise = null;
  let activeRun = null;
  let intentionallyClosing = false;
  let nextRunId = 1;

  async function run(payload = {}) {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('OpenAI API key is required for Clyde Pro.');
    }

    if (activeRun) {
      throw new Error('Clyde Pro realtime agent is already generating.');
    }

    const model = getModel();
    const ws = await ensureSocket(apiKey, model);

    return new Promise((resolve, reject) => {
      const runId = `pro-${Date.now()}-${nextRunId++}`;
      const draftCardId = payload.draftCardId || `${runId}-draft`;
      const groupId = payload.groupId || runId;

      activeRun = {
        payload,
        resolve,
        reject,
        toolCalls: 0,
        text: '',
        lastDraftSignature: '',
        lastDraftAt: 0,
        draftCardId,
        groupId,
        timeout: setTimeout(() => {
          finishActiveRunWithError(new Error('Clyde Pro realtime agent timed out.'));
        }, timeoutMs)
      };

      sendJson(ws, {
        type: 'session.update',
        session: buildRealtimeSessionConfig(payload)
      });

      sendJson(ws, {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{
            type: 'input_text',
            text: buildProAgentUserMessage(payload)
          }]
        }
      });

      sendJson(ws, {
        type: 'response.create',
        response: {
          output_modalities: ['text']
        }
      });
    });
  }

  async function warmup(payload = {}) {
    const apiKey = getApiKey();
    if (!apiKey || activeRun) {
      return false;
    }

    const ws = await ensureSocket(apiKey, getModel());
    sendJson(ws, {
      type: 'session.update',
      session: buildRealtimeSessionConfig({ ...payload, command: payload.command || 'assist' })
    });
    return true;
  }

  async function searchMemoryCards(payload = {}) {
    if (payload.allowMemorySearch === false) {
      return { cards: [], results: [], contextText: '', throttled: true };
    }

    sendStatus({ state: 'processing', message: 'Searching memory...' });
    const query = clean(payload.query || payload.targetQuestion || payload.manualPrompt || payload.digest || '');
    const results = await searchMemory(query, payload.context || {}, payload.mode);
    const cards = memoryCardsFromResults(results);

    return {
      cards,
      results,
      contextText: memoryContextFromResults(results)
    };
  }

  function buildRealtimeSessionConfig(payload = {}) {
    const toolsEnabled = payload.toolsEnabled !== false;

    return {
      type: 'realtime',
      instructions: buildProAgentInstructions({
        mode: payload.mode,
        context: payload.context,
        command: payload.command,
        toolsEnabled
      }),
      output_modalities: ['text'],
      reasoning: { effort: payload.reasoningEffort || 'low' },
      tool_choice: toolsEnabled ? 'auto' : 'none',
      tools: toolsEnabled ? getProAgentTools() : []
    };
  }

  function close() {
    intentionallyClosing = true;
    if (activeRun) {
      finishActiveRunWithError(new Error('Clyde Pro realtime agent was closed.'));
    }
    if (socket) {
      safeClose(socket);
    }
    socket = null;
    connectPromise = null;
    intentionallyClosing = false;
  }

  function ensureSocket(apiKey, model) {
    if (socket && socket.readyState === openReadyState) {
      return Promise.resolve(socket);
    }

    if (connectPromise) {
      return connectPromise;
    }

    intentionallyClosing = false;
    socket = new WebSocketImpl(`wss://api.openai.com/v1/realtime?model=${model}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    connectPromise = new Promise((resolve, reject) => {
      let opened = false;

      socket.on('open', () => {
        opened = true;
        resolve(socket);
      });

      socket.on('message', handleSocketMessage);

      socket.on('error', (error) => {
        if (!opened) {
          reject(error);
        }
        finishActiveRunWithError(error);
      });

      socket.on('close', () => {
        if (!opened && !intentionallyClosing) {
          reject(new Error('Clyde Pro realtime agent disconnected before it was ready.'));
        }
        socket = null;
        connectPromise = null;
        if (!intentionallyClosing) {
          finishActiveRunWithError(new Error('Clyde Pro realtime agent disconnected.'));
        }
      });
    });

    return connectPromise;
  }

  function getApiKey() {
    return settings.transcriptionApiKey || (settings.llmProvider === 'openai' ? settings.llmApiKey : '') || settings.openAiApiKey || process.env.OPENAI_API_KEY || '';
  }

  function getModel() {
    return encodeURIComponent(settings.proRealtimeModel || DEFAULT_MODEL);
  }

  function handleSocketMessage(raw) {
    let event;
    try {
      event = JSON.parse(String(raw));
    } catch (error) {
      logger.warn?.('Ignored non-JSON realtime event:', error);
      return;
    }

    if (event.type === 'error') {
      finishActiveRunWithError(new Error(event.error?.message || 'Clyde Pro realtime agent returned an error.'));
      return;
    }

    const delta = extractRealtimeDelta(event);
    if (delta && activeRun) {
      activeRun.text += delta;
      emitDraft(activeRun);
      return;
    }

    if (event.type === 'response.done') {
      handleResponseDone(event).catch(finishActiveRunWithError);
    }
  }

  async function handleResponseDone(event) {
    if (!activeRun || !socket) {
      return;
    }

    const run = activeRun;
    const output = Array.isArray(event.response?.output) ? event.response.output : [];
    const functionCalls = output.filter((item) => item?.type === 'function_call' && item.name);

    if (functionCalls.length) {
      for (const call of functionCalls) {
        run.toolCalls += 1;
        if (eagerToolOutputs) {
          executeToolCall(call, run.payload).catch(finishActiveRunWithError);
          sendJson(socket, {
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: call.call_id || call.id,
              output: JSON.stringify({ pending: true })
            }
          });
          continue;
        }

        const result = await executeToolCall(call, run.payload);
        sendJson(socket, {
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: call.call_id || call.id,
            output: JSON.stringify(result)
          }
        });
      }

      run.text = '';
      sendJson(socket, {
        type: 'response.create',
        response: {
          output_modalities: ['text']
        }
      });
      return;
    }

    const text = extractRealtimeText(output) || run.text;
    const cards = parseAgentCards(text);
    finishActiveRun({
      ok: true,
      text,
      cards,
      toolCalls: run.toolCalls,
      draftCardId: run.draftCardId,
      groupId: run.groupId
    });
  }

  function finishActiveRun(result) {
    if (!activeRun) {
      return;
    }

    const run = activeRun;
    activeRun = null;
    clearTimeout(run.timeout);
    run.resolve(result);
  }

  function finishActiveRunWithError(error) {
    if (!activeRun) {
      return;
    }

    const run = activeRun;
    activeRun = null;
    clearTimeout(run.timeout);
    run.reject(error);
  }

  function emitDraft(run) {
    if (typeof run.payload.onDraft !== 'function') {
      return;
    }

    const now = Date.now();
    if (now - run.lastDraftAt < 180) {
      return;
    }

    const card = parseDraftAgentCard(run.text, run.payload, run.draftCardId);
    if (!card) {
      return;
    }

    const signature = assistantDraftSignature(card);
    if (signature === run.lastDraftSignature) {
      return;
    }

    run.lastDraftAt = now;
    run.lastDraftSignature = signature;
    run.payload.onDraft({
      text: run.text,
      cards: [card],
      replaceCardId: run.draftCardId,
      groupId: run.groupId,
      draftCardId: run.draftCardId
    });
  }

  async function executeToolCall(call, payload = {}) {
    let args = {};
    try {
      args = call.arguments ? JSON.parse(call.arguments) : {};
    } catch (error) {
      throw new Error(`Invalid tool arguments for ${call.name}: ${error.message}`);
    }

    if (call.name === 'searchPastMeetings') {
      if (payload.allowMemorySearch === false) {
        return { results: [], throttled: true };
      }

      sendStatus({ state: 'processing', message: 'Searching memory...' });
      const query = clean(args.query || payload.digest || '');
      const results = await searchMemory(query, payload.context || {}, payload.mode);
      return { results };
    }

    if (call.name === 'retrievePinnedDocument') {
      const docName = clean(args.docName).toLowerCase();
      const pinned = [
        ...getPinnedKnowledge(),
        ...entityFilesFromContext(payload.context)
      ];
      const match = pinned.find((item) => {
        const filename = clean(item.filename).toLowerCase();
        const title = clean(item.metadata?.title).toLowerCase();
        return filename === docName || title === docName || filename.includes(docName);
      }) || pinned[0];

      return match
        ? {
            id: match.id,
            filename: match.filename,
            content: match.content
          }
        : { content: '' };
    }

    throw new Error(`Unknown Clyde Pro tool: ${call.name}`);
  }

  async function searchMemory(query, context = {}, mode = 'interview') {
    if (!query) {
      return [];
    }

    if (
      pineconeClient
      && typeof pineconeClient.searchKnowledgeVectors === 'function'
      && (settings.pineconeApiKey || process.env.PINECONE_API_KEY)
      && (settings.pineconeHost || process.env.PINECONE_HOST)
    ) {
      const filter = buildContextFilter(context, mode);
      const matches = await pineconeClient.searchKnowledgeVectors(query, settings, {
        topK: 5,
        ...(filter ? { filter } : {})
      });
      return matches.map((match) => ({
        text: match.text,
        source: match.source,
        knowledgeId: match.knowledgeId,
        score: match.score
      }));
    }

    if (knowledgeManager && typeof knowledgeManager.listKnowledge === 'function') {
      return knowledgeManager.listKnowledge({ query }).slice(0, 5).map((item) => ({
        text: item.content,
        source: item.filename,
        knowledgeId: item.id
      }));
    }

    return [];
  }

  function getPinnedKnowledge() {
    if (!knowledgeManager || typeof knowledgeManager.getPinnedKnowledge !== 'function') {
      return [];
    }

    return knowledgeManager.getPinnedKnowledge(settings.pinnedKnowledgeIds || []);
  }

  function entityFilesFromContext(context = {}) {
    return (Array.isArray(context.entityFiles) ? context.entityFiles : []).map((item) => ({
      id: item.id,
      filename: item.filename,
      content: item.content,
      metadata: item.metadata || {}
    }));
  }

  function buildContextFilter(context = {}, mode = 'interview') {
    const entityId = clean(context.entityId || context.activeEntityId || context.company || context.meetingTitle || '');
    if (!entityId) {
      return null;
    }

    return {
      mode: { $eq: mode === 'meeting' ? 'meeting' : 'interview' },
      entityId: { $eq: entityId }
    };
  }

  return {
    run,
    warmup,
    searchMemoryCards,
    close
  };
}

function sendJson(ws, payload) {
  ws.send(JSON.stringify(payload));
}

function safeClose(ws) {
  try {
    ws.close?.();
  } catch (_error) {}
}

function extractRealtimeText(output = []) {
  for (const item of output) {
    if (item?.type !== 'message') {
      continue;
    }

    const content = Array.isArray(item.content) ? item.content : [];
    const text = content
      .map((part) => part?.text || part?.transcript || '')
      .filter(Boolean)
      .join('\n')
      .trim();

    if (text) {
      return text;
    }
  }

  return '';
}

function extractRealtimeDelta(event = {}) {
  if (
    event.type === 'response.output_text.delta'
    || event.type === 'response.text.delta'
    || event.type === 'response.audio_transcript.delta'
  ) {
    return String(event.delta || '');
  }

  if (event.type === 'response.content_part.delta') {
    return String(event.delta?.text || event.delta?.transcript || event.part?.text || '');
  }

  return '';
}

function parseDraftAgentCard(text, payload = {}, draftCardId = '') {
  const parsedCards = parseAgentCards(text).filter((card) => card.type === 'answer' || card.type === 'suggestion');
  if (parsedCards.length) {
    return {
      ...parsedCards[0],
      id: draftCardId,
      title: 'Draft answer',
      draft: true,
      agentic: true
    };
  }

  const question = extractJsonStringValue(text, 'question') || clean(payload.targetQuestion);
  const bullets = extractJsonArrayStrings(text, 'bullets').slice(0, 4);
  const body = extractJsonStringValue(text, 'answer') || extractJsonStringValue(text, 'text') || extractJsonStringValue(text, 'body');

  if (!body && !bullets.length) {
    return null;
  }

  return {
    id: draftCardId,
    type: 'answer',
    title: 'Draft answer',
    question,
    body,
    bullets,
    draft: true,
    agentic: true
  };
}

function extractJsonStringValue(text = '', key = '') {
  const pattern = new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`);
  const match = String(text || '').match(pattern);
  return match ? clean(unescapeJsonString(match[1])) : '';
}

function extractJsonArrayStrings(text = '', key = '') {
  const pattern = new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*\\[([\\s\\S]*)`);
  const match = String(text || '').match(pattern);
  if (!match) {
    return [];
  }

  const arrayText = match[1].split(']')[0] || '';
  const values = [];
  const valuePattern = /"((?:\\.|[^"\\])*)"/g;
  let valueMatch;
  while ((valueMatch = valuePattern.exec(arrayText))) {
    const value = clean(unescapeJsonString(valueMatch[1]));
    if (value) {
      values.push(value);
    }
  }
  return values;
}

function unescapeJsonString(value = '') {
  try {
    return JSON.parse(`"${value}"`);
  } catch (_error) {
    return value.replace(/\\"/g, '"').replace(/\\n/g, '\n');
  }
}

function assistantDraftSignature(card = {}) {
  return [
    card.question || '',
    card.body || '',
    Array.isArray(card.bullets) ? card.bullets.join('|') : ''
  ].join('::');
}

function memoryCardsFromResults(results = []) {
  const seen = new Set();
  const cards = [];

  for (const result of Array.isArray(results) ? results : []) {
    const body = clean(result.text || result.content || '');
    const bullets = summarizeMemoryBullets(body);
    if (!body || !bullets.length) {
      continue;
    }

    const detail = clean(result.source || result.filename || result.knowledgeId || '');
    const key = `${body.toLowerCase()}::${detail.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    cards.push({
      type: 'memory',
      title: 'Memory',
      body: '',
      bullets,
      detail,
      agentic: true,
      score: result.score
    });

    if (cards.length >= 3) {
      break;
    }
  }

  return cards;
}

function summarizeMemoryBullets(text = '') {
  const value = clean(text);
  const bullets = value
    .replace(/\b(?:Interviewer|Candidate)\s*\([^)]*\):/gi, '. ')
    .replace(/\b(?:Interviewer|Candidate):/gi, '. ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => clean(sentence.replace(/^[-*•\s]+/, '')))
    .filter((sentence) => sentence.length >= 24)
    .filter((sentence) => !/^yes[,.]?\s*$/i.test(sentence))
    .slice(0, 3)
    .map((sentence) => shortenSentence(sentence, 150));

  return bullets.length ? bullets : [shortenSentence(value, 150)].filter(Boolean);
}

function shortenSentence(sentence = '', maxLength = 150) {
  const value = clean(sentence);
  if (value.length <= maxLength) {
    return value;
  }
  const truncated = value.slice(0, maxLength + 1);
  const lastSpace = truncated.lastIndexOf(' ');
  return `${clean(truncated.slice(0, lastSpace > 80 ? lastSpace : maxLength))}...`;
}

function memoryContextFromResults(results = []) {
  return (Array.isArray(results) ? results : [])
    .slice(0, 4)
    .map((result, index) => {
      const text = clean(result.text || result.content || '');
      const source = clean(result.source || result.filename || result.knowledgeId || '');
      return text ? `${index + 1}. ${text}${source ? ` (Source: ${source})` : ''}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseAgentCards(text) {
  const parsed = parseJsonObject(text);
  if (!parsed) {
    return [];
  }

  const cards = [];

  for (const item of toArray(parsed.answers)) {
    const question = clean(item.question);
    const bullets = Array.isArray(item.bullets) ? item.bullets.map(clean).filter(Boolean) : [];
    const body = clean(item.text || item.answer || item.body);

    if (question || bullets.length || body) {
      cards.push({
        type: 'answer',
        title: item.title || 'Answer',
        question,
        body,
        bullets,
        id: Buffer.from(question || body || bullets.join(' ')).toString('base64')
      });
    }
  }

  for (const item of toArray(parsed.suggestions)) {
    const body = clean(item.text || item.suggestion || item.body);
    if (body) {
      cards.push({
        type: 'suggestion',
        title: 'Say next',
        body,
        detail: clean(item.why)
      });
    }
  }

  for (const item of toArray(parsed.notes)) {
    const body = clean(item.text || item.note || item.body);
    if (body) {
      cards.push({
        type: 'note',
        title: 'Note',
        body
      });
    }
  }

  for (const item of toArray(parsed.memory_cards)) {
    const fact = clean(item.fact || item.text || item.body);
    if (fact) {
      cards.push({
        type: 'memory',
        title: 'Memory',
        body: fact,
        detail: clean(item.source || item.filename || item.session_title),
        agentic: true
      });
    }
  }

  return cards.slice(0, 4);
}

function parseJsonObject(text) {
  const value = String(text || '').trim();
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    const start = value.indexOf('{');
    const end = value.lastIndexOf('}');
    if (start === -1 || end <= start) {
      return null;
    }

    try {
      return JSON.parse(value.slice(start, end + 1));
    } catch (__error) {
      return null;
    }
  }
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function clean(value) {
  return String(value || '').trim();
}

module.exports = {
  createProRealtimeAgent,
  parseAgentCards
};
