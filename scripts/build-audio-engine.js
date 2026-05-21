const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const manifestPath = path.join(repoRoot, 'native', 'audio-engine', 'Cargo.toml');
const executableName = process.platform === 'win32'
  ? 'clyde-audio-engine.exe'
  : 'clyde-audio-engine';
const executablePath = path.join(
  repoRoot,
  'native',
  'audio-engine',
  'target',
  'release',
  executableName
);

const result = spawnSync('cargo', [
  'build',
  '--release',
  '--manifest-path',
  manifestPath
], {
  cwd: repoRoot,
  stdio: 'inherit'
});

if (result.error) {
  console.error(`Failed to run cargo: ${result.error.message}`);
  console.error('Install Rust from https://rustup.rs/ before packaging Clyde.');
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status || 1);
}

if (!fs.existsSync(executablePath)) {
  console.error(`Rust audio engine build finished, but ${executablePath} was not found.`);
  process.exit(1);
}
