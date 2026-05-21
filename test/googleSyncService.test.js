const assert = require('node:assert/strict');
const test = require('node:test');

const { createGoogleSyncService } = require('../src/googleSyncService');

function createSessionManager() {
  return {
    getSessionEntities: (mode) => mode === 'interview'
      ? [{ id: 'acme', name: 'ACME' }]
      : [{ id: 'weekly_sync', name: 'Weekly Sync' }]
  };
}

test('google sync generates opportunity status proposals from Gmail', () => {
  const saved = [];
  const service = createGoogleSyncService({
    syncStore: { upsertProposal: (proposal) => { saved.push(proposal); return proposal; }, addAudit: () => {} },
    sessionManager: createSessionManager(),
    googleClient: {},
    now: () => new Date('2026-05-21T12:00:00.000Z')
  });

  const proposals = service.proposalsFromGmailMessage({
    id: 'msg-1',
    subject: 'ACME next round',
    snippet: 'We would like to move forward to the onsite.',
    from: 'recruiter@example.com'
  });

  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].action.actionType, 'updateOpportunity');
  assert.equal(proposals[0].action.payload.entityName, 'ACME');
  assert.equal(proposals[0].action.payload.outcome, 'advanced');
});

test('google sync generates calendar proposals from Google Calendar events', () => {
  const service = createGoogleSyncService({
    syncStore: { upsertProposal: (proposal) => proposal, addAudit: () => {} },
    sessionManager: createSessionManager(),
    googleClient: {},
    now: () => new Date('2026-05-21T12:00:00.000Z')
  });

  const proposals = service.proposalsFromCalendarEvent({
    id: 'cal-1',
    title: 'Weekly Sync',
    start: '2026-05-22T15:00:00.000Z'
  });

  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].action.actionType, 'saveCalendarEvent');
  assert.equal(proposals[0].action.payload.mode, 'meeting');
  assert.equal(proposals[0].action.payload.date, '2026-05-22T15:00:00.000Z');
});
