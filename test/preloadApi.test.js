const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('preload exposes mode-aware session APIs', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'preload.js'), 'utf8');

  for (const api of [
    'getSessions',
    'saveSession',
    'deleteSession',
    'setActiveSessionContext',
    'validateServices'
  ]) {
    assert.match(source, new RegExp(`${api}:`));
  }
});
