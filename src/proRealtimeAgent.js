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

  async function run(payload = {}) {
    const apiKey = settings.transcriptionApiKey || (settings.llmProvider === 'openai' ? settings.llmApiKey : '') || settings.openAiApiKey || process.env.OPENAI_API_KEY || '';
    if (!apiKey) {
      throw new Error('OpenAI API key is required for Clyde Pro.');
    }

    const model = encodeURIComponent(settings.proRealtimeModel || DEFAULT_MODEL);
    const ws = new WebSocketImpl(`wss://api.openai.com/v1/realtime?model=${model}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    return new Promise((resolve, reject) => {
      let settled = false;
      let toolCalls = 0;
      const timeout = setTimeout(() => {
        finishWithError(new Error('Clyde Pro realtime agent timed out.'));
      }, timeoutMs);

      function finish(result) {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);
        safeClose(ws);
        resolve(result);
      }

      function finishWithError(error) {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);
        safeClose(ws);
        reject(error);
      }

      ws.on('open', () => {
        sendJson(ws, {
          type: 'session.update',
          session: {
            type: 'realtime',
            instructions: buildProAgentInstructions({
              mode: payload.mode,
              context: payload.context,
              command: payload.command
            }),
              output_modalities: ['text'],
            tool_choice: 'auto',
            tools: getProAgentTools()
          }
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

      ws.on('message', (raw) => {
        let event;
        try {
          event = JSON.parse(String(raw));
        } catch (error) {
          logger.warn?.('Ignored non-JSON realtime event:', error);
          return;
        }

        if (event.type === 'error') {
          finishWithError(new Error(event.error?.message || 'Clyde Pro realtime agent returned an error.'));
          return;
        }

        if (event.type === 'response.done') {
          handleResponseDone(event).catch(finishWithError);
        }
      });

      ws.on('error', (error) => {
        finishWithError(error);
      });

      async function handleResponseDone(event) {
        const output = Array.isArray(event.response?.output) ? event.response.output : [];
        const functionCalls = output.filter((item) => item?.type === 'function_call' && item.name);

        if (functionCalls.length) {
          for (const call of functionCalls) {
            toolCalls += 1;
            if (eagerToolOutputs) {
              executeToolCall(call, payload).catch(finishWithError);
              sendJson(ws, {
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: call.call_id || call.id,
                  output: JSON.stringify({ pending: true })
                }
              });
              continue;
            }

            const result = await executeToolCall(call, payload);
            sendJson(ws, {
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: call.call_id || call.id,
                output: JSON.stringify(result)
              }
            });
          }

          sendJson(ws, {
            type: 'response.create',
            response: {
              output_modalities: ['text']
            }
          });
          return;
        }

        const text = extractRealtimeText(output);
        const cards = parseAgentCards(text);
        finish({
          ok: true,
          text,
          cards,
          toolCalls
        });
      }
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
      const results = await searchMemory(query);
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

  async function searchMemory(query) {
    if (!query) {
      return [];
    }

    if (
      pineconeClient
      && typeof pineconeClient.searchKnowledgeVectors === 'function'
      && (settings.pineconeApiKey || process.env.PINECONE_API_KEY)
      && (settings.pineconeHost || process.env.PINECONE_HOST)
    ) {
      const matches = await pineconeClient.searchKnowledgeVectors(query, settings, { topK: 5 });
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

  return {
    run
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
