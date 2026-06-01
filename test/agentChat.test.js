const assert = require('node:assert/strict');
const test = require('node:test');

const { createAgentChat } = require('../src/agentChat');

test('free tier chat uses only active interview or meeting context', async () => {
  const knowledgeCalls = [];
  const sessions = [{
    id: 'abc123',
    mode: 'interview',
    entity: { id: 'apollo', name: 'Apollo' },
    title: 'Recruiter Screen',
    transcript: [{ speaker: 'Interviewer', text: 'Tell me about Finn.' }],
    notes: { summary: 'Apollo cares about Finn support automation.' }
  }];
  const agent = createAgentChat({
    settings: { userTier: 'free', llmProvider: 'local', llmModel: 'model', localLlmUrl: 'http://local' },
    knowledgeManager: {
      listKnowledge: (filters) => {
        knowledgeCalls.push(filters);
        return [{ id: 'k1', filename: 'Global.txt', content: 'This should not be used.' }];
      }
    },
    sessionManager: {
      getSessions: (filters) => {
        assert.deepEqual(filters, { mode: 'interview', entityId: 'apollo' });
        return sessions;
      }
    },
    generateChat: async (request) => {
      assert.match(request.messages[0].content, /Recruiter Screen/);
      assert.match(request.messages[0].content, /Finn support automation/);
      assert.doesNotMatch(request.messages[0].content, /Global\.txt/);
      return JSON.stringify({
        message: { content: 'Apollo cares about Finn.', citations: [] },
        pendingAction: null
      });
    }
  });

  const result = await agent.sendMessage({
    sessionId: 'chat-1',
    message: 'What does Apollo care about?',
    tier: 'free',
    mode: 'interview',
    activeEntityId: 'apollo',
    selectedSourceIds: ['k1'],
    sourceMode: 'selected'
  });

  assert.deepEqual(knowledgeCalls, []);
  assert.equal(result.message.content, 'Apollo cares about Finn.');
});

test('pro tier chat includes pinecone matches when configured', async () => {
  let pineconeCalled = false;
  const agent = createAgentChat({
    settings: {
      userTier: 'pro',
      llmProvider: 'gemini',
      llmModel: 'gemini-3.1-flash-lite',
      llmApiKey: 'key',
      pineconeApiKey: 'pine',
      pineconeHost: 'https://index.example'
    },
    knowledgeManager: { listKnowledge: () => [] },
    pineconeClient: {
      searchKnowledgeVectors: async () => {
        pineconeCalled = true;
        return [{ knowledgeId: 'p1', source: 'Pinecone result', text: 'ACME rejected the candidate.' }];
      }
    },
    generateChat: async (request) => {
      assert.match(request.messages[0].content, /ACME rejected/);
      return JSON.stringify({ message: { content: 'ACME context found.', citations: [] }, pendingAction: null });
    }
  });

  const result = await agent.sendMessage({ sessionId: 'chat-2', message: 'What happened with ACME?', tier: 'pro' });

  assert.equal(pineconeCalled, true);
  assert.equal(result.message.content, 'ACME context found.');
});

test('pro active context includes pinned files and pinecone matches', async () => {
  const agent = createAgentChat({
    settings: {
      userTier: 'pro',
      llmProvider: 'local',
      llmModel: 'model',
      pineconeApiKey: 'pine',
      pineconeHost: 'https://index.example',
      pinnedKnowledgeIds: ['pin-1']
    },
    knowledgeManager: {
      getKnowledgeItem: (id) => (
        id === 'pin-1'
          ? { id, filename: 'Pinned brief.txt', content: 'Pinned file says ACME uses Intercom.' }
          : null
      )
    },
    sessionManager: {
      getSessions: () => [{
        id: 's1',
        mode: 'interview',
        entity: { id: 'acme', name: 'ACME' },
        title: 'Hiring Manager',
        transcript: [{ speaker: 'You', text: 'I have Intercom certification.' }]
      }]
    },
    pineconeClient: {
      searchKnowledgeVectors: async () => [{ knowledgeId: 'p1', source: 'Pinecone hit', text: 'Vector match for Intercom.' }]
    },
    generateChat: async (request) => {
      assert.match(request.messages[0].content, /Hiring Manager/);
      assert.match(request.messages[0].content, /Pinned brief\.txt/);
      assert.match(request.messages[0].content, /Vector match for Intercom/);
      return JSON.stringify({ message: { content: 'Found Intercom context.', citations: [] }, pendingAction: null });
    }
  });

  const result = await agent.sendMessage({
    sessionId: 'chat-pro-active',
    message: 'What Intercom context do we have?',
    tier: 'pro',
    mode: 'interview',
    activeEntityId: 'acme'
  });

  assert.equal(result.message.content, 'Found Intercom context.');
});

test('pro active context scopes pinecone matches to the active Apollo entity', async () => {
  const filters = [];
  const agent = createAgentChat({
    settings: {
      userTier: 'pro',
      llmProvider: 'local',
      llmModel: 'model',
      pineconeApiKey: 'pine',
      pineconeHost: 'https://index.example'
    },
    knowledgeManager: { listKnowledge: () => [] },
    sessionManager: {
      getSessions: () => [{
        id: 'apollo-1',
        mode: 'interview',
        entity: { id: 'apollo', name: 'Apollo' },
        title: 'Apollo Support Operations Manager',
        transcript: [{ speaker: 'Interviewer', text: 'Apollo onboarding question.' }]
      }]
    },
    pineconeClient: {
      searchKnowledgeVectors: async (_query, _settings, options) => {
        filters.push(options.filter || null);
        return [{
          knowledgeId: 'apollo-1',
          source: 'Apollo transcript',
          text: 'Apollo onboarding context.'
        }];
      }
    },
    generateChat: async (request) => {
      assert.match(request.messages[0].content, /Apollo onboarding context/);
      assert.doesNotMatch(request.messages[0].content, /Sigma/);
      return JSON.stringify({ message: { content: 'Apollo only.', citations: [] }, pendingAction: null });
    }
  });

  const result = await agent.sendMessage({
    sessionId: 'chat-active-context',
    message: 'What matters for Apollo?',
    tier: 'pro',
    mode: 'interview',
    activeEntityId: 'apollo',
    sourceMode: 'active-context'
  });

  assert.deepEqual(filters, [{
    $or: [
      {
        mode: { $eq: 'interview' },
        entityId: { $eq: 'apollo' }
      },
      {
        entityId: { $in: ['', 'general'] }
      }
    ]
  }]);
  assert.equal(result.message.content, 'Apollo only.');
});

test('active context includes entity-scoped files', async () => {
  const agent = createAgentChat({
    settings: { userTier: 'free', llmProvider: 'local', llmModel: 'model' },
    knowledgeManager: {
      listEntityKnowledge: () => [{
        id: 'upload:interview:acme:1',
        filename: 'ACME brief.txt',
        content: 'ACME uses Kafka for billing events.',
        type: 'upload',
        metadata: { mode: 'interview', entityId: 'acme' }
      }]
    },
    sessionManager: { getSessions: () => [] },
    generateChat: async (request) => {
      assert.match(request.messages[0].content, /ACME brief\.txt/);
      assert.match(request.messages[0].content, /Kafka for billing events/);
      return JSON.stringify({ message: { content: 'Entity file included.', citations: [] }, pendingAction: null });
    }
  });

  const result = await agent.sendMessage({
    sessionId: 'chat-entity-files',
    message: 'What does ACME use?',
    tier: 'free',
    mode: 'interview',
    activeEntityId: 'acme'
  });

  assert.equal(result.message.content, 'Entity file included.');
});

test('pro all sources includes interview and meeting transcripts', async () => {
  const calls = [];
  const agent = createAgentChat({
    settings: { userTier: 'pro', llmProvider: 'local', llmModel: 'model', pinnedKnowledgeIds: ['pin-all'] },
    knowledgeManager: {
      getKnowledgeItem: (id) => (
        id === 'pin-all'
          ? { id, filename: 'Pinned all.txt', content: 'Pinned context should be included with all sources.' }
          : null
      )
    },
    sessionManager: {
      getSessions: (filters) => {
        calls.push(filters);
        if (filters.mode === 'interview') {
          return [{
            id: 'i1',
            mode: 'interview',
            entity: { id: 'apollo', name: 'Apollo' },
            title: 'Recruiter Screen',
            transcript: [{ speaker: 'Interviewer', text: 'Apollo interview transcript.' }]
          }];
        }
        return [{
          id: 'm1',
          mode: 'meeting',
          entity: { id: 'weekly', name: 'Weekly Sync' },
          title: 'Planning Meeting',
          transcript: [{ speaker: 'Morgan', text: 'Meeting transcript.' }]
        }];
      }
    },
    generateChat: async (request) => {
      assert.match(request.messages[0].content, /Apollo interview transcript/);
      assert.match(request.messages[0].content, /Meeting transcript/);
      assert.match(request.messages[0].content, /Pinned context should be included/);
      return JSON.stringify({ message: { content: 'Both transcript types included.', citations: [] }, pendingAction: null });
    }
  });

  const result = await agent.sendMessage({
    sessionId: 'chat-pro-all',
    message: 'Search everything.',
    tier: 'pro',
    sourceMode: 'all'
  });

  assert.deepEqual(calls, [{ mode: 'interview' }, { mode: 'meeting' }]);
  assert.equal(result.message.content, 'Both transcript types included.');
});

test('pro active and all sources include system knowledge documents', async () => {
  const ids = [];
  const agent = createAgentChat({
    settings: { userTier: 'pro', llmProvider: 'local', llmModel: 'model' },
    knowledgeManager: {
      getKnowledgeItem: (id) => {
        ids.push(id);
        return { id, filename: `${id}.txt`, content: `${id} content` };
      }
    },
    sessionManager: { getSessions: () => [] },
    generateChat: async (request) => {
      assert.match(request.messages[0].content, /system:opportunities-status content/);
      assert.match(request.messages[0].content, /system:calendar-events content/);
      return JSON.stringify({ message: { content: 'System docs included.', citations: [] }, pendingAction: null });
    }
  });

  const active = await agent.sendMessage({
    sessionId: 'chat-pro-system-active',
    message: 'How many rejections?',
    tier: 'pro',
    sourceMode: 'active-context'
  });

    assert.equal(active.message.content, 'System docs included.');
    assert.deepEqual(ids, ['system:calendar-events', 'system:opportunities-status']);
  });

test('chat preserves short history for follow-up turns', async () => {
  const prompts = [];
  const agent = createAgentChat({
    settings: { userTier: 'free', llmProvider: 'local', llmModel: 'model' },
    knowledgeManager: { listKnowledge: () => [] },
    generateChat: async (request) => {
      prompts.push(request.messages.map((message) => message.content).join('\n'));
      return JSON.stringify({ message: { content: `turn ${prompts.length}`, citations: [] }, pendingAction: null });
    }
  });

  await agent.sendMessage({ sessionId: 'chat-3', message: 'Summarize Apollo.' });
  await agent.sendMessage({ sessionId: 'chat-3', message: 'What should I ask next?' });

  assert.match(prompts[1], /Summarize Apollo\./);
  assert.match(prompts[1], /turn 1/);
});

test('pending action includes original user request for confirmation repair', async () => {
  const agent = createAgentChat({
    settings: { userTier: 'pro', llmProvider: 'local', llmModel: 'model' },
    knowledgeManager: { listKnowledge: () => [] },
    generateChat: async () => JSON.stringify({
      message: { content: 'I prepared the status update.', citations: [] },
      pendingAction: {
        id: 'action-1',
        label: 'Update status',
        summary: 'Update TeamViewer to rejected.',
        actionType: 'updateOpportunity',
        payload: { outcome: 'rejected' }
      }
    })
  });

  const result = await agent.sendMessage({
    sessionId: 'chat-action-original-request',
    message: 'change the status of the TeamViewer opportunity to Rejected',
    tier: 'pro'
  });

  assert.equal(result.pendingAction.originalUserMessage, 'change the status of the TeamViewer opportunity to Rejected');
  assert.equal(result.pendingAction.payload.originalUserMessage, 'change the status of the TeamViewer opportunity to Rejected');
});

test('pending action confirmation text uses the parsed calendar date instead of model text', async () => {
  const agent = createAgentChat({
    settings: { userTier: 'pro', llmProvider: 'local', llmModel: 'model' },
    knowledgeManager: { listKnowledge: () => [] },
    generateChat: async () => JSON.stringify({
      message: {
        content: 'I have scheduled your interview with Etsy for tomorrow, May 27th, at 3:00 PM ET.',
        citations: []
      },
      pendingAction: {
        id: 'action-calendar',
        label: 'Schedule interview',
        summary: 'Schedule interview with Etsy for tomorrow, May 27th, at 3:00 PM ET.',
        actionType: 'saveCalendarEvent',
        payload: {
          mode: 'interview',
          entityName: 'Etsy',
          title: 'Interview',
          date: '2026-05-22T15:00:00.000'
        }
      }
    })
  });

  const result = await agent.sendMessage({
    sessionId: 'chat-calendar-date',
    message: 'I have an interview tomorrow with Etsy at 3pm ET',
    tier: 'pro'
  });

  assert.match(result.message.content, /May 22, 2026 at 3:00 PM/);
  assert.doesNotMatch(result.message.content, /May 27th/);
  assert.match(result.pendingAction.summary, /May 22, 2026 at 3:00 PM/);
  assert.doesNotMatch(result.pendingAction.summary, /May 27th/);
});

test('confirmAction uses completed pending action payload from renderer form', async () => {
  const agent = createAgentChat({
    settings: { userTier: 'pro', llmProvider: 'local', llmModel: 'model' },
    actionRegistry: {
      confirmAction: async (action) => {
        assert.equal(action.payload.date, '2026-05-22T15:00');
        return { ok: true, changed: true, message: 'Saved.' };
      }
    },
    generateChat: async () => JSON.stringify({
      message: { content: 'Need a date.', citations: [] },
      pendingAction: {
        id: 'action-form',
        label: 'Create event',
        summary: 'Create event.',
        actionType: 'saveCalendarEvent',
        payload: { title: 'Weekly Sync' }
      }
    })
  });

  await agent.sendMessage({ sessionId: 'chat-form', message: 'Schedule Weekly Sync', tier: 'pro' });
  const result = await agent.confirmAction({
    actionId: 'action-form',
    pendingAction: {
      id: 'action-form',
      label: 'Create event',
      summary: 'Create event.',
      actionType: 'saveCalendarEvent',
      payload: { title: 'Weekly Sync', date: '2026-05-22T15:00' }
    }
  });

  assert.equal(result.ok, true);
});

test('malformed chat JSON returns safe error response', async () => {
  const agent = createAgentChat({
    settings: { userTier: 'free', llmProvider: 'local', llmModel: 'model' },
    knowledgeManager: { listKnowledge: () => [] },
    generateChat: async () => 'not json'
  });

  const result = await agent.sendMessage({ sessionId: 'chat-4', message: 'Hello' });

  assert.equal(result.message.role, 'assistant');
  assert.match(result.message.content, /could not parse/i);
  assert.equal(result.pendingAction, null);
});
