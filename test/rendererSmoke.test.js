const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.join(__dirname, '..');

test('React renderer defines the required live controls and mode surfaces', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');

  for (const required of [
    'data-testid="mode-interview"',
    'data-testid="mode-meeting"',
    'data-testid="startBtn"',
    'data-testid="stopBtn"',
    'data-testid="saveBtn"',
    'data-testid="healthGrid"',
    'data-testid="liveVoiceMeters"',
    'data-testid="commandInput"',
    'data-testid="sessionTimeline"',
    'data-testid="timelineNav"',
    'aria-label="Settings"'
  ]) {
    assert.match(appSource, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('timeline replaces the live workspace when opened', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const returnStart = appSource.indexOf('return (');
  const settingsDrawerStart = appSource.indexOf('{settingsOpen', returnStart);
  const renderBlock = appSource.slice(returnStart, settingsDrawerStart);

  assert.match(renderBlock, /workspace-timeline/);
  assert.ok(renderBlock.indexOf('<BrandMasthead') < renderBlock.indexOf('<WorkspaceNav'));
  assert.ok(renderBlock.indexOf('<TimelineView') < renderBlock.indexOf('<StatusStrip'));
  assert.ok(renderBlock.indexOf('<StatusStrip') < renderBlock.indexOf('className="live-grid"'));
});

test('mode tabs live in the title bar', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const titleBarStart = appSource.indexOf('function TitleBar');
  const titleBarEnd = appSource.indexOf('function BrandMasthead', titleBarStart);
  const titleBarSource = appSource.slice(titleBarStart, titleBarEnd);

  assert.match(titleBarSource, /<ModeToggle/);
  assert.equal(titleBarSource.includes('Command center'), false);
  assert.equal(titleBarSource.includes('mode-chip'), false);
});

test('renderer source does not use raw innerHTML injection', () => {
  const rendererDir = path.join(repoRoot, 'src', 'renderer');
  const files = fs.readdirSync(rendererDir, { recursive: true })
    .filter((file) => /\.(jsx|js)$/.test(file));

  for (const file of files) {
    const source = fs.readFileSync(path.join(rendererDir, file), 'utf8');
    assert.equal(source.includes('innerHTML'), false, `${file} uses innerHTML`);
    assert.equal(source.includes('dangerouslySetInnerHTML'), false, `${file} uses dangerouslySetInnerHTML`);
  }
});
