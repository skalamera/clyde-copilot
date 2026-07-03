const assert = require('node:assert/strict');
const test = require('node:test');

const {
  OPPORTUNITIES_STATUS_ID,
  CALENDAR_EVENTS_ID,
  buildCalendarEventsKnowledge,
  buildOpportunitiesStatusKnowledge
} = require('../src/systemKnowledge');

test('opportunities status knowledge includes outcomes and active interview marker', () => {
  const item = buildOpportunitiesStatusKnowledge({
    opportunities: [
      { id: 'apollo', name: 'Apollo', role: 'Support Operations Manager', outcome: 'advanced', outcomeUpdatedAt: '2026-05-20T10:00:00.000Z' },
      { id: 'sage', name: 'Sage', role: 'Staff TechOps Manager', outcome: 'rejected', outcomeUpdatedAt: '2026-05-19T10:00:00.000Z' }
    ],
    activeInterviewId: 'apollo'
  });

  assert.equal(item.id, OPPORTUNITIES_STATUS_ID);
  assert.equal(item.type, 'system');
  assert.match(item.content, /Apollo/);
  assert.match(item.content, /status: advanced/);
  assert.match(item.content, /active interview: yes/);
  assert.match(item.content, /Sage/);
  assert.match(item.content, /status: rejected/);
});

test('calendar events knowledge includes ids, dates, titles, and associated entities', () => {
  const item = buildCalendarEventsKnowledge({
    events: [{
      id: 'evt-1',
      title: 'Apollo interview',
      date: '2026-05-26T19:00:00.000Z',
      entityId: 'apollo',
      entityName: 'Apollo',
      mode: 'interview'
    }]
  });

  assert.equal(item.id, CALENDAR_EVENTS_ID);
  assert.equal(item.type, 'system');
  assert.match(item.content, /evt-1/);
  assert.match(item.content, /Apollo interview/);
  assert.match(item.content, /2026-05-26T19:00:00.000Z/);
  assert.match(item.content, /entity: Apollo \(apollo\)/);
});

test('refreshSystemKnowledge upserts and indexes both system documents', async () => {
  const upserts = [];
  const uploads = [];
  const { refreshSystemKnowledge } = require('../src/systemKnowledge');

  const result = await refreshSystemKnowledge({
    settings: { userTier: 'pro', pineconeApiKey: 'pine', pineconeHost: 'https://index.example' },
    sessionManager: {
      getSessionEntities: () => [{ id: 'apollo', name: 'Apollo', role: 'Support Operations Manager', outcome: 'offer' }]
    },
    calendarStore: {
      listEvents: () => [{ id: 'evt-1', title: 'Apollo interview', date: '2026-05-26T19:00:00.000Z' }]
    },
    knowledgeManager: {
      upsertKnowledgeItem: (item) => {
        upserts.push(item);
        return item;
      },
      uploadToPinecone: async (id) => {
        uploads.push(id);
        return { id };
      }
    },
    activeInterviewId: 'apollo'
  });

  assert.equal(result.length, 2);
  assert.deepEqual(upserts.map((item) => item.id), [OPPORTUNITIES_STATUS_ID, CALENDAR_EVENTS_ID]);
  assert.deepEqual(uploads, [OPPORTUNITIES_STATUS_ID, CALENDAR_EVENTS_ID]);
});
