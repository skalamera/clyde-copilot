const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.join(__dirname, '..');

test('packaging uses the generated Clyde ghost icon', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const mainSource = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');

  assert.match(mainSource, /icon: getAppIconPath\(\)/);
  assert.match(mainSource, /function getAppIconPath\(\)/);
  assert.equal(pkg.build.icon, 'icon.png');
  assert.equal(pkg.build.win.icon, 'icon.png');
  assert.ok(Array.isArray(pkg.build.extraResources));
  assert.ok(pkg.build.extraResources.some((entry) => typeof entry === 'object'
    && entry.from === 'build/icon.png'
    && entry.to === 'icon.png'));
  assert.match(pkg.scripts.prestart, /generate-icon/);
  assert.match(pkg.scripts.prepack, /generate-icon/);
  assert.match(pkg.scripts.predist, /generate-icon/);
});
