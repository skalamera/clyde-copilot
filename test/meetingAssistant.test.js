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

test('merges consecutive transcript turns from the same speaker', async () => {
  const assistant = createMeetingAssistant();
  await assistant.addTranscript({ speaker: 'System Audio', text: 'What is' });
  await assistant.addTranscript({ speaker: 'System Audio', text: 'Aladdin?' });
  
  const turns = assistant.getTranscriptTurns();
  assert.equal(turns.length, 1);
  assert.equal(turns[0].text, 'What is Aladdin?');
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
                    bullets: ['Aladdin is a risk platform.', 'Used by institutions.']
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

  await assistant.addTranscript({ speaker: 'System Audio', text: 'Can you give an example of a process you have put in place to help scale the team better?' });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://localhost:1234/v1/chat/completions');
  assert.equal(calls[0].body.model, 'gemma-4-e4b');
  assert.equal(calls[0].body.max_tokens, 800);
  assert.deepEqual(calls[0].body.reasoning, { effort: 'none' });
  assert.deepEqual(calls[0].body.response_format.json_schema.schema.properties, {
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
  assert.match(calls[0].body.messages[0].content, /The user wearing Clyde \("You"\) is the job candidate/);
  assert.match(calls[0].body.messages[0].content, /The "System Audio" and any other speakers are the interviewers/);
  assert.match(calls[0].body.messages[1].content, /System Audio: Can you give an example of a process you have put in place to help scale the team better/);
  assert.equal(calls[0].config.timeout, 60000);
  assert.equal(updates[0].cards[0].type, 'answer');
  assert.equal(updates[0].cards[0].question, 'What is Aladdin?');
  assert.deepEqual(updates[0].cards[0].bullets, ['Aladdin is a risk platform.', 'Used by institutions.']);
});

test('does not call LM Studio when only the user speaks', async () => {
  let calls = 0;
  const assistant = createMeetingAssistant({
    apiUrl: 'http://localhost:1234/v1/chat/completions',
    model: 'gemma-4-e4b',
    intervalMs: 0,
    axiosClient: {
      post: async () => {
        calls += 1;
      }
    }
  });

  const result = await assistant.addTranscript({ speaker: 'You', text: 'What is 2 plus 2?' });

  assert.equal(result.skipped, 'user-speaker');
  assert.equal(calls, 0);
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
