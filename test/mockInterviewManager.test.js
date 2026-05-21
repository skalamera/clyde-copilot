const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createMockInterviewManager, mockInterviewKnowledgeId } = require('../src/mockInterviewManager');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'clyde-mock-interviews-'));
}

const assessmentJson = JSON.stringify({
  overallScore: 82,
  verdict: 'Strong practice round',
  executiveSummary: 'The candidate gave clear examples and should add tighter metrics.',
  categories: [
    { name: 'Structure', score: 80, rationale: 'Answers had a clear order.', evidence: ['Used context before actions.'] },
    { name: 'Role fit', score: 84, rationale: 'Examples matched support operations.', evidence: ['Discussed escalations.'] }
  ],
  strengths: ['Clear ownership language.'],
  risks: ['Some answers lacked business impact.'],
  actionPlan: ['Add a metric to each major story.'],
  answerReviews: [
    { question: 'Tell me about yourself.', score: 78, feedback: 'Good overview.', betterAnswer: 'Lead with the most relevant support operations scope.' }
  ],
  nextPracticePrompt: 'Practice a 2 minute story with one metric.'
});

test('mock interview manager saves local records grouped by opportunity folder', async () => {
  const appPath = tempDir();
  const manager = createMockInterviewManager({ appPath });

  const saved = await manager.saveMockInterview({
    opportunity: { id: 'apollo', name: 'Apollo', role: 'Support Operations Manager' },
    transcript: [{ role: 'you', text: 'I improved support QA.' }],
    assessment: JSON.parse(assessmentJson)
  }, { userTier: 'free' });

  assert.equal(saved.opportunity.id, 'apollo');
  assert.equal(saved.assessment.overallScore, 82);
  assert.equal(manager.listMockInterviews().length, 1);
  assert.ok(fs.existsSync(path.join(appPath, 'Mock Interviews', 'apollo', `${saved.id}.json`)));
});

test('mock interview manager grades through OpenAI Responses with structured output', async () => {
  const posts = [];
  const manager = createMockInterviewManager({
    appPath: tempDir(),
    axiosClient: {
      post: async (url, data, config) => {
        posts.push({ url, data, config });
        return { data: { output_text: assessmentJson } };
      }
    }
  });

  const assessment = await manager.generateAssessment({
    opportunity: { name: 'Apollo', role: 'Support Operations Manager' },
    transcript: [{ role: 'interviewer', text: 'Tell me about yourself.' }, { role: 'you', text: 'I lead support operations.' }]
  }, {
    llmProvider: 'openai',
    llmApiKey: 'sk-test'
  });

  assert.equal(assessment.overallScore, 82);
  assert.equal(posts[0].url, 'https://api.openai.com/v1/responses');
  assert.equal(posts[0].data.model, 'gpt-5.5');
  assert.equal(posts[0].data.text.format.type, 'json_schema');
  assert.equal(posts[0].data.text.format.strict, true);
  assert.match(posts[0].data.instructions, /direct interview coach/);
});

test('pro mock interview saves assessment content to knowledge and tries Pinecone upload', async () => {
  const upserts = [];
  const uploads = [];
  const manager = createMockInterviewManager({
    appPath: tempDir(),
    knowledgeManager: {
      upsertKnowledgeItem: (item) => {
        upserts.push(item);
        return item;
      },
      uploadToPinecone: async (id) => {
        uploads.push(id);
        return { id };
      }
    }
  });

  await manager.saveMockInterview({
    opportunity: { id: 'apollo', name: 'Apollo', role: 'Support Operations Manager' },
    transcript: [{ role: 'you', text: 'I reduced ticket backlog.' }],
    assessment: JSON.parse(assessmentJson)
  }, { userTier: 'pro' });

  assert.equal(upserts.length, 1);
  assert.equal(upserts[0].type, 'mock-interview');
  assert.match(upserts[0].content, /Overall score: 82/);
  assert.equal(uploads.length, 1);
});

test('deleting a mock interview removes local record and matching Pinecone-backed knowledge item', async () => {
  const appPath = tempDir();
  const deletedKnowledge = [];
  const manager = createMockInterviewManager({
    appPath,
    knowledgeManager: {
      upsertKnowledgeItem: (item) => item,
      uploadToPinecone: async (id) => ({ id }),
      deleteKnowledgeItem: async (id, settings) => {
        deletedKnowledge.push({ id, settings });
        return true;
      }
    }
  });

  const saved = await manager.saveMockInterview({
    opportunity: { id: 'apollo', name: 'Apollo', role: 'Support Operations Manager' },
    transcript: [{ role: 'you', text: 'I reduced ticket backlog.' }],
    assessment: JSON.parse(assessmentJson)
  }, { userTier: 'pro', pineconeApiKey: 'pc-key', pineconeHost: 'https://pinecone.example' });

  const deleted = await manager.deleteMockInterview(saved.id, { userTier: 'pro', pineconeApiKey: 'pc-key' });

  assert.equal(deleted, true);
  assert.equal(manager.listMockInterviews().length, 0);
  assert.deepEqual(deletedKnowledge, [{
    id: mockInterviewKnowledgeId(saved),
    settings: { userTier: 'pro', pineconeApiKey: 'pc-key' }
  }]);
  assert.equal(fs.existsSync(path.join(appPath, 'Mock Interviews', 'apollo')), false);
});
