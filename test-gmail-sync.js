const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function run() {
    try {
        const configPath = 'C:\\Users\\skala\\AppData\\Roaming\\clyde\\config.json';
        const settings = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        const apiKey = settings.openAiApiKey;
        const model = 'gpt-5-nano-2025-08-07';
        
        console.log('API Key length:', apiKey ? apiKey.length : 0);
        console.log('Sending Gmail Sync payload to OpenAI via generateChat with model:', model);
        
        const { generateChat } = require('./src/llmClient');
        
        const schema = {
            type: 'object',
            properties: {
                isUpdate: { type: 'boolean' },
                companyName: { type: 'string' },
                outcome: { type: 'string', enum: ['advanced', 'rejected', 'offer'] }
            },
            required: ['isUpdate', 'companyName']
        };
        
        const messages = [
            { role: 'system', content: 'You are Clyde. Return JSON.' },
            { role: 'user', content: 'Email Content:\nSubject: Interview invitation\nBody: We would love to chat' }
        ];
        
        const result = await generateChat({
            provider: 'openai',
            apiKey,
            model,
            messages,
            jsonSchema: schema,
            temperature: 0.2,
            maxTokens: 1500,
            axiosClient: axios
        });
        
        console.log('Success! Result size:', result.length);
        console.log('Result text:', result);
    } catch (error) {
        console.error('Error occurred in raw request!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error);
        }
    }
}

run();
