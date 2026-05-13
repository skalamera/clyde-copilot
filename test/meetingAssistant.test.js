const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createMeetingAssistant,
  describeAssistantError,
  extractAssistantText,
  isUserSpeaker,
  parseAssistantCards
} = require('../src/meetingAssistant');

test('skips LM Studio calls until configured', async () => {
  const assistant = createMeetingAssistant({
    settings: { llmProvider: 'local', llmModel: '' }
  });

  const firstTurn = await assistant.addTranscript({ speaker: 'Test', text: 'Hello' });
  const secondTurn = await assistant.maybeRun(true, true);

  assert.strictEqual(firstTurn.skipped, 'not-configured');
  assert.strictEqual(secondTurn.skipped, 'not-configured');
});

test('merges consecutive transcript turns from the same speaker', async () => {
  const assistant = createMeetingAssistant();
  await assistant.addTranscript({ speaker: 'System Audio', text: 'What is' });
  await assistant.addTranscript({ speaker: 'System Audio', text: 'Aladdin?' });
  
  const turns = assistant.getTranscriptTurns();
  assert.equal(turns.length, 1);
  assert.equal(turns[0].text, 'What is Aladdin?');
});

test('posts rolling transcript to LM Studio chat completions', async () => {
  const updates = [];
  const requests = [];

  const assistant = createMeetingAssistant({
    settings: {
        llmProvider: 'local',
        localLlmUrl: 'http://localhost:1234/v1/chat/completions',
        llmModel: 'gemma-4-e4b'
    },
    axiosClient: {
      post: async (url, data) => {
        requests.push({ url, data });

        return {
          data: {
            choices: [{
              message: { content: '{"answers": [{"question":"Why?", "bullets": ["A"]}]}' }
            }]
          }
        };
      }
    },
    intervalMs: 1,
    sendUpdate: (update) => updates.push(update)
  });

  await assistant.addTranscript({ speaker: 'System Audio', text: 'Can you give an example of a process you have put in place to help scale the team better?' });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'http://localhost:1234/v1/chat/completions');
  assert.equal(requests[0].data.model, 'gemma-4-e4b');
  assert.equal(requests[0].data.max_tokens, 800);
  assert.deepEqual(requests[0].data.response_format.json_schema.schema.properties, {
    answers: { 
      type: 'array', 
      items: { 
        type: 'object', 
        properties: { 
          question: { type: 'string' }, 
          bullets: { type: 'array', items: { type: 'string' } } 
        }, 
        required: ['question', 'bullets'] 
      } 
    }
  });
  assert.match(requests[0].data.messages[0].content, /The user wearing Clyde \("You"\) is the job candidate/);
  assert.match(requests[0].data.messages[0].content, /The "System Audio" and any other speakers are the interviewers/);
  assert.match(requests[0].data.messages[1].content, /System Audio: Can you give an example of a process you have put in place to help scale the team better/);
  assert.equal(updates[0].cards[0].type, 'answer');
  assert.equal(updates[0].cards[0].question, 'Why?');
  assert.deepEqual(updates[0].cards[0].bullets, ['A']);
});

test('does not call LM Studio when only the user speaks', async () => {
  const requests = [];

  const assistant = createMeetingAssistant({
    settings: {
        llmProvider: 'local',
        localLlmUrl: 'http://localhost:1234/v1/chat/completions',
        llmModel: 'gemma-4-e4b'
    },
    axiosClient: {
      post: async (url, data) => {
        requests.push({ url, data });

        return {
          data: {
            choices: [{
              message: { content: 'test output' }
            }]
          }
        };
      }
    },
    intervalMs: 1
  });

  const result = await assistant.addTranscript({ speaker: 'You', text: 'What is 2 plus 2?' });

  assert.equal(result.skipped, 'user-speaker');
  assert.equal(requests.length, 0);
});

test('does not retrieve Pinecone context when RAG is disabled', async () => {
  const meetingAssistantPath = require.resolve('../src/meetingAssistant');
  const pineconeClientPath = require.resolve('../src/pineconeClient');
  const originalMeetingAssistantCache = require.cache[meetingAssistantPath];
  const originalPineconeClientCache = require.cache[pineconeClientPath];
  const originalPineconeApiKey = process.env.PINECONE_API_KEY;
  const originalPineconeHost = process.env.PINECONE_HOST;

  let searchCalls = 0;

  try {
    process.env.PINECONE_API_KEY = 'env-key';
    process.env.PINECONE_HOST = 'https://example-index.pinecone.io';

    delete require.cache[meetingAssistantPath];
    require.cache[pineconeClientPath] = {
      id: pineconeClientPath,
      filename: pineconeClientPath,
      loaded: true,
      exports: {
        detectResumeQuestion: async () => 'Tell me about your support career.',
        searchResumeVectors: async () => {
          searchCalls++;
          return [{ text: 'Pinecone fact' }];
        }
      }
    };

    const { createMeetingAssistant: createAssistantWithFakePinecone } = require('../src/meetingAssistant');
    const requests = [];

    const assistant = createAssistantWithFakePinecone({
      settings: {
        llmProvider: 'local',
        localLlmUrl: 'http://localhost:1234/v1/chat/completions',
        llmModel: 'gemma-4-e4b',
        ragEnabled: false
      },
      axiosClient: {
        post: async (url, data) => {
          requests.push({ url, data });
          return {
            data: {
              choices: [{
                message: { content: '{"answers": [{"question":"Why support?", "bullets": ["Because I like solving customer problems."]}]}' }
              }]
            }
          };
        }
      },
      intervalMs: 1
    });

    await assistant.addTranscript({ speaker: 'System Audio', text: 'Can you walk me through your support career?' });

    assert.equal(searchCalls, 0);
    assert.equal(requests.length, 1);
    assert.doesNotMatch(requests[0].data.messages[0].content, /Pinecone fact/);
  } finally {
    if (originalPineconeApiKey === undefined) {
      delete process.env.PINECONE_API_KEY;
    } else {
      process.env.PINECONE_API_KEY = originalPineconeApiKey;
    }

    if (originalPineconeHost === undefined) {
      delete process.env.PINECONE_HOST;
    } else {
      process.env.PINECONE_HOST = originalPineconeHost;
    }

    delete require.cache[meetingAssistantPath];

    if (originalMeetingAssistantCache) {
      require.cache[meetingAssistantPath] = originalMeetingAssistantCache;
    }

    if (originalPineconeClientCache) {
      require.cache[pineconeClientPath] = originalPineconeClientCache;
    } else {
      delete require.cache[pineconeClientPath];
    }
  }
});

test('warns when LM Studio returns no visible assistant content', async () => {
  const statuses = [];

  const assistant = createMeetingAssistant({
    settings: {
        llmProvider: 'local',
        localLlmUrl: 'http://localhost:1234/v1/chat/completions',
        llmModel: 'gemma-4-e4b'
    },
    axiosClient: {
      post: async () => ({
        data: {
          choices: [{
            message: { content: '<think>silently pondering</think>' }
          }]
        }
      })
    },
    intervalMs: 1,
    sendStatus: (status) => statuses.push(status)
  });

  const result = await assistant.addTranscript({ speaker: 'System Audio', text: 'Can you give an example of a process you have put in place to help scale the team better?' });

  assert.equal(result.text, '');
  assert.equal(statuses[0].state, 'warning');
  assert.match(statuses[0].message, /empty assistant message/);
});

test('extracts assistant text from chat completion responses', () => {
  assert.equal(
    extractAssistantText({
      choices: [{ message: { content: 'hello' } }]
    }),
    'hello'
  );
});

test('parses structured assistant cards', () => {
  const cards = parseAssistantCards(JSON.stringify({
    answers: [{ question: 'What changed?', bullets: ['Liquidity increased.'] }],
    suggestions: [{ text: 'I would ask how this affects timing.', why: 'It moves the discussion forward.' }]
  }));

  assert.deepEqual(cards.map((card) => card.type), ['answer', 'suggestion']);
  assert.equal(cards[0].title, 'Answer');
  assert.equal(cards[1].title, 'Say next');
});

test('detects the user speaker label', () => {
  assert.equal(isUserSpeaker('You'), true);
  assert.equal(isUserSpeaker('System Audio'), false);
});

test('formats assistant network errors', () => {
  assert.equal(
    describeAssistantError({
      code: 'ECONNREFUSED',
      config: { url: 'http://localhost:1234/v1/chat/completions' }
    }),
    'ECONNREFUSED calling http://localhost:1234/v1/chat/completions'
  );
});
