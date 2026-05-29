const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.join(__dirname, '..');

test('main process request-suggestion forwards prompt and screenshot options', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');

  assert.match(source, /desktopCapturer/);
  assert.match(source, /async function captureDesktopScreenshot/);
  assert.match(source, /ipcMain\.handle\('request-suggestion', async \(event, payload = \{\}\)/);
  assert.match(source, /includeScreenshot/);
  assert.match(source, /getMeetingAssistant\(\)\.requestSuggestion\(\{\s*prompt:/);
  assert.match(source, /screenshot/);
  assert.match(source, /sources: payload && payload\.sources/);
  assert.match(source, /intent: payload && payload\.intent/);
  assert.match(source, /mode: payload && payload\.mode/);
  assert.match(source, /transcript: payload && payload\.transcript/);
});

test('main process logs assistant update card counts', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const start = source.indexOf('function sendAssistantUpdate');
  const end = source.indexOf('\nfunction sendAudioLevelUpdate', start);
  const sendAssistantSource = source.slice(start, end);

  assert.match(sendAssistantSource, /assistant-update/);
  assert.match(sendAssistantSource, /cards = Array\.isArray\(update\?\.cards\)/);
  assert.match(sendAssistantSource, /Assistant update: .*cards/);
});

test('main process exposes hide-app handler', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');

  assert.match(source, /ipcMain\.handle\('hide-app'/);
  assert.match(source, /mainWindow\.hide\(\)/);
  assert.match(source, /mainWindow\.minimize\(\)/);
});

test('main process registers IPC handlers before loading renderer', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const createStart = source.indexOf('function createWindow');
  const createEnd = source.indexOf('\nfunction getAppIconPath', createStart);
  const createWindowSource = source.slice(createStart, createEnd);

  assert.ok(createWindowSource.indexOf("ipcMain.handle('list-agent-sources'") > -1);
  assert.ok(createWindowSource.indexOf("ipcMain.handle('list-agent-sources'") < createWindowSource.indexOf('mainWindow.loadFile(filePath)'));
  assert.ok(createWindowSource.indexOf("ipcMain.handle('get-google-sync-status'") < createWindowSource.indexOf('mainWindow.loadFile(filePath)'));
});

test('list-agent-sources handler normalizes request filters before use', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const start = source.indexOf("ipcMain.handle('list-agent-sources'");
  const end = source.indexOf("\n\n  ipcMain.handle('load-floating-agent-prefs'", start);
  const block = source.slice(start, end);

  assert.match(block, /requestFilters = \{\}/);
  assert.match(block, /const sourceFilters = requestFilters && typeof requestFilters === 'object' \? requestFilters : \{\}/);
  assert.match(block, /demoData\.listAgentSources\(sourceFilters\)/);
  assert.match(block, /getAgentChat\(\)\.listSources\(sourceFilters\)/);
  assert.doesNotMatch(block, /\bfilters\b/);
});

test('main process exposes app-window minimize and restore handlers', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');

  assert.match(source, /ipcMain\.handle\('minimize-app-window'/);
  assert.match(source, /function minimizeAppWindow/);
  assert.match(source, /appWindowMinimized = true/);
  assert.match(source, /ipcMain\.handle\('show-app'/);
  assert.match(source, /function restoreAppWindowBounds/);
  assert.match(source, /appWindowMinimized = false/);
});

test('main process exposes app-window maximize handler', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');

  assert.match(source, /ipcMain\.handle\('maximize-app-window'/);
  assert.match(source, /restoreAppWindowBounds\(\)/);
  assert.match(source, /mainWindow\.maximize\(\)/);
  assert.match(source, /mainWindow\.focus\(\)/);
});

test('main process requests resizing on start-audio-capture', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');

  assert.match(source, /function enterActiveCaptureWindow/);
  assert.match(source, /normalBounds = currentBounds/);
  assert.match(source, /mainWindow\.setBounds\(nextBounds\)/);
  assert.match(source, /mainWindow\.setHasShadow\(false\)/);
  assert.match(source, /ACTIVE_CAPTURE_DEFAULT_WIDTH = 800/);
  assert.match(source, /screen\.getDisplayMatching\(currentBounds\)/);
  assert.match(source, /saveActiveCaptureBounds\(mainWindow\.getBounds\(\)\)/);
});

test('main process ignores duplicate start capture requests while audio is active', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const start = source.indexOf("ipcMain.on('start-audio-capture'");
  const end = source.indexOf("\n  ipcMain.on('stop-audio-capture'", start);
  const block = source.slice(start, end);

  assert.match(source, /let audioCaptureRunning = false/);
  assert.match(block, /if \(audioCaptureRunning\)/);
  assert.match(block, /sendAudioStatus\(\{ state: 'capturing', message: 'Audio capture is already running\.' \}\)/);
  assert.match(block, /audioCaptureRunning = true/);
});

test('main process restores window bounds on stop-audio-capture', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');

  assert.match(source, /function restoreNormalWindowBounds/);
  assert.match(source, /if \(normalBounds\)/);
  assert.match(source, /mainWindow\.setBounds\(normalBounds\)/);
  assert.match(source, /mainWindow\.setHasShadow\(true\)/);
  assert.match(source, /normalBounds = null/);
  assert.match(source, /audioCaptureRunning = false/);
});

test('reset-session clears transcript and keeps capture running', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');

  // Extract the reset-session block
  const match = source.match(/ipcMain\.on\('reset-session', \(\) => \{([\s\S]*?)\}\);/);
  assert.ok(match, 'reset-session handler should exist');
  
  const block = match[1];
  assert.match(block, /fullSessionTranscript = \[\]/);
  assert.match(block, /closeTranscriptionProcessors\(\)/);
  assert.doesNotMatch(block, /stopRustAudioEngineCapture\(\)/);
  assert.doesNotMatch(block, /sendAudioStatus\(\{ state: 'idle', message: 'Session reset\.' \}\)/);
});

test('active capture window can shrink to rendered content height', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');

  assert.match(source, /const ACTIVE_CAPTURE_MIN_HEIGHT = 72/);
  assert.match(source, /const ACTIVE_CAPTURE_FULL_MIN_HEIGHT = 160/);
  assert.match(source, /const ACTIVE_CAPTURE_MINIMIZED_SIZE = 112/);
  assert.match(source, /const ACTIVE_CAPTURE_MINIMIZED_MARGIN = 10/);
  assert.match(source, /let activeCaptureMinimized = false/);
  assert.match(source, /function resizeActiveCaptureWindowToContent\(size = \{\}\)/);
  assert.match(source, /if \(!activeCaptureWindow \|\| !mainWindow \|\| mainWindow\.isDestroyed\(\)\)/);
  assert.match(source, /ipcMain\.handle\('resize-active-capture-window', async \(event, bounds = \{\}\)/);
  assert.match(source, /minimized\s*\?\s*ACTIVE_CAPTURE_MINIMIZED_SIZE/);
  assert.match(source, /mainWindow\.setMinimumSize\(minSize, minSize\)/);
  assert.match(source, /mainWindow\.setResizable\(!minimized\)/);
  assert.match(source, /workArea\.x \+ ACTIVE_CAPTURE_MINIMIZED_MARGIN/);
  assert.match(source, /workArea\.y \+ workArea\.height - nextHeight - ACTIVE_CAPTURE_MINIMIZED_MARGIN/);
  assert.match(source, /mainWindow\.setBounds\(nextBounds\)/);
  assert.match(source, /!activeCaptureMinimized && !suppressActiveBoundsSave/);
  assert.match(source, /ipcMain\.handle\('get-active-capture-window-bounds'/);
  assert.match(source, /ipcMain\.handle\('move-active-capture-window'/);
  assert.match(source, /activeCaptureMinimized \? ACTIVE_CAPTURE_MINIMIZED_SIZE : currentBounds\.width/);
  assert.match(source, /screen\.getDisplayNearestPoint\(targetPoint\)/);
});

test('main process toggles capture pause without stopping the session', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');

  assert.match(source, /let capturePaused = false/);
  assert.match(source, /ipcMain\.handle\('toggle-pause-capture'/);
  assert.match(source, /capturePaused = !capturePaused/);
  assert.match(source, /capture\.pause\(\)/);
  assert.match(source, /capture\.resume\(\)/);
  assert.match(source, /state: capturePaused \? 'paused' : 'capturing'/);
});

test('main process treats realtime transcription as OpenAI cloud transcription', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');

  assert.match(source, /function isOpenAiTranscriptionProvider/);
  assert.match(source, /provider === 'openai-realtime-whisper'/);
  assert.match(source, /Using OpenAI Realtime Whisper/);
});

test('main process exposes knowledge base and tier IPC handlers', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const signUpStart = source.indexOf("ipcMain.handle('sign-up'");
  const signInStart = source.indexOf("ipcMain.handle('sign-in'");
  const signOutStart = source.indexOf("ipcMain.handle('sign-out'");
  const signUpBlock = source.slice(signUpStart, signInStart);
  const signInBlock = source.slice(signInStart, signOutStart);

  assert.match(source, /createKnowledgeManager/);
  assert.match(source, /ipcMain\.handle\('get-tier-status'/);
  assert.match(source, /ipcMain\.handle\('open-upgrade-page'/);
  assert.match(source, /shell\.openExternal\(CLYDE_UPGRADE_URL\)/);
  assert.match(source, /ipcMain\.handle\('sign-in'/);
  assert.match(source, /ipcMain\.handle\('start-pro-signup-checkout'/);
  assert.match(source, /ipcMain\.handle\('start-checkout-session'/);
  assert.match(source, /ipcMain\.handle\('open-billing-portal'/);
  assert.match(source, /function publicSettings/);
  assert.match(source, /authAccessToken: _authAccessToken/);
  assert.match(source, /authRefreshToken: _authRefreshToken/);
  assert.match(source, /ipcMain\.handle\('list-knowledge'/);
  assert.match(source, /ipcMain\.handle\('ingest-knowledge-file'/);
  assert.match(source, /ipcMain\.handle\('delete-knowledge-item'/);
  assert.match(source, /ipcMain\.handle\('set-pinned-knowledge'/);
  assert.match(source, /pinnedKnowledgeBrief: getPinnedKnowledgeBrief\(settings\)/);
  assert.match(source, /pinnedKnowledge: pinnedKnowledgeItems\.map/);
  assert.match(source, /summarizePinnedKnowledgeContent/);
  assert.match(source, /ipcMain\.handle\('get-pinned-knowledge'/);
  assert.match(source, /ipcMain\.handle\('open-knowledge-file-dialog'/);
  assert.match(source, /function getSupabaseAuthConfig\(\)/);
  assert.match(source, /CLYDE_SUPABASE_URL/);
  assert.match(source, /CLYDE_SUPABASE_ANON_KEY/);
  assert.match(source, /CLYDE_SIGN_UP_URL/);
  assert.match(source, /CLYDE_PRO_SIGNUP_CHECKOUT_URL/);
  assert.match(source, /CLYDE_ENTITLEMENTS_URL/);
  assert.match(source, /process\.env\.CLYDE_ENTITLEMENTS_URL \|\| `\$\{CLYDE_API_BASE_URL\}\/entitlements`/);
  assert.match(source, /createProSignupCheckout/);
  assert.match(source, /signUpEndpoint: String\(CLYDE_SIGN_UP_URL \|\| ''\)\.trim\(\)/);
  assert.match(signUpBlock, /config: getSupabaseAuthConfig\(\)/);
  assert.match(signInBlock, /config: getSupabaseAuthConfig\(\)/);
});

test('main process defaults entitlement refreshes to the production API endpoint', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');

  assert.match(source, /const CLYDE_API_BASE_URL = \(process\.env\.CLYDE_API_BASE_URL \|\| 'https:\/\/clydeai\.live\/api'\)/);
  assert.match(source, /const CLYDE_ENTITLEMENTS_URL = process\.env\.CLYDE_ENTITLEMENTS_URL \|\| `\$\{CLYDE_API_BASE_URL\}\/entitlements`/);
  assert.match(source, /entitlementsUrl: store\.get\('entitlementsUrl'\) \|\| CLYDE_ENTITLEMENTS_URL/);
});

test('main process preserves settings on update but clears stale sync actions when Google is disconnected', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');

  assert.doesNotMatch(source, /credentialReset\.v1\.0\.0-beta\.1/);
  assert.doesNotMatch(source, /STALE_CREDENTIAL_KEYS/);
  assert.match(source, /if \(!getGoogleTokens\(\)\) \{\s*syncStore\.clearState\(\);\s*\}/);
});

test('main process mints GA Realtime client secrets', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const start = source.indexOf("ipcMain.handle('get-realtime-token'");
  const end = source.indexOf("\n  ipcMain.handle('start-agent-chat'", start);
  const block = source.slice(start, end);

  assert.match(block, /https:\/\/api\.openai\.com\/v1\/realtime\/client_secrets/);
  assert.match(block, /model: realtimeModel/);
  assert.match(block, /const realtimeModel = settings\.proRealtimeModel \|\| ''/);
  assert.match(block, /Realtime model is missing/);
  assert.match(block, /output_modalities: \['audio'\]/);
  assert.match(block, /turn_detection: \{ type: 'semantic_vad' \}/);
  assert.match(block, /voice: 'marin'/);
  assert.match(block, /OpenAI-Safety-Identifier/);
  assert.doesNotMatch(block, /realtime\/sessions/);
  assert.doesNotMatch(block, /gpt-4o-realtime-preview/);
});

test('main process exposes mock interview assessment and save handlers', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');

  assert.match(source, /createMockInterviewManager/);
  assert.match(source, /ipcMain\.handle\('generate-mock-interview-assessment'/);
  assert.match(source, /mockInterviewManager\.generateAssessment/);
  assert.match(source, /ipcMain\.handle\('save-mock-interview'/);
  assert.match(source, /mockInterviewManager\.saveMockInterview/);
  assert.match(source, /Mock interview assessment requested:/);
  assert.match(source, /Mock interview saved:/);
  assert.match(source, /ipcMain\.handle\('list-mock-interviews'/);
  assert.match(source, /ipcMain\.handle\('delete-mock-interview'/);
  assert.match(source, /mockInterviewManager\.deleteMockInterview\(id, loadSettings\(\)\)/);
  assert.match(source, /mock-interview-deleted/);
});

test('main process creates unique LiveAvatar context names for mock interviews', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const start = source.indexOf("ipcMain.handle('generate-mock-interview-session-token'");
  const end = source.indexOf("\n    ipcMain.handle('generate-mock-interview-assessment'", start);
  const block = source.slice(start, end);

  assert.match(block, /const contextName = \[/);
  assert.match(block, /new Date\(\)\.toISOString\(\)/);
  assert.match(block, /Math\.random\(\)\.toString\(16\)/);
  assert.match(block, /contextName,/);
  assert.match(block, /CLYDE_LIVEAVATAR_TOKEN_URL/);
  assert.match(block, /Authorization: `Bearer \$\{authSession\.accessToken\}`/);
  assert.doesNotMatch(block, /X-API-KEY/);
});

test('main process uses an app-owned Google OAuth client ID', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const connectStart = source.indexOf("ipcMain.handle('connect-google-sync'");
  const connectEnd = source.indexOf("\n  ipcMain.handle('disconnect-google-sync'", connectStart);
  const connectBlock = source.slice(connectStart, connectEnd);

  assert.match(source, /function getGoogleOAuthClientId\(\)/);
  assert.match(source, /function getGoogleOAuthClientSecret\(\)/);
  assert.match(source, /CLYDE_GOOGLE_OAUTH_CLIENT_ID/);
  assert.match(source, /GOOGLE_OAUTH_CLIENT_ID/);
  assert.match(source, /CLYDE_GOOGLE_OAUTH_CLIENT_SECRET/);
  assert.match(source, /GOOGLE_OAUTH_CLIENT_SECRET/);
  assert.doesNotMatch(connectBlock, /payload\.clientId/);
  assert.doesNotMatch(connectBlock, /googleOAuthClientId/);
  assert.match(connectBlock, /clientId: getGoogleOAuthClientId\(\)/);
  assert.match(connectBlock, /clientSecret: getGoogleOAuthClientSecret\(\)/);
});

test('main process triggers a one-shot Google sync scan on app launch', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');

  assert.match(source, /async function runGoogleSyncScan\(\{ manual = false, gmailLimit, calendarLimit \} = \{\}\)/);
  assert.match(source, /function startGoogleSyncOnLaunch\(settings = loadSettings\(\)\)/);
  assert.match(source, /function hasGoogleOAuthClientId\(\)/);
  assert.match(source, /!settings\.googleSyncEnabled \|\| !hasGoogleOAuthClientId\(\)/);
  assert.match(source, /startGoogleSyncTimer\(settings\);\s+startGoogleSyncOnLaunch\(settings\);/);
  assert.match(source, /runGoogleSyncScan\(\{ gmailLimit: 50, calendarLimit: 50 \}\)/);
  assert.match(source, /Google sync startup scan failed:/);
});

test('main process archives sessions into the pro knowledge base', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');

  assert.match(source, /archiveSessionKnowledge/);
  assert.match(source, /knowledgeManager\.archiveSession/);
  assert.match(source, /backfillKnowledgeFromSessions/);
});

test('main process forwards partial transcripts without saving or sending them to assistant context', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');

  assert.match(source, /if \(transcript && transcript\.partial\)/);
  assert.match(source, /mainWindow\.webContents\.send\('transcript-update', transcript\);\s*return;/);
});

test('main process closes transcription processors when capture stops', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');

  assert.match(source, /function closeTranscriptionProcessors/);
  assert.match(source, /for \(const processor of transcriptionProcessors\.values\(\)\)/);
  assert.match(source, /processor\.close\(\)/);
  assert.match(source, /closeTranscriptionProcessors\(\);\s*transcriptionProcessors = null;/);
});

test('main process integrates the Rust audio engine sidecar', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');

  assert.match(source, /createAudioEngineSidecar/);
  assert.match(source, /let audioEngineSidecar/);
  assert.match(source, /function shouldUseRustAudioEngine\(settings = loadSettings\(\)\)/);
  assert.match(source, /function startRustAudioEngineCapture/);
  assert.match(source, /audioEngineSidecar\.startCapture/);
  assert.match(source, /onAudioChunk: async \(event\) => \{/);
  assert.match(source, /processAudioChunk\(event\.source, event\.chunk, event\.sampleRate\)/);
  assert.match(source, /stopRustAudioEngineCapture\(\)/);
  assert.match(source, /audioEngineSidecar\.shutdown\(\)/);
  assert.match(source, /ipcMain\.handle\('list-audio-devices'/);
  assert.match(source, /ipcMain\.handle\('set-audio-devices'/);
  assert.match(source, /checkRustAudioEngineHealth\(settings\)/);
});

test('main process passes source sample rate into transcription processors', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const processorStart = source.indexOf('function getTranscriptionProcessor');
  const processorEnd = source.indexOf('async function processAudioChunk', processorStart);
  const processorSource = source.slice(processorStart, processorEnd);

  assert.match(processorSource, /sampleRate: source\.sampleRate \|\| 44100/);
  assert.match(source, /async function processAudioChunk\(source, chunk, sampleRate\)/);
  assert.match(source, /const sourceWithRate = sampleRate/);
});
