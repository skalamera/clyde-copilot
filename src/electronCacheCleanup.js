const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_CACHE_DIRS = [
  'Cache',
  'GPUCache',
  'Code Cache',
  'DawnGraphiteCache',
  'DawnWebGPUCache'
];

function cleanupElectronCache(appDataPath, cacheDirs = DEFAULT_CACHE_DIRS) {
  if (!appDataPath) {
    return { removed: [], failed: [] };
  }

  const sessionRoot = path.join(appDataPath, 'Clyde', 'Session');
  const removed = [];
  const failed = [];

  for (const cacheDir of cacheDirs) {
    const target = path.join(sessionRoot, cacheDir);
    if (!fs.existsSync(target)) {
      continue;
    }

    try {
      fs.rmSync(target, { recursive: true, force: true });
      removed.push(target);
    } catch (error) {
      failed.push({ target, error });
    }
  }

  return { removed, failed };
}

module.exports = {
  cleanupElectronCache,
  DEFAULT_CACHE_DIRS
};
