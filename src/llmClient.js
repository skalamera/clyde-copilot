const { GoogleGenerativeAI } = require('@google/generative-ai');

async function generateChat({ provider, apiKey, model, messages, jsonSchema, temperature = 0.2, maxTokens = 800, axiosClient, localUrl, images = [] }) {
    if (provider === 'clyde-cloud') {
        try {
            return await generateClydeCloud({ model, messages, jsonSchema, temperature, maxTokens, axiosClient, images });
        } catch (error) {
            console.error('Clyde Cloud failed; retrying managed Gemini 3.5 Flash:', error.message);
            return await generateClydeCloud({ model: 'gemini-3.5-flash', messages, jsonSchema, temperature, maxTokens, axiosClient, images });
        }
    } else if (provider === 'gemini') {
        return await generateGemini({ apiKey, model: 'gemini-3.5-flash', messages, jsonSchema, temperature, maxTokens, images });
    } else if (provider === 'anthropic') {
        try {
            return await generateAnthropic({ apiKey, model, messages, jsonSchema, temperature, maxTokens, axiosClient, images });
        } catch (error) {
            if (model !== 'claude-3-5-haiku-latest') {
                const errMsg = error.response?.data?.error?.message || error.message;
                console.warn(`Anthropic run with model "${model}" failed. Retrying with stable model "claude-3-5-haiku-latest": ${errMsg}`);
                return await generateAnthropic({ apiKey, model: 'claude-3-5-haiku-latest', messages, jsonSchema, temperature, maxTokens, axiosClient, images });
            }
            throw error;
        }
    } else if (provider === 'openai') {
        return await generateOpenAI({ apiKey, model: 'gpt-4o', messages, jsonSchema, temperature, maxTokens, axiosClient, url: 'https://api.openai.com/v1/chat/completions', images });
    } else {
        const url = normalizeOpenAIChatUrl(localUrl || process.env.LM_STUDIO_CHAT_URL || 'http://localhost:1234/v1/chat/completions');
        return generateOpenAI({ apiKey: 'lm-studio', model, messages, jsonSchema, temperature, maxTokens, axiosClient, url, images });
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

function makeSchemaStrict(schema) {
    if (!schema || typeof schema !== 'object') {
        return schema;
    }

    const copy = Array.isArray(schema) ? [] : {};
    
    for (const [key, value] of Object.entries(schema)) {
        if (typeof value === 'object' && value !== null) {
            copy[key] = makeSchemaStrict(value);
        } else {
            copy[key] = value;
        }
    }

    if (copy.type === 'object') {
        copy.additionalProperties = false;
        
        // OpenAI strict mode compliance: If strict=true is requested, 
        // every property in 'properties' must be listed in 'required'.
        if (copy.properties && !Array.isArray(copy.required)) {
            copy.required = Object.keys(copy.properties);
        } else if (copy.properties && Array.isArray(copy.required)) {
            const requiredSet = new Set(copy.required);
            for (const propName of Object.keys(copy.properties)) {
                if (!requiredSet.has(propName)) {
                    copy.required.push(propName);
                }
            }
        }
    }

    return copy;
}

async function generateOpenAI({ apiKey, model, messages, jsonSchema, temperature, maxTokens, axiosClient, url, images }) {
    const isReasoningModel = model.startsWith('o1') || model.startsWith('o3') || model.startsWith('gpt-5');
    const payload = {
        model,
        messages: attachImagesToLastUserMessage(messages, images, buildOpenAIMessageContent)
    };

    if (isReasoningModel) {
        payload.max_completion_tokens = Math.max(maxTokens, 4000);
    } else {
        payload.temperature = temperature;
        payload.max_tokens = maxTokens;
    }

    if (jsonSchema) {
        const isWrapper = typeof jsonSchema.schema === 'object' && jsonSchema.schema !== null;
        const schemaToUse = isWrapper ? jsonSchema.schema : jsonSchema;
        const schemaName = isWrapper ? (jsonSchema.name || 'json_response') : 'json_response';

        const isLocalStudio = apiKey === 'lm-studio';

        payload.response_format = {
            type: 'json_schema',
            json_schema: {
                name: schemaName,
                schema: isLocalStudio ? schemaToUse : makeSchemaStrict(schemaToUse),
                strict: !isLocalStudio
            }
        };
    } else {
        payload.response_format = { type: 'json_object' };
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };

    const response = await axiosClient.post(url, payload, { headers, timeout: 300000 });
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
        const isWrapper = typeof jsonSchema.schema === 'object' && jsonSchema.schema !== null;
        const schemaToUse = isWrapper ? jsonSchema.schema : jsonSchema;
        const schemaName = isWrapper ? (jsonSchema.name || 'json_response') : 'json_response';

        // Use Anthropic's tool_choice for structured output
        payload.tools = [{
            name: schemaName,
            description: 'Returns the structured JSON response.',
            input_schema: schemaToUse
        }];
        payload.tool_choice = { type: 'tool', name: schemaName };
    }

    const headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
    };

    const response = await axiosClient.post('https://api.anthropic.com/v1/messages', payload, { headers, timeout: 300000 });
    
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
        const isWrapper = typeof jsonSchema.schema === 'object' && jsonSchema.schema !== null;
        const schemaToUse = isWrapper ? jsonSchema.schema : jsonSchema;

        // Map JSON Schema to Gemini Schema Type
        generationConfig.responseSchema = mapToGeminiSchema(schemaToUse);
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
    if (!schema || typeof schema !== 'object') {
        return schema;
    }

    // Handle standard JSON schema optional/nullable standard structure of format:
    // anyOf: [ { type: 'null' }, { type: 'object', properties: ... } ]
    // by mapping it to a single nullable object.
    if (schema.anyOf && Array.isArray(schema.anyOf)) {
        const nonNullSchema = schema.anyOf.find(s => s && s.type !== 'null');
        const hasNull = schema.anyOf.some(s => s && s.type === 'null');
        if (nonNullSchema) {
            const cleaned = mapToGeminiSchema(nonNullSchema);
            if (hasNull) {
                cleaned.nullable = true;
            }
            return cleaned;
        }
    }

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

    if (geminiSchema.type === 'OBJECT' && (!geminiSchema.properties || Object.keys(geminiSchema.properties).length === 0)) {
        // Google Gemini API rejects OBJECT types that do not have properties defined.
        // Return an empty/unconstrained schema to allow any free-form dictionary.
        return {};
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

async function getFreshAccessToken() {
    let Store;
    try {
        Store = require('electron-store').default || require('electron-store');
    } catch (e) {
        throw new Error('electron-store is not available in this context.');
    }
    const store = new Store();
    const userId = store.get('userId', '');
    const accessToken = store.get('authAccessToken', '');
    const refreshToken = store.get('authRefreshToken', '');
    const expiresAt = Number(store.get('authExpiresAt', 0));

    if (!userId || !accessToken) {
        throw new Error('Please sign in to your Clyde account to use Clyde Managed Cloud.');
    }

    // If still valid (with 2 minutes buffer), return it!
    if (expiresAt && (expiresAt - Date.now() > 120000)) {
        return accessToken;
    }

    if (!refreshToken) {
        throw new Error('Clyde session expired. Please sign in again.');
    }

    try {
        const { refreshSession } = require('./authClient');
        const refreshed = await refreshSession({ refreshToken });
        if (refreshed && refreshed.accessToken) {
            store.set({
                userId: refreshed.userId || '',
                authEmail: refreshed.email || '',
                authAccessToken: refreshed.accessToken || '',
                authRefreshToken: refreshed.refreshToken || '',
                authExpiresAt: refreshed.expiresAt || null
            });
            return refreshed.accessToken;
        }
    } catch (e) {
        console.error('Failed to refresh Supabase session token:', e);
    }

    return accessToken; // fallback to existing token
}

async function generateClydeCloud({ model, messages, jsonSchema, temperature, maxTokens, axiosClient, images }) {
    const accessToken = await getFreshAccessToken();

    // 1. Build Gemini-style contents
    const geminiContents = [];
    let systemInstruction = undefined;
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

    const payload = {
        contents: geminiContents,
        model: model,
        jsonSchema: jsonSchema,
        maxTokens: maxTokens,
        temperature: temperature
    };

    if (systemInstruction) {
        payload.systemInstruction = systemInstruction;
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
    };

    const url = 'https://clydeai.live/api/proxy?type=chat';
    
    try {
        const response = await axiosClient.post(url, payload, { headers, timeout: 300000 });
        
        // Extract reply from Gemini format returned by proxy
        const candidateText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText) {
            if (response.data?.error) {
                throw new Error(response.data.error.message || JSON.stringify(response.data.error));
            }
            throw new Error('No response content returned from Clyde Managed Cloud.');
        }

        return candidateText;
    } catch (err) {
        if (err.response && err.response.data && err.response.data.error) {
            const serverError = err.response.data.error;
            const message = typeof serverError === 'object'
                ? (serverError.message || JSON.stringify(serverError))
                : String(serverError);
            throw new Error(message);
        }
        throw err;
    }
}

module.exports = {
    buildOpenAIMessageContent,
    generateChat,
    normalizeOpenAIChatUrl,
    mapToGeminiParts,
    mapToGeminiSchema
};
