const assert = require('node:assert/strict');
const test = require('node:test');

const { mapToGeminiSchema } = require('../src/llmClient');

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
