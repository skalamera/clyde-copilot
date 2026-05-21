const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildTranscriptCleanupPrompt,
  normalizeCleanedTranscriptResponse
} = require('../src/transcriptCleanup');

const rawTranscript = [
  { speaker: 'System Audio', text: 'Can you give an example of' },
  { speaker: 'You', text: 'You get a...' },
  { speaker: 'System Audio', text: "a process you've put in place to help scale the team better?" },
  { speaker: 'You', text: 'Yeah. benchmark, I directed support automation and systems integration strategy across Fresh Desk, Zendesk, and Ring Central. This was key to scaling because it reduced resolution time by 38%.' }
];

test('transcript cleanup rejects empty AI transcript output', () => {
  const cleaned = normalizeCleanedTranscriptResponse(JSON.stringify({ transcript: [] }), rawTranscript);

  assert.equal(cleaned, null);
});

test('transcript cleanup rejects output that drops most of the transcript', () => {
  const cleaned = normalizeCleanedTranscriptResponse(JSON.stringify({
    transcript: [
      { speaker: 'Interviewer', text: 'Tell me about yourself.' },
      { speaker: 'You', text: 'I...' }
    ]
  }), rawTranscript);

  assert.equal(cleaned, null);
});

test('transcript cleanup accepts cleaned transcript that keeps the substance', () => {
  const cleaned = normalizeCleanedTranscriptResponse(JSON.stringify({
    transcript: [
      { speaker: 'System Audio', text: "Can you give an example of a process you've put in place to help scale the team better?" },
      { speaker: 'You', text: 'Yeah. At Benchmark, I directed support automation and systems integration strategy across Fresh Desk, Zendesk, and Ring Central. This was key to scaling because it reduced resolution time by 38%.' }
    ]
  }), rawTranscript);

  assert.deepEqual(cleaned, [
    { speaker: 'System Audio', text: "Can you give an example of a process you've put in place to help scale the team better?" },
    { speaker: 'You', text: 'Yeah. At Benchmark, I directed support automation and systems integration strategy across Fresh Desk, Zendesk, and Ring Central. This was key to scaling because it reduced resolution time by 38%.' }
  ]);
});

test('transcript cleanup prompt asks for full transcript retention', () => {
  const prompt = buildTranscriptCleanupPrompt(rawTranscript);

  assert.match(prompt, /Keep every substantive question and answer/);
  assert.match(prompt, /Do not summarize/);
  assert.match(prompt, /preserve numbers, tools, company names, project names, and outcomes/i);
});
