const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('path');
const axios = require('axios');
const pdf = require('pdf-parse');
const { createAudioCapture } = require('./src/audioCapture');
const { createMeetingAssistant } = require('./src/meetingAssistant');
const { calculatePcmRms, createTranscriptionProcessor } = require('./src/transcriptionClient');
require('dotenv').config();

configureElectronStorage();

let mainWindow;
let audioCaptures;
let transcriptionProcessors;
let meetingAssistant;
let audioLevelCaptures;
let audioLevelTimer;
let healthCheckTimer;
const healthState = {
    audio: { state: 'unknown', label: 'Audio', detail: 'Not checked yet.' },
    whisper: { state: 'unknown', label: 'Whisper', detail: 'Not checked yet.' },
    lmStudio: { state: 'unknown', label: 'LM Studio', detail: 'Not checked yet.' },
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

async function checkServiceHealth() {
    await Promise.all([
        checkWhisperHealth(),
        checkLmStudioHealth()
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

async function checkWhisperHealth() {
    const transcriptionUrl = process.env.LM_STUDIO_API_URL || '';

    if (!transcriptionUrl) {
        updateHealth('whisper', { state: 'error', detail: 'LM_STUDIO_API_URL is not set.' });
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
            detail: `Cannot reach Whisper at ${transcriptionUrl}: ${formatServiceError(error)}`
        });
    }
}

async function checkLmStudioHealth() {
    const chatUrl = process.env.LM_STUDIO_CHAT_URL || '';
    const model = process.env.LM_STUDIO_CHAT_MODEL || '';

    if (!chatUrl || !model) {
        updateHealth('lmStudio', {
            state: 'warning',
            detail: 'LM Studio assistant is not configured.'
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
            detail: `Cannot reach LM Studio at ${chatUrl}: ${formatServiceError(error)}`
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

    meetingAssistant = createMeetingAssistant({
        apiUrl: process.env.LM_STUDIO_CHAT_URL || 'http://localhost:1234/v1/chat/completions',
        model: process.env.LM_STUDIO_CHAT_MODEL || '',
        intervalMs: Number(process.env.LM_STUDIO_ASSISTANT_INTERVAL_MS || 30000),
        maxTurns: Number(process.env.LM_STUDIO_ASSISTANT_MAX_TURNS || 6),
        maxTokens: Number(process.env.LM_STUDIO_ASSISTANT_MAX_TOKENS || 800),
        timeout: Number(process.env.LM_STUDIO_ASSISTANT_TIMEOUT_MS || 60000),
        axiosClient: axios,
        logger: console,
        sendStatus: sendAudioStatus,
        sendUpdate: sendAssistantUpdate
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

    const processor = createTranscriptionProcessor({
        apiUrl: process.env.LM_STUDIO_API_URL || '',
        model: process.env.TRANSCRIPTION_MODEL,
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

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.webContents.on('did-finish-load', () => {
      sendAudioStatus({ state: 'idle', message: 'Ready. Press Start to begin.' });
      checkServiceHealth();
      healthCheckTimer = setInterval(checkServiceHealth, Number(process.env.CLYDE_HEALTH_INTERVAL_MS || 10000));
  });

  // Setup IPC communication for start/stop transcription
  ipcMain.on('start-audio-capture', (event, context) => {
      getMeetingAssistant().setContext(context || {});
      const results = initializeAudioCaptures().map((capture) => capture.start());
      const failed = results.find((result) => !result.ok);

      if (failed) {
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
          sendAudioStatus({ state: 'idle', message: 'Audio capture stopped.' });
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

  ipcMain.handle('save-context', (event, context) => {
      const contextPath = path.join(app.getPath('userData'), 'context.json');
      fs.writeFileSync(contextPath, JSON.stringify(context, null, 2));
      return true;
  });

  ipcMain.handle('load-context', (event) => {
      const contextPath = path.join(app.getPath('userData'), 'context.json');
      if (fs.existsSync(contextPath)) {
          return JSON.parse(fs.readFileSync(contextPath, 'utf8'));
      }
      return { jobDescription: '' };
  });

  mainWindow.on('closed', () => {
    if (healthCheckTimer) {
        clearInterval(healthCheckTimer);
        healthCheckTimer = null;
    }
    stopAudioLevelTest();
    stopAudioCaptures();
    mainWindow = null;
  });
}

app.whenReady().then(() => {
    createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopAudioLevelTest();
    stopAudioCaptures();
    app.quit();
  }
});

// Expose a simple IPC channel for initial setup if needed later
ipcMain.handle('get-system-info', async (event) => {
    return { os: process.platform, arch: process.arch };
});
