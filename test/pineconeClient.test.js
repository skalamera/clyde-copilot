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

test('resolves configurable embedding providers for pro knowledge search', () => {
  assert.deepEqual(
    resolveEmbeddingConfig({ embeddingProvider: 'openai', embeddingModel: 'custom-embed', embeddingApiKey: 'embed-key' }),
    { provider: 'openai', model: 'custom-embed', apiKey: 'embed-key' }
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
