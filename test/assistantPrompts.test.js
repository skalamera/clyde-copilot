const assert = require('node:assert/strict');
const test = require('node:test');

const { buildAssistantPrompt, getAllowedCardTypes } = require('../src/assistantPrompts');

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
  assert.deepEqual(getAllowedCardTypes('meeting'), ['recap', 'action', 'follow_up', 'suggestion', 'note']);
});
