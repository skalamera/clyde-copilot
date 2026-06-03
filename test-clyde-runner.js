const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function run() {
    try {
        const configPath = 'C:\\Users\\skala\\AppData\\Roaming\\clyde\\config.json';
        const settings = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        console.log('App Mode:', settings.appMode);
        console.log('LLM Provider:', settings.llmProvider);
        console.log('LLM Model:', settings.llmModel);
        console.log('LLM API Key:', settings.llmApiKey ? settings.llmApiKey.slice(0, 10) : 'none');
        console.log('OpenAI API Key:', settings.openAiApiKey ? settings.openAiApiKey.slice(0, 10) : 'none');
        console.log('Transcription API Key:', settings.transcriptionApiKey ? settings.transcriptionApiKey.slice(0, 10) : 'none');
        
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
        
        // Mock a transcript turn
        await assistant.addTranscript({
            text: 'How are you using AI within your current role at Sigma?',
            speaker: 'System Audio'
        });
        
        console.log('Finished without throwing!');
    } catch (error) {
        console.error('Error occurred in assistant execution!');
        if (error.response) {
            console.error('Axios status:', error.response.status);
            console.error('Axios response data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error);
        }
    }
}

run();
