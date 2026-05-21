const path = require('node:path');

function resolveElectronStoragePaths(userDataPath) {
  if (!userDataPath) {
    throw new Error('userDataPath is required.');
  }

  return {
    userDataPath,
    sessionDataPath: path.join(userDataPath, 'Session')
  };
}

module.exports = {
  resolveElectronStoragePaths
};
