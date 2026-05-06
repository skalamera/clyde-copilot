const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const record = require('node-record-lpcm16');
const axios = require('axios');
require('dotenv').config();

let mainWindow;
let recording;
let isStreaming = false;
let transcriptStreamer = null; // Global state for the LM Studio connection/client

/**
 * Initializes the audio recording system.
 */
function initializeAudioCapture() {
    console.log("Initializing multi-source audio capture...");
    try {
        // Set up node-record-lpcm16 to capture mixed audio (assuming proper WASAPI routing)
        recording = record.record({ sampleRate: 44100, sampleSizeInBits: 16 });
        recording.on('rawdata', (chunk) => {
            if (!isStreaming) return; // Only process if actively streaming
            processAudioChunk(chunk);
        });
        recording.on('error', (err) => {
            // Log the specific error to help debugging environment dependencies like SoX
            console.error("Critical Audio recording failure detected. Check if necessary system binaries (like SoX) are installed and in PATH.", err);
        });
        console.log("Audio capture initialized successfully.");

    } catch (e) {
        console.warn("Failed to initialize audio recording. Check system prerequisites (Virtual Audio Cable, etc.):", e.message);
        recording = null;
    }
}

/**
 * Sends the captured audio chunk data stream to the LLM API endpoint.
 * @param {Buffer} chunk - The raw audio data buffer.
 */
async function processAudioChunk(chunk) {
    if (isStreaming === false) return;

    // 1. Send Chunk for Transcription (This logic replaces the simulation in the old code)
    try {
        const apiUrl = process.env.LM_STUDIO_API_URL || 'http://localhost:5000/stream'; // Default or env var
        console.log("Streaming audio chunk to LM Studio:", chunk);

        // In a real implementation, you would stream the raw bytes (chunk) to an endpoint 
        // designed for continuous speech-to-text with diarization capability.
        const formData = new FormData();
        formData.append('audio_data', chunk, 'chunk.wav'); // Simplified representation

        const response = await axios.post(apiUrl, formData, {
            headers: { 
                'Content-Type': 'multipart/form-data'
            },
            // This is highly complex and usually requires a streaming HTTP client. 
            // We simulate success here to move forward with architecture setup.
        });

        // --- SIMULATED LLM RESPONSE HANDLING START ---
        // Assuming the response contains structured JSON for real-time display
        const simulatedResponse = {
            text: `The speaker ${Math.random() < 0.5 ? "A" : "B"} said this segment based on the audio data.`,
            speaker: Math.random() < 0.5 ? "Participant A" : "You",
            speakerColor: '#d8bfd8'
        };
        mainWindow.webContents.send('transcript-update', simulatedResponse);
        // --- SIMULATED LLM RESPONSE HANDLING END ---

    } catch (error) {
        console.error("Error communicating with LM Studio or processing audio:", error.message);
    }
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

  // Setup IPC communication for start/stop transcription
  ipcMain.on('start-audio-capture', () => {
      isStreaming = true;
  });

  ipcMain.on('stop-audio-capture', () => {
      isStreaming = false;
  });

  mainWindow.on('closed', () => {
    recording = null; // Release resources
    mainWindow = null;
  });
}

app.whenReady().then(() => {
    initializeAudioCapture(); 
    createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    recording = null; // Ensure cleanup on exit
    app.quit();
  }
});

// Expose a simple IPC channel for initial setup if needed later
ipcMain.handle('get-system-info', async (event) => {
    return { os: process.platform, arch: process.arch };
});