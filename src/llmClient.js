const { GoogleGenerativeAI } = require('@google/generative-ai');

async function generateChat({ provider, apiKey, model, messages, jsonSchema, temperature = 0.2, maxTokens = 800, axiosClient, localUrl, images = [] }) {
    if (provider === 'gemini') {
        return generateGemini({ apiKey, model, messages, jsonSchema, temperature, maxTokens, images });
    } else if (provider === 'anthropic') {
        return generateAnthropic({ apiKey, model, messages, jsonSchema, temperature, maxTokens, axiosClient, images });
    } else if (provider === 'openai') {
        return generateOpenAI({ apiKey, model, messages, jsonSchema, temperature, maxTokens, axiosClient, url: 'https://api.openai.com/v1/chat/completions', images });
    } else {
        // default to local (LM Studio / OpenAI compatible)
        const url = normalizeOpenAIChatUrl(localUrl || process.env.LM_STUDIO_CHAT_URL || 'http://localhost:1234/v1/chat/completions');
        return generateOpenAI({ apiKey: apiKey || 'lm-studio', model, messages, jsonSchema, temperature, maxTokens, axiosClient, url, images });
    }
}

function normalizeOpenAIChatUrl(input) {
    const raw = String(input || '').trim();
    if (!raw) {
        return 'http://localhost:1234/v1/chat/completions';
    }

    try {
        const url = new URL(raw);
        const path = url.pathname.replace(/\/+$/, '');

        if (path.endsWith('/chat/completions')) {
            return url.toString();
        }

        url.pathname = path.endsWith('/v1')
            ? `${path}/chat/completions`
            : `${path || ''}/v1/chat/completions`;
        return url.toString();
    } catch {
        return raw;
    }
}

function normalizeImages(images = []) {
    return (Array.isArray(images) ? images : [images])
        .filter((image) => image && image.data)
        .map((image) => ({
            mimeType: image.mimeType || 'image/png',
            data: image.data
        }));
}

function buildOpenAIMessageContent(text, image) {
    const content = [{ type: 'text', text: String(text || '') }];
    const normalized = normalizeImages(image)[0];

    if (normalized) {
        content.push({
            type: 'image_url',
            image_url: {
                url: `data:${normalized.mimeType};base64,${normalized.data}`
            }
        });
    }

    return content;
}

function mapToGeminiParts(text, image) {
    const parts = [{ text: String(text || '') }];
    const normalized = normalizeImages(image)[0];

    if (normalized) {
        parts.push({
            inlineData: {
                mimeType: normalized.mimeType,
                data: normalized.data
            }
        });
    }

    return parts;
}

function buildAnthropicMessageContent(text, image) {
    const content = [{ type: 'text', text: String(text || '') }];
    const normalized = normalizeImages(image)[0];

    if (normalized) {
        content.push({
            type: 'image',
            source: {
                type: 'base64',
                media_type: normalized.mimeType,
                data: normalized.data
            }
        });
    }

    return content;
}

function attachImagesToLastUserMessage(messages = [], images = [], mapper) {
    const normalized = normalizeImages(images);

    if (!normalized.length) {
        return messages;
    }

    let attached = false;
    const mapped = [...messages].reverse().map((message) => {
        if (!attached && message.role !== 'system' && message.role !== 'assistant') {
            attached = true;
            return {
                ...message,
                content: mapper(message.content, normalized[0])
            };
        }
        return message;
    }).reverse();

    return mapped;
}

async function generateOpenAI({ apiKey, model, messages, jsonSchema, temperature, maxTokens, axiosClient, url, images }) {
    const payload = {
        model,
        temperature,
        max_tokens: maxTokens,
        messages: attachImagesToLastUserMessage(messages, images, buildOpenAIMessageContent)
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

async function generateAnthropic({ apiKey, model, messages, jsonSchema, temperature, maxTokens, axiosClient, images }) {
    // Anthropic separates system message
    let systemMessage = '';
    const anthropicMessages = [];

    const mappedMessages = attachImagesToLastUserMessage(messages, images, buildAnthropicMessageContent);

    for (const msg of mappedMessages) {
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

async function generateGemini({ apiKey, model, messages, jsonSchema, temperature, maxTokens, images }) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model });

    let systemInstruction = undefined;
    const geminiContents = [];

    const normalizedImages = normalizeImages(images);
    let imageAttached = false;

    for (let index = 0; index < messages.length; index++) {
        const msg = messages[index];
        if (msg.role === 'system') {
            systemInstruction = msg.content;
        } else {
            const isLastNonSystem = !imageAttached
                && normalizedImages.length
                && !messages.slice(index + 1).some((next) => next.role !== 'system' && next.role !== 'assistant');
            const parts = isLastNonSystem
                ? mapToGeminiParts(msg.content, normalizedImages[0])
                : [{ text: msg.content }];
            imageAttached = imageAttached || isLastNonSystem;
            geminiContents.push({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts
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
    buildOpenAIMessageContent,
    generateChat,
    normalizeOpenAIChatUrl,
    mapToGeminiParts,
    mapToGeminiSchema
};
