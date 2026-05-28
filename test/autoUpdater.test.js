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

test('startAutoUpdater skips updater setup when disabled', () => {
  let loaded = false;
  const messages = [];

  const result = startAutoUpdater({
    enabled: false,
    isPackaged: true,
    logger: { info: (message) => messages.push(message) },
    requireAutoUpdater: () => {
      loaded = true;
      return {};
    }
  });

  assert.equal(result, null);
  assert.equal(loaded, false);
  assert.match(messages.join('\n'), /disabled/);
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

test('startAutoUpdater handles update check rejections', async () => {
  const warnings = [];
  let errorHandler = null;
  const updater = {
    set logger(value) {},
    get logger() {
      return null;
    },
    on(eventName, handler) {
      if (eventName === 'error') {
        errorHandler = handler;
      }
    },
    checkForUpdatesAndNotify() {
      return Promise.reject(new Error('release feed missing'));
    }
  };

  const result = startAutoUpdater({
    isPackaged: true,
    logger: { warn: (message) => warnings.push(message) },
    requireAutoUpdater: () => updater
  });

  assert.equal(result, updater);
  assert.equal(typeof errorHandler, 'function');
  errorHandler(new Error('event failure'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(warnings.join('\n'), /release feed missing/);
  assert.match(warnings.join('\n'), /event failure/);
});
