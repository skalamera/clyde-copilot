const { GoogleGenerativeAI } = require('@google/generative-ai');

async function generateChat({ provider, apiKey, model, messages, jsonSchema, temperature = 0.2, maxTokens = 800, axiosClient, localUrl }) {
    if (provider === 'gemini') {
        return generateGemini({ apiKey, model, messages, jsonSchema, temperature, maxTokens });
    } else if (provider === 'anthropic') {
        return generateAnthropic({ apiKey, model, messages, jsonSchema, temperature, maxTokens, axiosClient });
    } else if (provider === 'openai') {
        return generateOpenAI({ apiKey, model, messages, jsonSchema, temperature, maxTokens, axiosClient, url: 'https://api.openai.com/v1/chat/completions' });
    } else {
        // default to local (LM Studio / OpenAI compatible)
        const url = localUrl || process.env.LM_STUDIO_CHAT_URL || 'http://localhost:1234/v1/chat/completions';
        return generateOpenAI({ apiKey: apiKey || 'lm-studio', model, messages, jsonSchema, temperature, maxTokens, axiosClient, url });
    }
}

async function generateOpenAI({ apiKey, model, messages, jsonSchema, temperature, maxTokens, axiosClient, url }) {
    const payload = {
        model,
        temperature,
        max_tokens: maxTokens,
        messages
    };

    if (jsonSchema) {
        payload.response_format = {
            type: 'json_schema',
            json_schema: {
                name: jsonSchema.name || 'json_response',
                schema: jsonSchema.schema,
                strict: true
            }
        };
    } else {
        payload.response_format = { type: 'json_object' };
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };

    const response = await axiosClient.post(url, payload, { headers, timeout: 120000 });
    return response.data?.choices?.[0]?.message?.content || '';
}

async function generateAnthropic({ apiKey, model, messages, jsonSchema, temperature, maxTokens, axiosClient }) {
    // Anthropic separates system message
    let systemMessage = '';
    const anthropicMessages = [];

    for (const msg of messages) {
        if (msg.role === 'system') {
            systemMessage += msg.content + '\n';
        } else {
            // map 'assistant' or 'user' roles.
            anthropicMessages.push({
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content
            });
        }
    }

    const payload = {
        model,
        system: systemMessage.trim(),
        messages: anthropicMessages,
        temperature,
        max_tokens: maxTokens
    };

    if (jsonSchema) {
        // Use Anthropic's tool_choice for structured output
        payload.tools = [{
            name: jsonSchema.name || 'json_response',
            description: 'Returns the structured JSON response.',
            input_schema: jsonSchema.schema
        }];
        payload.tool_choice = { type: 'tool', name: jsonSchema.name || 'json_response' };
    }

    const headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
    };

    const response = await axiosClient.post('https://api.anthropic.com/v1/messages', payload, { headers, timeout: 120000 });
    
    if (jsonSchema) {
        // Extract tool use
        const toolUse = response.data.content.find(c => c.type === 'tool_use');
        if (toolUse && toolUse.input) {
            return JSON.stringify(toolUse.input);
        }
    }

    // fallback to text content
    const textContent = response.data.content.find(c => c.type === 'text');
    return textContent ? textContent.text : '';
}

async function generateGemini({ apiKey, model, messages, jsonSchema, temperature, maxTokens }) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model });

    let systemInstruction = undefined;
    const geminiContents = [];

    for (const msg of messages) {
        if (msg.role === 'system') {
            systemInstruction = msg.content;
        } else {
            geminiContents.push({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            });
        }
    }

    const generationConfig = {
        temperature,
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json'
    };

    if (jsonSchema) {
        // Map JSON Schema to Gemini Schema Type
        generationConfig.responseSchema = mapToGeminiSchema(jsonSchema.schema);
    }

    const request = {
        contents: geminiContents,
        generationConfig
    };

    if (systemInstruction) {
        request.systemInstruction = systemInstruction;
    }

    let result;
    let retries = 3;
    while (retries > 0) {
        try {
            result = await geminiModel.generateContent(request);
            break;
        } catch (e) {
            retries--;
            if (retries === 0) throw e;
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    return result.response.text();
}

function mapToGeminiSchema(schema) {
    const geminiSchema = {};
    const allowedKeys = new Set([
        'type',
        'format',
        'description',
        'nullable',
        'enum',
        'items',
        'maxItems',
        'minItems',
        'properties',
        'propertyOrdering',
        'required'
    ]);

    for (const [key, value] of Object.entries(schema || {})) {
        if (allowedKeys.has(key)) {
            geminiSchema[key] = value;
        }
    }
    
    // Map standard types to Gemini enum types if needed.
    // The @google/generative-ai library expects type as a SchemaType enum or standard string depending on version,
    // usually passing raw JSON schema types works well enough for simple cases.
    // Let's ensure basic type mapping:
    if (geminiSchema.type) {
        geminiSchema.type = geminiSchema.type.toUpperCase();
    }
    
    if (geminiSchema.properties) {
        for (const key in geminiSchema.properties) {
            geminiSchema.properties[key] = mapToGeminiSchema(geminiSchema.properties[key]);
        }
    }
    
    if (geminiSchema.items) {
        geminiSchema.items = mapToGeminiSchema(geminiSchema.items);
    }

    return geminiSchema;
}

module.exports = {
    generateChat,
    mapToGeminiSchema
};
