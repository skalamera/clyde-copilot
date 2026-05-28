const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildMeetingPreviewFallback,
  normalizeMeetingPreviewResponse,
  normalizeTranscriptTurns
} = require('../src/meetingSessionPreview');

test('meeting preview normalizes structured sections', () => {
  const preview = normalizeMeetingPreviewResponse(JSON.stringify({
    notes: {
      agenda: ['Support volume'],
      decisions: ['Route resets to self-serve'],
      actionItems: ['Stephen: update routing rules'],
      blockers: ['Wait times over 4 hours'],
      followUps: ['Confirm training readiness'],
      openQuestions: ['When is the launch video going out?']
    }
  }));

  assert.equal(preview.status, 'generated');
  assert.deepEqual(preview.notes.actionItems, ['Stephen: update routing rules']);
  assert.deepEqual(preview.notes.openQuestions, ['When is the launch video going out?']);
});

test('meeting preview falls back without blocking save', () => {
  const preview = normalizeMeetingPreviewResponse('not json', [
    { speaker: 'Stephen', text: 'Ticket volume is up 15%.' },
    { speaker: 'Alex', text: 'Can we route resets to self-serve?' }
  ], [{ type: 'action', body: 'Update routing rules.' }]);

  assert.equal(preview.status, 'fallback');
  assert.equal(preview.notes.agenda.length > 0, true);
  assert.deepEqual(preview.notes.actionItems, ['Update routing rules.']);
});

test('raw transcript normalization keeps original speaker and text values', () => {
  const turns = normalizeTranscriptTurns([
    { speaker: 'Alex', text: 'Original raw wording.' },
    { speaker: '', text: 'No speaker text.' }
  ]);

  assert.deepEqual(turns, [
    { speaker: 'Alex', text: 'Original raw wording.' },
    { speaker: 'Unknown', text: 'No speaker text.' }
  ]);
  assert.equal(buildMeetingPreviewFallback([]).notes.agenda[0].includes('No generated summary yet'), true);
});
