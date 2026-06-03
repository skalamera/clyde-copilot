const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function run() {
    try {
        const configPath = 'C:\\Users\\skala\\AppData\\Roaming\\clyde\\config.json';
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        const apiKey = config.openAiApiKey;
        const model = 'gpt-4o';
        
        console.log('API Key retrieved, length:', apiKey ? apiKey.length : 0);
        console.log('Testing model:', model);
        
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
        
        console.log('Success!', result);
    } catch (error) {
        console.error('Error occurred!');
        if (error.response) {
            console.error('Axios status:', error.response.status);
            console.error('Axios response data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error);
        }
    }
}

run();
