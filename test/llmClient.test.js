const assert = require('node:assert/strict');
const test = require('node:test');

const { buildOpenAIMessageContent, mapToGeminiParts } = require('../src/llmClient');
const { mapToGeminiSchema, normalizeOpenAIChatUrl } = require('../src/llmClient');

test('maps JSON schema to Gemini schema without unsupported fields', () => {
  const schema = mapToGeminiSchema({
    type: 'object',
    additionalProperties: false,
    properties: {
      answers: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            question: { type: 'string' },
            bullets: { type: 'array', items: { type: 'string' } }
          },
          required: ['question', 'bullets']
        }
      }
    },
    required: ['answers']
  });

  assert.equal(schema.type, 'OBJECT');
  assert.equal(schema.additionalProperties, undefined);
  assert.equal(schema.properties.answers.type, 'ARRAY');
  assert.equal(schema.properties.answers.items.type, 'OBJECT');
  assert.equal(schema.properties.answers.items.additionalProperties, undefined);
  assert.equal(schema.properties.answers.items.properties.question.type, 'STRING');
});

test('OpenAI-compatible vision payload includes image_url parts', () => {
  const content = buildOpenAIMessageContent('What is on screen?', {
    mimeType: 'image/png',
    data: 'abc123'
  });

  assert.deepEqual(content, [
    { type: 'text', text: 'What is on screen?' },
    { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } }
  ]);
});

test('normalizes local OpenAI-compatible chat URLs', () => {
  assert.equal(normalizeOpenAIChatUrl('http://localhost:1234'), 'http://localhost:1234/v1/chat/completions');
  assert.equal(normalizeOpenAIChatUrl('http://localhost:1234/'), 'http://localhost:1234/v1/chat/completions');
  assert.equal(normalizeOpenAIChatUrl('http://localhost:1234/v1'), 'http://localhost:1234/v1/chat/completions');
  assert.equal(normalizeOpenAIChatUrl('http://localhost:1234/v1/'), 'http://localhost:1234/v1/chat/completions');
  assert.equal(normalizeOpenAIChatUrl('http://localhost:1234/v1/chat/completions'), 'http://localhost:1234/v1/chat/completions');
});

test('Gemini vision payload includes inlineData parts', () => {
  const parts = mapToGeminiParts('What is on screen?', {
    mimeType: 'image/png',
    data: 'abc123'
  });

  assert.deepEqual(parts, [
    { text: 'What is on screen?' },
    { inlineData: { mimeType: 'image/png', data: 'abc123' } }
  ]);
});
