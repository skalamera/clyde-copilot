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
    'Edit details',
    'Edit interview',
    'deleteSessionEntity',
    'Active Meeting:',
    '+ Add New Meeting',
    'onChangeActiveMeeting',
    'AI reply',
    "userTier: 'free'",
    'proAgentEnabled: false',
    'pinnedKnowledgeIds: []'
  ]) {
    assert.match(appSource, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
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

  assert.match(appSource, /<option value="openai-realtime-whisper">OpenAI Realtime Whisper<\/option>/);
  assert.match(appSource, /draft\.transcriptionProvider === 'local' \?/);
  assert.match(appSource, /OpenAI API Key/);
});

test('settings expose Rust audio engine and device controls', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');

  assert.match(appSource, /audioEngine: 'rust'/);
  assert.match(appSource, /Audio engine/);
  assert.match(appSource, /<option value="rust">Rust native audio<\/option>/);
  assert.match(appSource, /<option value="legacy">Legacy recorder<\/option>/);
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
  assert.match(appSource, /activeCapture \? null : \(\s*<TitleBar/);
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
  assert.equal(activeSource.includes('Ask Clyde or wait for suggestions.'), false);
  assert.equal(activeSource.includes('Live help will appear here during the call.'), false);
  assert.match(activeSource, /panelRef = useRef\(null\)/);
  assert.match(activeSource, /ResizeObserver/);
  assert.match(activeSource, /resizeActiveCaptureWindow/);
  assert.match(activeSource, /contentWidth/);
  assert.match(appSource, /slice\(-18\)/);
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
  assert.match(cssSource, /\.assistant-pane-active \.assistant-card\s*\{[\s\S]*overflow-y: auto/);
  assert.match(activeSource, /querySelectorAll\('\[data-active-size-content\]'\)/);
  assert.match(activeSource, /--active-card-stack-max-height/);
  assert.match(activeSource, /const maxAllowedWindowHeight = workAreaHeight - 40/);
  assert.match(activeSource, /rect\.top - panelRect\.top \+ visibleStackHeight/);
  assert.match(activeSource, /const contentHeight = Math\.max\(panel\.scrollHeight, contentBounds\.bottom, scrollContentBottom\)/);
  assert.match(activeSource, /showMeters, showTranscript/);
  assert.match(cssSource, /\.assistant-pane-active \.scroll-area\s*\{[\s\S]*max-height: var\(--active-card-stack-max-height, calc\(100vh - 138px\)\)/);
  assert.match(cssSource, /\.assistant-pane-active \.assistant-card\s*\{[\s\S]*min-height: clamp\(160px, 24vh, 260px\)/);
  assert.match(cssSource, /\.assistant-pane-active \.assistant-card:only-child\s*\{[\s\S]*min-height: clamp\(320px, 58vh, 560px\)/);
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
  assert.match(cssSource, /\.active-icon-btn\.camera-btn/);
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
  assert.ok(renderBlock.indexOf('<TimelineView') < renderBlock.indexOf('<StatusStrip'));
  assert.ok(renderBlock.indexOf('<StatusStrip') < renderBlock.indexOf('<ContextPanel'));
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

test('pre-call prep uses compact overview card with session start action', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const cssSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.css'), 'utf8');
  const contextStart = appSource.indexOf('function ContextPanel');
  const contextEnd = appSource.indexOf('function TimelineView', contextStart);
  const contextSource = appSource.slice(contextStart, contextEnd);

  assert.match(contextSource, /const prepSessionTitle = nextInterviewEvent\?\.title \|\| latestSession\?\.title \|\| 'Next session'/);
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
  assert.match(titleBarSource, /capture-protection-toggle/);
  assert.match(titleBarSource, /className="ghost-emoji-icon"/);
  assert.match(titleBarSource, />👻<\/span>/);
  assert.match(cssSource, /\.capture-protection-toggle \.ghost-emoji-icon[\s\S]*font-size: 20px/);
  assert.equal(titleBarSource.includes('Command center'), false);
  assert.equal(titleBarSource.includes('mode-chip'), false);
});

test('title bar exposes settings, minimize, maximize, and close controls in order', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const titleBarStart = appSource.indexOf('function TitleBar');
  const titleBarEnd = appSource.indexOf('function BrandMasthead', titleBarStart);
  const titleBarSource = appSource.slice(titleBarStart, titleBarEnd);
  const appStart = appSource.indexOf('function App()');
  const appEnd = appSource.indexOf('function ModeToggle', appStart);
  const appSourceBlock = appSource.slice(appStart, appEnd);
  const settingsIndex = titleBarSource.indexOf('aria-label="Settings"');
  const minimizeIndex = titleBarSource.indexOf('aria-label="Minimize Clyde"');
  const maximizeIndex = titleBarSource.indexOf('aria-label="Maximize Clyde"');
  const closeIndex = titleBarSource.indexOf('aria-label="Close app"');

  assert.match(titleBarSource, /Minimize Clyde/);
  assert.match(titleBarSource, /Maximize Clyde/);
  assert.match(titleBarSource, /onMinimizeApp/);
  assert.match(titleBarSource, /maximizeAppWindow\?\.\(\)/);
  assert.match(titleBarSource, /title-actions title-icons/);
  assert.ok(settingsIndex > -1);
  assert.ok(minimizeIndex > settingsIndex);
  assert.ok(maximizeIndex > minimizeIndex);
  assert.ok(closeIndex > maximizeIndex);
  assert.match(appSourceBlock, /const \[appWindowMinimized, setAppWindowMinimized\] = useState\(false\)/);
  assert.match(appSourceBlock, /if \(appWindowMinimized\) \{/);
  assert.match(appSourceBlock, /onMinimizeApp=\{async \(\) => \{/);
  assert.match(appSourceBlock, /minimizeAppWindow\?\.\(\)/);
  assert.match(appSourceBlock, /className="app-minimized-chip"/);
  assert.match(appSourceBlock, /window\.electronAPI\?\.showApp\?\.\(\)/);
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
  assert.match(setupSource, /await onSave\(draft\)/);
  assert.match(setupSource, /Save failed:/);
  assert.match(setupSource, /settings-save-status/);
  assert.match(setupSource, /Saving\.\.\./);
  assert.match(saveSource, /Settings save failed:/);
  assert.match(saveSource, /throw error/);
  assert.match(cssSource, /\.settings-save-status/);
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
});

test('session creation flows expose date time pickers and save dates', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');

  for (const componentName of [
    'NewOpportunityModal',
    'NewMeetingModal',
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

test('new meeting drawer accepts transcript text directly', () => {
  const appSource = fs.readFileSync(path.join(repoRoot, 'src', 'renderer', 'App.jsx'), 'utf8');
  const start = appSource.indexOf('function NewMeetingModal');
  const end = appSource.indexOf('function PostSessionSaveModal', start);
  const source = appSource.slice(start, end);

  assert.match(source, /Transcript/);
  assert.match(source, /Meeting memory/);
  assert.match(source, /transcriptText/);
  assert.match(source, /Create Meeting/);
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
  assert.match(navSource, /freeSidebarLogoUrl/);
  assert.match(navSource, /proLogoUrl/);
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
  assert.match(timelineSource, /resolveEventEntityLabel\(evt, entities\)/);
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
  assert.match(appSource, /session\?\.mode === 'meeting' \? 'Meeting notes' : 'Summary'/);
  assert.match(appSource, /session\?\.mode === 'interview' \? 'Examples' : 'Action items by attendee'/);
  assert.match(cssSource, /\.evaluation-notes/);
  assert.match(cssSource, /\.evaluation-section h4/);
  assert.match(cssSource, /\.evaluation-action-items/);
});
