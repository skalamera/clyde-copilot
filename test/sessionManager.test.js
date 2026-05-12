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
    notes: { summary: 'Release ownership was discussed.', actionItems: ['Assign owner'] },
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

  assert.equal(meetings.length, 1);
  assert.equal(meetings[0].mode, 'meeting');
  assert.deepEqual(meetings[0].notes.actionItems, ['Assign owner']);
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
