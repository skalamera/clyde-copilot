const assert = require('node:assert/strict');
const test = require('node:test');

const {
  detectResumeQuestion,
  extractLikelyInterviewQuestion,
  resolveEmbeddingConfig,
  sanitizePineconeMetadata,
  searchKnowledgeVectors,
  upsertKnowledgeChunks
} = require('../src/pineconeClient');

test('detects role-fit interview questions without relying on remote intent classification', async () => {
  const transcript = [
    'You: Thanks for having me.',
    'System Audio: Why do you think you would be a good fit for this particular role?'
  ].join('\n');

  assert.equal(
    extractLikelyInterviewQuestion(transcript),
    'Why do you think you would be a good fit for this particular role?'
  );

  assert.equal(
    await detectResumeQuestion(transcript),
    'Why do you think you would be a good fit for this particular role?'
  );
});

test('does not treat incomplete role-fit fragments as interview questions', () => {
  assert.equal(
    extractLikelyInterviewQuestion('System Audio: Why do you think you would be a good fit for'),
    null
  );
});

test('reconstructs the latest fragmented interview question without combining older questions', () => {
  const transcript = [
    'System Audio: If',
    'System Audio: If you were to get the job, what would your 30',
    'System Audio: sixty ninety day plan look like?',
    'System Audio: Why do you think you would be a good fit for this particular',
    'System Audio: particular role.',
    'System Audio: Can you tell me about the My Career Max project?'
  ].join('\n');

  assert.equal(
    extractLikelyInterviewQuestion(transcript),
    'Can you tell me about the My Career Max project?'
  );
});

test('reconstructs role-fit and 30-60-90 fragments as separate current questions', () => {
  assert.equal(
    extractLikelyInterviewQuestion([
      'System Audio: If',
      'System Audio: If you were to get the job, what would your 30',
      'System Audio: sixty ninety day plan look like?'
    ].join('\n')),
    'If you were to get the job, what would your 30 sixty ninety day plan look like?'
  );

  assert.equal(
    extractLikelyInterviewQuestion([
      'System Audio: Why do you think you would be a good fit for this particular',
      'System Audio: particular role.'
    ].join('\n')),
    'Why do you think you would be a good fit for this particular role.'
  );
});

test('detects live tuning interview prompts from customer operations interviews', () => {
  const questions = [
    'Have you had an experience integrating Gen AI or other automation tools directly into customer support workflows?',
    'Can you tell me about a time you had to align stakeholders across product, engineering, and operations on a technical project where the priorities conflicted. And how did you navigate that?',
    'How do you evaluate whether a change of tool or workflow will have downstream effects on other systems or teams. Walk me through your process.',
    'Can you describe a time you designed or maintained an API based integration between customer experience platform and another internal system. I know you kind of already talked through that, but if you do have another example or can go deeper into that one. Just talk me through that.'
  ];

  for (const question of questions) {
    assert.equal(
      extractLikelyInterviewQuestion(`System Audio: ${question}`),
      question
    );
  }
});

test('returns only the latest live tuning prompt when older questions remain in context', () => {
  const transcript = [
    'System Audio: So Can you walk me through a time When you audited and or optimized a CRM or ticketing system to improve frontline agent efficiency.',
    'You: At Benchmark Education, I led a comprehensive audit and optimization of our support tech stack.',
    'System Audio: Have you had an experience integrating Gen AI or other automation tools directly into customer support workflows?',
    'You: Yes, I built an AI-powered QA workflow for support ticket coaching.',
    'System Audio: How do you evaluate whether a change of tool or workflow will have downstream effects on other systems or teams. Walk me through your process.'
  ].join('\n');

  assert.equal(
    extractLikelyInterviewQuestion(transcript),
    'How do you evaluate whether a change of tool or workflow will have downstream effects on other systems or teams. Walk me through your process.'
  );
});

test('does not detect interviewer setup as an answerable interview question', () => {
  assert.equal(
    extractLikelyInterviewQuestion('System Audio: I have some questions I will go through. They are mostly tell me about a time questions. I am looking for specific examples so I can understand what exactly you did versus the team.'),
    null
  );
});

test('does not answer downstream impact prompt before the full process question arrives', () => {
  assert.equal(
    extractLikelyInterviewQuestion('System Audio: How do you evaluate whether a change or tool or workflow.'),
    null
  );

  assert.equal(
    extractLikelyInterviewQuestion('System Audio: How do you evaluate whether a change or tool or workflow will have downstream effects on other systems or teams. Walk me through your process.'),
    'How do you evaluate whether a change or tool or workflow will have downstream effects on other systems or teams. Walk me through your process.'
  );
});

test('detects complete ASR GenAI workflow question without terminal punctuation', () => {
  assert.equal(
    extractLikelyInterviewQuestion('System Audio: Have you had an integrating GenAI or other automation controls directly into customer support workflows'),
    'Have you had an integrating GenAI or other automation controls directly into customer support workflows'
  );
});

test('prefers reconstructed stakeholder question over continuation fragment', () => {
  assert.equal(
    extractLikelyInterviewQuestion([
      'System Audio: Can you tell me about a time you had to A line stakeholders across product engineering and operations',
      'System Audio: engineering and operations On a technical project where the priorities conflicted. And how did you navigate that?'
    ].join('\n')),
    'Can you tell me about a time you had to A line stakeholders across product engineering and operations On a technical project where the priorities conflicted. And how did you navigate that?'
  );
});

test('resolves configurable embedding providers for pro knowledge search', () => {
  assert.deepEqual(
    resolveEmbeddingConfig({ embeddingProvider: 'openai', embeddingModel: 'custom-embed', embeddingApiKey: 'embed-key' }),
    { provider: 'gemini', model: 'gemini-embedding-2', apiKey: 'embed-key' }
  );

  assert.equal(resolveEmbeddingConfig({ geminiApiKey: 'gemini-key' }).provider, 'gemini');
  assert.equal(resolveEmbeddingConfig({ embeddingProvider: 'gemini' }).model, 'gemini-embedding-2');
});

test('upserts knowledge chunks to pinecone with namespace and metadata', async () => {
  const posts = [];
  const result = await upsertKnowledgeChunks({
    knowledgeItem: {
      id: 'upload:research',
      filename: 'research.txt',
      type: 'upload',
      metadata: { topic: 'billing' }
    },
    chunks: ['Billing is moving to Lambda.'],
    settings: {
      pineconeApiKey: 'pine-key',
      pineconeHost: 'https://example-index.pinecone.io',
      pineconeNamespace: 'pro-memory'
    },
    axiosClient: {
      post: async (url, data, config) => {
        posts.push({ url, data, config });
        return { data: { upsertedCount: data.vectors.length } };
      }
    },
    getEmbeddingFn: async () => [0.1, 0.2, 0.3]
  });

  assert.equal(result.ok, true);
  assert.equal(posts[0].url, 'https://example-index.pinecone.io/vectors/upsert');
  assert.equal(posts[0].data.namespace, 'pro-memory');
  assert.equal(posts[0].data.vectors[0].metadata.knowledgeId, 'upload:research');
  assert.equal(posts[0].data.vectors[0].metadata.text, 'Billing is moving to Lambda.');
});

test('sanitizes nested Pinecone metadata before vector upsert', async () => {
  const posts = [];
  await upsertKnowledgeChunks({
    knowledgeItem: {
      id: 'system:calendar-events',
      filename: 'Calendar events.txt',
      type: 'system',
      metadata: {
        source: 'system',
        count: 1,
        pinecone: { status: 'indexed', count: 1 },
        tags: ['sync', 'calendar'],
        nested: { ignored: true },
        emptyList: [],
        nullable: null
      }
    },
    chunks: ['Calendar event snapshot'],
    settings: {
      pineconeApiKey: 'pine-key',
      pineconeHost: 'https://example-index.pinecone.io',
      pineconeNamespace: 'pro-memory'
    },
    axiosClient: {
      post: async (url, data) => {
        posts.push({ url, data });
        return { data: { upsertedCount: data.vectors.length } };
      }
    },
    getEmbeddingFn: async () => [0.1, 0.2, 0.3]
  });

  const metadata = posts[0].data.vectors[0].metadata;
  assert.equal(metadata.source, 'Calendar events.txt');
  assert.equal(metadata.count, 1);
  assert.deepEqual(metadata.tags, ['sync', 'calendar']);
  assert.equal(Object.prototype.hasOwnProperty.call(metadata, 'pinecone'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(metadata, 'nested'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(metadata, 'emptyList'), false);
});

test('sanitizes metadata helper keeps only Pinecone-supported values', () => {
  assert.deepEqual(
    sanitizePineconeMetadata({
      okString: 'value',
      okNumber: 3,
      okBoolean: true,
      list: [1, 'two', false],
      obj: { a: 1 },
      nil: null
    }),
    {
      okString: 'value',
      okNumber: 3,
      okBoolean: true,
      list: ['1', 'two', 'false']
    }
  );
});

test('searches pinecone knowledge vectors with namespace and filter', async () => {
  const posts = [];
  const matches = await searchKnowledgeVectors('lambda migration', {
    pineconeApiKey: 'pine-key',
    pineconeHost: 'https://example-index.pinecone.io',
    pineconeNamespace: 'pro-memory'
  }, {
    topK: 4,
    filter: { type: { $eq: 'transcript' } },
    axiosClient: {
      post: async (url, data) => {
        posts.push({ url, data });
        return {
          data: {
            matches: [{
              score: 0.91,
              metadata: {
                text: 'Cody mentioned Lambda.',
                source: 'Interview_with_Cody.txt',
                knowledgeId: 'session:interview:cody:1'
              }
            }]
          }
        };
      }
    },
    getEmbeddingFn: async () => [0.4, 0.5, 0.6]
  });

  assert.equal(posts[0].url, 'https://example-index.pinecone.io/query');
  assert.equal(posts[0].data.namespace, 'pro-memory');
  assert.deepEqual(posts[0].data.filter, { type: { $eq: 'transcript' } });
  assert.equal(matches[0].source, 'Interview_with_Cody.txt');
  assert.equal(matches[0].knowledgeId, 'session:interview:cody:1');
});
