const assert = require('node:assert/strict');
const test = require('node:test');

const { DEFAULT_GMAIL_QUERY, createGoogleSyncService } = require('../src/googleSyncService');

function createSessionManager() {
  return {
    getSessionEntities: (mode) => mode === 'interview'
      ? [{ id: 'acme', name: 'ACME' }]
      : [{ id: 'weekly_sync', name: 'Weekly Sync' }]
  };
}

test('google sync generates opportunity status proposals from Gmail', async () => {
  const saved = [];
  const service = createGoogleSyncService({
    syncStore: { upsertProposal: (proposal) => { saved.push(proposal); return proposal; }, addAudit: () => {} },
    sessionManager: createSessionManager(),
    googleClient: {},
    now: () => new Date('2026-05-21T12:00:00.000Z')
  });

  const proposals = await service.proposalsFromGmailMessage({
    id: 'msg-1',
    subject: 'ACME next round',
    snippet: 'We would like to move forward to the onsite.',
    from: 'recruiter@example.com'
  }, {});

  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].action.actionType, 'updateOpportunity');
  assert.equal(proposals[0].action.payload.entityName, 'ACME');
  assert.equal(proposals[0].action.payload.outcome, 'advanced');
});

test('google sync catches application update rejection emails from body text', async () => {
  const service = createGoogleSyncService({
    syncStore: { upsertProposal: (proposal) => proposal, addAudit: () => {} },
    sessionManager: {
      getSessionEntities: () => [{ id: 'microsoft', name: 'Microsoft' }]
    },
    googleClient: {},
    now: () => new Date('2026-05-21T12:00:00.000Z')
  });

  const proposals = await service.proposalsFromGmailMessage({
    id: 'msg-msft',
    subject: 'Microsoft Application Update',
    snippet: 'Thank you for the time and effort you invested in applying for the TSM position at Microsoft.',
    body: 'After a careful review of all applications, we have decided to move forward with other candidates whose qualifications more closely align with our current requirements.',
    from: 'Stephen Skalamera <skalamera@gmail.com>',
    internalDate: '1780000000000'
  }, {});

  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].action.actionType, 'updateOpportunity');
  assert.equal(proposals[0].action.payload.entityName, 'Microsoft');
  assert.equal(proposals[0].action.payload.outcome, 'rejected');
});

test('google sync creates rejected opportunity when an application update references a new company', async () => {
  const service = createGoogleSyncService({
    syncStore: { upsertProposal: (proposal) => proposal, addAudit: () => {} },
    sessionManager: createSessionManager(),
    googleClient: {},
    now: () => new Date('2026-05-21T12:00:00.000Z')
  });

  const proposals = await service.proposalsFromGmailMessage({
    id: 'msg-msft-new',
    subject: 'Microsoft Application Update',
    snippet: 'Thank you for applying for the TSM position at Microsoft.',
    body: 'We have decided to move forward with other candidates.',
    from: 'Stephen Skalamera <skalamera@gmail.com>'
  }, {});

  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].action.actionType, 'createOpportunity');
  assert.equal(proposals[0].action.payload.name, 'Microsoft');
  assert.equal(proposals[0].action.payload.outcome, 'rejected');
});

test('google sync scans the latest 15 Gmail messages and 25 calendar events by default', async () => {
  let gmailQuery = '';
  let gmailMaxResults = 0;
  let calendarMaxResults = 0;
  const service = createGoogleSyncService({
    syncStore: { upsertProposal: (proposal) => proposal, addAudit: () => {} },
    sessionManager: createSessionManager(),
    googleClient: {
      listGmailMessages: async ({ query, maxResults }) => {
        gmailQuery = query;
        gmailMaxResults = maxResults;
        return [];
      },
      listCalendarEvents: async ({ maxResults }) => {
        calendarMaxResults = maxResults;
        return [];
      }
    },
    now: () => new Date('2026-05-21T12:00:00.000Z')
  });

  await service.scan({ accessToken: 'token', settings: {} });

  assert.equal(gmailQuery, DEFAULT_GMAIL_QUERY);
  assert.equal(gmailQuery, '');
  assert.equal(gmailMaxResults, 15);
  assert.equal(calendarMaxResults, 25);
});

test('google sync does not use env LLM keys for Gmail parsing', async () => {
  const originalGeminiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'invalid-env-key';
  let calls = 0;
  const service = createGoogleSyncService({
    syncStore: { upsertProposal: (proposal) => proposal, addAudit: () => {} },
    sessionManager: createSessionManager(),
    googleClient: {},
    axiosClient: {},
    generateChat: async () => {
      calls += 1;
      return '{}';
    }
  });

  test.after(() => {
    if (originalGeminiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalGeminiKey;
    }
  });

  await service.proposalsFromGmailMessage({
    id: 'msg-env',
    subject: 'ACME update',
    snippet: 'We would like to move forward.'
  }, { llmProvider: 'gemini', llmModel: 'gemini-3.1-flash-lite' });

  assert.equal(calls, 0);
});

test('google sync generates calendar proposals from Google Calendar events', async () => {
  const service = createGoogleSyncService({
    syncStore: { upsertProposal: (proposal) => proposal, addAudit: () => {} },
    sessionManager: createSessionManager(),
    googleClient: {},
    now: () => new Date('2026-05-21T12:00:00.000Z')
  });

  const proposals = await service.proposalsFromCalendarEvent({
    id: 'cal-1',
    title: 'Weekly Sync',
    start: '2026-05-22T15:00:00.000Z'
  }, {});


  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].action.actionType, 'saveCalendarEvent');
  assert.equal(proposals[0].action.payload.mode, 'meeting');
  assert.equal(proposals[0].action.payload.date, '2026-05-22T15:00:00.000Z');
});
