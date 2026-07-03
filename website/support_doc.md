# Clyde Product & Support Documentation (RAG Source)

This document is the authoritative truth used by the Clyde Support Chatbot to answer user questions on clydeai.live.

## General Information
* **What is Clyde?** Clyde is an undetectable, offline-first real-time AI desktop assistant/co-pilot for remote job interviews, sales pitches, and meetings.
* **Pricing & Tiers:**
  * **Free Tier ($0):** Includes live capture, local transcription, basic real-time transcript help, meeting notes and action items, and local session preparation.
  * **Pro Tier ($29.99/month, or $24.99/month billed annually — about $299.88/year, a 16% saving):** Includes active RAG document indexing (Pinecone), advanced active Google Sync (Gmail & Google Calendar scheduling), OpenAI Realtime API access, local LLM integrations (like LM Studio with custom models), mock interviews with avatar scorecards, and complete trend performance analytics.
* **Download Compatibility:** Windows 10 & 11 (native execution). macOS support is currently in closed developer beta.
* **Website URL:** https://clydeai.live
* **Contact Support:** contact@clyde.ai or fill out the support form in the chatbot.

## Unique Features & Capabilities
* **Is Clyde detectable on screenshares (Zoom, Teams, Meet)?** No. Clyde is built using custom Electron wrapper window-level exclusion APIs (like `WS_EX_TOOLWINDOW` and OS display exclusion rules). It never shows up on screen sharing feeds, recordings, or video screenshot apps.
* **How fast is Clyde?** Clyde has a programmatic local transcription gate. Suggestions and advice cards load in under 500 milliseconds (0.5s), compared to web-based AI tools which often take 5-10 seconds.
* **What is local LLM/Model integration?** Pro users can run entirely offline models (any model served by LM Studio on port 1234, e.g. Qwen) for 100% data privacy. No company info or transcripts leave your machine.
* **Which cloud models does Clyde Managed Cloud use?** Google Gemini (gemini-2.5-flash by default, gemini-2.5-pro available) and OpenAI GPT (gpt-4o, gpt-4o-mini). Invalid or custom model names automatically fall back to gemini-2.5-flash or gpt-4o-mini.
* **How does RAG work?** You can upload past interview notes, resumes, or product directories as .txt, .pdf, or .md files. Clyde indexes them into Pinecone and semantic-searches them dynamically to cite exact facts during live calls. RAG and embedding vectorization (`gemini-embedding-2`) are fully managed and processed automatically via Clyde Cloud, requiring zero manual configuration or user-managed credentials.
* **What is Google Workspace Sync?** It scans your Google Calendar and Gmail to identify upcoming meetings and automatically builds pre-call preparation material based on who you're meeting and their company.

## Setup & Troubleshooting
* **How do I connect LM Studio?**
  1. Open LM Studio on your computer.
  2. Search for and load your model of choice.
  3. Start the Local Server inside LM Studio (it defaults to port 1234).
  4. In Clyde's **Settings → Context**, point to the local server base: `http://127.0.0.1:1234/v1`.
* **How do I capture audio?** Clyde uses a high-performance native Rust sidecar engine for virtual loopback audio routing, meaning it can capture both your voice and system audio from Zoom/Teams natively without requiring complicated audio cable software.
