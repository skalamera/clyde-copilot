const assert = require('node:assert/strict');
const test = require('node:test');

const { startAutoUpdater } = require('../src/autoUpdater');

test('startAutoUpdater skips updater setup when the app is not packaged', () => {
  let loaded = false;

  const result = startAutoUpdater({
    isPackaged: false,
    logger: { transports: { file: { level: 'warn' } } },
    requireAutoUpdater: () => {
      loaded = true;
      return {
        checkForUpdatesAndNotify() {
          throw new Error('should not run');
        }
      };
    }
  });

  assert.equal(result, null);
  assert.equal(loaded, false);
});

test('startAutoUpdater configures and runs the updater when packaged', () => {
  let called = false;
  let loggerAssigned = null;
  let levelAssigned = null;

  const updater = {
    set logger(value) {
      loggerAssigned = value;
    },
    get logger() {
      return {
        transports: {
          file: {
            set level(value) {
              levelAssigned = value;
            }
          }
        }
      };
    },
    checkForUpdatesAndNotify() {
      called = true;
    }
  };

  const result = startAutoUpdater({
    isPackaged: true,
    logger: { transports: { file: { level: 'warn' } } },
    requireAutoUpdater: () => updater
  });

  assert.equal(result, updater);
  assert.equal(called, true);
  assert.equal(loggerAssigned.transports.file.level, 'warn');
  assert.equal(levelAssigned, 'info');
});
