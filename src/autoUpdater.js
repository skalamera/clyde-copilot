function startAutoUpdater({ enabled = true, isPackaged, logger, requireAutoUpdater } = {}) {
  if (!isPackaged) {
    return null;
  }
  if (!enabled) {
    logger?.info?.('Auto updater disabled.');
    return null;
  }

  const loadAutoUpdater = requireAutoUpdater || (() => require('electron-updater').autoUpdater);
  const autoUpdater = loadAutoUpdater();

  autoUpdater.logger = logger;
  if (autoUpdater.logger && autoUpdater.logger.transports && autoUpdater.logger.transports.file) {
    autoUpdater.logger.transports.file.level = 'info';
  }

  if (typeof autoUpdater.on === 'function') {
    autoUpdater.on('error', (error) => {
      logger?.warn?.(`Auto update check failed: ${error?.message || error}`);
    });
  }

  const checkResult = autoUpdater.checkForUpdatesAndNotify();
  if (checkResult && typeof checkResult.catch === 'function') {
    checkResult.catch((error) => {
      logger?.warn?.(`Auto update check failed: ${error?.message || error}`);
    });
  }
  return autoUpdater;
}

module.exports = {
  startAutoUpdater
};
