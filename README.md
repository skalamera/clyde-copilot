# Clyde 👻

Clyde is a privacy-first, real-time AI assistant for meetings and interviews. Built with Electron and React, Clyde sits alongside your video calls to provide live transcription, contextual suggestions, and post-call analytics. It is designed to work seamlessly with local AI models (via LM Studio and Whisper) to keep your sensitive conversation data entirely on your machine, with options to connect to Cloud APIs if preferred.

---

## 🌟 Core Features

### 🎙️ Real-Time Audio Capture & Transcription
*   **Multi-channel Capture**: Records both your microphone ("You") and system audio ("Others") via a robust, custom Rust-based audio engine (`clyde-audio-engine`), alongside legacy fallback support via `native-audio-node`.
*   **Live Transcription**: Streams audio chunks to a local Whisper server or OpenAI's Cloud API to generate a continuous transcript.
*   **Visual Audio Meters**: Integrated directly into the sidebar to provide live audio levels (RMS) and speaking indicators for local and remote participants without obscuring your view.

### 🤖 Live AI Assistant (Active Capture)
*   **Pro Realtime Agent**: Connects to OpenAI's real-time WebSockets API (e.g., `gpt-realtime-2`) for ultra-low latency, agentic interactions (searching memory, retrieving pinned documents) directly mid-meeting.
*   **Interactive Agent Chat**: A dedicated chat agent that can list calendar events, ingest files, interact with your vector database, update opportunity/meeting statuses, delete sessions, and perform CRUD actions on your meeting/interview data seamlessly through conversation.
*   **Action Review Forms**: When Clyde needs more details to finish an action, it now renders a fillable form with the right field types instead of returning a plain error.
*   **Sidebar & Top Control Bar**: A streamlined top control bar and sidebar layout that sits nicely alongside your video calls, featuring adjustable UI opacity settings.
*   **Calendar Integration**: View, save, import, and delete calendar events, and quickly launch active capture for upcoming meetings via the integrated start button or agent actions.
*   **Agentic Gmail/Google Calendar Sync**: Clyde can scan connected Gmail and Google Calendar accounts, generate proposed actions inside the app, let you review or auto-approve them, and keep a local audit log in Settings.
*   **Contextual Nudges**: Click the "Nudge" button to get immediate AI suggestions on what to say next based on the live transcript.
*   **Screenshot Awareness**: Capture your current screen context alongside your prompt to get help with code, presentations, or technical questions.
*   **Custom Prompts**: Query the AI manually at any time during the meeting.
*   **Capture Protection**: Privacy toggle that prevents Clyde's overlay from showing up in your own screen shares.

### 💼 Interview & Meeting Modes
*   **Interview Mode**: Track opportunities by Company and Role. Paste in Job Descriptions to give Clyde deep context for tailoring interview answers.
*   **Meeting Mode**: Optimized for internal team syncs, generating recaps, action items, and follow-ups.

### 📈 Pre-Call Prep & Post-Call Analytics
*   **Automated Grading**: Clyde automatically grades your interview performance (0-5 stars) evaluating clarity, technical accuracy, and conciseness.
*   **Trend Analysis**: Plots your transcript ratings over time using interactive charts (`Recharts`). Computes confidence scores (0-100%) and overall momentum (Up, Down, Sideways), utilizing session signature generation to accurately map topics across multiple sessions.
*   **Outcome-Labeled Opportunity Learning**: Clyde uses explicitly labeled past interview outcomes (e.g., advanced, offer, rejected) to automatically calibrate its advice, leaning on successful past answers to guide you better in future rounds.
*   **Pre-Call Prep**: Analyzes past interviews for the same company to generate cumulative summaries, probable focus areas, interviewer question patterns, and questions you should ask.

### 🧠 Long-Term Memory & RAG
*   **Vector Database Integration**: Connects to Pinecone (via Gemini embeddings) to index and retrieve context from your Resume, past meetings, and long-term memory.
*   **Pinned Knowledge**: Explicitly pin core documents (like your resume or core company specs) so they are persistently loaded into context for the Pro Realtime Agent or standard chat.
*   **Opportunity and Meeting Files**: Attach pinned files directly to a specific opportunity or meeting from the Timeline or Meeting Memory view. Those files stay local and can also feed context when that record is active.
*   **Source Toggling**: Selectively include/exclude your Resume, Memory, RAG, or Web Search for specific queries mid-call.

---

## 🏗️ Architecture

Clyde follows a standard Electron multi-process architecture, heavily relying on IPC (Inter-Process Communication) to bridge the secure backend and the reactive frontend.

```mermaid
+-----------------------------------------------------------------------+
|                           Electron Main Process                       |
|                                                                       |
|  +----------------+   +-----------------+   +----------------------+  |
|  | Audio Capture  |   | LLM Orchestration|  | Transcription Client |  |
|  | (native-audio) |   | (axios, prompts)|   | (Whisper / OpenAI)   |  |
|  +-------+--------+   +--------+--------+   +----------+-----------+  |
|          |                     |                       |              |
+----------|---------------------|-----------------------|--------------+
           |                     |                       |
           v                     v                       v
      Audio Chunks         Cards / Advice          Text Streams
           |                     |                       |
+----------|---------------------|-----------------------|--------------+
|          |            Electron Renderer Process        |              |
|                                                                       |
|  +----------------+   +-----------------+   +----------------------+  |
|  | Active Sidebar |   |  Timeline View  |   | Trend & Prep Panels  |  |
|  | (Control Bar)  |   | (Transcript UI) |   | (Recharts, Stats)    |  |
|  +----------------+   +-----------------+   +----------------------+  |
|                                                                       |
|                       React + Vite + CSS Modules                      |
+-----------------------------------------------------------------------+
```

### Main Process (`main.js` & `src/`)
*   **`audioEngineSidecar.js` & `audioCapture.js`**: Hooks into OS-level audio devices using either the custom Rust engine or legacy `native-audio-node`.
*   **`agentChat.js` & `agentActionRegistry.js`**: Powers the conversational agent that has tools to modify Clyde's local database and calendar.
*   **`googleClient.js`, `googleSyncService.js`, and `syncStore.js`**: Handle local Google OAuth, Gmail/Calendar scanning, proposed action storage, and the audit log for approved or dismissed sync actions.
*   **`autoUpdater.js`**: Built-in automatic updates for the application via `electron-updater`.
*   **`llmClient.js` & `meetingAssistant.js`**: Constructs dynamic prompts utilizing the transcript digest, job descriptions, and user inputs. Calls LM Studio (Local LLM) or Cloud APIs.
*   **`transcriptionClient.js`**: Handles audio chunk buffering, RMS calculation (to drop silent chunks), and requests to the Whisper API.
*   **`sessionManager.js`, `interviewManager.js`, and `knowledgeManager.js`**: Handle local SQLite/JSON persistence of sessions, entities, transcripts, and pinned/entity-scoped files using `electron-store`.
*   **`trendAnalysis.js`**: Background worker logic that triggers LLM calls to compute grades and insights after a session ends.

### Renderer Process (`src/renderer/`)
*   **`App.jsx`**: The core React application containing the routing logic between the Timeline, Calendar, Trends, and the Live Capture views.
*   **`App.css`**: Custom styling, heavily utilizing CSS grid, flexbox, and backdrop-filters to create a modern, dark-mode, glassmorphic UI.
*   **IPC via `preload.js`**: Exposes a safe `window.electronAPI` bridge to allow React to trigger captures, save settings, manage Google sync, attach entity files, and receive real-time text/audio level updates.

---

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18+ recommended)
*   Python & FFmpeg (for local Whisper)
*   [LM Studio](https://lmstudio.ai/) (for local LLM capabilities)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd clyde
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Configure Local AI (Optional but recommended):**
   * Start **LM Studio** and load a model (e.g., Llama-3 or Mistral). Start the Local Inference Server on port `1234`.
   * Configure Clyde's settings via the UI to point to `http://localhost:1234/v1/chat/completions`.

4. **Start the Whisper Server:**
   ```bash
   # Starts the local Python FastAPI Whisper server
   npm run whisper
   
   # Or, if you don't have a CUDA GPU:
   npm run whisper:cpu
   ```

5. **Run the App (Development):**
   ```bash
   npm start
   ```

---

## 🛠️ Scripts & Tooling

*   `npm start`: Builds the Vite renderer and starts the Electron app.
*   `npm run renderer:build`: Compiles the React frontend into `src/renderer-dist`.
*   `npm run renderer:dev`: Starts the Vite dev server for frontend-only development.
*   `npm test`: Runs the Node.js native test runner against the test suite (`test/`).
*   `npm run audio:check`: Diagnostic script to list available OS audio sources.
*   `npm run pack` / `npm run dist`: Packages the application into an executable using `electron-builder`.

---

## 🧪 Testing

Clyde uses Node's native test runner (`node:test` and `node:assert`). Tests cover both the Main process IPC logic and Renderer Smoke tests (verifying UI components, classes, and logic).

```bash
npm test
```

For renderer UI changes, run the focused smoke test plus the production renderer build:

```bash
npm test -- test/rendererSmoke.test.js
npm run renderer:build
```

If the Codex Browser retry against the Vite renderer server returns `ERR_BLOCKED_BY_CLIENT`, stop the Vite server after the retry and use those 2 commands as the reliable verification path.

---

## 🔒 Privacy & Security

Clyde is architected to keep your data local by default:
*   **No Cloud Lock-in**: Audio and transcripts are processed entirely on your machine if using the Local Whisper and LM Studio integrations.
*   **Capture Protection**: The active overlay uses `mainWindow.setAlwaysOnTop(true, 'screen-saver')` and `mainWindow.setContentProtection(true)` to hide the HUD from standard screen sharing applications.
*   **Local Storage**: All transcripts, meeting notes, and job descriptions are stored locally in your OS's `userData` folder.

---

*Clyde - Your invisible edge in every meeting.*
