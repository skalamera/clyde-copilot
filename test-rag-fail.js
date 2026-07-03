const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function run() {
    try {
        const configPath = 'C:\\Users\\skala\\AppData\\Roaming\\clyde\\config.json';
        const settings = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        // Force settings to use OpenAI Custom Key and gpt-5-nano-2025-08-07
        settings.llmProvider = 'openai';
        settings.llmModel = 'gpt-5-nano-2025-08-07';
        
        console.log('App Mode:', settings.appMode);
        console.log('LLM Provider:', settings.llmProvider);
        console.log('LLM Model:', settings.llmModel);
        
        const { searchKnowledgeVectors } = require('./src/pineconeClient');
        const { createMeetingAssistant } = require('./src/meetingAssistant');
        
        const assistant = createMeetingAssistant({
            settings,
            intervalMs: 12000,
            utteranceSettleMs: 650,
            maxTurns: 6,
            maxTokens: 1500,
            timeout: 60000,
            axiosClient: axios,
            logger: console
        });
        
        // Set context
        assistant.setContext({
            mode: 'interview',
            company: 'apollo',
            role: '',
            resumeText: settings.resumeText,
            jobDescription: settings.jobDescription
        });
        
        const question = 'How are you using AI within your current role at Sigma?';
        
        // Query Pinecone
        console.log('Querying Pinecone for:', question);
        const vectors = await searchKnowledgeVectors(question, settings, { topK: 3 });
        console.log('Retrieved vectors:', vectors.length);
        
        const { generateChat } = require('./src/llmClient');
        const { buildAssistantPrompt, getAssistantSchema } = require('./src/assistantPrompts');
        
        let ragContext = "Relevant facts from the user's resume and past projects:\n" +
            vectors.map(v => `- ${v.text}`).join('\n');
            
        const systemPrompt = buildAssistantPrompt({
            mode: 'interview',
            context: {
                mode: 'interview',
                company: 'apollo',
                role: '',
                resumeText: settings.resumeText,
                jobDescription: settings.jobDescription
            },
            command: 'assist',
            targetQuestion: question,
            ragContext
        });
        
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
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question }
        ];
        
        console.log('Sending request to OpenAI with model: gpt-5-nano-2025-08-07 ...');
        const result = await generateChat({
            provider: 'openai',
            apiKey: settings.openAiApiKey,
            model: 'gpt-5-nano-2025-08-07',
            messages,
            jsonSchema: schema,
            temperature: 0.2,
            maxTokens: 1500,
            axiosClient: axios
        });
        
        console.log('Success! Result size:', result.length, 'Result text:', result);
    } catch (error) {
        console.error('Error occurred in runner!');
        if (error.response) {
            console.error('Axios status:', error.response.status);
            console.error('Axios response data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error);
        }
    }
}

run();
