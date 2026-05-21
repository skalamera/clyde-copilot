const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { cleanupElectronCache, DEFAULT_CACHE_DIRS } = require('../src/electronCacheCleanup');

test('cleanupElectronCache removes only Chromium cache folders under Clyde Session', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'clyde-cache-cleanup-'));
  const appDataPath = path.join(tempRoot, 'AppData', 'Roaming');
  const sessionRoot = path.join(appDataPath, 'Clyde', 'Session');
  const keepDir = path.join(sessionRoot, 'Local Storage');

  for (const dir of DEFAULT_CACHE_DIRS) {
    fs.mkdirSync(path.join(sessionRoot, dir), { recursive: true });
    fs.writeFileSync(path.join(sessionRoot, dir, 'marker.txt'), 'cache');
  }

  fs.mkdirSync(path.join(keepDir, 'leveldb'), { recursive: true });
  fs.writeFileSync(path.join(keepDir, 'leveldb', 'LOG'), 'keep');

  const result = cleanupElectronCache(appDataPath);

  assert.equal(result.removed.length, DEFAULT_CACHE_DIRS.length);
  assert.equal(result.failed.length, 0);
  for (const dir of DEFAULT_CACHE_DIRS) {
    assert.equal(fs.existsSync(path.join(sessionRoot, dir)), false);
  }
  assert.equal(fs.existsSync(keepDir), true);

  fs.rmSync(tempRoot, { recursive: true, force: true });
});
