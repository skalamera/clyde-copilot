const assert = require('node:assert/strict');
const test = require('node:test');

const { buildAssistantPrompt, getAllowedCardTypes, getAssistantSchema } = require('../src/assistantPrompts');

test('interview mode prompt focuses on candidate answers and follow-up questions', () => {
  const prompt = buildAssistantPrompt({
    mode: 'interview',
    context: {
      company: 'Acme',
      role: 'Staff Engineer',
      jobDescription: 'Build platform systems.',
      resumeText: 'Led migration work.'
    },
    command: 'assist'
  });

  assert.match(prompt, /live job interview copilot/i);
  assert.match(prompt, /Acme/);
  assert.match(prompt, /Staff Engineer/);
  assert.deepEqual(getAllowedCardTypes('interview'), ['answer', 'suggestion', 'follow_up', 'risk', 'note']);
});

test('meeting mode prompt focuses on notes, recap, actions, and memory', () => {
  const prompt = buildAssistantPrompt({
    mode: 'meeting',
    context: {
      meetingTitle: 'Platform weekly',
      attendees: [{ name: 'Morgan', role: 'PM' }],
      memory: 'Morgan asked for release notes last time.'
    },
    command: 'recap'
  });

  assert.match(prompt, /live meeting assistant/i);
  assert.match(prompt, /Platform weekly/);
  assert.match(prompt, /Long term memory across meetings/);
  assert.match(prompt, /release notes/);
  assert.deepEqual(getAllowedCardTypes('meeting'), ['recap', 'action', 'follow_up', 'suggestion', 'insight', 'screen_description', 'note']);
});

test('meeting screenshot command requests screen description and answer cards', () => {
  const prompt = buildAssistantPrompt({
    mode: 'meeting',
    context: { meetingTitle: 'Design review' },
    command: 'meeting_screen_question'
  });
  const schema = getAssistantSchema('meeting', 'meeting_screen_question');

  assert.match(prompt, /describe what is visible on the user's screen/i);
  assert.deepEqual(Object.keys(schema), ['screen_descriptions', 'answers']);
  assert.equal(schema.screen_descriptions.items.properties.text.type, 'string');
  assert.equal(schema.answers.items.properties.bullets.type, 'array');
});

test('meeting say-next command requests suggestions and insights', () => {
  const prompt = buildAssistantPrompt({
    mode: 'meeting',
    command: 'meeting_say_next'
  });
  const schema = getAssistantSchema('meeting', 'meeting_say_next');

  assert.match(prompt, /suggest useful things the user can say next/i);
  assert.deepEqual(Object.keys(schema), ['suggestions', 'insights']);
  assert.equal(schema.suggestions.items.properties.why.type, 'string');
  assert.equal(schema.insights.items.properties.text.type, 'string');
});

test('meeting custom prompt command uses generic answer and note cards', () => {
  const prompt = buildAssistantPrompt({
    mode: 'meeting',
    command: 'meeting_custom_prompt'
  });
  const schema = getAssistantSchema('meeting', 'meeting_custom_prompt');

  assert.match(prompt, /follow the user's custom prompt/i);
  assert.deepEqual(Object.keys(schema), ['answers', 'notes']);
});
