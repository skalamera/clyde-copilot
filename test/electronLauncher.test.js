const assert = require('node:assert/strict');
const test = require('node:test');

const { launchElectronApp } = require('../src/electronLauncher');

test('launchElectronApp removes ELECTRON_RUN_AS_NODE before spawning Electron', () => {
  let capturedEnv = null;
  let capturedArgs = null;
  let capturedPath = null;

  const child = {
    on() {}
  };

  const result = launchElectronApp({
    electronPath: 'electron.exe',
    args: ['.'],
    env: {
      ELECTRON_RUN_AS_NODE: '1',
      APPDATA: 'C:\\Users\\skala\\AppData\\Roaming'
    },
    spawnImpl: (path, args, options) => {
      capturedPath = path;
      capturedArgs = args;
      capturedEnv = options.env;
      return child;
    }
  });

  assert.equal(result, child);
  assert.equal(capturedPath, 'electron.exe');
  assert.deepEqual(capturedArgs, ['.']);
  assert.equal(capturedEnv.ELECTRON_RUN_AS_NODE, undefined);
  assert.equal(capturedEnv.APPDATA, 'C:\\Users\\skala\\AppData\\Roaming');
});
