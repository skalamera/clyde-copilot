const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios');
const { createAudioCapture } = require('./src/audioCapture');
const { createTranscriptionProcessor } = require('./src/transcriptionClient');
require('dotenv').config();

let mainWindow;
let audioCapture;
let transcriptionProcessor;

/**
 * Creates the audio recording controller without starting SoX.
 */
function initializeAudioCapture() {
    if (audioCapture) {
        return audioCapture;
    }

    audioCapture = createAudioCapture({
        env: process.env,
        logger: console,
        processAudioChunk,
        onStatus: sendAudioStatus
    });

    return audioCapture;
}

function sendAudioStatus(status) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    mainWindow.webContents.send('audio-status', status);
}

function sendTranscriptUpdate(transcript) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    mainWindow.webContents.send('transcript-update', transcript);
}

function getTranscriptionProcessor() {
    if (transcriptionProcessor) {
        return transcriptionProcessor;
    }

    transcriptionProcessor = createTranscriptionProcessor({
        apiUrl: process.env.LM_STUDIO_API_URL || '',
        model: process.env.TRANSCRIPTION_MODEL,
        minRms: Number(process.env.CASPER_MIN_RMS || 100),
        diagnostics: process.env.CASPER_AUDIO_DEBUG === '1',
        axiosClient: axios,
        logger: console,
        sendStatus: sendAudioStatus,
        sendTranscript: sendTranscriptUpdate
    });

    return transcriptionProcessor;
}

async function processAudioChunk(chunk) {
    await getTranscriptionProcessor().processAudioChunk(chunk);
}

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.webContents.on('did-finish-load', () => {
      sendAudioStatus({ state: 'idle', message: 'Ready. Press Start to begin.' });
  });

  // Setup IPC communication for start/stop transcription
  ipcMain.on('start-audio-capture', () => {
      const result = initializeAudioCapture().start();

      if (!result.ok) {
          sendAudioStatus({ state: 'error', message: result.message });
      }
  });

  ipcMain.on('stop-audio-capture', () => {
      if (audioCapture) {
          audioCapture.stop();
      } else {
          sendAudioStatus({ state: 'idle', message: 'Audio capture stopped.' });
      }
  });

  mainWindow.on('closed', () => {
    if (audioCapture) {
        audioCapture.stop();
        audioCapture = null;
    }
    transcriptionProcessor = null;
    mainWindow = null;
  });
}

app.whenReady().then(() => {
    createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (audioCapture) {
        audioCapture.stop();
        audioCapture = null;
    }
    transcriptionProcessor = null;
    app.quit();
  }
});

// Expose a simple IPC channel for initial setup if needed later
ipcMain.handle('get-system-info', async (event) => {
    return { os: process.platform, arch: process.arch };
});
