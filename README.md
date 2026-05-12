# Clyde - Live Interview Copilot

Clyde is an Electron-based desktop application designed to act as your real-time copilot during online job interviews. Powered by local LLMs (via LM Studio) and RAG (via Pinecone and Gemini), it captures meeting audio, provides live transcriptions, generates real-time suggestions on what to say next, and automatically grades your interview performance after the call.

The internal AI assistant is affectionately named **Clyde**.

## ✨ Key Features

* **🎙️ Real-Time Transcription:** Captures system and microphone audio using SoX and transcribes it on the fly using a local Whisper model.
* **🧠 Live Assistant (Clyde):** Analyzes the rolling transcript to provide real-time, non-intrusive UI cards with suggestions, answers, and questions to ask the interviewer.
* **📚 RAG Resume Context:** Integrates with Google's Gemini and Pinecone. When the interviewer asks about your past projects or experience, Clyde detects the intent, searches your vectorized resume, and injects your exact metrics and achievements into his suggested answers.
* **📊 Post-Interview Grading:** Save your interview sessions to a local dashboard. The app uses an LLM to grade your performance (A-F), extract reasoning, and compute an overall confidence trend for each company you interview with.
* **🎛️ Provider Agnostic:** Natively switch between Local LLMs (LM Studio) and Cloud LLMs (OpenAI, Anthropic, Gemini) via the in-app Settings UI. No proxy or complex configuration required.
* **🎛️ Context Management:** Easily paste the specific Job Description into the app's context settings so Clyde tailors his live answers specifically to the role's requirements.

---

## 📋 Prerequisites

Before you can run Clyde, you must install and configure the following external dependencies:

1. **Node.js** (v18+ recommended)
2. **SoX (Sound eXchange):**
   * **Windows:** Download and install [SoX](https://sourceforge.net/projects/sox/). **Crucial:** You must add the SoX installation folder (e.g., `C:\Program Files (x86)\sox-14-4-2`) to your system's `PATH` environment variable.
3. **LM Studio (or compatible local API):**
   * Download [LM Studio](https://lmstudio.ai/).
   * Start the Local Server in LM Studio (usually runs on `http://localhost:1234`).
   * Load an instruction-following model (e.g., Llama-3, Mistral) for the Chat completions.
   * Make sure you have a local Whisper endpoint running for transcription (or use the provided `npm run whisper` script if you have the standalone server configured).

## 🚀 Installation

1. Clone the repository and navigate into the directory:
   ```bash
   git clone <repository-url>
   cd casper
   ```

2. Install Node.js dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory (copy from a sample if available) and configure your environment:

   ```env
   # Endpoints
   LM_STUDIO_API_URL=http://localhost:8000/v1/audio/transcriptions
   LM_STUDIO_CHAT_URL=http://localhost:1234/v1/chat/completions
   LM_STUDIO_CHAT_MODEL=local-model-name
   TRANSCRIPTION_MODEL=Systran/faster-distil-whisper-large-v3
   
   # Assistant Settings
   LM_STUDIO_ASSISTANT_MAX_TOKENS=800
   
   # Pinecone & Gemini (For RAG / Resume Context)
   GEMINI_API_KEY=your_gemini_api_key_here
   PINECONE_API_KEY=your_pinecone_api_key_here
   PINECONE_HOST=your_pinecone_index_host_url_here

   # Audio Device Settings (Optional: specify explicit audio sources)
   # CLYDE_AUDIO_DEVICE=default
   ```

## 🎮 Usage

### Starting the Application
```bash
npm start
```

### Navigating the UI
1. **Context Settings:** Click "Context" in the top title bar to paste the Job Description before your interview begins.
2. **Audio Setup:** Click "Test Inputs" to verify your microphone and system audio are being captured (you'll see the RMS meters move).
3. **Start Transcription:** Click the **Start Transcription** button to begin capturing audio. The Live Transcript panel will populate as people speak.
4. **Live Help:** Clyde will automatically generate suggestion cards when questions are detected. If you get stuck, click **What to say next?** to force a suggestion.
5. **End & Save:** When the interview is over, click **End & Save**. Enter the company name and interview phase, then hit **Save & Grade**. 
6. **Dashboard:** Click "Dashboard" in the top title bar to view the leaderboard of your interviews, review your AI grades, and read historical transcripts.
7. **Reset Session:** Made a mistake or doing a dry run? Click **Reset Session** to wipe the current transcript buffer without restarting the app.

## 🛠️ Architecture & Core Files

* `main.js`: Electron main process. Manages window creation, IPC communication, and audio capture orchestration.
* `src/index.html`: The main UI overlay. Built with raw HTML/CSS/JS for maximum performance and a custom transparent glassmorphism aesthetic.
* `src/audioCapture.js`: Spawns and manages the `sox` child process to capture raw PCM audio streams.
* `src/transcriptionClient.js`: Buffers PCM audio chunks, calculates RMS to filter silence/hallucinations, packs them into WAV formats, and sends them to the local Whisper API.
* `src/meetingAssistant.js`: Maintains the rolling transcript buffer. Periodically sends the transcript to LM Studio, parses the structured JSON responses, and detects intent for RAG injections.
* `src/pineconeClient.js`: Uses Google Gemini embeddings to query Pinecone for relevant resume context when specific behavioral or experiential questions are detected.
* `src/interviewManager.js`: Handles local saving of interviews, background grading calls to the LLM, and calculating confidence scores.

## 🧪 Testing

Run the test suite using Node's native test runner:
```bash
npm test
```

## ⚠️ Troubleshooting

* **"SoX was not found" Error:** Ensure SoX is installed and the directory containing `sox.exe` is in your system's `PATH`. Restart your terminal/IDE after updating the path.
* **No Transcript Appearing:** Verify that your local Whisper server is running and `LM_STUDIO_API_URL` is pointing to the correct address. Use the "Test Inputs" button to ensure audio is actually reaching the app.
* **App Appears "Frozen" when saving:** The save modal might be hidden or improperly positioned if the window is resized. Ensure you are using the latest version with the fixed CSS z-index and opacity transitions.

## 📄 License

ISC License. See `package.json` for details.
