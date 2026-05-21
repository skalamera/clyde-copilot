const assert = require('node:assert/strict');
const test = require('node:test');

const { resolveElectronStoragePaths } = require('../src/electronStoragePaths');

test('resolveElectronStoragePaths keeps the session folder under the provided user data path', () => {
  const result = resolveElectronStoragePaths('C:\\Users\\skala\\AppData\\Roaming\\clyde');

  assert.equal(result.userDataPath, 'C:\\Users\\skala\\AppData\\Roaming\\clyde');
  assert.equal(result.sessionDataPath, 'C:\\Users\\skala\\AppData\\Roaming\\clyde\\Session');
});
