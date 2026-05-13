const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.join(__dirname, '..');

test('interview grading leaves enough response budget for written evaluation', () => {
  const mainSource = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const gradingBlock = mainSource.split('async function processSessionGradingInBackground')[1] || '';
  const maxTokensMatch = gradingBlock.match(/maxTokens:\s*(\d+)/);

  assert.ok(maxTokensMatch, 'grading maxTokens is configured');
  assert.equal(Number(maxTokensMatch[1]), 1800);
  assert.match(mainSource, /Write a detailed evaluation in exactly 4 short professional sections/);
  assert.match(mainSource, /Use concrete details from the transcript/);
  assert.match(mainSource, /Do not write a generic one-paragraph summary/);
});

test('interview saves clean transcript text before grading', () => {
  const mainSource = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');

  assert.match(mainSource, /processTranscriptCleanupInBackground/);
  assert.match(mainSource, /normalizeCleanedTranscriptResponse/);
  assert.match(mainSource, /name: 'transcript_cleanup'/);
  assert.match(mainSource, /record\.grading\.status === 'pending' && hasTranscript/);
});
