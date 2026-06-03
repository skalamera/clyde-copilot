const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function run() {
    try {
        const configPath = 'C:\\Users\\skala\\AppData\\Roaming\\clyde\\config.json';
        const settings = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        // Force settings to use OpenAI Custom Key and gpt-4o
        settings.llmProvider = 'openai';
        settings.llmModel = 'gpt-4o';
        
        console.log('App Mode:', settings.appMode);
        console.log('LLM Provider:', settings.llmProvider);
        console.log('LLM Model:', settings.llmModel);
        
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
        
        // Set the context title and resume text to simulate actual interview state
        assistant.setContext({
            mode: 'interview',
            company: 'apollo',
            role: '',
            resumeText: settings.resumeText,
            jobDescription: settings.jobDescription
        });
        
        console.log('Triggering a FORCED suggestion run (bypasses digest checks)...');
        const result = await assistant.maybeRun(true, true);
        console.log('Forced run returned result:', result);
        
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
