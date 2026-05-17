const { launchElectronApp } = require('../src/electronLauncher');

const child = launchElectronApp();

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
