const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createMeetingAssistant,
  describeAssistantError,
  extractAssistantText,
  parseAssistantCards
} = require('../src/meetingAssistant');

test('skips LM Studio calls until configured', async () => {
  let calls = 0;
  const assistant = createMeetingAssistant({
    apiUrl: '',
    model: '',
    axiosClient: {
      post: async () => {
        calls += 1;
      }
    }
  });

  const result = await assistant.addTranscript({ speaker: 'System Audio', text: 'What is Aladdin?' });

  assert.equal(result.skipped, 'not-configured');
  assert.equal(calls, 0);
});

test('posts rolling transcript to LM Studio chat completions', async () => {
  const calls = [];
  const updates = [];
  const assistant = createMeetingAssistant({
    apiUrl: 'http://localhost:1234/v1/chat/completions',
    model: 'gemma-4-e4b',
    intervalMs: 0,
    axiosClient: {
      post: async (url, body, config) => {
        calls.push({ url, body, config });
        return {
          data: {
            choices: [{
              message: {
                content: JSON.stringify({
                  answers: [{
                    question: 'What is Aladdin?',
                    answer: 'Aladdin is a risk platform.'
                  }],
                  questions: [],
                  suggestions: [],
                  actions: [],
                  risks: []
                })
              }
            }]
          }
        };
      }
    },
    sendUpdate: (update) => updates.push(update)
  });

  await assistant.addTranscript({ speaker: 'System Audio', text: 'What is Aladdin?' });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://localhost:1234/v1/chat/completions');
  assert.equal(calls[0].body.model, 'gemma-4-e4b');
  assert.equal(calls[0].body.max_tokens, 900);
  assert.deepEqual(calls[0].body.reasoning, { effort: 'none' });
  assert.deepEqual(calls[0].body.response_format, { type: 'json_object' });
  assert.match(calls[0].body.messages[0].content, /"You" is the user wearing Casper/);
  assert.match(calls[0].body.messages[0].content, /Use "System Audio"/);
  assert.match(calls[0].body.messages[1].content, /System Audio: What is Aladdin/);
  assert.equal(calls[0].config.timeout, 60000);
  assert.equal(updates[0].cards[0].type, 'answer');
  assert.equal(updates[0].cards[0].question, 'What is Aladdin?');
  assert.equal(updates[0].cards[0].body, 'Aladdin is a risk platform.');
});

test('warns when LM Studio returns no visible assistant content', async () => {
  const statuses = [];
  const assistant = createMeetingAssistant({
    apiUrl: 'http://localhost:1234/v1/chat/completions',
    model: 'gemma-4-e4b',
    intervalMs: 0,
    axiosClient: {
      post: async () => ({
        data: {
          choices: [{
            message: {
              content: '',
              reasoning_content: 'Thinking Process: hidden text'
            },
            finish_reason: 'length'
          }]
        }
      })
    },
    sendStatus: (status) => statuses.push(status)
  });

  const result = await assistant.addTranscript({ speaker: 'You', text: 'Can you hear me?' });

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
    answers: [{ question: 'What changed?', answer: 'Liquidity increased.' }],
    questions: [{ text: 'Can you define liquidity?', why: 'The term is central.' }],
    suggestions: [{ text: 'I would ask how this affects timing.', why: 'It moves the discussion forward.' }],
    actions: [{ text: 'Note the 4.5% money growth figure.' }],
    risks: [{ text: 'Nominal GDP was mentioned without a source.' }]
  }));

  assert.deepEqual(cards.map((card) => card.type), ['answer', 'question', 'suggestion', 'action', 'risk']);
  assert.equal(cards[0].title, 'Answer');
  assert.equal(cards[1].body, 'Can you define liquidity?');
  assert.equal(cards[2].title, 'Say next');
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
