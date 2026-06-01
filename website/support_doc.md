# Clyde Product & Support Documentation (RAG Source)

This document is the authoritative truth used by the Clyde Support Chatbot to answer user questions on clydeai.live.

## General Information
* **What is Clyde?** Clyde is an undetectable, offline-first real-time AI desktop assistant/co-pilot for remote job interviews, sales pitches, and meetings.
* **Pricing & Tiers:**
  * **Free Tier:** Includes cloud-transcription (Gemini 3.5 Flash), basic real-time transcript help, and local session preparation.
  * **Pro Tier ($29.99/mo or $240/yr):** Includes active RAG document indexing (Pinecone), advanced active Google Sync (Gmail & Google Calendar scheduling), OpenAI Realtime API access, local LLM integrations (like LM Studio with custom models), and complete trend performance analytics.
* **Download Compatibility:** Windows 10 & 11 (native execution). macOS support is currently in closed developer beta.
* **Website URL:** https://clydeai.live
* **Contact Support:** contact@clyde.ai or fill out the support form in the chatbot.

## Unique Features & Capabilities
* **Is Clyde detectable on screenshares (Zoom, Teams, Meet)?** No. Clyde is built using custom Electron wrapper window-level exclusion APIs (like `WS_EX_TOOLWINDOW` and OS display exclusion rules). It never shows up on screen sharing feeds, recordings, or video screenshot apps.
* **How fast is Clyde?** Clyde has a programmatic local transcription gate. Suggestions and advice cards load in under 500 milliseconds (0.5s), compared to web-based AI tools which often take 5-10 seconds.
* **What is local LLM/Model integration?** Pro users can run entirely offline models (such as Qwen 2.5 or 3.6 via LM Studio on port 1234) for 100% data privacy. No company info or transcripts leave your machine.
* **How does RAG work?** You can upload past interview notes, resumes, or product directories as .txt, .pdf, or .md files. Clyde indexes them into Pinecone and semantic-searches them dynamically to cite exact facts during live calls.
* **What is Google Workspace Sync?** It scans your Google Calendar and Gmail to identify upcoming meetings and automatically builds pre-call preparation material based on who you're meeting and their company.

## Setup & Troubleshooting
* **How do I connect LM Studio?**
  1. Open LM Studio on your computer.
  2. Search for and load your model (e.g. `qwen/qwen3.6-27b`).
  3. Start the Local Server inside LM Studio (it defaults to port 1234).
  4. In Clyde's **Settings → Context**, point to the local server base: `http://127.0.0.1:1234/v1`.
* **How do I capture audio?** Clyde uses a high-performance native Rust sidecar engine for virtual loopback audio routing, meaning it can capture both your voice and system audio from Zoom/Teams natively without requiring complicated audio cable software.
