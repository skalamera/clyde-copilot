const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const isDirBuild = process.argv.includes('--dir');
const mode = isDirBuild ? 'pack' : 'dist';
const buildRoot = path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'ClydeBuilds');
const outputDir = path.join(buildRoot, mode);
const repoDistDir = path.join(rootDir, 'dist');

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

const electronBuilderCli = path.join(rootDir, 'node_modules', 'electron-builder', 'cli.js');
const args = [electronBuilderCli, `--config.directories.output=${outputDir}`];
if (isDirBuild) {
  args.push('--dir');
}

const result = spawnSync(process.execPath, args, {
  cwd: rootDir,
  stdio: 'inherit',
  env: process.env,
});

if (result.status !== 0) {
  if (result.error) {
    console.error(result.error);
  }
  process.exit(result.status || 1);
}

fs.rmSync(repoDistDir, { recursive: true, force: true });
fs.mkdirSync(repoDistDir, { recursive: true });
fs.cpSync(outputDir, repoDistDir, { recursive: true });

console.log(`Copied ${mode} artifacts from ${outputDir} to ${repoDistDir}`);
