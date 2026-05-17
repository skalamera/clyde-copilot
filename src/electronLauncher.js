const { spawn } = require('node:child_process');

function launchElectronApp({
  electronPath = require('electron'),
  spawnImpl = spawn,
  args = ['.'],
  env = process.env
} = {}) {
  const nextEnv = { ...env };
  delete nextEnv.ELECTRON_RUN_AS_NODE;

  return spawnImpl(electronPath, args, {
    stdio: 'inherit',
    env: nextEnv
  });
}

module.exports = {
  launchElectronApp
};
