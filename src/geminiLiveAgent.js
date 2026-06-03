const WebSocket = require('ws');
const {
  buildProAgentInstructions,
  buildProAgentUserMessage,
  getProAgentTools
} = require('./proAgentPrompts');
const defaultPineconeClient = require('./pineconeClient');

const DEFAULT_MODEL = 'gemini-2.0-flash-exp';
const DEFAULT_TIMEOUT_MS = 30000;

function createGeminiLiveAgent(options = {}) {
  const WebSocketImpl = options.WebSocketImpl || WebSocket;
  const settings = options.settings || {};
  const knowledgeManager = options.knowledgeManager;
  const pineconeClient = options.pineconeClient || defaultPineconeClient;
  const logger = options.logger || console;
  const sendStatus = options.sendStatus || (() => {});
  const sendUpdate = options.sendUpdate || (() => {});
  const debugTrace = typeof options.debugTrace === 'function' ? options.debugTrace : () => {};
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const eagerToolOutputs = Boolean(options.eagerToolOutputs || WebSocketImpl !== WebSocket);
  const openReadyState = WebSocketImpl.OPEN ?? WebSocket.OPEN ?? 1;
  let socket = null;
  let connectPromise = null;
  let activeRun = null;
  let intentionallyClosing = false;
  let nextRunId = 1;
  let responseActive = false;
  let responseDoneResolve = null;
  let activeContext = {};
  let lastConnectAttemptAt = 0;
  const CONNECT_COOLDOWN_MS = 5000;
  let lastSentCardSignature = '';

  function getCardSignature(cards) {
    if (!Array.isArray(cards) || !cards.length) {
      return 'empty';
    }
    return cards.map((c) => `${c.title}|${c.question}|${c.body}|${c.bullets?.join(',')}`).join(';;');
  }

  function setContext(context) {
    activeContext = context || {};
  }

  async function run(payload = {}) {
    activeContext = payload.context || activeContext;
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('Gemini API key is required for Clyde Gemini Live.');
    }

    const model = getModel();
    const ws = await ensureSocket(apiKey, model, true, payload);
    trace('gemini.run.start', {
      model,
      mode: payload.mode,
      command: payload.command,
      digest: payload.digest || '',
      targetQuestion: payload.targetQuestion || '',
      manualPrompt: payload.manualPrompt || '',
      groupId: payload.groupId || '',
      draftCardId: payload.draftCardId || '',
      toolsEnabled: payload.toolsEnabled !== false
    });

    if (activeRun) {
      const prevRun = activeRun;
      activeRun = null;
      clearTimeout(prevRun.timeout);
      prevRun.resolve({ ok: false, skipped: 'interrupted' });
    }

    return new Promise((resolve, reject) => {
      const runId = `gemini-${Date.now()}-${nextRunId++}`;
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
          finishActiveRunWithError(new Error('Clyde Gemini Live agent timed out.'));
        }, timeoutMs)
      };

      const userMessage = buildProAgentUserMessage(payload);
      trace('gemini.user_message', {
        runId,
        groupId,
        draftCardId,
        userMessage
      });

      try {
        sendJson(ws, {
          client_content: {
            turns: [
              {
                role: 'user',
                parts: [
                  {
                    text: userMessage
                  }
                ]
              }
            ],
            turn_complete: true
          }
        });
      } catch (err) {
        finishActiveRunWithError(err);
      }
    });
  }

  async function warmup(payload = {}) {
    const apiKey = getApiKey();
    if (!apiKey || activeRun) {
      return false;
    }

    await ensureSocket(apiKey, getModel(), false);
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

  function appendAudioChunk(base64Data) {
    if (settings.appMode === 'interview') {
      return;
    }

    if (socket && socket.readyState === openReadyState) {
      sendJson(socket, {
        realtime_input: {
          media_chunks: [
            {
              mime_type: 'audio/pcm;rate=16000',
              data: base64Data
            }
          ]
        }
      });
      return;
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      return;
    }

    ensureSocket(apiKey, getModel(), false)
      .then((ws) => {
        if (ws && ws.readyState === openReadyState) {
          sendJson(ws, {
            realtime_input: {
              media_chunks: [
                {
                  mime_type: 'audio/pcm;rate=16000',
                  data: base64Data
                }
              ]
            }
          });
        }
      })
      .catch(() => {
        // Silently catch to avoid log flooding on every chunk
      });
  }

  function close() {
    intentionallyClosing = true;
    lastSentCardSignature = '';
    if (responseDoneResolve) {
      responseDoneResolve();
      responseDoneResolve = null;
    }
    if (activeRun) {
      finishActiveRunWithError(new Error('Clyde Gemini Live agent was closed.'));
    }
    if (socket) {
      safeClose(socket);
    }
    socket = null;
    connectPromise = null;
    intentionallyClosing = false;
  }

  function ensureSocket(apiKey, model, isRun = false, payload = {}) {
    if (socket && socket.readyState === openReadyState) {
      return Promise.resolve(socket);
    }

    if (connectPromise) {
      return connectPromise;
    }

    const now = Date.now();
    if (now - lastConnectAttemptAt < CONNECT_COOLDOWN_MS) {
      return Promise.reject(new Error('Connection attempt in cooldown.'));
    }
    lastConnectAttemptAt = now;

    intentionallyClosing = false;
    logger.info?.(`Clyde Gemini Live agent connecting to model: ${model}...`);
    trace('gemini.socket.connecting', { model });

    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

    socket = new WebSocketImpl(url);

    connectPromise = new Promise((resolve, reject) => {
      let opened = false;

      socket.on('open', () => {
        opened = true;
        logger.info?.('Clyde Gemini Live agent socket successfully connected.');
        trace('gemini.socket.open', { model });

        const setupPayload = isRun ? payload : {
          mode: settings.appMode || 'interview',
          context: activeContext,
          command: 'assist'
        };

        const setupFrame = buildGeminiSetupFrame(model, setupPayload);
        try {
          sendJson(socket, setupFrame);
        } catch (err) {
          logger.error?.('Failed to send Gemini setup frame on socket open:', err);
        }

        resolve(socket);
      });

      socket.on('message', handleSocketMessage);

      socket.on('error', (error) => {
        logger.error?.('Clyde Gemini Live agent socket error:', error);
        trace('gemini.socket.error', { message: error.message || String(error) });
        if (!opened) {
          reject(error);
        }
        finishActiveRunWithError(error);
      });

      socket.on('close', (code, reason) => {
        logger.info?.(`Clyde Gemini Live agent socket closed. Code: ${code}, Reason: ${reason}`);
        trace('gemini.socket.close', { code, reason: String(reason || '') });
        if (!opened && !intentionallyClosing) {
          reject(new Error(`Clyde Gemini Live agent disconnected before it was ready. Code: ${code}`));
        }
        socket = null;
        connectPromise = null;
        if (!intentionallyClosing) {
          finishActiveRunWithError(new Error(`Clyde Gemini Live agent disconnected. Code: ${code}`));
        }
      });
    });

    return connectPromise;
  }

  function buildGeminiSetupFrame(model, payload = {}) {
    const toolsEnabled = payload.toolsEnabled !== false;
    const systemInstructionText = buildProAgentInstructions({
      mode: payload.mode,
      context: payload.context,
      command: payload.command,
      toolsEnabled
    });

    const openaiTools = toolsEnabled ? getProAgentTools() : [];
    const geminiTools = mapToolsToGemini(openaiTools);

    let geminiModelName = model;
    if (!geminiModelName.startsWith('models/')) {
      geminiModelName = `models/${geminiModelName}`;
    }

    const setup = {
      model: geminiModelName,
      generation_config: {
        response_modalities: ['TEXT'],
        system_instruction: {
          parts: [{ text: systemInstructionText }]
        }
      }
    };

    if (geminiTools && geminiTools.length) {
      setup.tools = geminiTools;
    }

    return { setup };
  }

  function mapToolsToGemini(openaiTools) {
    if (!openaiTools || !openaiTools.length) return [];
    const functionDeclarations = openaiTools.map((t) => {
      const fn = t.function || t;
      const mapSchema = (schema) => {
        if (!schema) return schema;
        const mapped = { ...schema };
        if (typeof mapped.type === 'string') {
          mapped.type = mapped.type.toUpperCase();
        }
        if (mapped.properties) {
          mapped.properties = Object.keys(mapped.properties).reduce((acc, k) => {
            acc[k] = mapSchema(mapped.properties[k]);
            return acc;
          }, {});
        }
        if (mapped.items) {
          mapped.items = mapSchema(mapped.items);
        }
        return mapped;
      };
      return {
        name: fn.name,
        description: fn.description,
        parameters: mapSchema(fn.parameters)
      };
    });
    return [{ function_declarations: functionDeclarations }];
  }

  function getApiKey() {
    return settings.geminiApiKey || settings.llmApiKey || settings.transcriptionApiKey || process.env.GEMINI_API_KEY || process.env.GEMINI_LIVE_API_KEY || '';
  }

  function getModel() {
    let rawModel = settings.proRealtimeModel || DEFAULT_MODEL;
    if (rawModel.includes('gpt')) {
      rawModel = DEFAULT_MODEL;
    }
    return rawModel;
  }

  function handleSocketMessage(raw) {
    let event;
    try {
      event = JSON.parse(String(raw));
    } catch (error) {
      logger.warn?.('Ignored non-JSON realtime event:', error);
      return;
    }

    if (event.error) {
      const errMsg = event.error.message || String(event.error);
      trace('gemini.response.error', { message: errMsg });
      finishActiveRunWithError(new Error(errMsg || 'Clyde Gemini Live agent returned an error.'));
      return;
    }

    if (event.tool_call?.function_calls) {
      handleToolCalls(event.tool_call.function_calls).catch(finishActiveRunWithError);
      return;
    }

    let delta = '';
    if (event.server_content?.model_turn?.parts) {
      for (const part of event.server_content.model_turn.parts) {
        if (part.text) {
          delta += part.text;
        }
      }
    }

    if (delta && activeRun) {
      activeRun.text += delta;
      trace('gemini.response.delta', {
        groupId: activeRun.groupId,
        draftCardId: activeRun.draftCardId,
        delta
      });
      emitDraft(activeRun);
    }

    const isTurnComplete = event.server_content?.turn_complete === true || event.turn_complete === true;
    if (isTurnComplete) {
      handleTurnComplete().catch(finishActiveRunWithError);
    }
  }

  async function handleToolCalls(functionCalls) {
    if (!activeRun || !socket) {
      return;
    }

    const run = activeRun;
    const functionResponses = [];

    for (const call of functionCalls) {
      run.toolCalls += 1;
      const result = await executeToolCall({
        name: call.name,
        arguments: call.args ? JSON.stringify(call.args) : '{}',
        call_id: call.id
      }, run.payload);

      functionResponses.push({
        id: call.id,
        response: {
          output: result
        }
      });
    }

    sendJson(socket, {
      tool_response: {
        function_responses: functionResponses
      }
    });

    run.text = '';
  }

  async function handleTurnComplete() {
    if (!activeRun || !socket) {
      return;
    }

    const run = activeRun;
    const text = run.text;
    const cards = parseAgentCards(text);
    const filteredCards = cards.filter((card) => card.type !== 'memory');
    trace('gemini.response.done', {
      groupId: run.groupId,
      draftCardId: run.draftCardId,
      text,
      parsedCards: cards,
      filteredCards
    });

    const payloadMode = run.payload.mode || settings.appMode || 'interview';
    const processedFiltered = payloadMode === 'interview'
      ? condenseProInterviewCards(filteredCards)
      : filteredCards;
    trace('gemini.cards.processed', {
      groupId: run.groupId,
      mode: payloadMode,
      processedCards: processedFiltered,
      rejectedByFormat: filteredCards.length > 0 && processedFiltered.length === 0
    });

    const signature = getCardSignature(processedFiltered);

    if (run.groupId.startsWith('pro-vad-')) {
      if (signature !== 'empty' && signature === lastSentCardSignature) {
        logger.info?.('Ignoring duplicate VAD suggestion card.');
        finishActiveRun({
          ok: true,
          text,
          cards: [
            ...processedFiltered,
            ...cards.filter((card) => card.type === 'memory')
          ],
          toolCalls: run.toolCalls,
          draftCardId: run.draftCardId,
          groupId: run.groupId
        });
        return;
      }
      if (signature !== 'empty') {
        lastSentCardSignature = signature;
      }

      sendUpdate({
        title: 'Live help',
        text,
        cards: processedFiltered,
        replaceCardId: run.draftCardId,
        groupId: run.groupId
      });
    }

    finishActiveRun({
      ok: true,
      text,
      cards: [
        ...processedFiltered,
        ...cards.filter((card) => card.type === 'memory')
      ],
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
      trace('gemini.draft.rejected', {
        groupId: run.groupId,
        draftCardId: run.draftCardId,
        text: run.text
      });
      return;
    }

    const signature = assistantDraftSignature(card);
    if (signature === run.lastDraftSignature) {
      return;
    }

    run.lastDraftAt = now;
    run.lastDraftSignature = signature;
    trace('gemini.draft.emit', {
      groupId: run.groupId,
      draftCardId: run.draftCardId,
      card
    });
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
      trace('gemini.tool.searchPastMeetings', { query, mode: payload.mode });
      const results = await searchMemory(query, payload.context || {}, payload.mode);
      trace('gemini.tool.searchPastMeetings.result', { query, count: results.length, results });
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

    throw new Error(`Unknown Clyde Gemini Live tool: ${call.name}`);
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

    const activeMode = mode === 'meeting' ? 'meeting' : 'interview';
    return {
      $or: [
        {
          mode: { $eq: activeMode },
          entityId: { $eq: entityId }
        },
        {
          entityId: { $in: ['', 'general'] }
        }
      ]
    };
  }

  function trace(event, data = {}) {
    debugTrace(event, data);
  }

  return {
    run,
    warmup,
    searchMemoryCards,
    appendAudioChunk,
    setContext,
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

function parseDraftAgentCard(text, payload = {}, draftCardId = '') {
  const parsedCards = parseAgentCards(text).filter((card) => card.type === 'answer' || card.type === 'suggestion');
  if (parsedCards.length) {
    const normalized = (payload.mode || 'interview') === 'interview'
      ? condenseProInterviewCards(parsedCards)[0]
      : parsedCards[0];
    if (!normalized) {
      return null;
    }

    return {
      ...normalized,
      id: draftCardId,
      title: 'Draft answer',
      draft: true,
      agentic: true
    };
  }

  const question = extractJsonStringValue(text, 'question') || clean(payload.targetQuestion);
  const bullets = extractJsonArrayStrings(text, 'bullets').slice(0, 3);
  const body = extractJsonStringValue(text, 'answer') || extractJsonStringValue(text, 'text') || extractJsonStringValue(text, 'body');

  if ((payload.mode || 'interview') === 'interview' && (!question || bullets.length !== 3)) {
    return null;
  }

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
    const context = clean(item.question || item.context || item.referenced_transcript || '');
    const bullets = Array.isArray(item.bullets) ? item.bullets.map(clean).filter(Boolean) : [body].filter(Boolean);
    if (context || bullets.length) {
      cards.push({
        type: 'suggestion',
        title: 'Say next',
        question: context,
        bullets,
        id: Buffer.from(context || bullets.join(' ')).toString('base64')
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

function condenseProInterviewCards(cards) {
  if (!cards.length) {
    return [];
  }

  const firstWithQuestion = cards.find((c) => c.question) || cards[0];
  const question = firstWithQuestion.question || '';

  const bullets = cards
    .flatMap((card) => {
      if (Array.isArray(card.bullets) && card.bullets.length) {
        return card.bullets;
      }
      return [card.body, card.detail];
    })
    .map((b) => String(b || '').trim())
    .filter(Boolean)
    .slice(0, 3);

  if (!question || bullets.length !== 3) {
    return [];
  }

  return [{
    id: Buffer.from(question || bullets.join(' ')).toString('base64'),
    type: 'answer',
    title: 'Say next',
    question,
    body: '',
    detail: '',
    bullets,
    agentic: true
  }];
}

module.exports = {
  createGeminiLiveAgent,
  parseAgentCards
};
