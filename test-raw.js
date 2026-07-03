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
        console.log('Sending RAW payload to OpenAI with model:', model);
        
        const payload = {
            model,
            messages: [
                { role: 'system', content: 'You are Clyde. Return JSON.' },
                { role: 'user', content: 'How are you using AI within your current role at Sigma?' }
            ],
            max_completion_tokens: 1500,
            response_format: {
                type: 'json_schema',
                json_schema: {
                    name: 'assistant_cards',
                    schema: {
                        type: 'object',
                        properties: {
                            answers: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        question: { type: 'string' },
                                        bullets: { type: 'array', items: { type: 'string' } }
                                    },
                                    required: ['question', 'bullets'],
                                    additionalProperties: false
                                }
                            }
                        },
                        required: ['answers'],
                        additionalProperties: false
                    },
                    strict: true
                }
            }
        };
        
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        };
        
        const response = await axios.post('https://api.openai.com/v1/chat/completions', payload, { headers });
        console.log('Raw response status:', response.status);
        console.log('Raw response data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error in raw request!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error);
        }
    }
}

run();
