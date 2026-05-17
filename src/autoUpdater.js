function startAutoUpdater({ isPackaged, logger, requireAutoUpdater } = {}) {
  if (!isPackaged) {
    return null;
  }

  const loadAutoUpdater = requireAutoUpdater || (() => require('electron-updater').autoUpdater);
  const autoUpdater = loadAutoUpdater();

  autoUpdater.logger = logger;
  if (autoUpdater.logger && autoUpdater.logger.transports && autoUpdater.logger.transports.file) {
    autoUpdater.logger.transports.file.level = 'info';
  }

  autoUpdater.checkForUpdatesAndNotify();
  return autoUpdater;
}

module.exports = {
  startAutoUpdater
};
