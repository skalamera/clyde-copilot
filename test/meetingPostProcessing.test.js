const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildMeetingPostProcessPrompt,
  normalizeMeetingPostProcessResponse
} = require('../src/meetingPostProcessing');

const rawTranscript = [
  { speaker: 'Sarah Jenkins', text: 'We need to lock the launch date.' },
  { speaker: 'Marcus Thorne', text: 'I can send the vendor quote today.' },
  { speaker: 'Elena Rodriguez', text: 'I will update the rollout doc and share it by 3 PM.' }
];

test('meeting post-processing prompt asks for cleaned transcript, notes, and attendee action items', () => {
  const prompt = buildMeetingPostProcessPrompt(rawTranscript, [
    { name: 'Sarah Jenkins', role: 'PM' },
    { name: 'Marcus Thorne', role: 'Eng' }
  ]);

  assert.match(prompt, /cleaning and organizing a meeting transcript/i);
  assert.match(prompt, /Write detailed meeting notes/);
  assert.match(prompt, /organize them by attendee/i);
  assert.match(prompt, /Sarah Jenkins \(PM\)/);
});

test('meeting post-processing normalizes cleaned transcript and grouped action items', () => {
  const response = JSON.stringify({
    transcript: [
      { speaker: 'Sarah Jenkins', text: 'We need to lock the launch date.' },
      { speaker: 'Marcus Thorne', text: 'I can send the vendor quote today.' },
      { speaker: 'Elena Rodriguez', text: 'I will update the rollout doc and share it by 3 PM.' }
    ],
    notes: {
      summary: '**Meeting summary:**\nThe team aligned on launch timing.\n\n**Key points:**\n- Marcus sends the quote.\n- Elena updates the rollout doc.\n\n**Highlights:**\nThe launch date is still open.\n\n**Important notes:**\nConfirm the release owner before Friday.',
      actionItems: [
        { attendee: 'Marcus Thorne', items: ['Send the vendor quote today.'] },
        { attendee: 'Elena Rodriguez', items: ['Update the rollout doc and share it by 3 PM.'] }
      ]
    }
  });

  const normalized = normalizeMeetingPostProcessResponse(response, rawTranscript);

  assert.ok(normalized);
  assert.equal(normalized.transcript.length, 3);
  assert.equal(normalized.notes.summary.includes('Meeting summary'), true);
  assert.deepEqual(normalized.notes.actionItems, [
    { attendee: 'Marcus Thorne', items: ['Send the vendor quote today.'] },
    { attendee: 'Elena Rodriguez', items: ['Update the rollout doc and share it by 3 PM.'] }
  ]);
});
