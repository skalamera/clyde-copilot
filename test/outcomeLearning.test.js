const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createSessionManager } = require('../src/sessionManager');
const {
  buildOutcomeCalibrationExamples,
  formatOutcomeCalibrationExamples,
  summarizeOutcomeCalibrationExamples
} = require('../src/outcomeLearning');

function addSession(manager, entity, title, transcriptText, rating = 3) {
  manager.saveSession({
    mode: 'interview',
    entity,
    title,
    phase: title,
    transcript: [
      { speaker: 'Interviewer', text: 'Walk me through your background.' },
      { speaker: 'You', text: transcriptText }
    ],
    grading: {
      status: 'complete',
      transcriptRating: rating,
      reasoning: `${entity.name} evaluation`,
      examples: [`${entity.name} example`]
    }
  });
}

test('outcome calibration examples ignore active opportunities and current opportunity', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clyde-calibration-'));
  const manager = createSessionManager({ appPath: tempDir });

  test.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  addSession(manager, { id: 'apollo', name: 'Apollo', role: 'Support Operations Manager' }, 'Recruiter Screen', 'I built a ticket QA workflow for Freshdesk.', 4);
  manager.updateEntity('interview', 'apollo', { outcome: 'active' });

  addSession(manager, { id: 'benchmark', name: 'Benchmark', role: 'Support Operations Manager' }, 'Recruiter Screen', 'I owned customer support analytics and reduced review time.', 5);
  manager.updateEntity('interview', 'benchmark', {
    outcome: 'offer',
    outcomeReason: 'Moved through all rounds and received an offer.',
    outcomeDate: '2026-05-12'
  });

  addSession(manager, { id: 'curbwaste', name: 'CurbWaste', role: 'Customer Support Manager' }, 'Recruiter Screen', 'I described ticket QA work without manager-level ownership.', 2);
  manager.updateEntity('interview', 'curbwaste', {
    outcome: 'rejected',
    outcomeReason: 'Feedback asked for clearer people management examples.',
    outcomeDate: '2026-05-10'
  });

  manager.updateEntity('interview', 'emptyco', {
    name: 'EmptyCo',
    role: 'Support Operations Manager',
    outcome: 'advanced'
  });

  const examples = buildOutcomeCalibrationExamples({
    sessionManager: manager,
    currentEntityId: 'apollo',
    role: 'Support Operations Manager',
    limit: 4
  });

  assert.deepEqual(examples.map((example) => example.entityId).sort(), ['benchmark', 'curbwaste']);
  assert.ok(examples.every((example) => example.outcome !== 'active'));
  assert.ok(examples.every((example) => example.transcriptCount > 0));
  assert.equal(examples.find((example) => example.entityId === 'curbwaste').outcomeReason, 'Feedback asked for clearer people management examples.');
});

test('outcome calibration examples keep a capped mix of rejected and positive outcomes', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clyde-calibration-cap-'));
  const manager = createSessionManager({ appPath: tempDir });

  test.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  for (const [id, outcome] of [
    ['rejected-one', 'rejected'],
    ['rejected-two', 'rejected'],
    ['advanced-one', 'advanced'],
    ['offer-one', 'offer']
  ]) {
    addSession(manager, { id, name: id, role: 'Support Operations Manager' }, 'Interview #1', `${id} transcript evidence.`, outcome === 'rejected' ? 2 : 5);
    manager.updateEntity('interview', id, { outcome });
  }

  const examples = buildOutcomeCalibrationExamples({
    sessionManager: manager,
    currentEntityId: 'current',
    role: 'Support Operations Manager',
    limit: 2
  });

  assert.equal(examples.length, 2);
  assert.ok(examples.some((example) => example.outcome === 'rejected'));
  assert.ok(examples.some((example) => example.outcome === 'advanced' || example.outcome === 'offer'));

  const promptText = formatOutcomeCalibrationExamples(examples);
  assert.match(promptText, /Real outcome calibration examples/);
  assert.match(promptText, /Outcome:/);
  assert.match(promptText, /Transcript evidence:/);
});

test('outcome calibration summary counts rejected and positive examples', () => {
  const summary = summarizeOutcomeCalibrationExamples([
    { outcome: 'rejected' },
    { outcome: 'advanced' },
    { outcome: 'offer' }
  ]);

  assert.deepEqual(summary, {
    total: 3,
    rejected: 1,
    advanced: 1,
    offer: 1,
    positive: 2
  });
});
