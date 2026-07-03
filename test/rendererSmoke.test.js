const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.join(__dirname, '..');

test('React renderer defines the required live controls and mode surfaces', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');

  for (const required of [
    'data-testid="mode-interview"',
    'data-testid="mode-meeting"',
    'data-testid="startBtn"',
    'data-testid="stopBtn"',
    'data-testid="saveBtn"',
    'data-testid="healthGrid"',
    'data-testid="liveVoiceMeters"',
    'data-testid="aiReplyBtn"',
    'data-testid="sessionTimeline"',
    'data-testid="homePromptInput"',
    'data-testid="floatingClydeAgent"',
    'data-testid="agentSourceSelector"',
    'Home',
    "testId: 'timelineNav'",
    'aria-label="Settings"',
    'confidence-pill',
    'Edit opportunity details',
    'Edit interview',
    'deleteSessionEntity',
    'Active Meeting:',
    '+ Add New Meeting',
    'onChangeActiveMeeting',
    'AI reply',
    "userTier: 'free'",
    'proAgentEnabled: false',
    'pinnedKnowledgeIds: []',
    'googleSyncEnabled: false',
    'Sync',
    'SyncReviewPanel',
    'EntityFilesPanel',
    'openEntityFileDialog',
    'requiredFields',
    'UpgradeToProButton',
    'startCheckout',
    'Refresh subscription'
    ,'Account and billing'
    ,'Create account'
    ,'Manage billing'
  ]) {
    assert.match(appSource, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.doesNotMatch(appSource, /Google OAuth client ID/);
  assert.doesNotMatch(appSource, /googleOAuthClientId/);
  assert.match(appSource, /connectGoogleSync\?\.\(\)/);
});

test('settings drawer passes sync audit state into setup fields', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const drawerStart = appSource.indexOf('function SettingsDrawer');
  const fieldsStart = appSource.indexOf('function SetupFields', drawerStart);
  const drawerSource = appSource.slice(drawerStart, fieldsStart);

  assert.match(drawerSource, /syncAudit,\s*setSyncAudit/);
  assert.match(drawerSource, /syncAudit=\{syncAudit\}/);
  assert.match(drawerSource, /setSyncAudit=\{setSyncAudit\}/);
  assert.doesNotMatch(drawerSource, /syncAudit=\{syncAudit\}(?!\s*setSyncAudit)/);
});

test('first-run onboarding starts with Free vs Pro and has no hidden-app CTAs', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');

  assert.match(appSource, /ONBOARDING_GUIDE_DISMISSED_KEY = 'clyde-onboarding-guide-dismissed'/);
  assert.match(appSource, /function OnboardingWizard/);
  assert.match(appSource, /function PlanStep/);
  assert.match(appSource, /Create Account & Continue/);
  assert.match(appSource, /Subscribe & Continue to Checkout/);
  assert.match(appSource, /startProSignupCheckout/);
  assert.match(appSource, /If you choose a paid plan, we will create the account and direct you immediately to Stripe checkout/);
  assert.match(appSource, /Sign In & Restore Setup/);
  assert.match(appSource, /Restart registration/);
  assert.match(appSource, /Stripe checkout opened\. After payment completes, return here and sign in/i);
  assert.match(appSource, /Do not show this again/);
  assert.match(appSource, /localStorage\.setItem\(ONBOARDING_GUIDE_DISMISSED_KEY, 'true'\)/);
  assert.match(cssSource, /\.onboarding-wizard/);
  assert.match(cssSource, /\.onboarding-steps/);
  assert.doesNotMatch(appSource, /function GettingStartedGuide/);
  assert.doesNotMatch(appSource, /Open home/);
  assert.doesNotMatch(appSource, /Open Context settings/);
  assert.doesNotMatch(appSource, /Open LLM settings/);
  assert.doesNotMatch(appSource, /Open calendar/);
  assert.doesNotMatch(appSource, /Open checkout again/);
  assert.doesNotMatch(appSource, /Continue with Free for now/);
});

test('onboarding gates Pro setup and keeps Free setup local', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const wizardStart = appSource.indexOf('function OnboardingWizard');
  const settingsStart = appSource.indexOf('function SettingsDrawer', wizardStart);
  const wizardSource = appSource.slice(wizardStart, settingsStart);

  assert.match(wizardSource, /llmProvider: settings\.llmProvider \|\| \(\s*isPro \? 'clyde-cloud' : 'local'\s*\)/);
  assert.match(wizardSource, /transcriptionProvider: settings\.transcriptionProvider \|\| \(\s*isPro \? 'clyde-cloud-whisper' : 'local'\s*\)/);
  assert.match(wizardSource, /Local LM Studio/);
  assert.match(wizardSource, /OpenAI/);
  assert.match(wizardSource, /Google Gemini/);
  assert.match(wizardSource, /Local Whisper/);
  assert.match(wizardSource, /OpenAI Whisper/);
  assert.match(wizardSource, /Validate services/);
  assert.match(wizardSource, /\.\.\.\(proEntitled \? \[\{ id: 'pro', label: 'Pro setup' \}\] : \[\]\)/);
  assert.match(wizardSource, /Connect Google/);
  assert.match(wizardSource, /Enable RAG with Pinecone/);
  assert.match(wizardSource, /Clyde Cloud/);
  assert.match(wizardSource, /Enable Clyde Pro agent/);
  assert.match(wizardSource, /OpenAI Realtime Whisper/);
});

test('Google sync settings are gated behind Pro entitlements', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const syncStart = appSource.lastIndexOf("{activeTab === 'sync'");
  const syncEnd = appSource.indexOf('<div style={{ marginTop:', syncStart);
  const syncSource = appSource.slice(syncStart, syncEnd);

  assert.match(syncSource, /Google sync requires Clyde Pro/);
  assert.match(syncSource, /disabled=\{!proEntitled\}/);
  assert.match(syncSource, /checked=\{proEntitled && Boolean\(draft\.googleSyncEnabled\)\}/);
  assert.match(syncSource, /disabled=\{!proEntitled \|\| !googleStatus\?\.connected\}/);
});

test('sync review panel renders all pending proposals inside a scrollable list', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');
  const panelStart = appSource.indexOf('function SyncReviewPanel');
  const panelEnd = appSource.indexOf('function HomeView', panelStart);
  const panelSource = appSource.slice(panelStart, panelEnd);

  assert.match(panelSource, /proposals\.map\(\(proposal\)/);
  assert.doesNotMatch(panelSource, /proposals\.slice\(0,\s*6\)/);
  assert.match(panelSource, /Gmail/);
  assert.match(panelSource, /Google Calendar/);
  assert.match(panelSource, /Approve all/);
  assert.match(panelSource, /Dismiss all/);
  assert.match(cssSource, /\.sync-review-panel\s*\{[\s\S]*overflow: hidden/);
  assert.match(cssSource, /\.sync-proposal-list\s*\{[\s\S]*overflow-y: auto/);
});

test('home view keeps Google sync proposals in sidebar notifications', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const homeStart = appSource.indexOf('function HomeView');
  const sourceModeStart = appSource.indexOf('function sourceModeLabel', homeStart);
  const homeSource = appSource.slice(homeStart, sourceModeStart);
  const navStart = appSource.indexOf('function WorkspaceNav');
  const navEnd = appSource.indexOf('function SidebarToggleIcon', navStart);
  const navSource = appSource.slice(navStart, navEnd);

  assert.equal(homeSource.includes('SyncReviewPanel'), false);
  assert.match(navSource, /notificationCount = syncProposals\.length \+ unreadAutoApproved\.length/);
  assert.match(navSource, /Gmail/);
  assert.match(navSource, /Google Calendar/);
  assert.match(navSource, /Approve All/);
  assert.match(navSource, /Dismiss All/);
  assert.match(navSource, /workspace-sync-summary/);
  assert.match(navSource, /Last Sync/);
});

test('interview session phase controls use numbered phases and optional titles', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const postStart = appSource.indexOf('function PostSessionSaveModal');
  const jdStart = appSource.indexOf('function JobDescriptionModal', postStart);
  const postSource = appSource.slice(postStart, jdStart);
  const manualStart = appSource.indexOf('function ManualTranscriptModal');
  const entityStart = appSource.indexOf('function EditEntityModal', manualStart);
  const manualSource = appSource.slice(manualStart, entityStart);

  assert.match(appSource, /INTERVIEW_PHASE_OPTIONS = Array\.from\(\{ length: 10 \}/);
  assert.match(appSource, /function getNextInterviewPhase/);
  assert.match(postSource, /sessionTitle/);
  assert.match(postSource, /getNextInterviewPhase/);
  assert.match(appSource, /const title = customTitle \? `\$\{phase\} - \$\{customTitle\}` : phase/);
  assert.match(appSource, /setCompanyJobDescription\?\.\(entity\.id, jobDescription\)/);
  assert.equal(postSource.includes('Recruiter Screen'), false);
  assert.equal(postSource.includes('Live Session'), false);
  assert.equal(manualSource.includes('Recruiter Screen'), false);
  assert.equal(manualSource.includes('Live Session'), false);
});

test('renderer refreshes saved entitlements on startup for signed-in users', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');

  assert.match(appSource, /currentSettings\.userId && api\?\.refreshEntitlements/);
  assert.match(appSource, /Startup entitlement refresh failed/);
  assert.match(appSource, /currentSettings = await api\.loadSettings\(\)\.catch/);
});

test('home chat uses compact sticky composer and tier image heading', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');
  const homeStart = appSource.indexOf('function HomeView');
  const floatingStart = appSource.indexOf('function FloatingClydeAgent');
  const agentSource = appSource.slice(homeStart, floatingStart);

  assert.match(agentSource, /home-chat-logo/);
  assert.match(appSource, /brand-mark-pro/);
  assert.match(agentSource, /home-view-conversation/);
  assert.match(agentSource, /home-view-landing/);
  assert.match(agentSource, /agent-chat-empty-state/);
  assert.match(agentSource, /agent-input-badge/);
  assert.match(agentSource, /agent-send-button/);
  assert.match(agentSource, /agent-reset-button/);
  assert.match(agentSource, /messagesEndRef/);
  assert.match(cssSource, /\.home-chat-shell-landing\s*\{[\s\S]*grid-template-rows: auto auto/);
  assert.match(cssSource, /\.home-chat-shell-conversation\s*\{[\s\S]*grid-template-rows: minmax\(0, 1fr\) auto/);
  assert.match(cssSource, /\.agent-chat-home\.agent-chat-empty-state \.agent-chat-messages\s*\{[\s\S]*display: none/);
  assert.match(cssSource, /\.agent-chat-home \.agent-input-row\s*\{[\s\S]*border-radius: 999px/);
  assert.match(cssSource, /\.agent-input-row\s*\{[\s\S]*grid-template-columns: 40px minmax\(0, 1fr\) 40px 40px 40px/);
  assert.match(cssSource, /\.agent-input-badge\s*\{/);
  assert.match(cssSource, /\.agent-message-list\s*\{/);
  assert.match(cssSource, /\.agent-source-menu-wrap-home \.agent-source-popover[\s\S]*bottom: calc\(100% \+ 12px\)/);
  assert.match(cssSource, /\.agent-input-row input\s*\{[\s\S]*min-height: 34px/);
});

test('floating chat preserves state and opens inward near window edges', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');
  const floatingStart = appSource.indexOf('function FloatingClydeAgent');
  const navStart = appSource.indexOf('function WorkspaceNav', floatingStart);
  const floatingSource = appSource.slice(floatingStart, navStart);

  assert.match(appSource, /AGENT_CHAT_CONTEXT_LIMIT = 50/);
  assert.match(floatingSource, /chatState/);
  assert.match(floatingSource, /setChatState/);
  assert.match(floatingSource, /floating-clyde-panel panel-/);
  assert.match(floatingSource, /getFloatingPanelPlacement/);
  assert.match(appSource, /proSearchBadgeUrl = new URL.*clyde_pro_coin_dirty_black_gold\.svg/);
  assert.match(appSource, /freeSearchBadgeUrl/);
  assert.match(floatingSource, /settings\.userTier === 'pro' \? proSearchBadgeUrl : freeSearchBadgeUrl/);
  assert.match(cssSource, /\.floating-clyde-panel\.panel-left/);
  assert.match(cssSource, /\.floating-clyde-panel\.panel-up/);
});

test('title bar is fixed and assist status shows RAG provider and resume indicators', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');
  const statusStart = appSource.indexOf('function StatusStrip');
  const setupStart = appSource.indexOf('function SetupPanel', statusStart);
  const statusSource = appSource.slice(statusStart, setupStart);

  assert.match(cssSource, /\.title-bar\s*\{[\s\S]*position: fixed/);
  assert.match(cssSource, /\.workspace\s*\{[\s\S]*padding-top: calc\(var\(--titlebar-height\)/);
  assert.doesNotMatch(statusSource, /Chat LLM/);
  assert.doesNotMatch(statusSource, /<strong>Transcription/);
  assert.doesNotMatch(statusSource, /status-pills/);
  assert.match(statusSource, /Embeddings/);
  assert.match(statusSource, /RAG/);
  assert.match(statusSource, /Resume/);
});

test('live panel no longer renders canned note controls', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');

  assert.equal(appSource.includes('data-testid="commandInput"'), false);
  assert.equal(appSource.includes('className="command-input"'), false);
  assert.equal(appSource.includes("{ id: 'recap', label: 'Recap' }"), false);
  assert.equal(appSource.includes("{ id: 'follow_up', label: 'Follow-up questions' }"), false);
  assert.equal(appSource.includes("{ id: 'resume', label: 'Answer from resume' }"), false);
  assert.equal(appSource.includes("{ id: 'summary', label: 'Summarize last 2 minutes' }"), false);
  assert.equal(appSource.includes("{ id: 'note', label: 'Save note' }"), false);
});

test('settings expose OpenAI realtime Whisper transcription provider', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');

  assert.match(appSource, /<option value="openai-realtime-whisper">OpenAI Realtime Whisper \(BYOK\)<\/option>/);
  assert.match(appSource, /<option value="">Select a transcription provider<\/option>/);
  assert.match(appSource, /draft\.transcriptionProvider === 'local' \?/);
  assert.match(appSource, /OpenAI API key/);
});

test('LLM providers are locked to managed Gemini 3.5, BYOK Gemini 3.5, or BYOK GPT-4o without model pickers', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const providerStepStart = appSource.indexOf('function ProviderStep');
  const proStepStart = appSource.indexOf('function ProStep', providerStepStart);
  const setupFieldsStart = appSource.indexOf('function SetupFields');
  const providerStepSource = appSource.slice(providerStepStart, proStepStart);
  const setupFieldsSource = appSource.slice(setupFieldsStart);

  assert.match(appSource, /gemini-3\.5-flash/);
  assert.match(providerStepSource, /update\('llmModel', 'gemini-3\.5-flash'\)/);
  assert.match(providerStepSource, /update\('llmModel', 'gpt-4o'\)/);
  assert.match(setupFieldsSource, /update\('llmModel', 'gemini-3\.5-flash'\)/);
  assert.match(setupFieldsSource, /update\('llmModel', 'gpt-4o'\)/);
  assert.doesNotMatch(providerStepSource, /Anthropic \(Custom Key\)/);
  assert.doesNotMatch(setupFieldsSource, /Anthropic \(Custom Key\)/);
  assert.doesNotMatch(providerStepSource, /Model<input/);
  assert.doesNotMatch(setupFieldsSource, /list="llmModelList"/);
  assert.doesNotMatch(setupFieldsSource, /function renderLlmModelOptions/);
});

test('first-run model and endpoint settings are blank', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const mainSource = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');

  assert.match(appSource, /llmProvider: ''/);
  assert.match(appSource, /openAiApiKey: ''/);
  assert.match(appSource, /localLlmUrl: ''/);
  assert.match(appSource, /transcriptionProvider: ''/);
  assert.match(appSource, /localTranscriptionUrl: ''/);
  assert.match(appSource, /proRealtimeModel: ''/);
  assert.match(appSource, /embeddingProvider: ''/);
  assert.match(appSource, /embeddingModel: ''/);
  assert.match(appSource, /pineconeNamespace: ''/);
  assert.doesNotMatch(mainSource, /store\.get\('llmProvider', 'local'\)/);
  assert.doesNotMatch(mainSource, /store\.get\('localLlmUrl', 'http/);
  assert.doesNotMatch(mainSource, /process\.env\.OPENAI_API_KEY = ['"][A-Za-z0-9]{5,}/);
});

test('settings expose Rust audio engine and device controls', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');

  assert.match(appSource, /audioEngine: 'rust'/);
  assert.match(appSource, /Microphone/);
  assert.match(appSource, /System audio/);
  assert.match(appSource, /Refresh devices/);
  assert.match(appSource, /api\?\.listAudioDevices\?\.\(\)/);
  assert.match(appSource, /api\?\.setAudioDevices\?\.\(\{/);
});

test('renderer transcript merge handles realtime partials by item id', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const mergeStart = appSource.indexOf('function mergeTranscriptTurn');
  const mergeEnd = appSource.indexOf('function normalizeCardForRender', mergeStart);
  const mergeSource = appSource.slice(mergeStart, mergeEnd);

  assert.match(mergeSource, /itemId: turn\.itemId \|\| ''/);
  assert.match(mergeSource, /partial: Boolean\(turn\.partial\)/);
  assert.match(mergeSource, /findIndex\(\(item\) => item\.itemId === normalized\.itemId\)/);
  assert.match(mergeSource, /normalized\.partial/);
});

test('active capture view replaces the full live workspace while streaming', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');
  const activeStart = appSource.indexOf('function ActiveCaptureView');
  const activeEnd = appSource.indexOf('function LivePanel', activeStart);
  const activeSource = appSource.slice(activeStart, activeEnd);

  assert.match(appSource, /const \[captureSessionActive, setCaptureSessionActive\] = useState\(false\)/);
  assert.match(appSource, /const activeCapture = workspaceView === 'live' && captureSessionActive/);
  assert.match(appSource, /activeCapture\s*(?:\|\|\s*!signedIn)?\s*\?\s*null\s*:\s*\(\s*<TitleBar/);
  assert.match(appSource, /activeCapture \? \(/);
  assert.match(activeSource, /Ask about the screen/);
  assert.match(appSource, /Waiting for assistant cards/);
  assert.equal(activeSource.includes('active-assistant-status'), false);
  assert.equal(activeSource.includes('`${cards.length} assistant card'), false);
  assert.match(appSource, /<ActiveCaptureView[\s\S]*status=\{status\}/);
  assert.match(activeSource, /ghost-toggle/);
  assert.match(activeSource, /active-capture-icon ghost-emoji-icon/);
  assert.match(activeSource, />👻<\/span>/);
  assert.match(activeSource, /active-capture-icon window-emoji-icon/);
  assert.match(activeSource, />🪟<\/span>/);
  assert.match(appSource, /memory: 'Memory'/);
  assert.match(cssSource, /\.assistant-card\.memory/);
  assert.match(cssSource, /\.assistant-card-agentic/);
  assert.match(activeSource, /Custom Prompt/);
  assert.match(activeSource, /active-source-button/);
  assert.match(activeSource, /Minimize Clyde/);
  assert.match(activeSource, /handleMinimizedPointerDown/);
  assert.match(activeSource, /handleControlBarPointerDown/);
  assert.match(activeSource, /handleControlBarClickCapture/);
  assert.match(activeSource, /active-control-stack/);
  assert.match(activeSource, /active-capture-drag-tab/);
  assert.ok(activeSource.indexOf('<ActiveGhostMeters liveLevels={liveLevels}') > activeSource.indexOf('active-control-stack'));
  assert.match(activeSource, /window\.addEventListener\('pointermove', moveWindow/);
  assert.equal(activeSource.includes('controlBarTarget.setPointerCapture'), false);
  assert.match(activeSource, /intent: 'say_next'/);
  assert.match(activeSource, /getActiveCaptureWindowBounds/);
  assert.match(activeSource, /moveActiveCaptureWindow/);
  assert.match(activeSource, /resizeActiveCaptureWindow\?\.\(\{ width: 112, height: 112, minimized: true \}\)/);
  assert.match(activeSource, /Pause Capture/);
  assert.match(activeSource, /Show Live Transcription/);
  assert.match(activeSource, /showMeters/);
  assert.match(activeSource, /setShowMeters/);
  assert.match(activeSource, /Show audio meters/);
  assert.match(activeSource, /Hide audio meters/);
  assert.match(activeSource, /ActiveTranscriptPanel/);
  assert.match(appSource, /Include screenshot/);
  assert.match(activeSource, /data-testid="stopBtn"/);
  assert.match(activeSource, /Type a custom prompt/);
  assert.match(activeSource, /includeScreenshot/);
  assert.match(activeSource, /intent: isCamera \? 'screen_question' : 'custom_prompt'/);
  assert.equal(activeSource.includes('Ask Clyde or wait for suggestions.'), false);
  assert.equal(activeSource.includes('Live help will appear here during the call.'), false);
  assert.match(activeSource, /panelRef = useRef\(null\)/);
  assert.match(activeSource, /ResizeObserver/);
  assert.match(activeSource, /resizeActiveCaptureWindow/);
  assert.match(activeSource, /contentWidth/);
  assert.match(appSource, /slice\(-18\)/);
  assert.match(activeSource, /AssistantCards cards=\{cards\} variant="active"/);
  assert.equal(activeSource.includes('<Transcript'), false);
  assert.equal(activeSource.includes('<StatusStrip'), false);
  assert.equal(activeSource.includes('<ContextPanel'), false);
  assert.equal(activeSource.includes('liveVoiceMeters'), false);
  assert.match(cssSource, /\.active-capture-shell/);
  assert.match(cssSource, /\.active-capture-bar/);
  assert.match(cssSource, /\.active-control-stack[\s\S]*margin: 36px auto 0/);
  assert.match(cssSource, /\.active-capture-drag-tab[\s\S]*top: -32px/);
  assert.match(cssSource, /\.active-capture-bar[\s\S]*cursor: grab/);
  assert.match(cssSource, /\.active-assistant-panel/);
  assert.match(cssSource, /\.active-source-menu[\s\S]*top: 34px/);
  assert.match(cssSource, /\.active-source-menu[\s\S]*z-index: 180/);
  assert.match(cssSource, /\.assistant-pane-active\s*\{[\s\S]*flex: 1 1 auto/);
  assert.match(cssSource, /\.assistant-pane-active\s*\{[\s\S]*overflow: hidden/);
  assert.match(cssSource, /\.assistant-pane-active \.scroll-area\s*\{[\s\S]*overflow-y: auto/);
  assert.match(activeSource, /querySelectorAll\('\[data-active-size-content\]'\)/);
  assert.match(activeSource, /--active-card-stack-max-height/);
  assert.match(activeSource, /const maxAllowedWindowHeight = workAreaHeight - 40/);
  assert.match(activeSource, /rect\.top - panelRect\.top \+ visibleStackHeight/);
  assert.match(activeSource, /const contentHeight = Math\.max\(panel\.scrollHeight, contentBounds\.bottom, scrollContentBottom\)/);
  assert.match(activeSource, /showMeters, showTranscript/);
  assert.match(cssSource, /\.assistant-pane-active \.scroll-area\s*\{[\s\S]*max-height: min\(58vh, var\(--active-card-stack-max-height, calc\(100vh - 260px\)\)\)/);
  assert.match(cssSource, /\.assistant-pane-active \.assistant-card\s*\{[\s\S]*min-height: 0/);
  assert.match(cssSource, /\.active-memory-window\s*\{[\s\S]*max-height: min\(220px, 28vh\)/);
  assert.match(cssSource, /\.active-restore-chip[\s\S]*border-radius: 50%/);
  assert.match(cssSource, /\.active-restore-chip[\s\S]*width: 84px/);
  assert.match(cssSource, /\.active-restore-chip[\s\S]*height: 84px/);
  assert.match(cssSource, /\.active-restore-chip[\s\S]*box-shadow: none/);
  assert.match(cssSource, /\.active-capture-shell-minimized[\s\S]*height: 112px/);
  assert.match(cssSource, /\.active-capture-shell-minimized[\s\S]*width: 112px/);
  assert.match(cssSource, /\.active-assistant-panel\s*\{[\s\S]*overflow-y: auto/);
  assert.match(cssSource, /\.active-transcript-panel\s*\{[\s\S]*max-height: min\(220px, 32vh\)/);
  assert.match(appSource, /\[\.\.\.transcript\.slice\(-18\)\]\.reverse\(\)/);
});

test('mock interview view renders with the active interview entity in scope', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');
  const serviceSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'realtimeInterviewService.js'), 'utf8');
  const componentSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'RealtimeInterview.jsx'), 'utf8');

  assert.match(appSource, /testId: 'mockInterviewNav'/);
  assert.match(appSource, /const activeInterview = mode === 'interview' \? activeEntity : null/);
  assert.match(appSource, /workspaceView === 'mock-interview' && canUseFeature\(settings, 'mock_interviews'\) \? \(\s*<RealtimeInterview api=\{api\} targetEntity=\{activeInterview\} settings=\{settings\} \/>/);
  assert.match(serviceSource, /@heygen\/liveavatar-web-sdk/);
  assert.match(componentSource, /response\.output_text\.delta/);
  assert.doesNotMatch(componentSource, /MockAvatarService/);
  assert.doesNotMatch(componentSource, /mock-avatar-stage/);
  assert.match(componentSource, /conversation\.item\.input_audio_transcription\.completed/);
  assert.match(componentSource, /generateMockInterviewAssessment/);
  assert.match(componentSource, /saveMockInterview/);
  assert.match(componentSource, /const transcriptSnapshot = transcriptRef\.current/);
  assert.match(componentSource, /statusText: 'Saving transcript\.\.\.'/);
  assert.match(componentSource, /idOverride: saved\.id/);
  assert.match(componentSource, /function hasAssessmentScorecard\(assessment\)/);
  assert.match(componentSource, /hasAssessmentScorecard\(item\.assessment\) \? `\$\{item\.assessment\.overallScore \|\| 0\}\/100` : 'Pending'/);
  assert.doesNotMatch(componentSource, /if \(!assessment \|\| !assessment\.overallScore\)/);
  assert.match(componentSource, /listMockInterviews/);
  assert.match(componentSource, /deleteMockInterview/);
  assert.match(componentSource, /deleteSavedMockInterview/);
  assert.match(componentSource, /mock-library/);
  assert.match(componentSource, /mock-delete-button/);
  assert.match(componentSource, /Delete transcript and scorecard/);
  assert.match(componentSource, /mock-mic-indicator/);
  assert.match(cssSource, /speaking-you/);
  assert.match(cssSource, /speaking-interviewer/);
  assert.match(cssSource, /\.mock-delete-button/);
});

test('active capture UI uses compact icon buttons and new ghost meters', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');
  const activeStart = appSource.indexOf('function ActiveCaptureView');
  const activeEnd = appSource.indexOf('function LivePanel', activeStart);
  const activeSource = appSource.slice(activeStart, activeEnd);

  // Assert sources/send are icon buttons (not text)
  assert.match(activeSource, /active-icon-btn active-source-button/);
  assert.match(activeSource, /camera-btn/);
  assert.match(activeSource, /transcript-toggle-btn/);
  assert.match(activeSource, /pause-btn/);
  assert.match(activeSource, /minimize-btn/);
  assert.match(activeSource, /aria-label="Send"/);
  assert.equal(activeSource.includes('>Sources</button>'), false);

  // Assert ghost meters
  assert.match(appSource, /function ActiveGhostMeters/);
  assert.match(appSource, /ghost-label">You/);
  assert.match(appSource, /ghost-label">Others/);

  // Pre-call prep padding
  assert.match(cssSource, /\.context-section {\s*display: grid;\s*gap: 12px;\s*padding: 18px;/);
  assert.match(cssSource, /\.context-section h3/);
  
  // Card dismiss
  assert.match(appSource, /onDismissCard=\{/);
  assert.match(appSource, /className="card-dismiss-btn"/);
  assert.match(cssSource, /\.active-icon-btn\.pause-btn/);
  assert.match(cssSource, /\.active-icon-btn\.ghost-toggle \.active-capture-icon[\s\S]*font-size: 23px/);
  assert.match(cssSource, /\.active-icon-btn\.opacity-toggle-btn \.window-emoji-icon[\s\S]*justify-content: center/);
  assert.match(cssSource, /\.active-transcript-panel/);
  assert.match(cssSource, /\.active-capture-bar\s*\{[\s\S]*width: max-content/);
  assert.match(cssSource, /\.active-capture-bar\s*\{[\s\S]*box-shadow: none/);
  assert.match(cssSource, /\.active-icon-btn\s*\{[\s\S]*padding: 3px/);
  assert.match(cssSource, /\.active-icon-btn\.meter-toggle-btn/);
});

test('active source menu filters by mode and confirms selections', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const sourceMenuStart = appSource.indexOf('function ActiveSourceMenu');
  const sourceMenuEnd = appSource.indexOf('function ActiveCaptureView', sourceMenuStart);
  const sourceMenuSource = appSource.slice(sourceMenuStart, sourceMenuEnd);
  const activeStart = appSource.indexOf('function ActiveCaptureView');
  const activeEnd = appSource.indexOf('function LivePanel', activeStart);
  const activeSource = appSource.slice(activeStart, activeEnd);

  assert.match(sourceMenuSource, /mode/);
  assert.match(sourceMenuSource, /mode === 'interview'/);
  assert.match(sourceMenuSource, /mode === 'meeting'/);
  assert.match(sourceMenuSource, /Resume \/ background/);
  assert.match(sourceMenuSource, /Longterm memory/);
  assert.match(sourceMenuSource, /Confirm sources/);
  assert.match(sourceMenuSource, /onConfirm/);
  assert.match(activeSource, /<ActiveSourceMenu[\s\S]*mode=\{mode\}/);
  assert.match(activeSource, /onConfirm=\{\(\) => setSourceMenuOpen\(false\)\}/);
  assert.match(activeSource, /getDefaultActiveSources\(settings, mode\)/);
  assert.match(activeSource, /normalizeActiveSourcesForMode\(current, settings, mode\)/);
});

test('preflight modal uses compact mockup layout', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const mainSource = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');
  const start = appSource.indexOf('function CallPreflightModal');
  const end = appSource.indexOf('function PreflightModel', start);
  const preflightSource = appSource.slice(start, end);

  assert.match(preflightSource, /preflight-summary-strip/);
  assert.match(preflightSource, /Pro Realtime:/);
  assert.match(preflightSource, /RAG \/ Memory:/);
  assert.match(preflightSource, /Question Bank:/);
  assert.match(preflightSource, /preflight-main-layout/);
  assert.match(preflightSource, /preflight-connection-card/);
  assert.match(preflightSource, /preflight-middle-stack/);
  assert.match(preflightSource, /preflight-rag-panel/);
  assert.match(preflightSource, /Resume\/Background:/);
  assert.match(preflightSource, /Job Description:/);
  assert.match(preflightSource, /Knowledge page pins:/);
  assert.match(preflightSource, /Active opportunity files:/);
  assert.match(preflightSource, /preflight-choose-files/);
  assert.match(preflightSource, /status-ready/);
  assert.match(preflightSource, /status-bad/);
  assert.match(preflightSource, /testAudioIconUrl/);
  assert.match(preflightSource, /preflight-rag-chip/);
  assert.doesNotMatch(preflightSource, /activeContext\.resume\?\.excerpt/);
  assert.match(preflightSource, /transcriptionSelected/);
  assert.match(preflightSource, /transcriptionState = transcriptionSelected \? \(transcriptionHealth\.state \|\| 'unknown'\) : 'not selected'/);
  assert.match(preflightSource, /assistantSelected/);
  assert.match(preflightSource, /assistantState = assistantSelected \? \(assistantHealth\.state \|\| 'unknown'\) : 'not selected'/);
  assert.match(preflightSource, /<strong>Provider:<\/strong> <span>\{models\.transcriptionProvider \|\| 'Not selected'\}<\/span>/);
  assert.match(preflightSource, /preflightReady/);
  assert.match(preflightSource, /preflightPillLabel = preflight \? \(preflightReady \? 'Ready to start\.' : 'Check Connections'\) : status/);
  assert.match(preflightSource, /captureProtectionLabel/);
  assert.match(preflightSource, /Screen capture protection enabled/);
  assert.match(preflightSource, /Screen capture protection disabled/);
  assert.match(mainSource, /captureProtectionEnabled: settings\.captureProtectionEnabled !== false/);
  assert.match(cssSource, /\.preflight-summary-strip/);
  assert.match(cssSource, /\.preflight-hero-status/);
  assert.match(cssSource, /\.preflight-ready-pill\.issue/);
  assert.match(cssSource, /\.capture-protection-status/);
  assert.match(cssSource, /\.preflight-main-layout/);
  assert.match(cssSource, /\.preflight-connection-card/);
  assert.match(cssSource, /\.preflight-middle-stack/);
  assert.match(cssSource, /\.preflight-rag-summary/);
  assert.match(cssSource, /\.status-ready/);
  assert.match(cssSource, /\.status-bad/);
  assert.match(cssSource, /\.preflight-test-button img/);
  assert.match(cssSource, /\.preflight-file-chip\.preflight-rag-chip/);
  assert.match(cssSource, /\.preflight-upload-card|\.preflight-upload-panel/);
  assert.match(preflightSource, /function refreshPreflight\(includeGlobalOverride\)/);
  assert.match(preflightSource, /requestPayload\.includeGlobalQuestionBank = Boolean\(includeGlobalOverride\)/);
  assert.match(preflightSource, /next\?\.settings\?\.includeGlobalQuestionBank/);
  assert.match(preflightSource, /refreshPreflight\(checked\)/);
  assert.match(mainSource, /includeGlobalQuestionBank: store\.get\('includeGlobalQuestionBank', false\)/);
});

test('workspace nav uses dedicated Question Bank icons', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const iconStart = appSource.indexOf('function WorkspaceNavIcon');
  const iconEnd = appSource.indexOf('function KnowledgeView', iconStart);
  const iconSource = appSource.slice(iconStart, iconEnd);

  assert.match(appSource, /iconQuestionBankUrl = new URL\('\.\.\/\.\.\/navbar-icons\/Question_Bank\.svg'/);
  assert.match(appSource, /iconQuestionBankColorUrl = new URL\('\.\.\/\.\.\/navbar-icons\/Question_Bank_color\.svg'/);
  assert.match(iconSource, /'question-bank': active \? iconQuestionBankColorUrl : iconQuestionBankUrl/);
  assert.doesNotMatch(iconSource, /'question-bank': active \? iconAssistColorUrl : iconAssistUrl/);
});

test('question bank table supports bulk selection and edits', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const preloadSource = fs.readFileSync(path.join(repoRoot, 'src', 'preload.js'), 'utf8');
  const mainSource = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');
  const viewStart = appSource.indexOf('function QuestionBankView');
  const viewEnd = appSource.indexOf('function WorkspaceNav', viewStart);
  const viewSource = appSource.slice(viewStart, viewEnd);

  assert.match(viewSource, /selectedIds/);
  assert.match(viewSource, /bulkDeleteSelected/);
  assert.match(viewSource, /bulkLinkSelected/);
  assert.match(viewSource, /bulkSourceSelected/);
  assert.match(viewSource, /Select all visible/);
  assert.match(viewSource, /Delete selected/);
  assert.match(viewSource, /Link selected/);
  assert.match(viewSource, /Set source/);
  assert.match(viewSource, /aria-label="Select all visible question bank entries"/);
  assert.match(viewSource, /viewRef = useRef\(null\)/);
  assert.match(viewSource, /editorRef = useRef\(null\)/);
  assert.match(viewSource, /scrollTo\?\.\(\{ top: 0, behavior: 'smooth' \}\)/);
  assert.match(viewSource, /querySelector\?\.\('textarea'\)\?\.focus\?\.\(\)/);
  assert.match(viewSource, /showQuestionBankDialog/);
  assert.match(viewSource, /Question save failed/);
  assert.match(viewSource, /Question delete failed/);
  assert.match(viewSource, /Bulk delete failed/);
  assert.match(viewSource, /Bulk link update failed/);
  assert.match(viewSource, /Bulk source update failed/);
  assert.match(viewSource, /aria-label="Question Bank action message"/);
  assert.match(viewSource, /settings-message-modal/);
  assert.match(viewSource, /api\?\.deleteQuestionBankEntries/);
  assert.match(viewSource, /api\?\.bulkUpdateQuestionBankEntries/);
  assert.match(preloadSource, /deleteQuestionBankEntries/);
  assert.match(preloadSource, /bulkUpdateQuestionBankEntries/);
  assert.match(mainSource, /delete-question-bank-entries/);
  assert.match(mainSource, /bulk-update-question-bank-entries/);
  assert.match(cssSource, /\.question-bank-bulk-actions/);
  assert.match(cssSource, /grid-template-columns: 40px 1\.2fr 1\.8fr 0\.8fr 0\.45fr 150px/);
});

test('trend analysis chart is titled performance over time', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');

  assert.match(appSource, /Performance Over Time/);
  assert.doesNotMatch(appSource, /Transcript Rating Over Time/);
});

test('trend analysis includes overview dashboard before opportunity selection', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');
  const trendsStart = appSource.indexOf('function TrendsView');
  const trendsEnd = appSource.indexOf('function TrendChart', trendsStart);
  const trendsSource = appSource.slice(trendsStart, trendsEnd);

  assert.match(trendsSource, /TrendOverviewDashboard/);
  assert.match(trendsSource, /Opportunity comparison/);
  assert.match(trendsSource, /Overview/);
  assert.match(trendsSource, /trend-overview-rail-button/);
  assert.doesNotMatch(trendsSource, /Back to overview/);
  assert.match(appSource, /function MultiOpportunityTrendChart/);
  assert.match(appSource, /function buildTrendOverviewRows/);
  assert.match(cssSource, /\.trends-overview-dashboard/);
  assert.match(cssSource, /\.trends-comparison-table/);
});

test('trend analysis loads overview sessions when opened from nav', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const chooseStart = appSource.indexOf('function chooseWorkspaceView');
  const chooseEnd = appSource.indexOf('async function setActiveMeeting', chooseStart);
  const chooseSource = appSource.slice(chooseStart, chooseEnd);

  assert.match(chooseSource, /nextView === 'trends'/);
  assert.match(chooseSource, /setSelectedEntity\(''\)/);
  assert.match(chooseSource, /api\.getSessions\(\{ mode \}\)/);
});

test('pro knowledge workspace exposes upload, search, and pinning controls', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');
  const navStart = appSource.indexOf('function WorkspaceNav');
  const navEnd = appSource.indexOf('function ModeToggle', navStart);
  const navSource = appSource.slice(navStart, navEnd);

  assert.match(navSource, /Knowledge/);
  assert.match(navSource, /isProTier/);
  assert.match(appSource, /function KnowledgeView/);
  assert.match(appSource, /api\?\.listKnowledge/);
  assert.match(appSource, /api\?\.openKnowledgeFileDialog/);
  assert.match(appSource, /api\?\.setPinnedKnowledge/);
  assert.match(appSource, /pinnedKnowledgeIds/);
  assert.match(appSource, /Pinned context/);
  assert.match(appSource, /Drop research files/);
  assert.match(cssSource, /\.knowledge-view/);
  assert.match(cssSource, /\.knowledge-dropzone/);
  assert.match(cssSource, /\.knowledge-row/);
});

test('active assistant cards avoid duplicate label titles', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const assistantStart = appSource.indexOf('function AssistantCards');
  const assistantEnd = appSource.indexOf('function ContextPanel', assistantStart);
  const assistantSource = appSource.slice(assistantStart, assistantEnd);

  assert.match(assistantSource, /const cardLabel = labelForCard\(card\.type\)/);
  assert.match(assistantSource, /const showCardTitle = cardTitle && cardTitle\.toLowerCase\(\) !== cardLabel\.toLowerCase\(\)/);
  assert.match(assistantSource, /showCardTitle \? <h4>\{cardTitle\}<\/h4> : null/);
});

test('active assistant prepends new response cards above existing cards', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const appStart = appSource.indexOf('function App()');
  const appEnd = appSource.indexOf('function ModeToggle', appStart);
  const appBody = appSource.slice(appStart, appEnd);

  assert.match(appSource, /const MAX_ASSISTANT_CARDS = 12/);
  assert.match(appSource, /function prependAssistantCards/);
  assert.match(appSource, /return \[\.\.\.nextCards, \.\.\.retainedCards\]\.slice\(0, MAX_ASSISTANT_CARDS\)/);
  assert.match(appBody, /setAssistantCards\(\(current\) => prependAssistantCards\(nextCards, current\)\)/);
  assert.match(appBody, /setAssistantCards\(\(current\) => prependAssistantCards\(\[temporaryCard\], current\)\)/);
  assert.match(appBody, /setAssistantCards\(\(current\) => prependAssistantCards\(result\.cards, current, temporaryCard\.id, temporaryCard\.groupId\)\)/);
});

test('transcript rating chart renders oldest sessions first', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const trendsStart = appSource.indexOf('function TrendsView');
  const trendsEnd = appSource.indexOf('function TrendChart', trendsStart);
  const trendsSource = appSource.slice(trendsStart, trendsEnd);

  assert.match(trendsSource, /const chronologicalSessions = useMemo/);
  assert.match(trendsSource, /new Date\(a\.date\) - new Date\(b\.date\)/);
  assert.match(trendsSource, /const sortedSessions = chronologicalSessions/);
  assert.equal(trendsSource.includes('[...chronologicalSessions].reverse()'), false);
});

test('trend analysis view keeps content in the main grid column with a resizable rail', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const trendsStart = appSource.indexOf('function TrendsView');
  const trendsEnd = appSource.indexOf('function TrendChart', trendsStart);
  const trendsSource = appSource.slice(trendsStart, trendsEnd);

  assert.match(trendsSource, /const \[railWidth, setRailWidth\] = useState\(390\)/);
  assert.match(trendsSource, /data-testid="trendsTimeline" style=\{\{ '--timeline-rail-width': `\$\{railWidth\}px` \}\}/);
  assert.match(trendsSource, /timeline-rail-resizer/);
  assert.match(trendsSource, /role="separator"/);
  assert.ok(trendsSource.indexOf('className="timeline-rail"') < trendsSource.indexOf('className="timeline-rail-resizer"'));
  assert.ok(trendsSource.indexOf('className="timeline-rail-resizer"') < trendsSource.indexOf('className="timeline-main"'));
});

test('timeline replaces the live workspace when opened', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const returnStart = appSource.indexOf('return (');
  const settingsDrawerStart = appSource.indexOf('{settingsOpen', returnStart);
  const renderBlock = appSource.slice(returnStart, settingsDrawerStart);

  assert.match(renderBlock, /workspace-timeline/);
  assert.ok(renderBlock.indexOf('<BrandMasthead') < renderBlock.indexOf('<WorkspaceNav'));
  assert.equal(renderBlock.includes('<StatusStrip'), false);
  assert.ok(renderBlock.indexOf('<TimelineView') < renderBlock.indexOf('<ContextPanel'));
});

test('interview timeline shows transcript star ratings', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');

  assert.match(appSource, /function StarRating/);
  assert.match(appSource, /Transcript rating/);
  assert.match(appSource, /Array\.from\(\{ length: 5 \}/);
  assert.match(appSource, /className=\{`star-icon/);
  assert.match(cssSource, /\.star-rating/);
  assert.match(cssSource, /\.star-icon\.filled/);
  assert.equal(appSource.includes('session-confidence-pill'), false);
  assert.equal(appSource.includes('trendConfidenceScores'), false);
  assert.equal(appSource.includes('Interview confidence'), false);
});

test('interview timeline exposes opportunity outcome status', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');

  assert.match(appSource, /function getOutcomeLabel/);
  assert.match(appSource, /function OutcomeBadge/);
  assert.match(appSource, /Status/);
  assert.match(appSource, /outcomeReason/);
  assert.match(appSource, /outcomeDate/);
  assert.match(appSource, /value="rejected"/);
  assert.match(appSource, /value="advanced"/);
  assert.match(appSource, /value="offer"/);
  assert.match(appSource, /outcome-badge/);
  assert.match(cssSource, /\.outcome-badge/);
  assert.match(cssSource, /\.outcome-badge\.rejected/);
  assert.match(cssSource, /\.outcome-badge\.advanced/);
  assert.match(cssSource, /\.outcome-badge\.offer/);
  assert.match(cssSource, /\.timeline-title-meta \.outcome-badge/);
  assert.match(cssSource, /margin-bottom: 6px/);
});

test('rejected opportunities cannot be selected as the active interview', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const titleBarStart = appSource.indexOf('function TitleBar');
  const titleBarEnd = appSource.indexOf('function GearIcon', titleBarStart);
  const titleBarSource = appSource.slice(titleBarStart, titleBarEnd);
  const timelineStart = appSource.indexOf('function TimelineView');
  const timelineEnd = appSource.indexOf('function SessionBlock', timelineStart);
  const timelineSource = appSource.slice(timelineStart, timelineEnd);
  const saveStart = appSource.indexOf('async function saveEntityEdits');
  const saveEnd = appSource.indexOf('async function saveSessionEdits', saveStart);
  const saveSource = appSource.slice(saveStart, saveEnd);

  assert.match(titleBarSource, /selectableInterviewEntities/);
  assert.match(titleBarSource, /normalizeOpportunityOutcome\(entity\.outcome\) !== 'rejected'/);
  assert.match(titleBarSource, /selectableInterviewEntities\.map/);
  assert.match(timelineSource, /const canSetActiveInterview = mode !== 'interview' \|\| normalizeOpportunityOutcome\(entity\.outcome\) !== 'rejected'/);
  assert.match(timelineSource, /disabled=\{!canSetActiveInterview\}/);
  assert.match(saveSource, /normalizeOpportunityOutcome\(patch\.outcome\) === 'rejected'/);
  assert.match(saveSource, /company: '',\s*role: ''/);
});

test('interview timeline groups rejected and offer opportunities below active opportunities', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');
  const sectionStart = appSource.indexOf('function OpportunitySection');
  const sectionEnd = appSource.indexOf('function TimelineView', sectionStart);
  const sectionSource = appSource.slice(sectionStart, sectionEnd);
  const timelineStart = appSource.indexOf('function TimelineView');
  const timelineEnd = appSource.indexOf('function SessionBlock', timelineStart);
  const timelineSource = appSource.slice(timelineStart, timelineEnd);

  assert.match(timelineSource, /activeEntities/);
  assert.match(timelineSource, /rejectedEntities/);
  assert.match(timelineSource, /offerEntities/);
  assert.match(timelineSource, /OpportunitySection/);
  assert.match(timelineSource, /Rejected/);
  assert.match(timelineSource, /Offer/);
  assert.match(sectionSource, /aria-expanded/);
  assert.match(timelineSource, /timeline-rail-resizer/);
  assert.match(timelineSource, /role="separator"/);
  assert.match(timelineSource, /--timeline-rail-width/);
  assert.match(cssSource, /\.opportunity-row-main/);
  assert.match(cssSource, /\.opportunity-row-heading/);
  assert.match(cssSource, /\.opportunity-section-toggle/);
  assert.match(cssSource, /\.timeline-rail-resizer/);
  assert.match(cssSource, /grid-template-columns: var\(--timeline-rail-width, 390px\) 8px minmax\(0, 1fr\)/);
});

test('narrow interview timeline lets the full selected opportunity column scroll into view', () => {
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');
  const narrowStart = cssSource.indexOf('@media (max-width: 1120px)');
  const narrowEnd = cssSource.indexOf('@media (max-width: 980px)', narrowStart);
  const narrowSource = cssSource.slice(narrowStart, narrowEnd);

  assert.match(narrowSource, /\.workspace-timeline\s*\{[\s\S]*height: auto;[\s\S]*overflow: visible;[\s\S]*\}/);
  assert.match(narrowSource, /\.timeline-view\s*\{[\s\S]*grid-template-rows: auto auto;[\s\S]*overflow: visible;[\s\S]*\}/);
  assert.match(narrowSource, /\.timeline-main\s*\{[\s\S]*overflow: visible;[\s\S]*\}/);
  assert.match(narrowSource, /\.timeline-main \.session-list\s*\{[\s\S]*max-height: none;[\s\S]*overflow: visible;[\s\S]*\}/);
});

test('timeline and trend views show outcome calibration diagnostics', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');
  const trendsStart = appSource.indexOf('function TrendsView');
  const trendsEnd = appSource.indexOf('function TrendChart', trendsStart);
  const trendsSource = appSource.slice(trendsStart, trendsEnd);
  const timelineStart = appSource.indexOf('function TimelineView');
  const timelineEnd = appSource.indexOf('function SessionBlock', timelineStart);
  const timelineSource = appSource.slice(timelineStart, timelineEnd);

  assert.match(appSource, /function useOutcomeCalibrationSummary/);
  assert.match(appSource, /function OutcomeCalibrationNote/);
  assert.match(appSource, /Calibration used:/);
  assert.match(appSource, /advanced\/offer/);
  assert.match(appSource, /getOutcomeCalibrationSummary/);
  assert.match(trendsSource, /OutcomeCalibrationNote/);
  assert.match(timelineSource, /OutcomeCalibrationNote/);
  assert.match(cssSource, /\.calibration-note/);
});

test('trend analysis groups rejected and offer opportunities below active opportunities', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const trendsStart = appSource.indexOf('function TrendsView');
  const trendsEnd = appSource.indexOf('function TrendChart', trendsStart);
  const trendsSource = appSource.slice(trendsStart, trendsEnd);

  assert.match(trendsSource, /collapsedOutcomeSections/);
  assert.match(trendsSource, /activeEntities/);
  assert.match(trendsSource, /rejectedEntities/);
  assert.match(trendsSource, /offerEntities/);
  assert.match(trendsSource, /OpportunitySection/);
  assert.match(trendsSource, /title="Rejected"/);
  assert.match(trendsSource, /title="Offer"/);
  assert.match(trendsSource, /No active opportunities/);
});

test('pre-call prep and trend breakdown omit per-phase confidence scores', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');

  assert.equal(appSource.includes('Interview confidence by phase:'), false);
  assert.equal(appSource.includes('phase-confidence-row'), false);
  assert.equal(appSource.includes('phase-confidence-pill'), false);
  assert.equal(appSource.includes('confidence_scores'), false);
});

test('pre-call prep renders saved AI prep sections with 3 bullets each', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const contextStart = appSource.indexOf('function ContextPanel');
  const contextEnd = appSource.indexOf('function TimelineView', contextStart);
  const contextSource = appSource.slice(contextStart, contextEnd);

  assert.match(contextSource, /const preCallPrep = trendAnalysis\?\.pre_call_prep/);
  assert.equal(contextSource.includes('buildInterviewPrepSuggestions'), false);
  assert.match(contextSource, /preCallPrep\.probable_focus\.map/);
  assert.match(contextSource, /preCallPrep\.interviewer_question_patterns\.map/);
  assert.match(contextSource, /preCallPrep\.questions_to_ask\.map/);
  assert.match(contextSource, /preCallPrep\.cumulative_phase_summary\.map/);
  assert.match(contextSource, /Previous interviewer question patterns/);
});

test('pre-call prep supports material-based interview prep before completed interviews', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const contextStart = appSource.indexOf('function ContextPanel');
  const contextEnd = appSource.indexOf('function TimelineView', contextStart);
  const contextSource = appSource.slice(contextStart, contextEnd);

  assert.match(appSource, /isMaterialPreCallPrepComplete/);
  assert.match(contextSource, /Generating AI prep from the role materials/);
  assert.match(contextSource, /Probable questions to expect/);
  assert.match(contextSource, /Strengths aligned to the role/);
  assert.match(contextSource, /Questions you can ask/);
  assert.match(contextSource, /Gaps and mitigation/);
  assert.match(contextSource, /preCallPrep\.gaps_and_mitigation\.map/);
  assert.match(contextSource, /preCallPrep\.questions_to_ask\.map/);
  assert.match(contextSource, /const prepRequiredSections = materialPrep/);
  assert.match(contextSource, /gaps_and_mitigation', 'questions_to_ask'/);
  assert.match(contextSource, /api\.generateTrendAnalysis\(activeId, \{ force: true \}\)/);
  assert.match(contextSource, /const cachedAnalysis = unwrapTrendAnalysisRecord\(parsed\)/);
  assert.match(contextSource, /normalized\.length < 2 && isMaterialPreCallPrepComplete\(cachedAnalysis\)/);
  assert.match(contextSource, /const storedAnalysis = unwrapTrendAnalysisRecord\(stored\)/);
  assert.match(contextSource, /normalized\.length < 2 && isMaterialPreCallPrepComplete\(storedAnalysis\)/);
  assert.ok(contextSource.indexOf('Gaps and mitigation') < contextSource.indexOf('Questions you can ask'));
  assert.doesNotMatch(contextSource, /normalized\.length < 2\)\s*\{\s*setTrendAnalysis\(null\)/);
});

test('pre-call prep uses compact overview card with session start action', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');
  const contextStart = appSource.indexOf('function ContextPanel');
  const contextEnd = appSource.indexOf('function TimelineView', contextStart);
  const contextSource = appSource.slice(contextStart, contextEnd);

  assert.match(contextSource, /const prepSessionTitle = nextInterviewEvent\?\.title \|\| 'Next interview'/);
  assert.doesNotMatch(contextSource, /const prepSessionTitle = nextInterviewEvent\?\.title \|\| latestSession\?\.title/);
  assert.match(contextSource, /className="prep-overview-card"/);
  assert.match(contextSource, /className="prep-overview-grid"/);
  assert.match(contextSource, /Session title/);
  assert.match(contextSource, /className="prep-start-button primary-action"/);
  assert.match(contextSource, />Start Interview<\/button>/);
  assert.equal(contextSource.includes('<div className="prep-card">'), false);
  assert.match(cssSource, /\.prep-overview-card/);
  assert.match(cssSource, /\.prep-overview-grid/);
  assert.match(cssSource, /\.prep-start-button/);
});

test('starting capture switches to the live workspace before streaming', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const start = appSource.indexOf('function startCapture()');
  const end = appSource.indexOf('\n  function stopCapture()', start);
  const startCaptureSource = appSource.slice(start, end);

  assert.match(startCaptureSource, /setWorkspaceView\('live'\)/);
  assert.match(startCaptureSource, /setCaptureSessionActive\(true\)/);
  assert.ok(
    startCaptureSource.indexOf("setWorkspaceView('live')") < startCaptureSource.indexOf('setIsStreaming(true)'),
    'startCapture should enter the live workspace before streaming so the active capture UI renders immediately'
  );
});

test('audio errors do not collapse the active capture controls', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const audioStatusStart = appSource.indexOf('api?.onAudioStatus?');
  const audioStatusEnd = appSource.indexOf('api?.onHealthUpdate?', audioStatusStart);
  const audioStatusSource = appSource.slice(audioStatusStart, audioStatusEnd);
  const stopStart = appSource.indexOf('function stopCapture()');
  const stopEnd = appSource.indexOf('\n  useEffect(() => {', stopStart);
  const stopCaptureSource = appSource.slice(stopStart, stopEnd);

  assert.match(audioStatusSource, /nextStatus\.state === 'idle' \|\| nextStatus\.state === 'error'/);
  assert.equal(audioStatusSource.includes('setCaptureSessionActive(false)'), false);
  assert.match(stopCaptureSource, /setCaptureSessionActive\(false\)/);
});

test('mode tabs live in the title bar', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');
  const titleBarStart = appSource.indexOf('function TitleBar');
  const titleBarEnd = appSource.indexOf('function BrandMasthead', titleBarStart);
  const titleBarSource = appSource.slice(titleBarStart, titleBarEnd);

  assert.match(titleBarSource, /<ModeToggle/);
  assert.equal(titleBarSource.includes('Command center'), false);
  assert.equal(titleBarSource.includes('mode-chip'), false);
});

test('title bar exposes minimize, maximize, and close controls in order', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const titleBarStart = appSource.indexOf('function TitleBar');
  const titleBarEnd = appSource.indexOf('function BrandMasthead', titleBarStart) > -1 ? appSource.indexOf('function BrandMasthead', titleBarStart) : appSource.indexOf('function NotificationIcon', titleBarStart);
  const titleBarSource = appSource.slice(titleBarStart, titleBarEnd);
  const appStart = appSource.indexOf('function App()');
  const appEnd = appSource.indexOf('function ModeToggle', appStart);
  const appSourceBlock = appSource.slice(appStart, appEnd);
  const minimizeIndex = titleBarSource.indexOf('aria-label="Minimize Clyde"');
  const maximizeIndex = titleBarSource.indexOf('Maximize Clyde');
  const closeIndex = titleBarSource.indexOf('aria-label="Close app"');

  assert.match(titleBarSource, /Minimize Clyde/);
  assert.match(titleBarSource, /Close app/);
  assert.match(titleBarSource, /onMinimizeApp/);
  assert.match(titleBarSource, /maximizeAppWindow\?\.\(\)/);
  assert.match(titleBarSource, /title-actions title-icons/);
  assert.ok(minimizeIndex > -1);
  assert.ok(maximizeIndex > minimizeIndex);
  assert.ok(closeIndex > maximizeIndex);
  assert.match(appSourceBlock, /const \[appWindowMinimized, setAppWindowMinimized\] = useState\(false\)/);
});

test('onboarding wizard has readable step navigation and no disabled first back button', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');
  const guideStart = appSource.indexOf('function OnboardingWizard');
  const guideEnd = appSource.indexOf('function SettingsDrawer', guideStart);
  const guideSource = appSource.slice(guideStart, guideEnd);
  const cssStart = cssSource.indexOf('.onboarding-steps');
  const cssEnd = cssSource.indexOf('.onboarding-panel', cssStart);
  const progressCss = cssSource.slice(cssStart, cssEnd);

  assert.match(guideSource, /<span>\{index \+ 1\}<\/span>/);
  assert.match(guideSource, /stepIndex > 0 \? <button/);
  assert.doesNotMatch(guideSource, /disabled=\{stepIndex === 0\}/);
  assert.match(progressCss, /\.onboarding-steps button \{/);
  assert.match(progressCss, /grid-template-columns: 28px minmax\(0, 1fr\)/);
  assert.doesNotMatch(progressCss, /height: 6px/);
});

test('onboarding checkbox rows override form-grid label layout', () => {
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');

  assert.match(cssSource, /\.onboarding-form-grid \.toggle-row,\s*\.onboarding-foot \.toggle-row/);
  assert.match(cssSource, /\.onboarding-form-grid \.toggle-row input,\s*\.onboarding-foot \.toggle-row input/);
  assert.match(cssSource, /overflow-y: scroll/);
});

test('meeting context fields are not rendered in settings setup', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const setupStart = appSource.indexOf('function SetupFields');
  const setupEnd = appSource.indexOf('function EmptyState', setupStart);
  const setupSource = appSource.slice(setupStart, setupEnd);

  assert.equal(setupSource.includes('Meeting title'), false);
  assert.equal(setupSource.includes('meetingAttendeesText'), false);
  assert.equal(setupSource.includes('meetingTitle'), false);
});

test('settings setup save awaits the main process and reports failures', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');
  const setupStart = appSource.indexOf('function SetupFields');
  const setupEnd = appSource.indexOf('function EmptyState', setupStart);
  const setupSource = appSource.slice(setupStart, setupEnd);
  const saveStart = appSource.indexOf('async function saveSettings');
  const saveEnd = appSource.indexOf('async function toggleCaptureProtection', saveStart);
  const saveSource = appSource.slice(saveStart, saveEnd);

  assert.match(setupSource, /async function handleSubmit/);
  assert.match(setupSource, /async function saveDraft\(close\)/);
  assert.match(setupSource, /await onSave\(draft, \{ close \}\)/);
  assert.match(setupSource, /Save failed:/);
  assert.match(setupSource, /Settings saved\./);
  assert.match(setupSource, /settings-message-modal/);
  assert.match(setupSource, /role="alertdialog"/);
  assert.match(setupSource, /Save and close/);
  assert.match(setupSource, /Saving\.\.\./);
  assert.match(saveSource, /Settings save failed:/);
  assert.match(saveSource, /throw error/);
  assert.match(cssSource, /\.settings-message-modal/);
});

test('post-session save prompt supports interview and meeting destinations', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');

  assert.match(appSource, /function PostSessionSaveModal/);
  assert.match(appSource, /Save interview transcript/);
  assert.match(appSource, /Save meeting transcript/);
  assert.match(appSource, /Existing company/);
  assert.match(appSource, /New company/);
  assert.match(appSource, /Paste job description/i);
  assert.match(appSource, /jobDescription/);
  assert.match(appSource, /setCompanyJobDescription/);
  assert.match(appSource, /Interview phase/);
  assert.match(appSource, /Interviewer/);
  assert.match(appSource, /Existing meeting/);
  assert.match(appSource, /New meeting/);
  assert.match(appSource, /meetingSessionTitle/);
  assert.match(appSource, /Session title/);
  assert.match(appSource, /title: payload\?\.title \|\| 'Meeting session'/);
});

test('session creation flows expose date time pickers where sessions are created', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');

  for (const componentName of [
    'PostSessionSaveModal',
    'ManualTranscriptModal',
    'EditSessionModal'
  ]) {
    const start = appSource.indexOf(`function ${componentName}`);
    const end = appSource.indexOf('\nfunction ', start + 1);
    const source = appSource.slice(start, end === -1 ? appSource.length : end);

    assert.match(source, /type="datetime-local"/, `${componentName} needs a date picker`);
  }

  assert.match(appSource, /date:\s*fromDateTimeLocal\(data\.date/);
  assert.match(appSource, /date:\s*fromDateTimeLocal\(payload\?\.date/);
});

test('new opportunity and meeting drawers create records without sessions', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const opportunityStart = appSource.indexOf('function NewOpportunityModal');
  const meetingStart = appSource.indexOf('function NewMeetingModal');
  const postSessionStart = appSource.indexOf('function PostSessionSaveModal', meetingStart);
  const opportunitySource = appSource.slice(opportunityStart, meetingStart);
  const meetingSource = appSource.slice(meetingStart, postSessionStart);
  const newOpportunityHandlerStart = appSource.indexOf('newOpportunityOpen &&');
  const newMeetingHandlerStart = appSource.indexOf('newMeetingOpen &&');
  const newRecordHandlers = appSource.slice(newOpportunityHandlerStart, newMeetingHandlerStart + 400);

  assert.match(opportunitySource, /Add transcripts later as interview sessions/);
  assert.doesNotMatch(opportunitySource, /Transcript Text/);
  assert.match(meetingSource, /Add dated meeting sessions from the timeline/);
  assert.doesNotMatch(meetingSource, /Transcript/);
  assert.match(newRecordHandlers, /updateSessionEntity/);
  assert.doesNotMatch(newRecordHandlers, /saveSession\?\.\(/);
});

test('editing an interview transcript clears stale grading and restarts grading', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const start = appSource.indexOf('async function saveSessionEdits');
  const end = appSource.indexOf('return (', start);
  const source = appSource.slice(start, end);
  const promptStart = appSource.indexOf('function PostSessionSaveModal');
  const promptEnd = appSource.indexOf('function JobDescriptionModal', promptStart);
  const promptSource = appSource.slice(promptStart, promptEnd);

  assert.match(source, /transcriptTextsMatch/);
  assert.match(source, /record\.grading = \{ status: 'pending' \}/);
  assert.match(source, /summary: ''/);
  assert.match(promptSource, /window\.scrollTo\(0, 0\)/);
});

test('meeting timeline adds dated meeting sessions separately', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const start = appSource.indexOf('function ManualTranscriptModal');
  const end = appSource.indexOf('function EditEntityModal', start);
  const source = appSource.slice(start, end);

  assert.match(appSource, /Meeting timeline/);
  assert.match(appSource, /Add New Meeting Session to Timeline/);
  assert.match(source, /Add meeting session/);
  assert.match(source, /Session title/);
  assert.match(source, /Save session/);
});

test('timeline sessions are collapsed by default', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');
  const start = appSource.indexOf('function SessionBlock');
  const end = appSource.indexOf('function EvaluationNotes', start);
  const source = appSource.slice(start, end);

  assert.match(source, /<details className="session-block session-block-collapsible">/);
  assert.match(source, /<summary className="session-summary-row">/);
  assert.doesNotMatch(source, /<details className="session-block session-block-collapsible" open/);
  assert.match(cssSource, /\.session-block-collapsible > summary/);
  assert.match(cssSource, /\.session-expanded-content/);
});

test('timeline upcoming events render as compact rows above the session list', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');
  const timelineStart = appSource.indexOf('function TimelineView');
  const timelineEnd = appSource.indexOf('function SessionBlock', timelineStart);
  const timelineSource = appSource.slice(timelineStart, timelineEnd);

  assert.match(timelineSource, /upcoming-event-rows/);
  assert.match(timelineSource, /upcoming-event-row/);
  assert.match(timelineSource, /Interview Timeline/);
  assert.match(cssSource, /\.upcoming-event-row\s*\{[\s\S]*grid-template-columns: auto minmax\(0, 1fr\) minmax\(76px, auto\)/);
  assert.match(cssSource, /\.timeline-session-area\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
});

test('meeting settings use long term memory naming', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const setupStart = appSource.indexOf('function SetupFields');
  const setupEnd = appSource.indexOf('function EmptyState', setupStart);
  const setupSource = appSource.slice(setupStart, setupEnd);

  assert.match(setupSource, /Long term memory/);
  assert.equal(setupSource.includes('Meeting memory'), false);
});

test('renderer source does not use raw innerHTML injection', () => {
  const rendererDir = path.join(repoRoot, 'src', 'renderer');
  const files = fs.readdirSync(rendererDir, { recursive: true })
    .filter((file) => /\.(jsx|js)$/.test(file));

  for (const file of files) {
    const source = fs.readFileSync(path.join(rendererDir, file), 'utf8');
    assert.equal(source.includes('innerHTML'), false, `${file} uses innerHTML`);
    assert.equal(source.includes('dangerouslySetInnerHTML'), false, `${file} uses dangerouslySetInnerHTML`);
  }
});

test('select option menus have readable dark colors', () => {
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');

  assert.match(cssSource, /color-scheme:\s*dark/);
  assert.match(cssSource, /select option\s*\{/);
  assert.match(cssSource, /background:\s*#071018/);
  assert.match(cssSource, /color:\s*#f5fbff/);
});

test('drawer prompts open at the top of the viewport', () => {
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');

  assert.match(cssSource, /\.drawer-backdrop\s*\{/);
  assert.match(cssSource, /align-items:\s*flex-start/);
});

test('workspace nav shows the next upcoming event next to calendar', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');
  const navStart = appSource.indexOf('function WorkspaceNav');
  const navEnd = appSource.indexOf('function ModeToggle', navStart);
  const navSource = appSource.slice(navStart, navEnd);

  assert.match(navSource, /nextUpcomingEvent/);
  assert.match(navSource, /workspace-nav-event/);
  assert.match(navSource, /workspace-nav-event-button/);
  assert.match(navSource, /Next up/);
  assert.match(navSource, /onOpenNextUpcomingEvent/);
  assert.match(navSource, /resolveEventEntityLabel\(nextUpcomingEvent/);
  assert.match(navSource, /formatEventDateTime\(nextUpcomingEvent\.date\)/);
  assert.equal(navSource.includes('workspace-nav-start'), false);
  assert.equal(navSource.includes('onStartEvent'), false);
  assert.match(appSource, /const nextUpcomingEvent = useMemo\(\(\) =>/);
  assert.match(appSource, /function openNextUpcomingEvent\(\)/);
  assert.match(appSource, /setWorkspaceView\('calendar'\)/);
  assert.match(appSource, /setCalendarEditEvent\(nextUpcomingEvent\)/);
  assert.match(appSource, /setCalendarModalOpen\(true\)/);
  assert.match(cssSource, /\.workspace-nav-inner/);
  assert.match(cssSource, /\.workspace-nav-event/);
  assert.match(cssSource, /\.workspace-nav-logo-card/);
  assert.match(cssSource, /\.workspace-nav-empty/);
});

test('calendar and timeline event cards render associated entity labels', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const calendarStart = appSource.indexOf('function CalendarView');
  const calendarEnd = appSource.indexOf('function CalendarEventModal', calendarStart);
  const calendarSource = appSource.slice(calendarStart, calendarEnd);
  const modalStart = appSource.indexOf('function CalendarEventModal');
  const modalEnd = appSource.indexOf('function App()', modalStart);
  const modalSource = appSource.slice(modalStart, modalEnd);
  const timelineStart = appSource.indexOf('function TimelineView');
  const timelineEnd = appSource.indexOf('function SessionBlock', timelineStart);
  const timelineSource = appSource.slice(timelineStart, timelineEnd);

  assert.match(appSource, /function resolveEventEntityLabel/);
  assert.match(calendarSource, /resolveEventEntityLabel\(evt, entities\)/);
  assert.match(calendarSource, /event-entity/);
  assert.match(modalSource, /entityName:/);
  assert.match(modalSource, /linkedEntity\?\.name/);
  assert.match(timelineSource, /upcoming-event-row/);
});

test('calendar month cells use taller day squares for stacked events', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const calendarStart = appSource.indexOf('const calendarStyles = `');
    const calendarEnd = appSource.indexOf('`;\n  \n  function CalendarView', calendarStart);
  const calendarStylesSource = appSource.slice(calendarStart, calendarEnd);

  assert.match(calendarStylesSource, /\.calendar-days \{[\s\S]*grid-auto-rows: minmax\(160px, 1fr\)/);
});

test('calendar marks past events with muted styling', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const calendarStart = appSource.indexOf('function CalendarView');
  const calendarEnd = appSource.indexOf('function CalendarEventModal', calendarStart);
  const calendarSource = appSource.slice(calendarStart, calendarEnd);
  const stylesStart = appSource.indexOf('const calendarStyles = `');
  const stylesEnd = appSource.indexOf('`;\n\nfunction CalendarView', stylesStart);
  const stylesSource = appSource.slice(stylesStart, stylesEnd);

  assert.match(appSource, /function isPastCalendarEvent/);
  assert.match(calendarSource, /const nowMs = useNowMs\(\)/);
  assert.match(calendarSource, /isPastCalendarEvent\(evt, nowMs\)/);
  assert.match(calendarSource, /calendar-event-chip \$\{isPast \? 'past' : ''\}/);
  assert.match(calendarSource, /calendar-event-card \$\{isPast \? 'past' : ''\}/);
  assert.match(stylesSource, /\.calendar-event-chip\.past/);
  assert.match(stylesSource, /\.calendar-event-card\.past/);
  assert.match(stylesSource, /saturate\(0\.35\)/);
});

test('trend analysis cache is keyed by the session signature', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const clientSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'trendAnalysisClient.js'), 'utf8');

  assert.match(appSource, /from '\.\/trendAnalysisClient\.js'/);
  assert.equal(appSource.includes("from '../trendAnalysis.js'"), false);
  assert.match(clientSource, /export function buildTrendAnalysisSessionSignature/);
  assert.match(clientSource, /export function isTrendAnalysisComplete/);
  assert.match(appSource, /buildTrendAnalysisSessionSignature/);
  assert.match(appSource, /isTrendAnalysisComplete/);
  assert.match(appSource, /sessionsSignature/);
  assert.match(appSource, /getTrendAnalysis/);
  assert.match(appSource, /sessionsMatchSelected/);
  assert.match(appSource, /sort\(\(a, b\) => new Date\(a\.date\) - new Date\(b\.date\)\)/);
});

test('trend analysis view loads saved analysis without auto-regenerating on navigation', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const trendsStart = appSource.indexOf('function TrendsView');
  const trendsEnd = appSource.indexOf('function TrendChart', trendsStart);
  const trendsSource = appSource.slice(trendsStart, trendsEnd);

  assert.match(trendsSource, /getTrendAnalysis/);
  assert.match(trendsSource, /Generate Analysis/);
  assert.match(trendsSource, /generateTrendAnalysis\?\.\(selected\.id, \{ force: true \}\)/);
  assert.equal(trendsSource.includes('setAnalysis(null);\n      generateAnalysis();'), false);
});

test('trend analysis supports one-session baseline analysis', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const trendsStart = appSource.indexOf('function TrendsView');
  const trendsEnd = appSource.indexOf('function TrendChart', trendsStart);
  const trendsSource = appSource.slice(trendsStart, trendsEnd);
  const chartSource = appSource.slice(trendsEnd, appSource.indexOf('const calendarStyles', trendsEnd));

  assert.match(trendsSource, /sessions\.length < 1/);
  assert.match(trendsSource, /Baseline Analysis/);
  assert.doesNotMatch(trendsSource, /At least 2 interview sessions are required/);
  assert.match(chartSource, /validSessions\.length < 1/);
  assert.match(chartSource, /validSessions\.length === 1/);
});

test('renderer reloads sessions after background session data changes', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');

  assert.match(appSource, /api\?\.onSessionDataChanged\?\./);
  assert.match(appSource, /change\?\.mode/);
  assert.match(appSource, /reloadSessions\(mode, selectedEntity \|\| change\?\.entityId \|\| ''\)/);
});

test('upcoming event lists hide events after their scheduled date time passes', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const timelineStart = appSource.indexOf('function TimelineView');
  const timelineEnd = appSource.indexOf('function SessionBlock', timelineStart);
  const timelineSource = appSource.slice(timelineStart, timelineEnd);
  const contextStart = appSource.indexOf('function ContextPanel');
  const contextEnd = appSource.indexOf('function TimelineView', contextStart);
  const contextSource = appSource.slice(contextStart, contextEnd);

  assert.match(appSource, /function useNowMs/);
  assert.match(appSource, /setInterval\(\(\) => setNowMs\(Date\.now\(\)\), 30000\)/);
  assert.match(timelineSource, /const nowMs = useNowMs\(\)/);
  assert.match(timelineSource, /Number\.isFinite\(eventTime\) && eventTime >= nowMs/);
  assert.match(contextSource, /const nowMs = useNowMs\(\)/);
  assert.match(contextSource, /Number\.isFinite\(eventTime\) && eventTime >= nowMs/);
});

test('calendar event modal submit resolves a valid color before saving', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const modalStart = appSource.indexOf('function CalendarEventModal');
  const modalEnd = appSource.indexOf('function App()', modalStart);
  const modalSource = appSource.slice(modalStart, modalEnd);

  assert.match(modalSource, /const resolvedColor = associationMode === 'opportunity'/);
  assert.match(modalSource, /color:\s*resolvedColor/);
});

test('timeline renders evaluation notes as structured content', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');

  assert.match(appSource, /function EvaluationNotes/);
  assert.match(appSource, /function directAddressFeedback/);
  assert.match(appSource, /parseEvaluationText/);
  assert.match(appSource, /directAddressFeedback\(text\)/);
  assert.match(appSource, /directAddressFeedback\(item\)/);
  assert.match(appSource, /evaluation-section/);
  assert.match(appSource, /evaluation-action-items/);
  assert.match(appSource, /evaluation-examples/);
  assert.match(appSource, /function buildNotes\(transcript, cards, mode = 'interview'\)/);
  assert.match(appSource, /summary: ''/);
  assert.match(appSource, /actionItems: \[\]/);
  assert.match(appSource, /Meeting notes/);
  assert.match(appSource, /Action items by attendee/);
  assert.match(cssSource, /\.evaluation-notes/);
  assert.match(cssSource, /\.evaluation-section h4/);
  assert.match(cssSource, /\.evaluation-action-items/);
});
