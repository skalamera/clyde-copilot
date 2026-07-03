const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function run() {
    try {
        const configPath = 'C:\\Users\\skala\\AppData\\Roaming\\clyde\\config.json';
        const settings = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        const apiKey = settings.openAiApiKey;
        const model = 'gpt-5-nano-2025-08-07';
        
        const { generateChat } = require('./src/llmClient');
        const { getAssistantSchema } = require('./src/assistantPrompts');
        
        const schema = {
            name: 'assistant_cards',
            schema: {
                type: 'object',
                properties: getAssistantSchema('interview', 'assist'),
                required: Object.keys(getAssistantSchema('interview', 'assist')),
                additionalProperties: false
            }
        };
        
        const messages = [
            { role: 'system', content: 'You are Clyde. Return JSON.' },
            { role: 'user', content: 'How are you using AI within your current role at Sigma?' }
        ];
        
        const responseText = await generateChat({
            provider: 'openai',
            apiKey,
            model,
            messages,
            jsonSchema: schema,
            temperature: 0.2,
            maxTokens: 1500,
            axiosClient: axios
        });
        
        console.log('Result type:', typeof responseText);
        console.log('Raw responseText:', JSON.stringify(responseText));
    } catch (error) {
        console.error('Error occurred in raw request!', error);
    }
}

run();
