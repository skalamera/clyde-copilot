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
  const { dialog } = require('electron');

  // Secure auto-updates by verifying the cryptographic code signature on Windows/macOS updates.
  // We do NOT set verifyUpdateCodeSignature = true here because in electron-updater v6,
  // verifyUpdateCodeSignature is a property getter/setter that overrides the verification function.
  // Instead, signature verification is automatically enabled by specifying publisherName in package.json/app-update.yml.
  autoUpdater.logger = logger;
  if (autoUpdater.logger && autoUpdater.logger.transports && autoUpdater.logger.transports.file) {
    autoUpdater.logger.transports.file.level = 'info';
  }

  if (typeof autoUpdater.on === 'function') {
    autoUpdater.on('error', (error) => {
      logger?.warn?.(`Auto update check failed: ${error?.message || error}`);
    });

    autoUpdater.on('update-downloaded', (info) => {
      logger?.info?.(`Update ${info.version} downloaded, preparing native confirmation dialog.`);
      dialog.showMessageBox({
        type: 'info',
        buttons: ['Restart and Install', 'Later'],
        defaultId: 0,
        cancelId: 1,
        title: 'Clyde Update Available',
        message: `Version ${info.version} is ready!`,
        detail: 'A new version of Clyde has been successfully downloaded. Would you like to restart and install the update now?'
      }).then((result) => {
        if (result.response === 0) {
          logger?.info?.('User clicked Restart and Install. Calling quitAndInstall.');
          autoUpdater.quitAndInstall();
        }
      });
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
