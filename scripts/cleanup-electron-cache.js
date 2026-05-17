const path = require('node:path');
const os = require('node:os');

const { cleanupElectronCache } = require('../src/electronCacheCleanup');

const appDataPath = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const { removed, failed } = cleanupElectronCache(appDataPath);

if (removed.length > 0) {
  console.log(`Cleared Electron cache folders:\n${removed.join('\n')}`);
}

for (const entry of failed) {
  console.warn(`Could not clear Electron cache folder: ${entry.target}`);
}
