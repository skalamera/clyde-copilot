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
