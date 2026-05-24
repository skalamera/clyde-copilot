# Clyde User Guide

Everything you need to run Clyde with confidence: provider setup, fully local/private AI, live capture, Clyde Assistant, Clyde Pro Agent, opportunity tracking, meeting notes, RAG, mock interviews, trends, privacy, and troubleshooting.

## Table Of Contents

- [Quick Start](#quick-start)
- [Requirements And Readiness](#requirements-and-readiness)
- [Cloud Provider Setup](#cloud-provider-setup)
- [Fully Local / Private Setup](#fully-local--private-setup)
- [Interview Mode Vs Meeting Mode](#interview-mode-vs-meeting-mode)
- [Running Live Calls](#running-live-calls)
- [Clyde Assistant Vs Clyde Pro Agent](#clyde-assistant-vs-clyde-pro-agent)
- [Opportunity Tracker](#opportunity-tracker)
- [Meeting Notes And Action Items](#meeting-notes-and-action-items)
- [Calendar, Gmail, And Google Sync](#calendar-gmail-and-google-sync)
- [Knowledge, RAG, And Active Context](#knowledge-rag-and-active-context)
- [Realtime Mock Interviews](#realtime-mock-interviews)
- [Trends, Scorecards, And Confidence](#trends-scorecards-and-confidence)
- [Privacy, Undetectable Mode, And Capture Protection](#privacy-undetectable-mode-and-capture-protection)
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

Choose the model Clyde uses for chat, answer cards, notes, and reasoning. Add API key, model name, and endpoint when required.

### Realtime Transcription

Choose a transcription provider for live turns. This can be different from the assistant model.

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

Use for recruiter screens, technical rounds, hiring manager calls, final loops, and follow-ups. Clyde tracks role, phase, JD, transcript ratings, confidence, outcomes, trends, and mock interviews.

### Meeting Mode

Use for product reviews, retros, customer calls, investor updates, 1:1s, planning, and recurring meetings. Clyde focuses on notes, decisions, highlights, blockers, and action items.

## Running Live Calls

### Preflight

Start opens a preflight check so you can verify context, providers, and capture settings before going live.

### Live Transcript

Clyde captures microphone/system audio, separates turns, and creates a near realtime transcript.

### Ask Clyde

Request answer suggestions, recap, risks, follow-up questions, or custom help while the call is active.

### Screenshot Analysis

Use screenshots for prompts, slides, dashboards, coding questions, or shared screens that Clyde should interpret.

### Stop And Save

When the call ends, Clyde can save transcripts, generate notes, extract action items, and grade interviews.

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

View upcoming interviews, meetings, follow-ups, and reminders associated with opportunities or meetings.

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

Pin high-priority files so Clyde brings them into active context quickly.

### Semantic RAG

Pro users can index knowledge into Pinecone so Clyde can retrieve and cite relevant sources.

## Realtime Mock Interviews

### Start Practice

Open Mock Interview with an active opportunity selected. The avatar asks role-specific questions and follows up on your answers.

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

Clyde can use content protection and overlay behavior to keep active UI out of standard captures where supported.

### Source Control

Choose which files, transcripts, memories, screenshots, and integrations Clyde can read.

### Pause Anytime

Pause or stop capture whenever content should not be processed.

## Troubleshooting

### No Transcript

Check microphone permission, selected devices, recorder settings, transcription endpoint, and whether capture is paused.

### AI Answers Fail

Validate services, confirm API keys/model names, verify local servers, and check whether the model supports the requested modality.

### Google Sync Misses Items

Confirm Google is connected, run **Scan now**, inspect proposals, and check whether messages include enough company or meeting context.

### RAG Has No Results

Upload/index knowledge, verify Pinecone settings, choose the right source mode, and confirm files are scoped to the correct entity.
