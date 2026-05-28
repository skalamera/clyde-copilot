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

test('google sync creates an opportunity instead of marking an unknown company advanced', async () => {
  const service = createGoogleSyncService({
    syncStore: { upsertProposal: (proposal) => proposal, addAudit: () => {} },
    sessionManager: createSessionManager(),
    googleClient: {},
    now: () => new Date('2026-05-25T12:00:00-04:00')
  });

  const proposals = await service.proposalsFromGmailMessage({
    id: 'apollo-next-steps',
    subject: 'Re: Apollo | Next steps',
    snippet: 'We would like to move forward to the next interview.',
    body: 'Can you share availability for a 45-minute Zoom with Kenny Keesee?',
    from: 'James Thomas <james@apollo.io>'
  }, {});

  assert.equal(proposals.some((proposal) => proposal.action.actionType === 'updateOpportunity'), false);
  const create = proposals.find((proposal) => proposal.action.actionType === 'createOpportunity');
  assert.ok(create);
  assert.equal(create.action.payload.name, 'Apollo');
  assert.equal(create.action.payload.outcome, 'advanced');
});

test('LLM Gmail parsing creates unknown opportunities instead of updating missing records', async () => {
  const service = createGoogleSyncService({
    syncStore: { upsertProposal: (proposal) => proposal, addAudit: () => {} },
    sessionManager: createSessionManager(),
    googleClient: {},
    axiosClient: {},
    generateChat: async () => JSON.stringify({
      isUpdate: true,
      companyName: 'Apollo',
      outcome: 'advanced'
    })
  });

  const proposals = await service.proposalsFromGmailMessage({
    id: 'apollo-llm',
    subject: 'Apollo | Next steps',
    snippet: 'Next interview.'
  }, { llmProvider: 'local', localLlmUrl: 'http://localhost:1234/v1/chat/completions' });

  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].action.actionType, 'createOpportunity');
  assert.equal(proposals[0].action.payload.name, 'Apollo');
  assert.equal(proposals[0].action.payload.outcome, 'advanced');
});

test('google sync creates interview meeting request from recruiter scheduling email', async () => {
  const service = createGoogleSyncService({
    syncStore: { upsertProposal: (proposal) => proposal, addAudit: () => {} },
    sessionManager: {
      getSessionEntities: () => [{ id: 'apollo', name: 'Apollo' }]
    },
    googleClient: {},
    now: () => new Date('2026-05-25T12:00:00-04:00')
  });

  const proposals = await service.proposalsFromGmailMessage({
    id: 'apollo-next-steps',
    subject: 'Re: Apollo | Next steps',
    snippet: 'Can you share availability for a 45-minute Zoom with Kenny Keesee on Wednesday at 3:00pm EDT?',
    body: 'We would like to schedule the next interview, a 45-minute Zoom with Kenny Keesee on Wednesday at 3:00pm EDT.',
    from: 'James Thomas <james@apollo.io>'
  }, {});

  const meeting = proposals.find((proposal) => proposal.action.actionType === 'addInterviewMeetingRequest');
  assert.ok(meeting);
  assert.equal(meeting.action.payload.entityName, 'Apollo');
  assert.equal(meeting.action.payload.mode, 'interview');
  assert.equal(meeting.action.payload.durationMinutes, 45);
  assert.deepEqual(meeting.action.payload.attendees, ['Kenny Keesee']);
  assert.match(meeting.action.payload.date, /^2026-05-27T15:00/);
});

test('google sync deduplicates repeated Apollo advanced emails but keeps calendar action', async () => {
  const saved = [];
  const service = createGoogleSyncService({
    syncStore: {
      upsertProposal: (proposal) => {
        saved.push(proposal);
        return proposal;
      },
      addAudit: () => {}
    },
    sessionManager: {
      getSessionEntities: () => [{ id: 'apollo', name: 'Apollo' }]
    },
    googleClient: {
      listGmailMessages: async () => [
        { id: 'm1', subject: 'Apollo | Next steps', snippet: 'We would like to move forward to the next interview.' },
        { id: 'm2', subject: 'Interview confirmation', snippet: 'WED 27 Virtual Onsite 1 - Kenny with Apollo is confirmed.' },
        { id: 'm3', subject: 'Re: Apollo | Next steps', snippet: 'Great, thanks. I just sent an invite for Wednesday at 3:00pm EDT.' }
      ],
      listCalendarEvents: async () => [{
        id: 'cal-apollo',
        title: 'Virtual Onsite 1 - Kenny with Apollo',
        start: '2026-05-27T15:00:00-04:00'
      }]
    },
    now: () => new Date('2026-05-25T12:00:00-04:00')
  });

  await service.scan({ accessToken: 'token', settings: {} });

  assert.equal(saved.length, 2);
  assert.equal(saved.filter((proposal) => proposal.action.actionType === 'updateOpportunity').length, 1);
  assert.equal(saved.filter((proposal) => proposal.action.actionType === 'saveCalendarEvent').length, 1);
  assert.equal(saved[0].action.payload.entityName, 'Apollo');
});

test('google sync skips outcome proposals that match the current opportunity status', async () => {
  const saved = [];
  const service = createGoogleSyncService({
    syncStore: {
      upsertProposal: (proposal) => {
        saved.push(proposal);
        return proposal;
      },
      addAudit: () => {}
    },
    sessionManager: {
      getSessionEntities: () => [{ id: 'apollo', name: 'Apollo', outcome: 'advanced' }]
    },
    googleClient: {
      listGmailMessages: async () => [
        { id: 'm1', subject: 'Re: Apollo | Next steps', snippet: 'We would like to move forward to the next interview.' }
      ],
      listCalendarEvents: async () => []
    },
    now: () => new Date('2026-05-25T12:00:00-04:00')
  });

  await service.scan({ accessToken: 'token', settings: {} });

  assert.equal(saved.some((proposal) => proposal.action.actionType === 'updateOpportunity'), false);
});

test('google sync ignores newsletters job alerts and unrelated bulk mail', async () => {
  const service = createGoogleSyncService({
    syncStore: { upsertProposal: (proposal) => proposal, addAudit: () => {} },
    sessionManager: createSessionManager(),
    googleClient: {},
    axiosClient: {},
    generateChat: async () => JSON.stringify({
      isUpdate: true,
      companyName: 'Linkedin',
      outcome: 'rejected'
    })
  });

  const messages = [
    {
      id: 'mbmarket',
      subject: 'The MB Market Daily Update & Auctions Ending Today (May 25, 2026)',
      snippet: 'Auctions ending today.',
      from: 'The MB Market <mail@thembmarket.com>'
    },
    {
      id: 'gloss',
      subject: 'New Jobs: Fraud Operations Manager at GlossGenius and 11 more jobs',
      snippet: 'New jobs you may like.',
      from: 'Job Alert <jobalert@example.com>'
    },
    {
      id: 'linkedin',
      subject: "How did Anthropic's AI find 10,000 software security issues in 30 days?",
      snippet: 'LinkedIn news digest.',
      from: 'LinkedIn <news@linkedin.com>'
    }
  ];
  const proposals = (await Promise.all(messages.map((message) => service.proposalsFromGmailMessage(message, {
    llmProvider: 'local',
    localLlmUrl: 'http://localhost:1234/v1/chat/completions'
  })))).flat();

  assert.equal(proposals.length, 0);
});

test('google sync dismisses stale pending proposals for rescanned sources', async () => {
  const dismissed = [];
  const saved = [];
  const service = createGoogleSyncService({
    syncStore: {
      upsertProposal: (proposal) => {
        saved.push(proposal);
        return proposal;
      },
      dismissPendingProposals: (predicate, result) => {
        const stale = [
          {
            id: 'old-update',
            status: 'pending',
            dedupeKey: 'gmail:opportunity:apollo:advanced',
            source: { type: 'gmail', id: 'm1' }
          },
          {
            id: 'old-calendar',
            status: 'pending',
            dedupeKey: 'calendar:anniv:saveCalendarEvent',
            source: { type: 'calendar', id: 'anniv' }
          }
        ].filter(predicate);
        dismissed.push(...stale.map((proposal) => ({ ...proposal, result })));
        return stale;
      },
      addAudit: () => {}
    },
    sessionManager: createSessionManager(),
    googleClient: {
      listGmailMessages: async () => [
        {
          id: 'm1',
          subject: 'Apollo | Next steps',
          snippet: 'We would like to move forward to the next interview.',
          from: 'James Thomas <james@apollo.io>'
        }
      ],
      listCalendarEvents: async () => [
        { id: 'anniv', title: "Nick and Lauren's Anniv", start: '2033-07-22' }
      ]
    },
    now: () => new Date('2026-05-25T12:00:00-04:00')
  });

  await service.scan({ accessToken: 'token', settings: {} });

  assert.equal(saved.length, 1);
  assert.equal(saved[0].action.actionType, 'createOpportunity');
  assert.deepEqual(dismissed.map((proposal) => proposal.id).sort(), ['old-calendar', 'old-update']);
  assert.equal(dismissed[0].result.reason, 'stale-after-rescan');
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

test('google sync ignores unrelated Google Calendar events', async () => {
  const service = createGoogleSyncService({
    syncStore: { upsertProposal: (proposal) => proposal, addAudit: () => {} },
    sessionManager: createSessionManager(),
    googleClient: {},
    now: () => new Date('2026-05-21T12:00:00.000Z')
  });

  const unrelated = [
    { id: 'anniv', title: "Nick and Lauren's Anniv", start: '2033-07-22' },
    { id: 'race', title: 'GT Manufacturers Cup - Nurburgring 24h', start: '2033-05-08' },
    { id: 'birthday', title: "Sophia's Birthday", start: '2033-04-03' }
  ];
  const proposals = (await Promise.all(unrelated.map((event) => service.proposalsFromCalendarEvent(event, {})))).flat();

  assert.equal(proposals.length, 0);
});

test('google sync keeps interview calendar proposals with job language', async () => {
  const service = createGoogleSyncService({
    syncStore: { upsertProposal: (proposal) => proposal, addAudit: () => {} },
    sessionManager: createSessionManager(),
    googleClient: {},
    now: () => new Date('2026-05-21T12:00:00.000Z')
  });

  const proposals = await service.proposalsFromCalendarEvent({
    id: 'cal-apollo',
    title: 'Virtual Onsite 1 - Kenny with Apollo',
    description: 'Interview with hiring manager.',
    start: '2026-05-27T15:00:00-04:00'
  }, {});

  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].action.actionType, 'saveCalendarEvent');
  assert.equal(proposals[0].action.payload.mode, 'interview');
});
