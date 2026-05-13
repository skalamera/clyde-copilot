const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const axios = require('axios');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');

// Configure electron-log
log.transports.file.level = 'info';
console.log = log.info;
console.error = log.error;
console.warn = log.warn;

require('dotenv').config({ path: path.join(__dirname, '.env') });

const { createAudioCapture } = require('./src/audioCapture');
const { calculatePcmRms, createTranscriptionProcessor } = require('./src/transcriptionClient');
const { createMeetingAssistant } = require('./src/meetingAssistant');
const { createInterviewManager } = require('./src/interviewManager');
const { createSessionManager } = require('./src/sessionManager');
const { generateChat } = require('./src/llmClient');
const {
    buildTranscriptCleanupPrompt,
    normalizeCleanedTranscriptResponse,
    transcriptToText
} = require('./src/transcriptCleanup');

let mainWindow;
let audioCaptures;
let audioLevelCaptures;
let transcriptionProcessors;
let meetingAssistant;
let interviewManager;
let sessionManager;
let audioLevelTimer;
let liveAudioLevelTimer;
let liveAudioLevels;
let healthCheckTimer;

let fullSessionTranscript = [];

const healthState = {
    audio: { state: 'unknown', label: 'Audio', detail: 'Not checked yet.' },
    whisper: { state: 'unknown', label: 'Transcription', detail: 'Not checked yet.' },
    lmStudio: { state: 'unknown', label: 'Assistant LLM', detail: 'Not checked yet.' },
    capture: { state: 'idle', label: 'Capture', detail: 'Stopped.' }
};

function configureElectronStorage() {
    const appData = app.getPath('appData');
    const userData = path.join(appData, 'Clyde');
    const sessionData = path.join(userData, 'Session');

    fs.mkdirSync(sessionData, { recursive: true });
    app.setPath('userData', userData);
    app.setPath('sessionData', sessionData);
}

function loadSettings() {
    const Store = require('electron-store').default || require('electron-store');
    const store = new Store();
    
    let settings = {
        llmProvider: store.get('llmProvider', 'local'),
        llmModel: store.get('llmModel', ''),
        llmApiKey: store.get('llmApiKey', ''),
        localLlmUrl: store.get('localLlmUrl', 'http://localhost:1234/v1/chat/completions'),
        transcriptionProvider: store.get('transcriptionProvider', 'local'),
        transcriptionApiKey: store.get('transcriptionApiKey', ''),
        localTranscriptionUrl: store.get('localTranscriptionUrl', 'http://localhost:8000/v1/audio/transcriptions'),
        jobDescription: store.get('jobDescription', ''),
        resumeText: store.get('resumeText', ''),
        currentCompany: store.get('currentCompany', ''),
        currentRole: store.get('currentRole', ''),
        geminiApiKey: store.get('geminiApiKey', ''),
        pineconeApiKey: store.get('pineconeApiKey', ''),
        pineconeHost: store.get('pineconeHost', ''),
        ragEnabled: store.get('ragEnabled', false),
        appMode: store.get('appMode', 'interview'),
        meetingTitle: store.get('meetingTitle', ''),
        meetingAttendees: store.get('meetingAttendees', []),
        meetingMemory: store.get('meetingMemory', ''),
        screenShareHidden: store.get('screenShareHidden', true)
    };

    // Fallbacks from env if settings aren't populated
    if (!settings.localLlmUrl) settings.localLlmUrl = process.env.LM_STUDIO_CHAT_URL || 'http://localhost:1234/v1/chat/completions';
    if (!settings.localTranscriptionUrl) settings.localTranscriptionUrl = process.env.LM_STUDIO_API_URL || 'http://localhost:8000/v1/audio/transcriptions';
    if (!settings.llmModel && settings.llmProvider === 'local') settings.llmModel = process.env.LM_STUDIO_CHAT_MODEL || '';
    if (!settings.geminiApiKey) settings.geminiApiKey = process.env.GEMINI_API_KEY || '';
    if (!settings.pineconeApiKey) settings.pineconeApiKey = process.env.PINECONE_API_KEY || '';
    if (!settings.pineconeHost) settings.pineconeHost = process.env.PINECONE_HOST || '';
    
    // Inject back into process.env so existing modules (like pineconeClient.js) can read them
    if (settings.geminiApiKey) process.env.GEMINI_API_KEY = settings.geminiApiKey;
    if (settings.pineconeApiKey) process.env.PINECONE_API_KEY = settings.pineconeApiKey;
    if (settings.pineconeHost) process.env.PINECONE_HOST = settings.pineconeHost;

    return settings;
}

function saveSettings(newSettings) {
    const Store = require('electron-store').default || require('electron-store');
    const store = new Store();
    
    store.set(newSettings);
    
    // Update process.env immediately
    if (newSettings.geminiApiKey) process.env.GEMINI_API_KEY = newSettings.geminiApiKey;
    
    if (newSettings.ragEnabled && newSettings.pineconeApiKey) {
        process.env.PINECONE_API_KEY = newSettings.pineconeApiKey;
    } else {
        delete process.env.PINECONE_API_KEY;
    }
    
    if (newSettings.ragEnabled && newSettings.pineconeHost) {
        process.env.PINECONE_HOST = newSettings.pineconeHost;
    } else {
        delete process.env.PINECONE_HOST;
    }

    // Re-initialize clients with new settings
    if (meetingAssistant) {
        meetingAssistant = createMeetingAssistant({
            settings: newSettings,
            intervalMs: Number(process.env.LM_STUDIO_ASSISTANT_INTERVAL_MS || 30000),
            maxTurns: Number(process.env.LM_STUDIO_ASSISTANT_MAX_TURNS || 6),
            maxTokens: Number(process.env.LM_STUDIO_ASSISTANT_MAX_TOKENS || 800),
            timeout: Number(process.env.LM_STUDIO_ASSISTANT_TIMEOUT_MS || 60000),
            axiosClient: axios,
            logger: console,
            sendStatus: sendAudioStatus,
            sendUpdate: sendAssistantUpdate
        });
        const activeJd = (interviewManager && newSettings.currentCompany) ? interviewManager.getCompanyJobDescription(newSettings.currentCompany) : '';
        meetingAssistant.setContext({ 
            mode: newSettings.appMode || 'interview',
            jobDescription: activeJd,
            resumeText: newSettings.resumeText || '',
            company: newSettings.currentCompany || '',
            role: newSettings.currentRole || '',
            meetingTitle: newSettings.meetingTitle || '',
            attendees: Array.isArray(newSettings.meetingAttendees) ? newSettings.meetingAttendees : [],
            memory: newSettings.meetingMemory || ''
        });
    }

    if (interviewManager) {
        interviewManager = createInterviewManager({
            appPath: app.getPath('userData'),
            axiosClient: axios,
            settings: newSettings,
            onStatus: sendAudioStatus
        });
    }

    // Force health recheck
    checkServiceHealth(newSettings);
}

/**
 * Creates the audio recording controller without starting SoX.
 */
function initializeAudioCaptures() {
    if (audioCaptures) {
        return audioCaptures;
    }

    audioCaptures = getAudioSources().map((source) => createAudioCapture({
        env: process.env,
        logger: console,
        recordOptions: {
            device: source.device
        },
        processAudioChunk: (chunk) => processAudioChunk(source, chunk),
        onStatus: (status) => sendSourceAudioStatus(source, status)
    }));

    return audioCaptures;
}

function getAudioSources() {
    const configured = process.env.CLYDE_AUDIO_SOURCES;

    if (!configured) {
        return [{
            id: 'default',
            label: 'Transcription API',
            device: process.env.CLYDE_AUDIO_DEVICE,
            color: '#d8bfd8'
        }];
    }

    return configured
        .split(';')
        .map((source, index) => {
            const [label, device, color] = source.split('|').map((part) => part && part.trim());

            return {
                id: `source-${index}`,
                label: label || `Source ${index + 1}`,
                device,
                color: color || '#d8bfd8'
            };
        })
        .filter((source) => source.device);
}

function sendSourceAudioStatus(source, status) {
    if (!status || !status.message) {
        sendAudioStatus(status);
        return;
    }

    updateHealth('capture', {
        state: status.state === 'error' ? 'error' : status.state === 'capturing' ? 'ready' : 'idle',
        detail: `${source.label}: ${status.message}`
    });

    if (status.state === 'error' || status.state === 'warning') {
        sendAudioStatus({
            ...status,
            message: `${source.label}: ${status.message}`
        });
    }
}

function sendTranscriptionStatus(source, status) {
    if (!status || !status.message) {
        return;
    }

    if (status.state === 'error' || status.state === 'warning') {
        sendSourceAudioStatus(source, status);
    }
}

function sendAudioStatus(status) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    mainWindow.webContents.send('audio-status', status);
}

function updateHealth(key, next) {
    healthState[key] = {
        ...healthState[key],
        ...next
    };
    sendHealthUpdate();
}

function sendHealthUpdate() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    mainWindow.webContents.send('health-update', healthState);
}

async function checkServiceHealth(settings = loadSettings()) {
    await Promise.all([
        checkWhisperHealth(settings),
        checkLmStudioHealth(settings)
    ]);

    checkAudioHealth();
    sendHealthUpdate();
}

function checkAudioHealth() {
    const sources = getAudioSources();

    updateHealth('audio', {
        state: sources.length ? 'ready' : 'error',
        detail: sources.length
            ? `${sources.map((source) => `${source.label}: ${source.device}`).join(' | ')}`
            : 'No audio sources configured.'
    });
}

async function checkWhisperHealth(settings) {
    if (settings.transcriptionProvider === 'openai') {
        updateHealth('whisper', { state: 'ready', detail: 'Using OpenAI Cloud Transcription API.' });
        return;
    }

    const transcriptionUrl = settings.localTranscriptionUrl;

    if (!transcriptionUrl) {
        updateHealth('whisper', { state: 'error', detail: 'Local transcription URL is not set.' });
        return;
    }

    try {
        const baseUrl = new URL(transcriptionUrl);
        const docsUrl = `${baseUrl.origin}/docs`;
        await axios.get(docsUrl, { timeout: 2000 });

        updateHealth('whisper', {
            state: 'ready',
            detail: `${docsUrl} is reachable. Model warms on first transcription.`
        });
    } catch (error) {
        updateHealth('whisper', {
            state: 'error',
            detail: `Cannot reach local whisper at ${transcriptionUrl}: ${formatServiceError(error)}`
        });
    }
}

async function checkLmStudioHealth(settings) {
    if (settings.llmProvider !== 'local') {
        updateHealth('lmStudio', { state: 'ready', detail: `Using Cloud LLM: ${settings.llmProvider} (${settings.llmModel})` });
        return;
    }

    const chatUrl = settings.localLlmUrl;
    const model = settings.llmModel;

    if (!chatUrl || !model) {
        updateHealth('lmStudio', {
            state: 'warning',
            detail: 'Local Assistant LLM is not configured properly.'
        });
        return;
    }

    try {
        const baseUrl = new URL(chatUrl);
        const modelsUrl = `${baseUrl.origin}/v1/models`;
        const response = await axios.get(modelsUrl, { timeout: 2000 });
        const models = Array.isArray(response.data && response.data.data)
            ? response.data.data.map((item) => item.id)
            : [];
        const hasModel = models.includes(model);

        updateHealth('lmStudio', {
            state: hasModel ? 'ready' : 'warning',
            detail: hasModel
                ? `${model} is available at ${baseUrl.origin}.`
                : `${baseUrl.origin} is reachable, but ${model} was not listed.`
        });
    } catch (error) {
        updateHealth('lmStudio', {
            state: 'error',
            detail: `Cannot reach local LLM at ${chatUrl}: ${formatServiceError(error)}`
        });
    }
}

function formatServiceError(error) {
    if (error && error.code) {
        return error.code;
    }

    if (error && error.message) {
        return error.message;
    }

    return 'unknown error';
}

function sendTranscriptUpdate(transcript) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    // Append to the full session transcript for saving later
    if (transcript && transcript.text) {
        const speaker = transcript.speaker || 'Unknown';
        const text = String(transcript.text).trim();
        
        if (fullSessionTranscript.length > 0 && fullSessionTranscript[fullSessionTranscript.length - 1].speaker === speaker) {
            fullSessionTranscript[fullSessionTranscript.length - 1].text += ' ' + text;
        } else {
            fullSessionTranscript.push({
                speaker: speaker,
                text: text
            });
        }
    }

    mainWindow.webContents.send('transcript-update', transcript);
    getMeetingAssistant().addTranscript(transcript);
}

function sendAssistantUpdate(update) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    mainWindow.webContents.send('assistant-update', update);
}

function sendAudioLevelUpdate(update) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    mainWindow.webContents.send('audio-level-update', update);
}

function getMeetingAssistant() {
    if (meetingAssistant) {
        return meetingAssistant;
    }

    const settings = loadSettings();

    meetingAssistant = createMeetingAssistant({
        settings,
        intervalMs: Number(process.env.LM_STUDIO_ASSISTANT_INTERVAL_MS || 30000),
        maxTurns: Number(process.env.LM_STUDIO_ASSISTANT_MAX_TURNS || 6),
        maxTokens: Number(process.env.LM_STUDIO_ASSISTANT_MAX_TOKENS || 800),
        timeout: Number(process.env.LM_STUDIO_ASSISTANT_TIMEOUT_MS || 60000),
        axiosClient: axios,
        logger: console,
        sendStatus: sendAudioStatus,
        sendUpdate: sendAssistantUpdate
    });
    
    const activeJd = (interviewManager && settings.currentCompany) ? interviewManager.getCompanyJobDescription(settings.currentCompany) : '';
    meetingAssistant.setContext({ 
        mode: settings.appMode || 'interview',
        jobDescription: activeJd,
        resumeText: settings.resumeText || '',
        company: settings.currentCompany || '',
        role: settings.currentRole || '',
        meetingTitle: settings.meetingTitle || '',
        attendees: Array.isArray(settings.meetingAttendees) ? settings.meetingAttendees : [],
        memory: settings.meetingMemory || ''
    });

    return meetingAssistant;
}

function getTranscriptionProcessor(source) {
    if (!transcriptionProcessors) {
        transcriptionProcessors = new Map();
    }

    if (transcriptionProcessors.has(source.id)) {
        return transcriptionProcessors.get(source.id);
    }

    const settings = loadSettings();

    const processor = createTranscriptionProcessor({
        settings,
        minRms: Number(process.env.CLYDE_MIN_RMS || 100),
        hallucinationRms: Number(process.env.CLYDE_HALLUCINATION_RMS || 350),
        timeout: Number(process.env.TRANSCRIPTION_TIMEOUT_MS || 120000),
        diagnostics: process.env.CLYDE_AUDIO_DEBUG === '1',
        speaker: source.label,
        speakerColor: source.color,
        axiosClient: axios,
        logger: console,
        sendStatus: (status) => sendTranscriptionStatus(source, status),
        sendTranscript: sendTranscriptUpdate
    });

    transcriptionProcessors.set(source.id, processor);
    return processor;
}

async function processAudioChunk(source, chunk) {
    updateLiveAudioLevel(source, chunk);
    await getTranscriptionProcessor(source).processAudioChunk(chunk);
}

function stopAudioCaptures() {
    if (audioCaptures) {
        for (const capture of audioCaptures) {
            capture.stop();
        }
        audioCaptures = null;
    }

    transcriptionProcessors = null;
    meetingAssistant = null;
    stopLiveAudioLevels();
}

function startLiveAudioLevels() {
    const sources = getAudioSources();
    liveAudioLevels = new Map(sources.map((source) => [source.id, {
        label: source.label,
        color: source.color,
        rms: 0,
        level: 0,
        chunks: 0,
        speaking: false
    }]));

    if (liveAudioLevelTimer) {
        clearInterval(liveAudioLevelTimer);
    }

    liveAudioLevelTimer = setInterval(() => {
        sendAudioLevelUpdate({
            type: 'live-levels',
            sources: Array.from(liveAudioLevels.entries()).map(([id, value]) => ({
                id,
                ...value
            }))
        });
    }, 120);

    sendAudioLevelUpdate({
        type: 'live-started',
        sources: Array.from(liveAudioLevels.entries()).map(([id, value]) => ({
            id,
            ...value
        }))
    });
}

function stopLiveAudioLevels() {
    if (liveAudioLevelTimer) {
        clearInterval(liveAudioLevelTimer);
        liveAudioLevelTimer = null;
    }

    liveAudioLevels = null;
    sendAudioLevelUpdate({ type: 'live-stopped' });
}

function updateLiveAudioLevel(source, chunk) {
    if (!liveAudioLevels || !source || !chunk) {
        return;
    }

    const current = liveAudioLevels.get(source.id);

    if (!current) {
        return;
    }

    const rms = calculatePcmRms(chunk);
    current.rms = rms;
    current.level = rmsToMeterLevel(rms);
    current.chunks += 1;
    current.speaking = rms >= Number(process.env.CLYDE_VOICE_ACTIVE_RMS || 450);
}

function startAudioLevelTest() {
    stopAudioLevelTest();

    const sources = getAudioSources();
    const levels = new Map(sources.map((source) => [source.id, {
        label: source.label,
        color: source.color,
        rms: 0,
        level: 0,
        chunks: 0
    }]));

    audioLevelCaptures = sources.map((source) => createAudioCapture({
        env: process.env,
        logger: console,
        recordOptions: {
            device: source.device
        },
        onStatus: (status) => sendAudioLevelUpdate({
            type: 'status',
            sourceId: source.id,
            label: source.label,
            status
        }),
        processAudioChunk: (chunk) => {
            const rms = calculatePcmRms(chunk);
            const current = levels.get(source.id);

            current.rms = rms;
            current.level = rmsToMeterLevel(rms);
            current.chunks += 1;
        }
    }));

    const results = audioLevelCaptures.map((capture) => capture.start());
    const failed = results.find((result) => !result.ok);

    if (failed) {
        sendAudioLevelUpdate({ type: 'error', message: failed.message });
        stopAudioLevelTest();
        return;
    }

    audioLevelTimer = setInterval(() => {
        sendAudioLevelUpdate({
            type: 'levels',
            sources: Array.from(levels.entries()).map(([id, value]) => ({
                id,
                ...value
            }))
        });
    }, 150);

    sendAudioLevelUpdate({
        type: 'started',
        sources: Array.from(levels.entries()).map(([id, value]) => ({
            id,
            ...value
        }))
    });
}

function stopAudioLevelTest() {
    if (audioLevelTimer) {
        clearInterval(audioLevelTimer);
        audioLevelTimer = null;
    }

    if (audioLevelCaptures) {
        for (const capture of audioLevelCaptures) {
            capture.stop();
        }
        audioLevelCaptures = null;
    }

    sendAudioLevelUpdate({ type: 'stopped' });
}

function rmsToMeterLevel(rms) {
    if (!rms || rms <= 0) {
        return 0;
    }

    return Math.max(0, Math.min(100, Math.round((20 * Math.log10(rms / 32768) + 60) / 60 * 100)));
}

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    transparent: true,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const rendererIndex = path.join(__dirname, 'src', 'renderer-dist', 'index.html');
  const legacyRendererIndex = path.join(__dirname, 'src', 'index.html');
  mainWindow.loadFile(fs.existsSync(rendererIndex) ? rendererIndex : legacyRendererIndex);

  mainWindow.webContents.on('did-finish-load', () => {
      sendAudioStatus({ state: 'idle', message: 'Ready. Press Start to begin.' });
      checkServiceHealth(loadSettings());
      healthCheckTimer = setInterval(() => checkServiceHealth(loadSettings()), Number(process.env.CLYDE_HEALTH_INTERVAL_MS || 10000));
  });

  const settings = loadSettings();
  interviewManager = createInterviewManager({
      appPath: app.getPath('userData'),
      axiosClient: axios,
      settings,
      onStatus: sendAudioStatus
  });

  sessionManager = createSessionManager({
      appPath: app.getPath('userData')
  });

  // Setup IPC communication for start/stop transcription
  ipcMain.on('start-audio-capture', (event) => {
      fullSessionTranscript = []; // Reset full session transcript on new start
      getMeetingAssistant(); // ensure initialized
      startLiveAudioLevels();
      const results = initializeAudioCaptures().map((capture) => capture.start());
      const failed = results.find((result) => !result.ok);

      if (failed) {
          stopLiveAudioLevels();
          sendAudioStatus({ state: 'error', message: failed.message });
      } else {
          const sourceNames = getAudioSources().map((source) => source.label).join(' and ');
          const message = sourceNames
              ? `Capturing audio from ${sourceNames}.`
              : 'Capturing audio.';

          sendAudioStatus({ state: 'capturing', message });
          updateHealth('capture', { state: 'ready', detail: message });
      }
  });

  ipcMain.on('stop-audio-capture', () => {
      if (audioCaptures) {
          stopAudioCaptures();
          sendAudioStatus({ state: 'idle', message: 'Audio capture stopped.' });
          updateHealth('capture', { state: 'idle', detail: 'Stopped.' });
      } else {
          stopLiveAudioLevels();
          sendAudioStatus({ state: 'idle', message: 'Audio capture stopped.' });
      }
  });

  ipcMain.on('reset-session', () => {
      fullSessionTranscript = [];
      if (meetingAssistant) {
          meetingAssistant.resetTranscript();
      }
      sendAudioStatus({ state: 'idle', message: 'Session reset.' });
      if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('session-reset');
      }
  });

  ipcMain.on('start-audio-level-test', () => {
      startAudioLevelTest();
  });

  ipcMain.on('stop-audio-level-test', () => {
      stopAudioLevelTest();
  });

  ipcMain.on('request-suggestion', () => {
      getMeetingAssistant().requestSuggestion();
  });

  ipcMain.handle('save-settings', (event, settings) => {
      saveSettings(settings);
      return true;
  });

  ipcMain.handle('load-settings', (event) => {
      return loadSettings();
  });

  ipcMain.handle('get-companies', (event) => {
      return interviewManager.getCompanies();
  });

  ipcMain.handle('get-roles', (event) => {
      return interviewManager.getRoles();
  });

  ipcMain.handle('get-interviews', (event, company) => {
      return interviewManager.getInterviews(company);
  });

  ipcMain.handle('delete-company', (event, company) => {
      interviewManager.deleteCompany(company);
      sessionManager.deleteEntity('interview', company);
      return true;
  });

  ipcMain.handle('rename-company', (event, oldName, newName) => {
      interviewManager.renameCompany(oldName, newName);
      return true;
  });

  ipcMain.handle('set-company-role', (event, companyName, role) => {
      interviewManager.setCompanyRole(companyName, role);
      return true;
  });

  ipcMain.handle('get-company-jd', (event, companyName) => {
      return interviewManager.getCompanyJobDescription(companyName);
  });

  ipcMain.handle('set-company-jd', (event, companyName, jdText) => {
      interviewManager.setCompanyJobDescription(companyName, jdText);
      return true;
  });

  ipcMain.handle('delete-interview', (event, company, id) => {
      interviewManager.deleteInterview(company, id);
      return true;
  });

  ipcMain.handle('save-interview', (event, metadata) => {
      if (!fullSessionTranscript || fullSessionTranscript.length === 0) {
          throw new Error("No transcript data recorded.");
      }
      return interviewManager.saveInterview({ ...metadata, transcript: fullSessionTranscript });
  });

  ipcMain.handle('save-manual-interview', (event, metadata) => {
      return interviewManager.saveInterview(metadata);
  });

  ipcMain.handle('get-sessions', (event, filters) => {
      return sessionManager.getSessions(filters || {});
  });

  ipcMain.handle('get-session-entities', (event, mode) => {
      return sessionManager.getSessionEntities(mode || 'interview');
  });

  ipcMain.handle('save-session', (event, record) => {
      const sessionId = sessionManager.saveSession(record || {});
      
      // If it's an interview session that needs grading, trigger background grading
      const hasTranscript = record && Array.isArray(record.transcript) && record.transcript.length > 0;
      if (record && record.mode === 'interview' && record.grading && record.grading.status === 'pending' && hasTranscript) {
         processInterviewCleanupAndGradingInBackground(sessionId, record, loadSettings()).catch(console.error);
      } else if (record && record.mode === 'interview' && record.entity && !hasTranscript) {
         sessionManager.updateEntityConfidence(record.entity.id, 0, 'neutral');
      }
      
      return sessionId;
  });

  async function processInterviewCleanupAndGradingInBackground(sessionId, record, settings) {
      try {
          const cleanedTranscript = await processTranscriptCleanupInBackground(record, settings);
          const nextRecord = cleanedTranscript && cleanedTranscript.length
              ? { ...record, transcript: cleanedTranscript }
              : record;

          if (cleanedTranscript && cleanedTranscript.length) {
              sessionManager.saveSession(nextRecord);
          }

          await processSessionGradingInBackground(sessionId, nextRecord, settings);
      } catch (error) {
          console.error("Transcript cleanup failed", error);
          await processSessionGradingInBackground(sessionId, record, settings);
      }
  }

  async function processTranscriptCleanupInBackground(record, settings) {
      if (!record?.transcript || record.transcript.length === 0) {
          return [];
      }

      const provider = settings.llmProvider || 'local';
      const apiKey = settings.llmApiKey || '';
      const model = settings.llmModel || '';
      const localUrl = settings.localLlmUrl;
      const prompt = buildTranscriptCleanupPrompt(record.transcript);

      const responseText = await generateChat({
          provider,
          apiKey,
          model,
          temperature: 0,
          maxTokens: 8192,
          axiosClient: axios,
          localUrl,
          jsonSchema: {
              name: 'transcript_cleanup',
              schema: {
                  type: 'object',
                  properties: {
                      transcript: {
                          type: 'array',
                          items: {
                              type: 'object',
                              properties: {
                                  speaker: { type: 'string' },
                                  text: { type: 'string' }
                              },
                              required: ['speaker', 'text'],
                              additionalProperties: false
                          }
                      }
                  },
                  required: ['transcript'],
                  additionalProperties: false
              }
          },
          messages: [{ role: 'user', content: prompt }]
      });

      const cleanedTranscript = normalizeCleanedTranscriptResponse(responseText, record.transcript);
      if (cleanedTranscript) {
          return cleanedTranscript;
      }

      try {
          console.error('Failed to parse cleaned transcript JSON:', responseText);
      } catch (_error) {}

      return null;
  }

  async function processSessionGradingInBackground(sessionId, record, settings) {
      sendAudioStatus({ state: 'processing', message: `Grading interview for ${record.entity.name}...` });

      try {
          const provider = settings.llmProvider || 'local';
          const apiKey = settings.llmApiKey || '';
          const model = settings.llmModel || '';
          const localUrl = settings.localLlmUrl;

          const transcriptText = transcriptToText(record.transcript);
          const roleStr = record.entity.role ? `\nRole/Job Title: ${record.entity.role}` : '';
          const jd = interviewManager.getCompanyJobDescription(record.entity.name) || interviewManager.getCompanyJobDescription(record.entity.id);
          const jdStr = jd ? `\nJob Description Context:\n${jd}` : '';
          
          const prompt = `You are an expert technical recruiter and hiring manager. Evaluate the candidate ("You") based on the interview transcript.
          Company: ${record.entity.name}${roleStr}${jdStr}
          
          Give a highly precise grade (A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-, F) based on clarity, technical accuracy, conciseness, and professionalism. Be strict and exact.
          Write a detailed evaluation in exactly 4 short professional sections using markdown headers: **Overall assessment:**, **Evidence:**, **Risks:**, and **Outlook:**.
          Use concrete details from the transcript. Do not write a generic one-paragraph summary. Finish every sentence. Keep examples separate from the written evaluation.
          
          Transcript:
          ${transcriptText}`;

          const resultText = await generateChat({
              provider,
              apiKey,
              model,
              temperature: 0.2,
              maxTokens: 1800,
              axiosClient: axios,
              localUrl,
              jsonSchema: {
                  name: 'grading',
                  schema: {
                      type: 'object',
                      properties: {
                          grade: { type: 'string', enum: ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'] },
                          reasoning: { type: 'string', description: 'The detailed evaluation formatted in exactly 4 sections with markdown headers: **Overall assessment:**, **Evidence:**, **Risks:**, **Outlook:**' },
                          examples: { type: 'array', items: { type: 'string' } }
                      },
                      required: ['grade', 'reasoning', 'examples'],
                      additionalProperties: false
                  }
              },
              messages: [{ role: 'user', content: prompt }]
          });

          let gradeData = { grade: 'C', reasoning: 'Failed to generate proper evaluation.', examples: [] };
          try {
              let cleanedText = resultText.trim();
              if (cleanedText.startsWith('\`\`\`json')) {
                  cleanedText = cleanedText.replace(/^\`\`\`json/g, '').replace(/\`\`\`$/g, '').trim();
              } else if (cleanedText.startsWith('\`\`\`')) {
                  cleanedText = cleanedText.replace(/^\`\`\`/g, '').replace(/\`\`\`$/g, '').trim();
              }
              gradeData = JSON.parse(cleanedText);
          } catch (e) {
              console.error("Failed to parse grading score JSON:", resultText);
          }

          // Update record and save it
          record.grading = {
              status: 'complete',
              grade: gradeData.grade,
              reasoning: gradeData.reasoning,
              examples: gradeData.examples
          };
          sessionManager.saveSession(record);

          // Now recompute confidence score
          await processSessionConfidenceInBackground(record.entity, settings);

      } catch (error) {
          console.error("Grading processing error:", error);
          record.grading = { status: 'failed' };
          sessionManager.saveSession(record);
          sendAudioStatus({ state: 'error', message: `Grading failed for ${record.entity.name}` });
      }
  }

  async function processSessionConfidenceInBackground(entity, settings) {
      sendAudioStatus({ state: 'processing', message: `Computing confidence score for ${entity.name}...` });
      
      try {
          // Get all interview sessions for this entity to analyze
          const allSessions = sessionManager.getSessions({ mode: 'interview', entityId: entity.id });
          if (allSessions.length === 0) {
              sendAudioStatus({ state: 'success', message: `Evaluation complete for ${entity.name}!` });
              return;
          }

          const provider = settings.llmProvider || 'local';
          const apiKey = settings.llmApiKey || '';
          const model = settings.llmModel || '';
          const localUrl = settings.localLlmUrl;

          const combinedTranscripts = allSessions.map((inv, idx) => `\n--- Interview ${idx + 1} (${inv.title}) ---\n` + inv.transcript.map(t => `${t.speaker}: ${t.text}`).join('\n')).join('\n');

          const roleStr = entity.role ? `\nRole/Job Title: ${entity.role}` : '';
          const jd = interviewManager.getCompanyJobDescription(entity.name) || interviewManager.getCompanyJobDescription(entity.id);
          const jdStr = jd ? `\nJob Description Context:\n${jd}` : '';

          const confPrompt = `You are a strict, objective hiring manager evaluating a candidate across all their interviews for a company.
          Company: ${entity.name}${roleStr}${jdStr}
          
          Review the transcripts of all their interviews so far.
          Determine the likelihood of them receiving an offer or moving to the next round, as a percentage from 0 to 100.
          CRITICAL: Be extremely precise and granular with your percentage. Do NOT default to round numbers or multiples of 5 (e.g. avoid exactly 80, 85, 90). Instead, give highly specific numbers based on a detailed analysis of their performance (e.g., 82, 87, 91, 74). Be highly realistic and critical.
          Determine if their trend is "up", "down", or "neutral" compared to previous rounds (if only one round, default to neutral).
          
          Transcripts:
          ${combinedTranscripts}`;

          const confText = await generateChat({
              provider,
              apiKey,
              model,
              temperature: 0.2,
              maxTokens: 300,
              axiosClient: axios,
              localUrl,
              jsonSchema: {
                  name: 'confidence',
                  schema: {
                      type: 'object',
                      properties: {
                          confidence_score: { type: 'integer' },
                          trend: { type: 'string', enum: ['up', 'down', 'neutral'] }
                      },
                      required: ['confidence_score', 'trend'],
                      additionalProperties: false
                  }
              },
              messages: [{ role: 'user', content: confPrompt }]
          });

          let confData = { confidence_score: 0, trend: 'neutral' };
          try {
              let cleanedText = confText.trim();
              if (cleanedText.startsWith('\`\`\`json')) {
                  cleanedText = cleanedText.replace(/^\`\`\`json/g, '').replace(/\`\`\`$/g, '').trim();
              } else if (cleanedText.startsWith('\`\`\`')) {
                  cleanedText = cleanedText.replace(/^\`\`\`/g, '').replace(/\`\`\`$/g, '').trim();
              }
              confData = JSON.parse(cleanedText);
          } catch (e) {
              console.error("Failed to parse confidence score JSON:", confText);
          }

          // Save the confidence to the entity's meta.json
          sessionManager.updateEntityConfidence(entity.id, confData.confidence_score, confData.trend);
          sendAudioStatus({ state: 'success', message: `Evaluation complete for ${entity.name}!` });

      } catch (err) {
          console.error("Confidence recompute failed", err);
          sendAudioStatus({ state: 'error', message: `Confidence evaluation failed for ${entity.name}` });
      }
  }

  ipcMain.handle('delete-session', (event, payload) => {
      const nextPayload = payload || {};
      const deleted = sessionManager.deleteSession(nextPayload);

      if (nextPayload.mode === 'interview' && nextPayload.entityId) {
          const remaining = sessionManager.getSessions({ mode: 'interview', entityId: nextPayload.entityId });
          if (remaining.length > 0) {
              processSessionConfidenceInBackground(remaining[0].entity, loadSettings()).catch(console.error);
          } else {
              sessionManager.updateEntityConfidence(nextPayload.entityId, 0, 'neutral');
          }
      }

      return deleted;
  });

  ipcMain.handle('delete-session-entity', (event, payload) => {
      return sessionManager.deleteEntity(payload && payload.mode, payload && payload.entityId);
  });

  ipcMain.handle('update-session-entity', (event, payload) => {
      const nextEntity = sessionManager.updateEntity(
          payload && payload.mode,
          payload && payload.entityId,
          payload && payload.patch
      );

      if (payload && payload.mode === 'interview' && payload.entityId) {
          const patch = payload.patch || {};
          if (patch.role !== undefined) {
              try { interviewManager.setCompanyRole(payload.entityId, patch.role); } catch (error) { console.warn(error.message); }
          }
      }

      return nextEntity;
  });

  ipcMain.handle('set-active-session-context', (event, context) => {
      const settings = loadSettings();
      const nextSettings = {
          ...settings,
          appMode: context && context.mode ? context.mode : settings.appMode,
          currentCompany: context && context.company !== undefined ? context.company : settings.currentCompany,
          currentRole: context && context.role !== undefined ? context.role : settings.currentRole,
          meetingTitle: context && context.meetingTitle !== undefined ? context.meetingTitle : settings.meetingTitle,
          meetingAttendees: context && Array.isArray(context.attendees) ? context.attendees : settings.meetingAttendees,
          meetingMemory: context && context.memory !== undefined ? context.memory : settings.meetingMemory,
          screenShareHidden: context && context.screenShareHidden !== undefined ? Boolean(context.screenShareHidden) : settings.screenShareHidden
      };

      saveSettings(nextSettings);
      if (meetingAssistant) {
          meetingAssistant.setContext({
              mode: nextSettings.appMode,
              jobDescription: nextSettings.jobDescription || '',
              resumeText: nextSettings.resumeText || '',
              company: nextSettings.currentCompany || '',
              role: nextSettings.currentRole || '',
              meetingTitle: nextSettings.meetingTitle || '',
              attendees: nextSettings.meetingAttendees || [],
              memory: nextSettings.meetingMemory || ''
          });
      }

      return nextSettings;
  });

  ipcMain.handle('validate-services', async (event, settingsPatch) => {
      const settings = {
          ...loadSettings(),
          ...(settingsPatch || {})
      };
      await checkServiceHealth(settings);
      return JSON.parse(JSON.stringify(healthState));
  });

  ipcMain.handle('extract-job-context', async (event, jobDescription) => {
      const settings = loadSettings();
      const provider = settings.llmProvider || 'local';
      const apiKey = settings.llmApiKey || '';
      const model = settings.llmModel || '';
      const localUrl = settings.localLlmUrl;

      const prompt = `You are an expert HR assistant. Your goal is to analyze the provided raw Job Description and perform two tasks:
1. Extract the primary Company Name and the Job Title/Role. If you cannot find one of them, leave it as an empty string.
2. Reorganize and structure the raw Job Description into a clean, consistent Markdown format with the following sections:
   - **Role Overview**: A brief summary of the position.
   - **Key Responsibilities**: A bulleted list of the main duties.
   - **Required Qualifications**: A bulleted list of the absolute must-have skills/experience.
   - **Preferred Qualifications**: A bulleted list of nice-to-have skills/experience (if any).

Raw Job Description:
${jobDescription}`;

      try {
          const response = await generateChat({
              provider,
              apiKey,
              model,
              temperature: 0.1,
              maxTokens: 1500, // Increased to allow formatting the full description
              axiosClient: axios,
              localUrl,
              jsonSchema: {
                  name: 'job_context',
                  schema: {
                      type: 'object',
                      properties: {
                          company: { type: 'string' },
                          role: { type: 'string' },
                          structured_description: { type: 'string', description: 'The fully reorganized and cleaned Markdown job description.' }
                      },
                      required: ['company', 'role', 'structured_description'],
                      additionalProperties: false
                  }
              },
              messages: [{ role: 'user', content: prompt }]
          });

          let parsed = { company: '', role: '', structured_description: jobDescription };
          try {
              let cleanedText = response.trim();
              if (cleanedText.startsWith('```json')) cleanedText = cleanedText.replace(/^```json/g, '').replace(/```$/g, '').trim();
              else if (cleanedText.startsWith('```')) cleanedText = cleanedText.replace(/^```/g, '').replace(/```$/g, '').trim();
              parsed = JSON.parse(cleanedText);
          } catch(e) {
              console.error("Failed to parse extracted context:", response);
          }
          return parsed;
      } catch (err) {
          console.error("Extraction error:", err);
          return { company: '', role: '', structured_description: jobDescription };
      }
  });

  mainWindow.on('closed', () => {
    if (healthCheckTimer) {
        clearInterval(healthCheckTimer);
        healthCheckTimer = null;
    }
    stopAudioLevelTest();
    stopLiveAudioLevels();
    stopAudioCaptures();
    mainWindow = null;
  });
}

app.whenReady().then(() => {
    configureElectronStorage();
    createWindow();
    
    // Auto Updater logic
    autoUpdater.logger = log;
    autoUpdater.logger.transports.file.level = 'info';
    autoUpdater.checkForUpdatesAndNotify();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopAudioLevelTest();
    stopLiveAudioLevels();
    stopAudioCaptures();
    app.quit();
  }
});

// Expose a simple IPC channel for initial setup if needed later
ipcMain.handle('get-system-info', async (event) => {
    return { os: process.platform, arch: process.arch };
});
