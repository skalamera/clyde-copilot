const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.join(__dirname, '..');

test('Clyde managed cloud and BYOK providers enforce fixed model policy', () => {
  const mainSource = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const llmClientSource = fs.readFileSync(path.join(repoRoot, 'src', 'llmClient.js'), 'utf8');
  const proxySource = fs.readFileSync(path.join(repoRoot, 'website', 'api', 'proxy.js'), 'utf8');

  assert.match(proxySource, /gemini-3\.5-flash/);
  assert.match(proxySource, /validGeminiModels = new Set\(\['gemini-3\.5-flash'/);
  assert.match(proxySource, /validGptModels = new Set\(\['gpt-4o'\]\)/);
  assert.doesNotMatch(proxySource, /gpt-4o-mini'\]/);
  assert.match(llmClientSource, /model: 'gemini-3\.5-flash'/);
  assert.match(llmClientSource, /model: 'gpt-4o'/);
  assert.doesNotMatch(llmClientSource, /gpt-4o-mini/);
  assert.match(mainSource, /llmProvider: store\.get\('llmProvider', ''\)/);
});
