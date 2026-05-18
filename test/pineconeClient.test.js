const assert = require('node:assert/strict');
const test = require('node:test');

const {
  detectResumeQuestion,
  extractLikelyInterviewQuestion
} = require('../src/pineconeClient');

test('detects role-fit interview questions without relying on remote intent classification', async () => {
  const transcript = [
    'You: Thanks for having me.',
    'System Audio: Why do you think you would be a good fit for this particular role?'
  ].join('\n');

  assert.equal(
    extractLikelyInterviewQuestion(transcript),
    'Why do you think you would be a good fit for this particular role?'
  );

  assert.equal(
    await detectResumeQuestion(transcript),
    'Why do you think you would be a good fit for this particular role?'
  );
});

test('does not treat incomplete role-fit fragments as interview questions', () => {
  assert.equal(
    extractLikelyInterviewQuestion('System Audio: Why do you think you would be a good fit for'),
    null
  );
});

test('reconstructs the latest fragmented interview question without combining older questions', () => {
  const transcript = [
    'System Audio: If',
    'System Audio: If you were to get the job, what would your 30',
    'System Audio: sixty ninety day plan look like?',
    'System Audio: Why do you think you would be a good fit for this particular',
    'System Audio: particular role.',
    'System Audio: Can you tell me about the My Career Max project?'
  ].join('\n');

  assert.equal(
    extractLikelyInterviewQuestion(transcript),
    'Can you tell me about the My Career Max project?'
  );
});

test('reconstructs role-fit and 30-60-90 fragments as separate current questions', () => {
  assert.equal(
    extractLikelyInterviewQuestion([
      'System Audio: If',
      'System Audio: If you were to get the job, what would your 30',
      'System Audio: sixty ninety day plan look like?'
    ].join('\n')),
    'If you were to get the job, what would your 30 sixty ninety day plan look like?'
  );

  assert.equal(
    extractLikelyInterviewQuestion([
      'System Audio: Why do you think you would be a good fit for this particular',
      'System Audio: particular role.'
    ].join('\n')),
    'Why do you think you would be a good fit for this particular role.'
  );
});
