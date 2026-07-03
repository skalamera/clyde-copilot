# Clyde User Guide

Everything you need to run Clyde with confidence: provider setup, fully local/private AI, live capture, nudge, question bank, pre-call prep, Clyde Assistant, Clyde Pro Agent, opportunity tracking, meeting notes, RAG, mock interviews, trends, privacy, and troubleshooting.

## Table Of Contents

- [Quick Start](#quick-start)
- [Requirements And Readiness](#requirements-and-readiness)
- [Cloud Provider Setup](#cloud-provider-setup)
- [Fully Local / Private Setup](#fully-local--private-setup)
- [Interview Mode Vs Meeting Mode](#interview-mode-vs-meeting-mode)
- [Running Live Calls](#running-live-calls)
- [Nudge: What Should I Say Next](#nudge-what-should-i-say-next)
- [Capture Window Controls](#capture-window-controls)
- [Pre-Call Prep](#pre-call-prep)
- [Question Bank](#question-bank)
- [Clyde Assistant Vs Clyde Pro Agent](#clyde-assistant-vs-clyde-pro-agent)
- [Opportunity Tracker](#opportunity-tracker)
- [Meeting Notes And Action Items](#meeting-notes-and-action-items)
- [Calendar, Gmail, And Google Sync](#calendar-gmail-and-google-sync)
- [Knowledge, RAG, And Active Context](#knowledge-rag-and-active-context)
- [Realtime Mock Interviews](#realtime-mock-interviews)
- [Trends, Scorecards, And Confidence](#trends-scorecards-and-confidence)
- [Privacy, Undetectable Mode, And Capture Protection](#privacy-undetectable-mode-and-capture-protection)
- [Settings Reference](#settings-reference)
- [Onboarding And In-App User Guide](#onboarding-and-in-app-user-guide)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Troubleshooting](#troubleshooting)

## Quick Start

**Best first run:** choose Interview or Meeting mode, select an active context, configure providers in Settings, validate services, then click **Start**.

1. **Choose mode**
   Interview mode tracks opportunities, job descriptions, phases, outcomes, confidence, scorecards, trends, and mock interviews. Meeting mode focuses on notes, attendees, decisions, and action items.

2. **Select active context**
   Pick the active interview or meeting in the title bar. Clyde saves transcripts, notes, scorecards, and agent actions to that context.

3. **Configure AI**
   Open Settings and choose cloud providers, local providers, or a mix. Clyde can use one provider for transcription and another for chat, screenshots, RAG, or grading.

4. **Start capture**
   Click **Start**. Clyde checks context, captures microphone/system audio, builds a live transcript, and makes realtime help available.

## Requirements And Readiness

### Audio Access

Clyde needs microphone permission. System audio uses the configured capture engine and selected devices.

### AI Services

Configure at least one assistant provider and one transcription path. Use cloud APIs, local servers, or both.

### Active Context

Set the current opportunity or meeting before recording so Clyde files notes and actions correctly.

### Google Integrations

Gmail and Calendar features require connecting Google. Clyde creates proposals unless autonomous mode is enabled.

## Cloud Provider Setup

Open **Settings**. Provider credentials are handled by the Electron main process. Use **Validate services** after changes.

### LLM Provider

Choose the model Clyde uses for chat, answer cards, notes, and reasoning. Supported providers include OpenAI, Anthropic, Google Gemini, and local LM Studio. Add API key, model name, and endpoint when required.

### Realtime Transcription

Choose a transcription provider for live turns. Options include Local Whisper, OpenAI Whisper, and OpenAI Realtime Whisper. This can be different from the assistant model.

### Vision / Screenshots

Use a model that supports images if you want Clyde to analyze screenshots during calls.

### Embeddings / RAG

Pro users can configure embeddings and Pinecone for semantic search across files, sessions, notes, and mock interviews.

**Mix and match:** use frontier realtime transcription, a separate assistant model, and local/private models for sensitive work.

## Fully Local / Private Setup

For a private path, configure local transcription and a local chat model so audio, transcript text, prompts, and notes do not need to leave your device.

1. **Run a local LLM**
   Start LM Studio or another OpenAI-compatible local server. Load the model and copy the local endpoint.

2. **Connect Clyde**
   In Settings, select the local/OpenAI-compatible provider, paste the endpoint, and enter the exact model name.

3. **Add local transcription**
   Configure a local Whisper-compatible endpoint or supported local transcription provider.

4. **Validate**
   Click **Validate services**. If it fails, confirm the local server is running, the model is loaded, and endpoint paths are correct.

## Interview Mode Vs Meeting Mode

### Interview Mode

Use for recruiter screens, technical rounds, hiring manager calls, final loops, and follow-ups. Clyde tracks role, phase, JD, transcript ratings, confidence, outcomes, trends, and mock interviews. Interview mode also enables the Question Bank and Trend Analysis pages.

### Meeting Mode

Use for product reviews, retros, customer calls, investor updates, 1:1s, planning, and recurring meetings. Clyde focuses on notes, decisions, highlights, blockers, and action items.

## Running Live Calls

### Preflight

Start opens a preflight check modal so you can verify context, providers, capture protection status, and capture settings before going live. The preflight shows the active entity, linked question bank pairs, and whether screen capture protection is enabled.

### Live Transcript

Clyde captures microphone/system audio, separates turns by speaker, and creates a near realtime transcript. Transcript bubbles show as a chat interface with your turns on the right and the other party's turns on the left.

### Ask Clyde

Type a custom prompt in the input pill at the bottom of the capture window. Request answer suggestions, recap, risks, follow-up questions, or any custom help while the call is active.

### Screenshot Analysis

Click the **camera button** (1-click screenshot) in the input pill to capture and analyze your desktop. Clyde interprets prompts, slides, dashboards, coding questions, or shared screens. You can also toggle the **Include Screenshot** switch to attach a screenshot with any custom prompt.

### Suggested Questions

Click the **questions button** in the capture bottom bar to ask Clyde for tailored follow-up questions based on the full transcript, job description, and active opportunity context.

### Stop And Save

When the call ends, Clyde can save transcripts, generate notes, extract action items, and grade interviews.

### Download Session History

Click the **download button** in the capture bottom bar to export the full conversation history (your prompts and Clyde's answer cards) as a markdown file.

## Nudge: What Should I Say Next

The Nudge feature gives you instant suggestions for what to say next during a live call.

### Nudge Button

During an active capture session, click the **nudge button** (wave icon) in the input pill next to the screenshot button. Clyde reviews the most recent question or request from the current transcript and provides an answer or suggestion in a distinctly colored card (purple/indigo) so nudge suggestions are easy to differentiate from auto-generated answer cards.

### Nudge Hotkey (Global Keyboard Shortcut)

A programmable global keyboard shortcut triggers the nudge from anywhere on your desktop during live calls. The default is **Ctrl+Shift+N**.

- The shortcut is registered system-wide when audio capture starts and unregistered when capture stops.
- Configure the hotkey in **Settings → General → Nudge hotkey**. Click inside the recording box and press the desired key combination. Press **Clear** to remove it.
- The shortcut works even when Clyde is not the focused window, making it ideal for triggering nudge while you are in your meeting application.

## Capture Window Controls

The active capture window provides a complete set of controls:

### Top Control Bar

- **Minimize** — Click the ghost coin icon to minimize Clyde to a small draggable chip. Click or drag the chip to restore.
- **Stop** — End the capture session and return to the workspace.
- **Pause / Resume** — Pause audio capture temporarily. The pause icon switches to a play icon while paused.
- **Reset** — Clear the current session transcript and answer cards.

### Bottom Bar

- **Capture Protection Toggle** — Enable or disable screen capture protection on the fly. The ghost icon glows when protection is active.
- **Opacity Slider** — Adjust window background transparency from 35% to 100%. Click the opacity icon to open the slider popover.
- **Download** — Export the full chat history as a markdown file.
- **Microphone Indicator** — A glowing mic icon that pulses when audio is detected. Click to mute/unmute (pause/resume capture).
- **Suggested Questions** — Generate tailored follow-up questions for the interviewer.

### Input Pill

- **Screenshot (Camera)** — 1-click screenshot analysis.
- **Nudge** — Trigger the "what should I say next" suggestion.
- **Text Input** — Type any custom prompt.
- **Send** — Submit the custom prompt.
- **Include Screenshot Toggle** — Attach a screenshot with your next custom prompt.

### Window Dragging

Drag the control bar or the minimized chip to reposition the capture window anywhere on screen.

### Source Selection Menu

Access the source selection menu to control which context sources Clyde uses when answering during capture. Options include resume/background, memory, RAG, and web, plus a toggle for including screenshots.

## Pre-Call Prep

The **Pre-Call Prep** page (labeled "Pre-Call Prep" in the sidebar under the "Now" eyebrow) provides a structured preparation workflow before calls.

### Material Pre-Call Prep

When Clyde has enough context (sessions, JD, and opportunity data), it generates a comprehensive prep card that includes:

- **Cumulative phase summary** — What the opportunity has covered so far.
- **Probable focus** — What to expect in the upcoming round.
- **Strengths aligned to the role** — Key talking points and patterns from prior interviewer questions.
- **Questions to ask** — Suggested questions for the interviewer, informed by the JD and prior sessions.

### Quick Launch

From Pre-Call Prep you can quickly start a capture session, configure your setup, or jump into the active context.

## Question Bank

The **Question Bank** page (interview mode only) is a dedicated workspace for managing Q&A pairs that Clyde uses as context during live calls.

### Add Questions

Add individual questions and model answers manually. Provide the interviewer question and your ideal response.

### Import CSV

Bulk import question-answer pairs from a CSV file.

### Link to Opportunities

Questions can be scoped to specific opportunities so Clyde only uses relevant Q&A during that interview.

### Global Question Bank

Toggle the **Include Global** checkbox to include unscoped global Q&A pairs alongside opportunity-specific ones during capture. This setting is also available in **Settings → Context**.

### Review and Edit

Browse, edit, and delete existing Q&A pairs. The dashboard shows the total count and linked pairs.

## Clyde Assistant Vs Clyde Pro Agent

Clyde has two levels of chat and agent behavior. Free users get **Clyde Assistant** for focused active-context help. Pro users unlock the full **Clyde Pro Agent** with deeper memory, RAG, Google sync, autonomous updates, and advanced interview intelligence.

**Simple distinction:** Free = Clyde Assistant. Pro = Clyde Pro Agent.

### Free: Clyde Assistant

Free users get:

- Floating chat
- Active-context questions
- Local knowledge/basic context
- Ask about current opportunities or meetings
- Request simple in-app actions if supported
- Private/local operation options

Use Clyde Assistant when you want focused help around the current interview, meeting, transcript, or locally available context.

### Pro: Clyde Pro Agent

Pro users get:

- Full Clyde Pro Agent
- RAG across uploaded knowledge and saved sessions
- Broader cross-opportunity / cross-meeting memory
- Google Gmail + Calendar scanning
- Sync proposals and autonomous updates
- Mock interview scorecards / deeper assessment workflows
- Outcome-calibrated trend analysis and confidence improvements
- More advanced source selection and agentic follow-through

Use Clyde Pro Agent when you want Clyde to reason across long-term memory, retrieve from saved knowledge, detect external opportunity signals, suggest or complete actions, and improve feedback over time.

### Shared Chat Surface

Both tiers use the floating chat. What changes is how much context Clyde can retrieve, how much it can reason across, and which actions it can prepare or complete.

### What Pro Agent Can Observe

Clyde Pro Agent can observe active opportunity or meeting, live transcript, saved sessions, job descriptions, resumes, uploaded knowledge, pinned files, RAG matches, upcoming calendar events, Gmail/Calendar sync signals, and prior interview outcomes.

### What Pro Agent Can Reason About

Clyde Pro Agent can reason about which prior meeting matters for the current person or company, what interview phase you are in, what answer style has performed well before, which action should happen next, and whether an email/calendar signal changes opportunity status.

### What Pro Agent Can Do

Clyde Pro Agent can draft live answer cards, search memory, cite sources, create or update calendar events, mark opportunities advanced/rejected/offered, create meetings, import prep emails, summarize trends, and suggest follow-up tasks.

### How Confirmation Works

When an action needs approval, Clyde creates an action card with the proposed change and asks you to confirm. If details are missing, Clyde asks for them before submitting.

### When To Use Active Context

Use Active context during live calls or prep when you want Clyde focused on the current opportunity or meeting. This is available as the safest, most focused chat mode.

### When To Use All Sources Or RAG

Use broader source selection or RAG in Pro when researching patterns across interviews, asking about old meetings, reviewing career trends, or searching for something you cannot remember.

### Good Free Prompts

- What should I prepare for this active interview?
- Summarize the current meeting context.
- What notes do I have for this opportunity?
- Add a simple reminder if supported.

### Good Pro Prompts

- What should I review before my Orion final loop?
- Add my Google interview tomorrow at 3pm to the calendar.
- What action items did Design own last Product Weekly?
- Compare my Nova and Orion technical rounds.

## Opportunity Tracker

### Create Opportunities

Add company, role, phase, job description, and optional transcript. This becomes active interview context.

### Save Interviews

Recorded or manual transcripts become sessions with ratings, notes, grading, and examples.

### Set Outcomes

Mark opportunities active, advanced, rejected, or offered. Outcomes calibrate future confidence scoring.

### Use As Context

The active opportunity powers live suggestions, mock interviews, prep, and floating chat answers.

## Meeting Notes And Action Items

### Create Meeting Contexts

Create recurring contexts like Product Weekly, Investor Update, Customer Call, or Team Retro.

### Generate Notes

After capture stops, Clyde cleans the transcript, writes notes, highlights decisions, identifies blockers, and groups action items by attendee.

### Search Later

Ask Clyde across previous notes and transcripts instead of hunting through old documents.

### Follow Through

Request reminders, next-step summaries, or calendar updates from the floating chat.

## Calendar, Gmail, And Google Sync

### Calendar Workspace

View upcoming interviews, meetings, follow-ups, and reminders associated with opportunities or meetings. The sidebar shows your next upcoming event with countdown timing.

### Gmail Scans

Clyde scans for status updates, interview invites, offers, rejections, and next-round signals.

### Sync Proposals

Approve or dismiss suggested actions such as Add final loop, Import prep email, Mark rejected, or Add follow-up.

### Autonomous Updates

When enabled, Clyde can keep opportunity statuses and calendar items current inside the app.

## Knowledge, RAG, And Active Context

### Upload Files

Add resumes, brag docs, company research, prep docs, project writeups, and meeting materials.

### Scope Files

Attach files to a specific opportunity or meeting when they should only apply there.

### Pin Context

Pin high-priority files (up to 3 per entity) so Clyde brings them into active context quickly.

### Semantic RAG

Pro users can index knowledge into Pinecone so Clyde can retrieve and cite relevant sources. Configure embedding provider (Gemini or OpenAI), embedding model, embedding API key, Pinecone API key, Pinecone host URL, and Pinecone namespace in **Settings → Context**.

## Realtime Mock Interviews

### Start Practice

Open Mock Interview with an active opportunity selected. The avatar asks role-specific questions and follows up on your answers. Requires Clyde Pro with a realtime voice agent model configured.

### Review Scorecards

Clyde saves the transcript and generates a 0-100 scorecard with categories, strengths, risks, action plan, and answer reviews.

### Improve Over Time

Saved mock interviews can become knowledge so Clyde remembers your practice history and improvement plan.

## Trends, Scorecards, And Confidence

### Transcript Ratings

Each interview can receive a star-style rating and written evaluation.

### 0-100 Scorecards

Clyde grades performance with categories, examples, strengths, and improvements.

### Confidence

Confidence uses saved session ratings and prior outcomes. The current opportunity is excluded from its own calibration set.

### Phase Analysis

See how performance changes across recruiter, technical, product, leadership, and final-loop phases.

## Privacy, Undetectable Mode, And Capture Protection

**Private when you choose it:** use local transcription and local chat when you want processing to stay on-device.

### No Meeting Bot

Clyde runs as a desktop app and does not join the meeting participant list.

### Capture Protection

Clyde uses content protection and overlay behavior to keep the active UI out of standard screen captures and recordings. Toggle capture protection on or off:

- **During capture:** Click the ghost icon in the bottom bar of the capture window.
- **Before capture:** The preflight modal shows the current capture protection status.
- **In settings:** The `captureProtectionEnabled` setting defaults to on.

### UI Opacity

Adjust the capture window transparency using the opacity slider in the bottom bar. Lower opacity makes the window more transparent, allowing you to see through it while keeping Clyde's cards visible. Range is 35% to 100%.

### Source Control

Choose which files, transcripts, memories, screenshots, and integrations Clyde can read.

### Pause Anytime

Pause or stop capture whenever content should not be processed. The microphone indicator in the bottom bar also serves as a quick mute/unmute toggle.

## Settings Reference

Access Settings from the gear icon in the workspace. Settings are organized into six tabs:

### Account

Manage account and billing information. View your subscription status (Free or Pro), authentication email, and subscription plan. Upgrade to Clyde Pro or refresh entitlements from this tab.

### General

- **Floating Clyde chatbot** — Show or hide the floating chat window.
- **Nudge hotkey** — Record a global keyboard shortcut for the nudge feature. Click inside the box and press a key combination (e.g., Ctrl+Shift+N). The shortcut is registered globally during live calls.
- **Validate services** — Run a health check against audio, transcription, assistant provider, and capture status using the current saved settings.

### Context

- **Resume / background** (interview mode) or **Long term memory** (meeting mode) — Paste resume facts, metrics, and projects, or persistent context for meetings. Import from .txt, .md, or .pdf files.
- **RAG with Pinecone** (Pro) — Enable semantic search. Configure embedding provider, model, API key, and Pinecone connection details.

### Sync

- **Google sync** (Pro) — Enable periodic Gmail and Calendar scanning. Configure auto-approval of sync actions and poll interval.
- **Connect / Disconnect Google** — Manage the Google account connection.
- **Scan now** — Trigger an immediate sync scan.
- **Audit log** — Review all sync events with timestamps and statuses.

### LLM

- **Standard AI provider** — Choose the model for answer cards, prep, summaries, grading, trend analysis, and sync reasoning. Supported providers: Local LM Studio, OpenAI, Anthropic, Google Gemini.
- **Realtime voice agent** (Pro) — Enable Clyde Pro agent with a realtime model. Configure the OpenAI realtime model and API key.
- **OpenAI Realtime Whisper** — Option to use the same realtime API key for lowest-latency transcription.

### Speech

- **Audio engine** — Choose between Rust native audio and legacy recorder.
- **Microphone** — Select the input device for your voice.
- **System audio** — Select the output device for capturing the other party's audio.
- **Refresh devices** — Re-scan available audio devices.
- **Transcription provider** — Choose Local Whisper, OpenAI Whisper, or OpenAI Realtime Whisper. Configure the transcription URL or API key.

## Onboarding And In-App User Guide

### Onboarding Guide

On first launch, Clyde displays an onboarding guide that walks through all core features. The guide covers quick start steps, provider setup, local AI, modes, live calls, agent behavior, opportunities, meetings, calendar, knowledge, mock interviews, trends, and privacy. Dismiss the guide when ready; it will not appear again.

### In-App User Guide

Access the full User Guide at any time from within the app. The in-app guide mirrors this document and provides quick navigation via a table of contents with anchored sections.

### Floating Clyde Chatbot

The floating chat window provides quick access to Clyde Assistant (Free) or Clyde Pro Agent (Pro) from any page. Show or hide the floating chatbot from **Settings → General**.

## Keyboard Shortcuts

| Shortcut | Action | Scope |
|---|---|---|
| Nudge hotkey (default: Ctrl+Shift+N) | Trigger nudge — "What should I say next?" | Global during live capture |

Configure the nudge hotkey in **Settings → General → Nudge hotkey**. The shortcut is registered when audio capture starts and unregistered when capture stops.

## Troubleshooting

### No Transcript

Check microphone permission, selected devices, recorder settings, transcription endpoint, and whether capture is paused.

### AI Answers Fail

Validate services, confirm API keys/model names, verify local servers, and check whether the model supports the requested modality.

### Google Sync Misses Items

Confirm Google is connected, run **Scan now**, inspect proposals, and check whether messages include enough company or meeting context.

### RAG Has No Results

Upload/index knowledge, verify Pinecone settings, choose the right source mode, and confirm files are scoped to the correct entity.

### Nudge Hotkey Not Working

Confirm a hotkey is set in **Settings → General**. The global shortcut only registers while audio capture is actively running. If the hotkey conflicts with another application, choose a different combination. Check the app logs for registration errors.

### Capture Window Not Visible

If the capture window disappears, it may be minimized to the ghost chip. Look for a small floating icon on screen and click it to restore. If it is off-screen, restart the capture session.

### Capture Protection Blocks Screenshots

When capture protection is enabled, Clyde's window will appear blank in screen recordings and screenshots. Toggle it off using the ghost icon in the capture bottom bar if you need to include Clyde in a recording.
