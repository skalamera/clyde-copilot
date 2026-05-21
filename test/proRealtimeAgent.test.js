const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');

const { createProRealtimeAgent } = require('../src/proRealtimeAgent');

class FakeWebSocket extends EventEmitter {
  static instances = [];

  constructor(url, options) {
    super();
    this.url = url;
    this.options = options;
    this.sent = [];
    this.readyState = FakeWebSocket.OPEN;
    FakeWebSocket.instances.push(this);
  }

  send(payload) {
    this.sent.push(JSON.parse(payload));
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.closed = true;
  }
}

FakeWebSocket.OPEN = 1;
FakeWebSocket.CLOSED = 3;

function emitJson(ws, payload) {
  ws.emit('message', JSON.stringify(payload));
}

test('pro realtime agent executes memory tool calls and returns normalized cards', async () => {
  FakeWebSocket.instances = [];
  const toolQueries = [];
  const agent = createProRealtimeAgent({
    WebSocketImpl: FakeWebSocket,
    timeoutMs: 1000,
      settings: {
        transcriptionApiKey: 'openai-key',
        llmApiKey: 'openai-key',
        proRealtimeModel: 'gpt-realtime-2',
        pineconeApiKey: 'pine-key',
        pineconeHost: 'https://example-index.pinecone.io'
      },
    knowledgeManager: {
      getPinnedKnowledge: () => [{ id: 'doc-1', filename: 'JD.md', content: 'Pinned job description.' }]
    },
    pineconeClient: {
      searchKnowledgeVectors: async (query) => {
        toolQueries.push(query);
        return [{
          text: 'Cody mentioned AWS Lambda next quarter.',
          source: 'Interview_with_Cody_2026-04.txt',
          knowledgeId: 'session:interview:cody:1'
        }];
      }
    }
  });

  const run = agent.run({
    digest: 'System Audio: What did Cody say about the backend?',
    mode: 'interview',
    command: 'assist',
    allowMemorySearch: true
  });

  const ws = FakeWebSocket.instances[0];
  ws.emit('open');

  assert.equal(ws.url, 'wss://api.openai.com/v1/realtime?model=gpt-realtime-2');
  assert.equal(ws.options.headers.Authorization, 'Bearer openai-key');
  assert.equal(ws.sent[0].type, 'session.update');
  assert.equal(ws.sent[0].session.tool_choice, 'auto');

  emitJson(ws, {
    type: 'response.done',
    response: {
      output: [{
        type: 'function_call',
        name: 'searchPastMeetings',
        call_id: 'call-1',
        arguments: JSON.stringify({ query: 'Cody backend Lambda' })
      }]
    }
  });

  assert.equal(toolQueries[0], 'Cody backend Lambda');
  assert.equal(ws.sent.at(-2).item.type, 'function_call_output');
  assert.equal(ws.sent.at(-2).item.call_id, 'call-1');

  emitJson(ws, {
    type: 'response.done',
    response: {
      output: [{
        type: 'message',
        content: [{
          type: 'output_text',
          text: JSON.stringify({
            answers: [{ question: 'What did Cody say?', bullets: ['Mention Lambda migration.'] }],
            memory_cards: [{
              fact: 'Cody mentioned AWS Lambda next quarter.',
              source: 'Interview_with_Cody_2026-04.txt'
            }]
          })
        }]
      }]
    }
  });

  const result = await run;
  assert.equal(result.ok, true);
  assert.equal(result.cards.map((card) => card.type).join(','), 'answer,memory');
  assert.equal(result.cards[1].agentic, true);
  assert.equal(ws.closed, true);
});

test('pro realtime agent reports websocket errors', async () => {
  FakeWebSocket.instances = [];
  const agent = createProRealtimeAgent({
    WebSocketImpl: FakeWebSocket,
    timeoutMs: 1000,
    settings: { transcriptionApiKey: 'openai-key', llmApiKey: 'openai-key' }
  });

  const run = agent.run({ digest: 'System Audio: Hello', mode: 'meeting', command: 'assist' });
  const ws = FakeWebSocket.instances[0];
  ws.emit('error', new Error('socket dropped'));

  await assert.rejects(run, /socket dropped/);
});
