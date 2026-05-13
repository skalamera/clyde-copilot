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
    'aria-label="Settings"',
    'confidence-pill',
    'Edit details',
    'Edit interview',
    'deleteSessionEntity',
    'Active Meeting:',
    '+ Add New Meeting',
    'onChangeActiveMeeting'
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

test('meeting context fields are not rendered in settings setup', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const setupStart = appSource.indexOf('function SetupFields');
  const setupEnd = appSource.indexOf('function EmptyState', setupStart);
  const setupSource = appSource.slice(setupStart, setupEnd);

  assert.equal(setupSource.includes('Meeting title'), false);
  assert.equal(setupSource.includes('meetingAttendeesText'), false);
  assert.equal(setupSource.includes('meetingTitle'), false);
});

test('post-session save prompt supports interview and meeting destinations', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');

  assert.match(appSource, /function PostSessionSaveModal/);
  assert.match(appSource, /Save interview transcript/);
  assert.match(appSource, /Save meeting transcript/);
  assert.match(appSource, /Existing company/);
  assert.match(appSource, /New company/);
  assert.match(appSource, /Interview phase/);
  assert.match(appSource, /Interviewer/);
  assert.match(appSource, /Existing meeting/);
  assert.match(appSource, /New meeting/);
});

test('session creation flows expose date time pickers and save dates', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');

  for (const componentName of [
    'NewOpportunityModal',
    'NewMeetingModal',
    'PostSessionSaveModal',
    'ManualTranscriptModal',
    'EditSessionModal'
  ]) {
    const start = appSource.indexOf(`function ${componentName}`);
    const end = appSource.indexOf('\nfunction ', start + 1);
    const source = appSource.slice(start, end === -1 ? appSource.length : end);

    assert.match(source, /type="datetime-local"/, `${componentName} needs a date picker`);
  }

  assert.match(appSource, /date:\s*fromDateTimeLocal\(data\.date/);
  assert.match(appSource, /date:\s*fromDateTimeLocal\(payload\?\.date/);
});

test('meeting settings use long term memory naming', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const setupStart = appSource.indexOf('function SetupFields');
  const setupEnd = appSource.indexOf('function EmptyState', setupStart);
  const setupSource = appSource.slice(setupStart, setupEnd);

  assert.match(setupSource, /Long term memory/);
  assert.equal(setupSource.includes('Meeting memory'), false);
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

test('select option menus have readable dark colors', () => {
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');

  assert.match(cssSource, /color-scheme:\s*dark/);
  assert.match(cssSource, /select option\s*\{/);
  assert.match(cssSource, /background:\s*#071018/);
  assert.match(cssSource, /color:\s*#f5fbff/);
});

test('timeline renders evaluation notes as structured content', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');

  assert.match(appSource, /function EvaluationNotes/);
  assert.match(appSource, /parseEvaluationText/);
  assert.match(appSource, /evaluation-section/);
  assert.match(appSource, /evaluation-examples/);
  assert.match(appSource, /function buildNotes\(transcript, cards, mode = 'interview'\)/);
  assert.match(appSource, /summary: ''/);
  assert.match(appSource, /actionItems: \[\]/);
  assert.match(appSource, /session\?.mode === 'interview' \? 'Examples' : 'Action items'/);
  assert.match(cssSource, /\.evaluation-notes/);
  assert.match(cssSource, /\.evaluation-section h4/);
});
