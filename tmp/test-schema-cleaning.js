function cleanSchemaForGemini(schema) {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  if (schema.anyOf && Array.isArray(schema.anyOf)) {
    const nonNullSchema = schema.anyOf.find(s => s && s.type !== 'null');
    const hasNull = schema.anyOf.some(s => s && s.type === 'null');
    if (nonNullSchema) {
      const cleaned = cleanSchemaForGemini(nonNullSchema);
      if (hasNull) {
        cleaned.nullable = true;
      }
      return cleaned;
    }
  }

  const copy = {};
  const allowedKeys = new Set(['type', 'format', 'description', 'nullable', 'enum', 'properties', 'required', 'items']);
  
  for (const [key, value] of Object.entries(schema)) {
    if (allowedKeys.has(key)) {
      copy[key] = value;
    }
  }

  if (copy.type) {
    copy.type = String(copy.type).toUpperCase();
  }

  if (copy.type === 'OBJECT' && (!copy.properties || Object.keys(copy.properties).length === 0)) {
    return {};
  }

  if (copy.properties) {
    const nextProps = {};
    for (const [key, value] of Object.entries(copy.properties)) {
      nextProps[key] = cleanSchemaForGemini(value);
    }
    copy.properties = nextProps;
  }

  if (copy.items) {
    copy.items = cleanSchemaForGemini(copy.items);
  }

  return copy;
}

function chatJsonSchema() {
  return {
    name: 'agent_chat_response',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'object',
          properties: {
            content: { type: 'string' },
            citations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  sourceId: { type: 'string' },
                  label: { type: 'string' }
                },
                required: ['sourceId', 'label'],
                additionalProperties: false
              }
            }
          },
          required: ['content', 'citations'],
          additionalProperties: false
        },
        pendingAction: {
          anyOf: [
            { type: 'null' },
            {
              type: 'object',
              properties: {
                id: { type: 'string' },
                label: { type: 'string' },
                summary: { type: 'string' },
                actionType: { type: 'string' },
                payload: { type: 'object', additionalProperties: true }
              },
              required: ['label', 'summary', 'actionType', 'payload'],
              additionalProperties: false
            }
          ]
        }
      },
      required: ['message', 'pendingAction'],
      additionalProperties: false
    }
  };
}

const originalSchema = chatJsonSchema().schema;
const cleanedSchema = cleanSchemaForGemini(originalSchema);

console.log("Original Schema:\n", JSON.stringify(originalSchema, null, 2));
console.log("\nCleaned Schema:\n", JSON.stringify(cleanedSchema, null, 2));
