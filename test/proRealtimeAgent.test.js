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

async function waitFor(predicate, timeoutMs = 500) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail('Timed out waiting for condition.');
}

test('pro realtime agent executes memory tool calls and returns normalized cards', async () => {
  FakeWebSocket.instances = [];
  const toolQueries = [];
  const traceEvents = [];
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
    },
    debugTrace: (event, data) => traceEvents.push({ event, data })
  });

  const run = agent.run({
    digest: 'System Audio: What did Cody say about the backend?',
    mode: 'interview',
    command: 'assist',
    allowMemorySearch: true,
    context: {
      pinnedKnowledgeBrief: 'Global story bank: mention support automation.'
    }
  });

  const ws = FakeWebSocket.instances[0];
  ws.emit('open');
  await waitFor(() => ws.sent.length >= 3);

  assert.equal(ws.url, 'wss://api.openai.com/v1/realtime?model=gpt-realtime-2');
  assert.equal(ws.options.headers.Authorization, 'Bearer openai-key');
  assert.equal(ws.sent[0].type, 'session.update');
  assert.equal(ws.sent[0].session.tool_choice, 'auto');
  assert.match(ws.sent[0].session.instructions, /Global story bank/);

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

  await waitFor(() => toolQueries.length === 1);
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
            answers: [{
              question: 'What did Cody say?',
              bullets: [
                'Mention Lambda migration.',
                'Connect it to the team timeline.',
                'Keep the answer focused on the Cody context.'
              ]
            }],
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
  assert.ok(traceEvents.some((row) => row.event === 'pro.user_message'));
  assert.ok(traceEvents.some((row) => row.event === 'pro.response.done'));
  assert.ok(traceEvents.some((row) => row.event === 'pro.cards.processed'));
  assert.equal(ws.closed, undefined);
  agent.close();
  assert.equal(ws.closed, true);
});

test('pro realtime agent scopes memory search to the active entity context', async () => {
  FakeWebSocket.instances = [];
  const filters = [];
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
      getPinnedKnowledge: () => []
    },
    pineconeClient: {
      searchKnowledgeVectors: async (_query, _settings, options) => {
        filters.push(options.filter || null);
        return [{
          text: 'Apollo only memory.',
          source: 'Apollo Interview',
          knowledgeId: 'session:interview:apollo:1'
        }];
      }
    }
  });

  const run = agent.run({
    digest: 'Apollo support context',
    mode: 'interview',
    command: 'assist',
    allowMemorySearch: true,
    context: {
      entityId: 'apollo'
    }
  });

  const ws = FakeWebSocket.instances[0];
  ws.emit('open');
  await waitFor(() => ws.sent.length >= 3);

  emitJson(ws, {
    type: 'response.done',
    response: {
      output: [{
        type: 'function_call',
        name: 'searchPastMeetings',
        call_id: 'call-1',
        arguments: JSON.stringify({ query: 'Apollo onboarding' })
      }]
    }
  });

  await waitFor(() => filters.length === 1);

  emitJson(ws, {
    type: 'response.done',
    response: {
      output: [{
        type: 'message',
        content: [{
          type: 'output_text',
          text: JSON.stringify({
            answers: [{
              question: 'Apollo?',
              bullets: [
                'Use Apollo context.',
                'Tie the answer to onboarding.',
                'Keep the response specific to this active entity.'
              ]
            }],
            memory_cards: []
          })
        }]
      }]
    }
  });

  const result = await run;
  assert.deepEqual(filters, [{ mode: { $eq: 'interview' }, entityId: { $eq: 'apollo' } }]);
  assert.equal(result.ok, true);
  assert.equal(ws.closed, undefined);
});

test('pro realtime memory cards keep a fallback reminder when text has no sentence break', async () => {
  const agent = createProRealtimeAgent({
    WebSocketImpl: FakeWebSocket,
    settings: {
      transcriptionApiKey: 'openai-key',
      pineconeApiKey: 'pine-key',
      pineconeHost: 'https://example-index.pinecone.io'
    },
    pineconeClient: {
      searchKnowledgeVectors: async () => [{
        text: 'Human in loop for sensitive customer escalations and billing disputes',
        source: 'Interview_with_Joe.txt'
      }]
    }
  });

  const result = await agent.searchMemoryCards({
    query: 'human in loop',
    mode: 'interview',
    allowMemorySearch: true
  });

  assert.equal(result.cards.length, 1);
  assert.equal(result.cards[0].type, 'memory');
  assert.deepEqual(result.cards[0].bullets, ['Human in loop for sensitive customer escalations and billing disputes']);
});

test('pro realtime agent reuses the websocket across sequential runs', async () => {
  FakeWebSocket.instances = [];
  const agent = createProRealtimeAgent({
    WebSocketImpl: FakeWebSocket,
    timeoutMs: 1000,
    settings: { transcriptionApiKey: 'openai-key', llmApiKey: 'openai-key' }
  });

  const firstRun = agent.run({ digest: 'System Audio: First question?', mode: 'interview', command: 'assist' });
  const ws = FakeWebSocket.instances[0];
  ws.emit('open');
  await waitFor(() => ws.sent.length >= 3);

  emitJson(ws, {
    type: 'response.done',
    response: {
      output: [{
        type: 'message',
        content: [{ type: 'output_text', text: '{"answers":[{"question":"First?","bullets":["A","B","C"]}]}' }]
      }]
    }
  });

  await firstRun;

  const secondRun = agent.run({ digest: 'System Audio: Second question?', mode: 'interview', command: 'assist' });
  await waitFor(() => ws.sent.filter((item) => item.type === 'response.create').length === 2);
  assert.equal(FakeWebSocket.instances.length, 1);

  emitJson(ws, {
    type: 'response.done',
    response: {
      output: [{
        type: 'message',
        content: [{ type: 'output_text', text: '{"answers":[{"question":"Second?","bullets":["A","B","C"]}]}' }]
      }]
    }
  });

  const result = await secondRun;
  assert.equal(result.cards[0].question, 'Second?');
  assert.equal(ws.closed, undefined);
});

test('pro realtime agent emits draft cards from text deltas', async () => {
  FakeWebSocket.instances = [];
  const drafts = [];
  const agent = createProRealtimeAgent({
    WebSocketImpl: FakeWebSocket,
    timeoutMs: 1000,
    settings: { transcriptionApiKey: 'openai-key', llmApiKey: 'openai-key' }
  });

  const run = agent.run({
    digest: 'System Audio: Tell me about support?',
    mode: 'interview',
    command: 'assist',
    targetQuestion: 'Tell me about support?',
    toolsEnabled: false,
    draftCardId: 'draft-card',
    groupId: 'draft-group',
    onDraft: (draft) => drafts.push(draft)
  });
  const ws = FakeWebSocket.instances[0];
  ws.emit('open');
  await waitFor(() => ws.sent.length >= 3);
  assert.equal(ws.sent[0].session.tool_choice, 'none');
  assert.deepEqual(ws.sent[0].session.tools, []);
  assert.deepEqual(ws.sent[0].session.reasoning, { effort: 'low' });

  emitJson(ws, {
    type: 'response.output_text.delta',
    delta: '{"answers":[{"question":"Tell me about support?","bullets":["Lead with scale and ownership","Name the operating metric","Close with the business result"'
  });

  await waitFor(() => drafts.length === 1);
  assert.equal(drafts[0].cards[0].id, 'draft-card');
  assert.equal(drafts[0].cards[0].draft, true);
  assert.deepEqual(drafts[0].cards[0].bullets, [
    'Lead with scale and ownership',
    'Name the operating metric',
    'Close with the business result'
  ]);

  emitJson(ws, {
    type: 'response.done',
    response: {
      output: [{
        type: 'message',
        content: [{ type: 'output_text', text: '{"answers":[{"question":"Tell me about support?","bullets":["Final answer","Add one metric","End with impact"]}]}' }]
      }]
    }
  });

  const result = await run;
  assert.equal(result.draftCardId, 'draft-card');
  assert.equal(result.groupId, 'draft-group');
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

test('pro realtime agent appends raw audio chunks to websocket', async () => {
  FakeWebSocket.instances = [];
  const agent = createProRealtimeAgent({
    WebSocketImpl: FakeWebSocket,
    timeoutMs: 1000,
    settings: { transcriptionApiKey: 'openai-key', llmApiKey: 'openai-key' }
  });

  // Start agent to open socket
  const run = agent.run({ digest: 'System Audio: Hello', mode: 'meeting', command: 'assist' }).catch(() => {});
  const ws = FakeWebSocket.instances[0];
  ws.emit('open');

  agent.appendAudioChunk('UGFja2V0'); // Base64 of 'Packet'
  await waitFor(() => ws.sent.length >= 4);

  const appendEvent = ws.sent.find((item) => item.type === 'input_audio_buffer.append');
  assert.ok(appendEvent);
  assert.equal(appendEvent.audio, 'UGFja2V0');

  agent.close();
});

test('pro realtime agent configures session on socket open if not run (e.g. warmup or appendAudioChunk)', async () => {
  FakeWebSocket.instances = [];
  const agent = createProRealtimeAgent({
    WebSocketImpl: FakeWebSocket,
    timeoutMs: 1000,
    settings: { transcriptionApiKey: 'openai-key', llmApiKey: 'openai-key' }
  });

  // Call appendAudioChunk directly while no socket is open to force ensureSocket(..., false)
  agent.appendAudioChunk('UGFja2V0');
  const ws = FakeWebSocket.instances[0];
  assert.ok(ws);
  ws.emit('open');

  await waitFor(() => ws.sent.length >= 2);
  const sessionUpdateEvent = ws.sent.find((item) => item.type === 'session.update');
  assert.ok(sessionUpdateEvent);
  assert.equal(sessionUpdateEvent.session.output_modalities[0], 'text');

  agent.close();
});

test('pro realtime agent condenses multiple suggestions into one card in interview mode', async () => {
  FakeWebSocket.instances = [];
  const agent = createProRealtimeAgent({
    WebSocketImpl: FakeWebSocket,
    timeoutMs: 1000,
    settings: { transcriptionApiKey: 'openai-key', llmApiKey: 'openai-key', appMode: 'interview' }
  });

  const run = agent.run({ digest: 'System Audio: Hello', mode: 'interview', command: 'assist' });
  const ws = FakeWebSocket.instances[0];
  ws.emit('open');

  await waitFor(() => ws.sent.length >= 3);

  emitJson(ws, {
    type: 'response.done',
    response: {
      output: [{
        type: 'message',
        content: [{ type: 'output_text', text: '{"suggestions":[{"question":"What is your experience?","bullets":["Sig 1","Sig 2"]},{"question":"Other turn","bullets":["Sig 3"]}]}' }]
      }]
    }
  });

  const result = await run;
  assert.equal(result.cards.length, 1);
  assert.equal(result.cards[0].question, 'What is your experience?');
  assert.deepEqual(result.cards[0].bullets, ['Sig 1', 'Sig 2', 'Sig 3']);

  agent.close();
});
