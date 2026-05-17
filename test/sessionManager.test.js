const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createSessionManager } = require('../src/sessionManager');

test('session manager saves and reads interview and meeting sessions', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clyde-sessions-'));
  const manager = createSessionManager({ appPath: tempDir });

  test.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const interviewId = manager.saveSession({
    mode: 'interview',
    entity: { id: 'acme', name: 'Acme', role: 'Staff Engineer' },
    title: 'Technical screen',
    phase: 'Technical Screen',
    attendees: [{ name: 'Avery', role: 'Interviewer' }],
    transcript: [{ speaker: 'Avery', text: 'Tell me about a project.' }],
    notes: { summary: 'Candidate discussed project work.', actionItems: [] },
    cards: [{ type: 'answer', title: 'Answer', bullets: ['Built the platform.'] }],
    grading: { status: 'pending' }
  });

  const meetingId = manager.saveSession({
    mode: 'meeting',
    entity: { id: 'platform-weekly', name: 'Platform weekly' },
    title: 'Platform weekly sync',
    attendees: [{ name: 'Morgan', role: 'PM' }],
    transcript: [{ speaker: 'Morgan', text: 'We need a release owner.' }],
    notes: { summary: 'Release ownership was discussed.', actionItems: [{ attendee: 'Morgan', items: ['Assign owner'] }] },
    cards: [{ type: 'recap', title: 'Recap', body: 'Release owner needed.' }],
    grading: null
  });

  assert.ok(interviewId);
  assert.ok(meetingId);

  const interviews = manager.getSessions({ mode: 'interview', entityId: 'acme' });
  const meetings = manager.getSessions({ mode: 'meeting', entityId: 'platform-weekly' });

  assert.equal(interviews.length, 1);
  assert.equal(interviews[0].mode, 'interview');
  assert.equal(interviews[0].entity.name, 'Acme');
  assert.equal(interviews[0].phase, 'Technical Screen');

  const updatedEntity = manager.updateEntity('interview', 'acme', {
    name: 'Acme Labs',
    role: 'Principal Engineer'
  });
  const updatedInterviews = manager.getSessions({ mode: 'interview', entityId: 'acme' });

  assert.equal(updatedEntity.name, 'Acme Labs');
  assert.equal(updatedInterviews[0].entity.name, 'Acme Labs');
  assert.equal(updatedInterviews[0].entity.role, 'Principal Engineer');

  assert.equal(meetings.length, 1);
  assert.equal(meetings[0].mode, 'meeting');
  assert.deepEqual(meetings[0].notes.actionItems, [{ attendee: 'Morgan', items: ['Assign owner'] }]);

  assert.equal(manager.deleteEntity('meeting', 'platform-weekly'), true);
  assert.deepEqual(manager.getSessionEntities('meeting'), []);
  assert.deepEqual(manager.getSessions({ mode: 'meeting', entityId: 'platform-weekly' }), []);
});

test('session manager can read existing interview manager files', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clyde-legacy-'));
  const legacyDir = path.join(tempDir, 'Interviews', 'acme');
  fs.mkdirSync(legacyDir, { recursive: true });
  fs.writeFileSync(path.join(legacyDir, 'meta.json'), JSON.stringify({ name: 'Acme', role: 'Engineer' }, null, 2));
  fs.writeFileSync(path.join(legacyDir, '123.json'), JSON.stringify({
    id: '123',
    company: 'Acme',
    role: 'Engineer',
    phase: 'Recruiter Screen',
    interviewerName: 'Sam',
    interviewerTitle: 'Recruiter',
    date: '2026-05-11T12:00:00.000Z',
    transcript: [{ speaker: 'Sam', text: 'Welcome.' }],
    gradingStatus: 'complete',
    grade: 'A',
    reasoning: 'Clear answers.',
    examples: ['Good context.']
  }, null, 2));

  const manager = createSessionManager({ appPath: tempDir });

  test.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const sessions = manager.getSessions({ mode: 'interview', entityId: 'acme' });

  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].id, '123');
  assert.equal(sessions[0].mode, 'interview');
  assert.equal(sessions[0].entity.name, 'Acme');
  assert.equal(sessions[0].grading.grade, 'A');
});

test('deleteEntity removes legacy interview company folders', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clyde-legacy-delete-'));
  const legacyDir = path.join(tempDir, 'Interviews', 'curbwaste');
  fs.mkdirSync(legacyDir, { recursive: true });
  fs.writeFileSync(path.join(legacyDir, 'meta.json'), JSON.stringify({ name: 'CurbWaste' }, null, 2));
  fs.writeFileSync(path.join(legacyDir, '123.json'), JSON.stringify({
    id: '123',
    company: 'CurbWaste',
    phase: 'Interview #1',
    transcript: [{ speaker: 'Interviewer', text: 'Welcome.' }]
  }, null, 2));

  const manager = createSessionManager({ appPath: tempDir });

  test.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  assert.equal(manager.getSessions({ mode: 'interview', entityId: 'curbwaste' }).length, 1);
  assert.equal(manager.deleteEntity('interview', 'curbwaste'), true);
  assert.equal(fs.existsSync(legacyDir), false);
  assert.deepEqual(manager.getSessions({ mode: 'interview', entityId: 'curbwaste' }), []);
});

test('deleteEntity removes native and legacy interview folders together', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clyde-hybrid-delete-'));
  const legacyDir = path.join(tempDir, 'Interviews', 'curbwaste');
  fs.mkdirSync(legacyDir, { recursive: true });
  fs.writeFileSync(path.join(legacyDir, 'meta.json'), JSON.stringify({ name: 'CurbWaste' }, null, 2));
  fs.writeFileSync(path.join(legacyDir, 'legacy.json'), JSON.stringify({
    id: 'legacy',
    company: 'CurbWaste',
    transcript: [{ speaker: 'Interviewer', text: 'Legacy.' }]
  }, null, 2));

  const manager = createSessionManager({ appPath: tempDir });
  manager.saveSession({
    mode: 'interview',
    entity: { id: 'curbwaste', name: 'CurbWaste', role: 'Customer Support Manager' },
    title: 'Native session',
    transcript: [{ speaker: 'Interviewer', text: 'Native.' }]
  });

  test.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  assert.equal(manager.getSessions({ mode: 'interview', entityId: 'curbwaste' }).length, 2);
  assert.equal(manager.deleteEntity('interview', 'curbwaste'), true);
  assert.equal(fs.existsSync(path.join(tempDir, 'Sessions', 'interview', 'curbwaste')), false);
  assert.equal(fs.existsSync(legacyDir), false);
  assert.deepEqual(manager.getSessions({ mode: 'interview', entityId: 'curbwaste' }), []);
});

test('deleting the last interview session resets company confidence', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clyde-confidence-reset-'));
  const manager = createSessionManager({ appPath: tempDir });

  test.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  manager.saveSession({
    mode: 'interview',
    entity: { id: 'apollo', name: 'Apollo', role: 'Support Operations Manager' },
    title: 'Recruiter Screen',
    transcript: [{ speaker: 'Interviewer', text: 'Tell me about yourself.' }]
  });

  manager.updateEntityConfidence('apollo', 78, 'up');

  let entities = manager.getSessionEntities('interview');
  assert.equal(entities[0].confidence, 78);

  const [session] = manager.getSessions({ mode: 'interview', entityId: 'apollo' });
  assert.ok(session);
  assert.equal(manager.deleteSession({ mode: 'interview', id: session.id, entityId: 'apollo' }), true);

  entities = manager.getSessionEntities('interview');
  assert.equal(entities[0].confidence, 0);
  assert.deepEqual(manager.getSessions({ mode: 'interview', entityId: 'apollo' }), []);
});

test('saving a generated-id session twice updates the original record', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clyde-session-resave-'));
  const manager = createSessionManager({ appPath: tempDir });

  test.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const record = {
    mode: 'interview',
    entity: { id: 'apollo', name: 'Apollo', role: 'Engineer' },
    title: 'Recruiter Screen',
    phase: 'Recruiter Screen',
    transcript: [{ speaker: 'Interviewer', text: 'Tell me about yourself.' }],
    grading: { status: 'pending' }
  };

  const firstId = manager.saveSession(record);
  record.grading = { status: 'complete', transcriptRating: 5 };
  const secondId = manager.saveSession(record);

  const sessions = manager.getSessions({ mode: 'interview', entityId: 'apollo' });

  assert.equal(secondId, firstId);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].grading.transcriptRating, 5);
});

test('session manager normalizes and preserves transcript star ratings', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clyde-session-stars-'));
  const manager = createSessionManager({ appPath: tempDir });

  test.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  manager.saveSession({
    mode: 'interview',
    entity: { id: 'apollo', name: 'Apollo', role: 'Support Operations Manager' },
    title: 'Recruiter Screen',
    transcript: [{ speaker: 'Interviewer', text: 'Walk me through your background.' }],
    grading: {
      status: 'complete',
      transcriptRating: 4.6,
      reasoning: 'Strong support tooling examples.',
      examples: ['Explained ticket QA process.']
    }
  });

  const [session] = manager.getSessions({ mode: 'interview', entityId: 'apollo' });

  assert.equal(session.grading.transcriptRating, 5);
  assert.equal(session.grading.reasoning, 'Strong support tooling examples.');
  assert.deepEqual(session.grading.examples, ['Explained ticket QA process.']);
});

test('saving a session preserves existing overall confidence when no new score is supplied', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clyde-confidence-preserve-'));
  const manager = createSessionManager({ appPath: tempDir });

  test.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  manager.saveSession({
    mode: 'interview',
    entity: { id: 'apollo', name: 'Apollo', role: 'Support Operations Manager' },
    title: 'Recruiter Screen',
    transcript: [{ speaker: 'Interviewer', text: 'Tell me about yourself.' }]
  });
  manager.updateEntityConfidence('apollo', 87, 'up');
  manager.saveSession({
    mode: 'interview',
    entity: { id: 'apollo', name: 'Apollo', role: 'Support Operations Manager' },
    title: 'Technical Screen',
    transcript: [{ speaker: 'Interviewer', text: 'Describe your workflow.' }]
  });

  const [entity] = manager.getSessionEntities('interview');

  assert.equal(entity.confidence, 87);
  assert.equal(entity.trend, 'up');
});

test('graded interview sessions expose evaluation text as notes without action items', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clyde-session-eval-'));
  const manager = createSessionManager({ appPath: tempDir });

  test.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  manager.saveSession({
    mode: 'interview',
    entity: { id: 'apollo', name: 'Apollo', role: 'Support Operations Manager' },
    title: 'Recruiter Screen',
    transcript: [{ speaker: 'Interviewer', text: 'Walk me through your background.' }],
    grading: {
      status: 'complete',
      grade: 'A',
      reasoning: 'Clear examples tied to the support operations role.',
      examples: ['Explained ticket QA process.', 'Named escalation improvements.']
    }
  });

  const [session] = manager.getSessions({ mode: 'interview', entityId: 'apollo' });

  assert.equal(session.notes.summary, 'Clear examples tied to the support operations role.');
  assert.deepEqual(session.notes.actionItems, []);
});

test('interview grading does not turn examples into action items', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clyde-session-no-actions-'));
  const manager = createSessionManager({ appPath: tempDir });

  test.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  manager.saveSession({
    mode: 'interview',
    entity: { id: 'apollo', name: 'Apollo', role: 'Support Operations Manager' },
    title: 'Recruiter Screen',
    transcript: [{ speaker: 'Interviewer', text: 'Walk me through your background.' }],
    grading: {
      status: 'complete',
      grade: 'A',
      reasoning: 'Strong fit for the role.',
      examples: ['Mentioned systems work.']
    }
  });

  const [session] = manager.getSessions({ mode: 'interview', entityId: 'apollo' });

  assert.equal(session.notes.summary, 'Strong fit for the role.');
  assert.deepEqual(session.notes.actionItems, []);
});

test('interview entities store outcome fields and default old records to active', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clyde-outcome-meta-'));
  const manager = createSessionManager({ appPath: tempDir });

  test.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  manager.saveSession({
    mode: 'interview',
    entity: { id: 'apollo', name: 'Apollo', role: 'Support Operations Manager' },
    title: 'Recruiter Screen',
    transcript: [{ speaker: 'Interviewer', text: 'Tell me about yourself.' }]
  });

  let [entity] = manager.getSessionEntities('interview');
  assert.equal(entity.outcome, 'active');
  assert.equal(entity.outcomeReason, '');
  assert.equal(entity.outcomeDate, '');
  assert.equal(entity.outcomeUpdatedAt, '');

  const updated = manager.updateEntity('interview', 'apollo', {
    outcome: 'rejected',
    outcomeReason: 'Recruiter said the team chose a candidate with deeper Freshdesk admin experience.',
    outcomeDate: '2026-05-15'
  });

  assert.equal(updated.outcome, 'rejected');
  assert.equal(updated.outcomeReason, 'Recruiter said the team chose a candidate with deeper Freshdesk admin experience.');
  assert.equal(updated.outcomeDate, '2026-05-15');
  assert.match(updated.outcomeUpdatedAt, /^\d{4}-\d{2}-\d{2}T/);

  manager.updateEntityConfidence('apollo', 41, 'down');
  manager.saveSession({
    mode: 'interview',
    entity: { id: 'apollo', name: 'Apollo', role: 'Support Operations Manager' },
    title: 'Technical Screen',
    transcript: [{ speaker: 'Interviewer', text: 'Describe your ticket QA process.' }]
  });

  [entity] = manager.getSessionEntities('interview');
  assert.equal(entity.confidence, 41);
  assert.equal(entity.trend, 'down');
  assert.equal(entity.outcome, 'rejected');
  assert.equal(entity.outcomeReason, 'Recruiter said the team chose a candidate with deeper Freshdesk admin experience.');
  assert.equal(entity.outcomeDate, '2026-05-15');
  assert.match(entity.outcomeUpdatedAt, /^\d{4}-\d{2}-\d{2}T/);
});
