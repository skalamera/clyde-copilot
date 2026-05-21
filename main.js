const { app, BrowserWindow, ipcMain, desktopCapturer, screen, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const axios = require('axios');
const log = require('electron-log');

// Configure electron-log
log.transports.file.level = 'info';
console.log = log.info;
console.error = log.error;
console.warn = log.warn;

require('dotenv').config({ path: path.join(__dirname, '.env') });

const { createAudioCapture } = require('./src/audioCapture');
const { createAudioEngineSidecar, resolveAudioEnginePath } = require('./src/audioEngineSidecar');
const { calculatePcmRms, createTranscriptionProcessor } = require('./src/transcriptionClient');
const { createMeetingAssistant } = require('./src/meetingAssistant');
const { createInterviewManager } = require('./src/interviewManager');
const { createSessionManager } = require('./src/sessionManager');
const { createKnowledgeManager } = require('./src/knowledgeManager');
const { createMockInterviewManager } = require('./src/mockInterviewManager');
const { createCalendarStore } = require('./src/calendarStore');
const { createAgentChat } = require('./src/agentChat');
const { createAgentActionRegistry } = require('./src/agentActionRegistry');
const { createGoogleClient } = require('./src/googleClient');
const { createGoogleSyncService } = require('./src/googleSyncService');
const { createSyncStore } = require('./src/syncStore');
const { refreshSystemKnowledge } = require('./src/systemKnowledge');
const { generateChat } = require('./src/llmClient');
const {
    buildTranscriptCleanupPrompt,
    normalizeCleanedTranscriptResponse,
    transcriptToText
} = require('./src/transcriptCleanup');
const {
    buildMeetingPostProcessPrompt,
    normalizeMeetingPostProcessResponse
} = require('./src/meetingPostProcessing');
const { startAutoUpdater } = require('./src/autoUpdater');
const { resolveElectronStoragePaths } = require('./src/electronStoragePaths');
const { buildTrendAnalysisSessionSignature, directAddressFeedback, isTrendAnalysisComplete, normalizeTranscriptRating, normalizeTrendAnalysisResult } = require('./src/trendAnalysis');
const { deleteTrendAnalysis, loadTrendAnalysis, renameTrendAnalysis, saveTrendAnalysis } = require('./src/trendAnalysisStore');
const { calculateEntityConfidence } = require('./src/confidenceScoring');
const {
    buildOutcomeCalibrationExamples,
    formatOutcomeCalibrationExamples,
    summarizeOutcomeCalibrationExamples
} = require('./src/outcomeLearning');

let mainWindow;
let normalBounds = null;
let appWindowMinimized = false;
let appWindowNormalBounds = null;
let activeCaptureWindow = false;
let activeCaptureMinimized = false;
let suppressActiveBoundsSave = false;
let suppressAppBoundsSave = false;
let capturePaused = false;
let audioCaptureRunning = false;
let audioCaptures;
let audioLevelCaptures;
let transcriptionProcessors;
let meetingAssistant;
let interviewManager;
let sessionManager;
let knowledgeManager;
let mockInterviewManager;
let calendarStore;
let agentChat;
let syncStore;
let googleClient;
let googleSyncService;
let googleSyncTimer;
let audioLevelTimer;
let liveAudioLevelTimer;
let liveAudioLevels;
let audioEngineSidecar;
let rustAudioLevelTestLevels;
let healthCheckTimer;

let fullSessionTranscript = [];

const ACTIVE_CAPTURE_DEFAULT_WIDTH = 460;
const ACTIVE_CAPTURE_MAX_HEIGHT = 760;
const ACTIVE_CAPTURE_MARGIN = 20;
const ACTIVE_CAPTURE_MIN_WIDTH = 72;
const ACTIVE_CAPTURE_MIN_HEIGHT = 72;
const ACTIVE_CAPTURE_FULL_MIN_WIDTH = 360;
const ACTIVE_CAPTURE_FULL_MIN_HEIGHT = 160;
const ACTIVE_CAPTURE_MINIMIZED_SIZE = 112;
const ACTIVE_CAPTURE_MINIMIZED_MARGIN = 10;
const APP_WINDOW_MINIMIZED_SIZE = 96;
const APP_WINDOW_MINIMIZED_MARGIN = 12;

const healthState = {
    audio: { state: 'unknown', label: 'Audio', detail: 'Not checked yet.' },
    whisper: { state: 'unknown', label: 'Transcription', detail: 'Not checked yet.' },
    lmStudio: { state: 'unknown', label: 'Assistant LLM', detail: 'Not checked yet.' },
    capture: { state: 'idle', label: 'Capture', detail: 'Stopped.' }
};

function isOpenAiTranscriptionProvider(provider) {
    return provider === 'openai' || provider === 'openai-realtime-whisper';
}

function shouldUseRustAudioEngine(settings = loadSettings()) {
    return (settings.audioEngine || (process.platform === 'win32' ? 'rust' : 'legacy')) === 'rust';
}

function getGoogleOAuthClientId() {
    const clientId = String(process.env.CLYDE_GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim();
    if (!clientId) {
        throw new Error('Clyde Google OAuth client ID is not configured.');
    }
    return clientId;
}

function getGoogleOAuthClientSecret() {
    return String(process.env.CLYDE_GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim();
}

function configureElectronStorage() {
    const { sessionDataPath } = resolveElectronStoragePaths(app.getPath('userData'));

    fs.mkdirSync(sessionDataPath, { recursive: true });
    app.setPath('sessionData', sessionDataPath);
}

function loadSettings() {
    const Store = require('electron-store').default || require('electron-store');
    const store = new Store();
    
    let settings = {
        llmProvider: store.get('llmProvider', 'local'),
        llmModel: store.get('llmModel', ''),
        llmApiKey: store.get('llmApiKey', ''),
        localLlmUrl: store.get('localLlmUrl', 'http://localhost:1234/v1/chat/completions'),
        transcriptionProvider: store.get('transcriptionProvider', 'local'),
        transcriptionApiKey: store.get('transcriptionApiKey', ''),
        localTranscriptionUrl: store.get('localTranscriptionUrl', 'http://localhost:8000/v1/audio/transcriptions'),
        audioEngine: store.get('audioEngine', process.platform === 'win32' ? 'rust' : 'legacy'),
        microphoneDeviceId: store.get('microphoneDeviceId', ''),
        systemAudioDeviceId: store.get('systemAudioDeviceId', ''),
        jobDescription: store.get('jobDescription', ''),
        resumeText: store.get('resumeText', ''),
        currentCompany: store.get('currentCompany', ''),
        currentRole: store.get('currentRole', ''),
        geminiApiKey: store.get('geminiApiKey', ''),
        pineconeApiKey: store.get('pineconeApiKey', ''),
        pineconeHost: store.get('pineconeHost', ''),
        ragEnabled: store.get('ragEnabled', false),
        userTier: process.env.CLYDE_USER_TIER || store.get('userTier', 'free'),
        proAgentEnabled: store.get('proAgentEnabled', false),
        proRealtimeModel: store.get('proRealtimeModel', 'gpt-realtime-2'),
        embeddingProvider: store.get('embeddingProvider', 'gemini'),
        embeddingModel: store.get('embeddingModel', 'gemini-embedding-2'),
        embeddingApiKey: store.get('embeddingApiKey', ''),
        pineconeNamespace: store.get('pineconeNamespace', 'clyde-pro-knowledge'),
        pinnedKnowledgeIds: store.get('pinnedKnowledgeIds', []),
        googleSyncEnabled: store.get('googleSyncEnabled', false),
        googleAccountEmail: store.get('googleAccountEmail', ''),
        googleSyncAutoApprove: store.get('googleSyncAutoApprove', false),
        googleSyncPollMinutes: store.get('googleSyncPollMinutes', 15),
        appMode: store.get('appMode', 'interview'),
        meetingTitle: store.get('meetingTitle', ''),
        meetingAttendees: store.get('meetingAttendees', []),
        meetingMemory: store.get('meetingMemory', ''),
        captureProtectionEnabled: store.get('captureProtectionEnabled', true),
        uiOpacity: store.get('uiOpacity', 100),
        activeCaptureBounds: store.get('activeCaptureBounds', null)
    };

    // Fallbacks from env if settings aren't populated
    if (!settings.localLlmUrl) settings.localLlmUrl = process.env.LM_STUDIO_CHAT_URL || 'http://localhost:1234/v1/chat/completions';
    if (!settings.localTranscriptionUrl) settings.localTranscriptionUrl = process.env.LM_STUDIO_API_URL || 'http://localhost:8000/v1/audio/transcriptions';
    if (!settings.llmModel && settings.llmProvider === 'local') settings.llmModel = process.env.LM_STUDIO_CHAT_MODEL || '';
    if (!settings.geminiApiKey) settings.geminiApiKey = process.env.GEMINI_API_KEY || '';
    if (!settings.pineconeApiKey) settings.pineconeApiKey = process.env.PINECONE_API_KEY || '';
    if (!settings.pineconeHost) settings.pineconeHost = process.env.PINECONE_HOST || '';
    
    // Inject back into process.env so existing modules (like pineconeClient.js) can read them
    if (settings.geminiApiKey) process.env.GEMINI_API_KEY = settings.geminiApiKey;
    if (settings.pineconeApiKey) process.env.PINECONE_API_KEY = settings.pineconeApiKey;
    if (settings.pineconeHost) process.env.PINECONE_HOST = settings.pineconeHost;

    return settings;
}

function saveSettings(newSettings) {
    const Store = require('electron-store').default || require('electron-store');
    const store = new Store();
    const { googleOAuthClientId: _legacyGoogleOAuthClientId, ...settingsToStore } = newSettings || {};
    
    store.delete('googleOAuthClientId');
    store.set(settingsToStore);
    applyCaptureProtection(settingsToStore);
    
    // Update process.env immediately
    if (settingsToStore.geminiApiKey) process.env.GEMINI_API_KEY = settingsToStore.geminiApiKey;
    
    if ((settingsToStore.ragEnabled || settingsToStore.userTier === 'pro') && settingsToStore.pineconeApiKey) {
        process.env.PINECONE_API_KEY = settingsToStore.pineconeApiKey;
    } else {
        delete process.env.PINECONE_API_KEY;
    }
    
    if ((settingsToStore.ragEnabled || settingsToStore.userTier === 'pro') && settingsToStore.pineconeHost) {
        process.env.PINECONE_HOST = settingsToStore.pineconeHost;
    } else {
        delete process.env.PINECONE_HOST;
    }

    // Re-initialize clients with new settings
    if (meetingAssistant) {
        meetingAssistant = createMeetingAssistant({
            settings: settingsToStore,
            intervalMs: Number(process.env.LM_STUDIO_ASSISTANT_INTERVAL_MS || 30000),
            utteranceSettleMs: Number(process.env.CLYDE_INTENT_UTTERANCE_SETTLE_MS || 700),
            maxTurns: Number(process.env.LM_STUDIO_ASSISTANT_MAX_TURNS || 6),
            maxTokens: Number(process.env.LM_STUDIO_ASSISTANT_MAX_TOKENS || 800),
            timeout: Number(process.env.LM_STUDIO_ASSISTANT_TIMEOUT_MS || 60000),
            axiosClient: axios,
            logger: console,
            knowledgeManager,
            sendStatus: sendAudioStatus,
            sendUpdate: sendAssistantUpdate
        });
        meetingAssistant.setContext(buildAssistantContext(settingsToStore));
    }

    if (interviewManager) {
        interviewManager = createInterviewManager({
            appPath: app.getPath('userData'),
            axiosClient: axios,
            settings: settingsToStore,
            onStatus: sendAudioStatus
        });
    }

    // Force health recheck
    checkServiceHealth(settingsToStore);
    startGoogleSyncTimer(settingsToStore);
}

function applyCaptureProtection(settings = {}) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    if (process.platform !== 'win32' && process.platform !== 'darwin') {
        return;
    }

    try {
        mainWindow.setContentProtection(Boolean(settings.captureProtectionEnabled));
    } catch (error) {
        console.warn('Failed to apply screen capture protection:', error);
    }
}

function getOutcomeCalibrationExamples(entity = {}) {
    return buildOutcomeCalibrationExamples({
        sessionManager,
        currentEntityId: entity.id || entity.name || '',
        role: entity.role || '',
        limit: 4
    });
}

function buildOutcomeCalibrationSection(entity = {}) {
    try {
        const examples = getOutcomeCalibrationExamples(entity);

        return formatOutcomeCalibrationExamples(examples)
            || 'Real outcome calibration examples:\nNone available yet. Use the standard rubric without local calibration.';
    } catch (error) {
        console.warn('Failed to build outcome calibration examples:', error);
        return 'Real outcome calibration examples:\nNone available yet. Use the standard rubric without local calibration.';
    }
}

function buildOutcomeCalibrationSummary(entity = {}) {
    try {
        return summarizeOutcomeCalibrationExamples(getOutcomeCalibrationExamples(entity));
    } catch (error) {
        console.warn('Failed to build outcome calibration summary:', error);
        return summarizeOutcomeCalibrationExamples([]);
    }
}

function getSettingsStore() {
    const Store = require('electron-store').default || require('electron-store');
    return new Store();
}

async function archiveSessionKnowledge(record, settings = loadSettings()) {
    if (!knowledgeManager || !recordHasTranscript(record)) {
        return null;
    }

    try {
        return await knowledgeManager.archiveSession(record, settings);
    } catch (error) {
        console.warn('Failed to archive session in knowledge base:', error);
        return null;
    }
}

async function backfillKnowledgeFromSessions(settings = loadSettings()) {
    if (!knowledgeManager || !sessionManager) {
        return { ok: false, count: 0 };
    }

    let count = 0;
    for (const mode of ['interview', 'meeting']) {
        const sessions = sessionManager.getSessions({ mode });
        for (const session of sessions) {
            if (!recordHasTranscript(session)) {
                continue;
            }

            const archived = await archiveSessionKnowledge(session, settings);
            if (archived) {
                count += 1;
            }
        }
    }

    return { ok: true, count };
}

function recordHasTranscript(record) {
    return Boolean(record && Array.isArray(record.transcript) && record.transcript.length > 0);
}

function getTierStatus() {
    const settings = loadSettings();
    const tier = settings.userTier === 'pro' ? 'pro' : 'free';
    return {
        tier,
        userTier: tier,
        pro: tier === 'pro',
        proAgentEnabled: Boolean(settings.proAgentEnabled)
    };
}

function getPinnedKnowledgeIds(settings = loadSettings()) {
    return Array.isArray(settings.pinnedKnowledgeIds)
        ? settings.pinnedKnowledgeIds.slice(0, 3)
        : [];
}

function normalizeWindowBounds(bounds) {
    if (!bounds || typeof bounds !== 'object') {
        return null;
    }

    const normalized = {
        x: Number(bounds.x),
        y: Number(bounds.y),
        width: Number(bounds.width),
        height: Number(bounds.height)
    };

    return Object.values(normalized).every(Number.isFinite) ? normalized : null;
}

function clampBoundsToDisplay(bounds, display) {
    const workArea = display.workArea;
    const width = Math.max(
        ACTIVE_CAPTURE_MIN_WIDTH,
        Math.min(Math.round(bounds.width), workArea.width)
    );
    const height = Math.max(
        ACTIVE_CAPTURE_MIN_HEIGHT,
        Math.min(Math.round(bounds.height), workArea.height)
    );
    const x = Math.max(
        workArea.x,
        Math.min(Math.round(bounds.x), workArea.x + workArea.width - width)
    );
    const y = Math.max(
        workArea.y,
        Math.min(Math.round(bounds.y), workArea.y + workArea.height - height)
    );

    return { x, y, width, height };
}

function defaultActiveCaptureBounds(sourceBounds) {
    const display = screen.getDisplayMatching(sourceBounds);
    const workArea = display.workArea;
    const width = Math.min(ACTIVE_CAPTURE_DEFAULT_WIDTH, workArea.width);
    const height = Math.min(ACTIVE_CAPTURE_MAX_HEIGHT, workArea.height - ACTIVE_CAPTURE_MARGIN * 2);

    return {
        x: Math.round(workArea.x + workArea.width - width - ACTIVE_CAPTURE_MARGIN),
        y: Math.round(workArea.y + Math.max(ACTIVE_CAPTURE_MARGIN, (workArea.height - height) / 2)),
        width: Math.round(width),
        height: Math.round(Math.max(ACTIVE_CAPTURE_MIN_HEIGHT, height))
    };
}

function getSavedActiveCaptureBounds() {
    const saved = normalizeWindowBounds(getSettingsStore().get('activeCaptureBounds', null));
    if (!saved || saved.width < ACTIVE_CAPTURE_FULL_MIN_WIDTH || saved.height < ACTIVE_CAPTURE_FULL_MIN_HEIGHT) {
        return null;
    }

    return saved;
}

function saveActiveCaptureBounds(bounds) {
    const normalized = normalizeWindowBounds(bounds);
    if (!normalized) {
        return;
    }

    getSettingsStore().set('activeCaptureBounds', normalized);
}

function enterActiveCaptureWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    const currentBounds = mainWindow.getBounds();
    if (!activeCaptureWindow) {
        normalBounds = currentBounds;
    }

    const display = screen.getDisplayMatching(currentBounds);
    const savedBounds = getSavedActiveCaptureBounds();
    const nextBounds = clampBoundsToDisplay(savedBounds || defaultActiveCaptureBounds(currentBounds), display);

    activeCaptureWindow = true;
    activeCaptureMinimized = false;
    suppressActiveBoundsSave = true;
    if (typeof mainWindow.setMinimumSize === 'function') {
        mainWindow.setMinimumSize(ACTIVE_CAPTURE_MIN_WIDTH, ACTIVE_CAPTURE_MIN_HEIGHT);
    }
    mainWindow.setResizable(true);
    mainWindow.setBounds(nextBounds);
    setTimeout(() => {
        suppressActiveBoundsSave = false;
        saveActiveCaptureBounds(mainWindow.getBounds());
    }, 250);

    mainWindow.setIgnoreMouseEvents(false);
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    if (typeof mainWindow.setHasShadow === 'function') {
        mainWindow.setHasShadow(false);
    }
    if (mainWindow.isMinimized()) {
        mainWindow.restore();
    }
    if (!mainWindow.isVisible()) {
        mainWindow.show();
    }
    mainWindow.focus();
}

function getAppMinimizedBounds(currentBounds) {
    const display = screen.getDisplayMatching(currentBounds);
    const workArea = display.workArea;
    return clampBoundsToDisplay({
        x: workArea.x + APP_WINDOW_MINIMIZED_MARGIN,
        y: workArea.y + workArea.height - APP_WINDOW_MINIMIZED_SIZE - APP_WINDOW_MINIMIZED_MARGIN,
        width: APP_WINDOW_MINIMIZED_SIZE,
        height: APP_WINDOW_MINIMIZED_SIZE
    }, display);
}

function minimizeAppWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return false;
    }

    const currentBounds = mainWindow.getBounds();
    if (!appWindowMinimized) {
        appWindowNormalBounds = currentBounds;
    }

    const nextBounds = getAppMinimizedBounds(currentBounds);
    appWindowMinimized = true;
    suppressAppBoundsSave = true;
    if (typeof mainWindow.setMinimumSize === 'function') {
        mainWindow.setMinimumSize(APP_WINDOW_MINIMIZED_SIZE, APP_WINDOW_MINIMIZED_SIZE);
    }
    mainWindow.setResizable(false);
    mainWindow.setBounds(nextBounds);
    mainWindow.setIgnoreMouseEvents(false);
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    if (typeof mainWindow.setHasShadow === 'function') {
        mainWindow.setHasShadow(false);
    }
    if (mainWindow.isMinimized()) {
        mainWindow.restore();
    }
    if (!mainWindow.isVisible()) {
        mainWindow.show();
    }
    setTimeout(() => {
        suppressAppBoundsSave = false;
    }, 250);

    return true;
}

function restoreAppWindowBounds() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return false;
    }

    if (appWindowMinimized && appWindowNormalBounds) {
        suppressAppBoundsSave = true;
        if (typeof mainWindow.setMinimumSize === 'function') {
            mainWindow.setMinimumSize(ACTIVE_CAPTURE_MIN_WIDTH, ACTIVE_CAPTURE_MIN_HEIGHT);
        }
        mainWindow.setResizable(true);
        mainWindow.setBounds(appWindowNormalBounds);
        appWindowNormalBounds = null;
        setTimeout(() => {
            suppressAppBoundsSave = false;
        }, 250);
    }

    appWindowMinimized = false;
    mainWindow.setIgnoreMouseEvents(false);
    mainWindow.setAlwaysOnTop(false);
    if (typeof mainWindow.setHasShadow === 'function') {
        mainWindow.setHasShadow(true);
    }

    return true;
}

function restoreNormalWindowBounds() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    if (activeCaptureWindow && !activeCaptureMinimized) {
        saveActiveCaptureBounds(mainWindow.getBounds());
    }

    activeCaptureWindow = false;
    activeCaptureMinimized = false;
    suppressActiveBoundsSave = true;
    if (typeof mainWindow.setMinimumSize === 'function') {
        mainWindow.setMinimumSize(ACTIVE_CAPTURE_MIN_WIDTH, ACTIVE_CAPTURE_MIN_HEIGHT);
    }
    mainWindow.setResizable(true);
    if (normalBounds) {
        mainWindow.setBounds(normalBounds);
        normalBounds = null;
    }
    setTimeout(() => {
        suppressActiveBoundsSave = false;
    }, 250);

    mainWindow.setIgnoreMouseEvents(false);
    mainWindow.setAlwaysOnTop(false);
    if (typeof mainWindow.setHasShadow === 'function') {
        mainWindow.setHasShadow(true);
    }
}

function resizeActiveCaptureWindowToContent(size = {}) {
    if (!activeCaptureWindow || !mainWindow || mainWindow.isDestroyed()) {
        return false;
    }

    const currentBounds = mainWindow.getBounds();
    const display = screen.getDisplayMatching(currentBounds);
    const workArea = display.workArea;
    const minimized = Boolean(size.minimized);
    const restore = Boolean(size.restore);
    const width = Number.isFinite(Number(size.width))
        ? Number(size.width)
        : currentBounds.width;
    const height = Number.isFinite(Number(size.height))
        ? Number(size.height)
        : currentBounds.height;
    const nextWidth = minimized
        ? ACTIVE_CAPTURE_MINIMIZED_SIZE
        : Math.min(width, ACTIVE_CAPTURE_DEFAULT_WIDTH);
    const nextHeight = minimized
        ? ACTIVE_CAPTURE_MINIMIZED_SIZE
        : Math.min(height, workArea.height - ACTIVE_CAPTURE_MARGIN);
    const nextX = minimized
        ? workArea.x + ACTIVE_CAPTURE_MINIMIZED_MARGIN
        : restore
            ? workArea.x + Math.round((workArea.width - nextWidth) / 2)
            : currentBounds.x;
    const nextY = minimized
        ? workArea.y + workArea.height - nextHeight - ACTIVE_CAPTURE_MINIMIZED_MARGIN
        : restore
            ? workArea.y + ACTIVE_CAPTURE_MARGIN
            : currentBounds.y;

    activeCaptureMinimized = minimized ? true : false;
    if (typeof mainWindow.setMinimumSize === 'function') {
        const minSize = minimized ? ACTIVE_CAPTURE_MINIMIZED_SIZE : ACTIVE_CAPTURE_MIN_WIDTH;
        mainWindow.setMinimumSize(minSize, minSize);
    }
    mainWindow.setResizable(true);
    const nextBounds = clampBoundsToDisplay({
        x: nextX,
        y: nextY,
        width: nextWidth,
        height: nextHeight
    }, display);

    if (Math.abs(nextBounds.width - currentBounds.width) < 4
        && Math.abs(nextBounds.height - currentBounds.height) < 4
        && nextBounds.x === currentBounds.x
        && nextBounds.y === currentBounds.y) {
        mainWindow.setResizable(!minimized);
        return true;
    }

    suppressActiveBoundsSave = true;
    mainWindow.setBounds(nextBounds);
    mainWindow.setResizable(!minimized);
    setTimeout(() => {
        suppressActiveBoundsSave = false;
    }, 250);

    return true;
}

function moveAppWindowTo(bounds = {}) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return false;
    }

    const currentBounds = mainWindow.getBounds();
    const width = appWindowMinimized ? APP_WINDOW_MINIMIZED_SIZE : currentBounds.width;
    const height = appWindowMinimized ? APP_WINDOW_MINIMIZED_SIZE : currentBounds.height;
    const targetPoint = {
        x: Number.isFinite(Number(bounds.x)) ? Number(bounds.x) + Math.round(width / 2) : currentBounds.x + Math.round(width / 2),
        y: Number.isFinite(Number(bounds.y)) ? Number(bounds.y) + Math.round(height / 2) : currentBounds.y + Math.round(height / 2)
    };
    const display = screen.getDisplayNearestPoint(targetPoint);
    const nextBounds = clampBoundsToDisplay({
        x: Number.isFinite(Number(bounds.x)) ? Number(bounds.x) : currentBounds.x,
        y: Number.isFinite(Number(bounds.y)) ? Number(bounds.y) : currentBounds.y,
        width,
        height
    }, display);

    suppressAppBoundsSave = true;
    mainWindow.setBounds(nextBounds);
    if (appWindowMinimized) {
        mainWindow.setResizable(false);
    }
    setTimeout(() => {
        suppressAppBoundsSave = false;
    }, 120);

    return true;
}

/**
 * Creates the audio recording controller without starting SoX.
 */
function initializeAudioCaptures(settings = loadSettings()) {
    if (audioCaptures) {
        return audioCaptures;
    }

    audioCaptures = getAudioSources(settings).map((source) => createAudioCapture({
        env: process.env,
        logger: console,
        recordOptions: {
            device: source.device
        },
        processAudioChunk: (chunk) => processAudioChunk(source, chunk),
        onStatus: (status) => sendSourceAudioStatus(source, status)
    }));

    return audioCaptures;
}

function getAudioSources(settings = loadSettings()) {
    if (shouldUseRustAudioEngine(settings)) {
        return getRustAudioSources(settings);
    }

    const configured = process.env.CLYDE_AUDIO_SOURCES;

    if (!configured) {
        return [{
            id: 'default',
            label: 'Transcription API',
            device: process.env.CLYDE_AUDIO_DEVICE,
            color: '#d8bfd8'
        }];
    }

    return configured
        .split(';')
        .map((source, index) => {
            const [label, device, color] = source.split('|').map((part) => part && part.trim());

            return {
                id: `source-${index}`,
                label: label || `Source ${index + 1}`,
                device,
                color: color || '#d8bfd8'
            };
        })
        .filter((source) => source.device);
}

function getRustAudioSources(settings = loadSettings()) {
    return [
        {
            id: 'you',
            label: 'You',
            device: settings.microphoneDeviceId || 'Default microphone',
            color: '#8fff5f',
            sampleRate: 48000
        },
        {
            id: 'others',
            label: 'System Audio',
            device: settings.systemAudioDeviceId || 'Default system audio',
            color: '#89c2ff',
            sampleRate: 48000
        }
    ];
}

function getRustAudioEngineSidecar() {
    if (audioEngineSidecar) {
        return audioEngineSidecar;
    }

    audioEngineSidecar = createAudioEngineSidecar({
        appPath: __dirname,
        isPackaged: app.isPackaged,
        logger: console,
        onAudioChunk: async (event) => {
            try {
                await processAudioChunk(event.source, event.chunk, event.sampleRate);
            } catch (error) {
                console.error('Rust audio engine chunk processing failed:', error);
            }
        },
        onLevel: (event) => {
            updateLiveAudioLevelFromRms(event.source, event.rms, event.peak);
            updateRustAudioLevelTest(event);
        },
        onStatus: (status) => {
            if (status && status.message) {
                sendAudioStatus(status);
            }
        },
        onError: (error) => {
            updateHealth('capture', {
                state: 'error',
                detail: error && error.message ? error.message : 'Rust audio engine failed.'
            });
        }
    });

    return audioEngineSidecar;
}

async function startRustAudioEngineCapture(settings = loadSettings()) {
    audioEngineSidecar = getRustAudioEngineSidecar();
    const startResult = audioEngineSidecar.start();

    if (!startResult.ok) {
        return startResult;
    }

    const captureResult = audioEngineSidecar.startCapture({
        microphoneDeviceId: settings.microphoneDeviceId || '',
        systemAudioDeviceId: settings.systemAudioDeviceId || ''
    });

    if (!captureResult.ok) {
        return captureResult;
    }

    audioCaptures = [{
        pause: () => audioEngineSidecar.pause(),
        resume: () => audioEngineSidecar.resume(),
        stop: () => audioEngineSidecar.stop()
    }];

    return { ok: true };
}

function stopRustAudioEngineCapture() {
    if (audioEngineSidecar) {
        audioEngineSidecar.shutdown();
        audioEngineSidecar = null;
    }
    rustAudioLevelTestLevels = null;
}

function sendSourceAudioStatus(source, status) {
    if (!status || !status.message) {
        sendAudioStatus(status);
        return;
    }

    updateHealth('capture', {
        state: status.state === 'error' ? 'error' : status.state === 'capturing' ? 'ready' : 'idle',
        detail: `${source.label}: ${status.message}`
    });

    if (status.state === 'error' || status.state === 'warning') {
        sendAudioStatus({
            ...status,
            message: `${source.label}: ${status.message}`
        });
    }
}

function sendTranscriptionStatus(source, status) {
    if (!status || !status.message) {
        return;
    }

    if (status.state === 'error' || status.state === 'warning') {
        sendSourceAudioStatus(source, status);
    }
}

function sendAudioStatus(status) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    mainWindow.webContents.send('audio-status', status);
}

function sendSessionDataChanged(change = {}) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    mainWindow.webContents.send('session-data-changed', change);
}

function refreshSystemKnowledgeFromState(reason = 'system-refresh') {
    if (!knowledgeManager || !sessionManager || !calendarStore) {
        return Promise.resolve([]);
    }
    const settings = loadSettings();
    return refreshSystemKnowledge({
        settings,
        sessionManager,
        calendarStore,
        knowledgeManager,
        activeInterviewId: settings.currentCompany || ''
    }).catch((error) => {
        console.warn(`System knowledge refresh failed (${reason}):`, error);
        return [];
    });
}

function notifyDataChanged(change = {}) {
    sendSessionDataChanged(change);
    refreshSystemKnowledgeFromState(change.reason || 'data-changed');
}

function getCurrentAgentContext() {
    const settings = loadSettings();
    const mode = settings.appMode === 'meeting' ? 'meeting' : 'interview';
    if (mode === 'meeting') {
        return {
            mode,
            entityId: settings.meetingTitle || '',
            entityName: settings.meetingTitle || ''
        };
    }
    return {
        mode,
        entityId: settings.currentCompany || '',
        entityName: settings.currentCompany || '',
        role: settings.currentRole || ''
    };
}

function getActiveEntityFiles(settings = loadSettings()) {
    if (!knowledgeManager || typeof knowledgeManager.listEntityKnowledge !== 'function') {
        return [];
    }
    const mode = settings.appMode === 'meeting' ? 'meeting' : 'interview';
    const entityId = mode === 'meeting' ? settings.meetingTitle : settings.currentCompany;
    if (!entityId) {
        return [];
    }
    return knowledgeManager.listEntityKnowledge({ mode, entityId }).slice(0, 5);
}

function buildAssistantContext(settings = loadSettings()) {
    const activeJd = (interviewManager && settings.currentCompany) ? interviewManager.getCompanyJobDescription(settings.currentCompany) : '';
    return {
        mode: settings.appMode || 'interview',
        jobDescription: activeJd,
        resumeText: settings.resumeText || '',
        company: settings.currentCompany || '',
        role: settings.currentRole || '',
        meetingTitle: settings.meetingTitle || '',
        attendees: Array.isArray(settings.meetingAttendees) ? settings.meetingAttendees : [],
        memory: settings.meetingMemory || '',
        entityFiles: getActiveEntityFiles(settings)
    };
}

function createActionRegistry() {
    return createAgentActionRegistry({
        sessionManager,
        interviewManager,
        calendarStore,
        loadSettings,
        saveSettings,
        getActiveContext: getCurrentAgentContext,
        emitChange: notifyDataChanged,
        emitCalendarChanged: (change) => notifyDataChanged({ ...change, reason: change.reason || 'calendar-changed' })
    });
}

function getAgentChat() {
    if (agentChat) {
        return agentChat;
    }

    const actionRegistry = createActionRegistry();

    agentChat = createAgentChat({
        settings: loadSettings(),
        knowledgeManager,
        sessionManager,
        calendarStore,
        actionRegistry,
        axiosClient: axios,
        generateChat
    });

    return agentChat;
}

function getGoogleTokens() {
    const store = getSettingsStore();
    return store.get('googleTokens', null);
}

function saveGoogleTokens(tokens = {}) {
    const current = getGoogleTokens() || {};
    getSettingsStore().set('googleTokens', {
        ...current,
        ...tokens,
        refresh_token: tokens.refresh_token || current.refresh_token || ''
    });
}

function clearGoogleTokens() {
    getSettingsStore().delete('googleTokens');
}

async function getGoogleAccessToken(settings = loadSettings()) {
    const tokens = getGoogleTokens();
    if (!tokens?.refresh_token && !tokens?.access_token) {
        throw new Error('Google is not connected.');
    }
    const expiresAt = tokens.expires_at ? new Date(tokens.expires_at).getTime() : 0;
    if (tokens.access_token && expiresAt > Date.now() + 60000) {
        return tokens.access_token;
    }
    const refreshed = await googleClient.refreshAccessToken({
        clientId: getGoogleOAuthClientId(),
        clientSecret: getGoogleOAuthClientSecret(),
        refreshToken: tokens.refresh_token
    });
    saveGoogleTokens(refreshed);
    return refreshed.access_token;
}

function getGoogleSyncStatus() {
    const settings = loadSettings();
    const tokens = getGoogleTokens();
    return {
        connected: Boolean(tokens?.refresh_token || tokens?.access_token),
        enabled: Boolean(settings.googleSyncEnabled),
        accountEmail: settings.googleAccountEmail || '',
        autoApprove: Boolean(settings.googleSyncAutoApprove),
        pollMinutes: Number(settings.googleSyncPollMinutes || 15) || 15,
        pendingCount: syncStore ? syncStore.listProposals({ status: 'pending' }).length : 0
    };
}

async function runGoogleSyncScan({ manual = false, gmailLimit, calendarLimit } = {}) {
    const settings = loadSettings();
    if (!googleSyncService || !syncStore) {
        throw new Error('Google sync is not ready.');
    }
    if (!manual && !settings.googleSyncEnabled) {
        return [];
    }
    const accessToken = await getGoogleAccessToken(settings);
    const scanSettings = {
        ...settings,
        ...(gmailLimit ? { googleSyncGmailLimit: Number(gmailLimit) } : {}),
        ...(calendarLimit ? { googleSyncCalendarLimit: Number(calendarLimit) } : {})
    };
    const proposals = await googleSyncService.scan({ accessToken, settings: scanSettings });
    if (settings.googleSyncAutoApprove) {
        const pending = syncStore.listProposals({ status: 'pending' });
        for (const proposal of pending) {
            await approveSyncProposal({ proposalId: proposal.id, autoApproved: true });
        }
    }
    notifyDataChanged({ reason: 'google-sync-scanned' });
    return proposals;
}

async function approveSyncProposal({ proposalId, completedAction, autoApproved = false } = {}) {
    const proposal = syncStore && syncStore.getProposal(proposalId);
    if (!proposal) {
        return { ok: false, changed: false, message: 'Sync proposal not found.' };
    }
    const action = completedAction || proposal.action;
    const result = await createActionRegistry().confirmAction(action);
    if (result?.needsInput) {
        syncStore.addAudit({
            type: 'sync-approval',
            status: 'needs-input',
            message: result.message,
            proposalId: proposal.id,
            source: proposal.source,
            action,
            result
        });
        return { ...result, proposal };
    }
    syncStore.markProposal(proposal.id, result.ok ? 'approved' : 'failed', result);
    syncStore.addAudit({
        type: 'sync-approval',
        status: result.ok ? 'success' : 'failed',
        message: result.message || proposal.summary,
        proposalId: proposal.id,
        source: proposal.source,
        action,
        result,
        autoApproved,
        read: !autoApproved
    });
    notifyDataChanged({ reason: 'google-sync-proposal-applied' });
    return result;
}

function dismissSyncProposal(proposalId) {
    const proposal = syncStore && syncStore.getProposal(proposalId);
    if (!proposal) {
        return false;
    }
    const updated = syncStore.markProposal(proposal.id, 'dismissed', { ok: true });
    syncStore.addAudit({
        type: 'sync-dismiss',
        status: 'dismissed',
        message: proposal.summary,
        proposalId: proposal.id,
        source: proposal.source,
        action: proposal.action
    });
    notifyDataChanged({ reason: 'google-sync-proposal-dismissed' });
    return Boolean(updated);
}

function startGoogleSyncTimer(settings = loadSettings()) {
    if (googleSyncTimer) {
        clearInterval(googleSyncTimer);
        googleSyncTimer = null;
    }
    if (!settings.googleSyncEnabled) {
        return;
    }
    const minutes = Math.max(1, Number(settings.googleSyncPollMinutes || 15) || 15);
    googleSyncTimer = setInterval(() => {
        runGoogleSyncScan().catch((error) => {
            syncStore?.addAudit({
                type: 'sync-scan',
                status: 'failed',
                message: error.message
            });
            console.warn('Google sync scan failed:', error);
        });
    }, minutes * 60 * 1000);
}

function startGoogleSyncOnLaunch(settings = loadSettings()) {
    if (!settings.googleSyncEnabled) {
        return;
    }
    const tokens = getGoogleTokens();
    if (!tokens?.refresh_token && !tokens?.access_token) {
        return;
    }
    setTimeout(() => {
        runGoogleSyncScan({ gmailLimit: 50, calendarLimit: 50 }).catch((error) => {
            syncStore?.addAudit({
                type: 'sync-scan',
                status: 'failed',
                message: error.message
            });
            console.warn('Google sync startup scan failed:', error);
        });
    }, 1500);
}

function updateHealth(key, next) {
    healthState[key] = {
        ...healthState[key],
        ...next
    };
    sendHealthUpdate();
}

function sendHealthUpdate() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    mainWindow.webContents.send('health-update', healthState);
}

async function checkServiceHealth(settings = loadSettings()) {
    await Promise.all([
        checkWhisperHealth(settings),
        checkLmStudioHealth(settings)
    ]);

    checkRustAudioEngineHealth(settings);
    sendHealthUpdate();
}

function checkRustAudioEngineHealth(settings = loadSettings()) {
    if (!shouldUseRustAudioEngine(settings)) {
        checkAudioHealth(settings);
        return;
    }

    const enginePath = resolveAudioEnginePath({ appPath: __dirname, isPackaged: app.isPackaged });
    const enginePresent = fs.existsSync(enginePath);
    const mic = settings.microphoneDeviceId || 'Default microphone';
    const systemAudio = settings.systemAudioDeviceId || 'Default system audio';

    updateHealth('audio', {
        state: enginePresent ? 'ready' : 'warning',
        detail: enginePresent
            ? `Rust audio engine ready. Mic: ${mic} | System audio: ${systemAudio}.`
            : `Rust audio engine missing at ${enginePath}. Install Rust and run npm run audio-engine:build.`
    });
}

function checkAudioHealth(settings = loadSettings()) {
    const sources = getAudioSources(settings);

    updateHealth('audio', {
        state: sources.length ? 'ready' : 'error',
        detail: sources.length
            ? `${sources.map((source) => `${source.label}: ${source.device}`).join(' | ')}`
            : 'No audio sources configured.'
    });
}

async function checkWhisperHealth(settings) {
    if (isOpenAiTranscriptionProvider(settings.transcriptionProvider)) {
        const detail = settings.transcriptionProvider === 'openai-realtime-whisper'
            ? 'Using OpenAI Realtime Whisper.'
            : 'Using OpenAI Cloud Transcription API.';
        updateHealth('whisper', { state: 'ready', detail });
        return;
    }

    const transcriptionUrl = settings.localTranscriptionUrl;

    if (!transcriptionUrl) {
        updateHealth('whisper', { state: 'error', detail: 'Local transcription URL is not set.' });
        return;
    }

    try {
        const baseUrl = new URL(transcriptionUrl);
        const docsUrl = `${baseUrl.origin}/docs`;
        await axios.get(docsUrl, { timeout: 2000 });

        updateHealth('whisper', {
            state: 'ready',
            detail: `${docsUrl} is reachable. Model warms on first transcription.`
        });
    } catch (error) {
        updateHealth('whisper', {
            state: 'error',
            detail: `Cannot reach local whisper at ${transcriptionUrl}: ${formatServiceError(error)}`
        });
    }
}

async function checkLmStudioHealth(settings) {
    if (settings.llmProvider !== 'local') {
        updateHealth('lmStudio', { state: 'ready', detail: `Using Cloud LLM: ${settings.llmProvider} (${settings.llmModel})` });
        return;
    }

    const chatUrl = settings.localLlmUrl;
    const model = settings.llmModel;

    if (!chatUrl || !model) {
        updateHealth('lmStudio', {
            state: 'warning',
            detail: 'Local Assistant LLM is not configured properly.'
        });
        return;
    }

    try {
        const baseUrl = new URL(chatUrl);
        const modelsUrl = `${baseUrl.origin}/v1/models`;
        const response = await axios.get(modelsUrl, { timeout: 2000 });
        const models = Array.isArray(response.data && response.data.data)
            ? response.data.data.map((item) => item.id)
            : [];
        const hasModel = models.includes(model);

        updateHealth('lmStudio', {
            state: hasModel ? 'ready' : 'warning',
            detail: hasModel
                ? `${model} is available at ${baseUrl.origin}.`
                : `${baseUrl.origin} is reachable, but ${model} was not listed.`
        });
    } catch (error) {
        updateHealth('lmStudio', {
            state: 'error',
            detail: `Cannot reach local LLM at ${chatUrl}: ${formatServiceError(error)}`
        });
    }
}

function formatServiceError(error) {
    if (error && error.code) {
        return error.code;
    }

    if (error && error.message) {
        return error.message;
    }

    return 'unknown error';
}

function sendTranscriptUpdate(transcript) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    if (transcript && transcript.partial) {
        mainWindow.webContents.send('transcript-update', transcript);
        return;
    }

    // Append to the full session transcript for saving later
    if (transcript && transcript.text) {
        const speaker = transcript.speaker || 'Unknown';
        const text = String(transcript.text).trim();
        
        if (fullSessionTranscript.length > 0 && fullSessionTranscript[fullSessionTranscript.length - 1].speaker === speaker) {
            fullSessionTranscript[fullSessionTranscript.length - 1].text += ' ' + text;
        } else {
            fullSessionTranscript.push({
                speaker: speaker,
                text: text
            });
        }
    }

    mainWindow.webContents.send('transcript-update', transcript);
    getMeetingAssistant().addTranscript(transcript);
}

function sendAssistantUpdate(update) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    const cards = Array.isArray(update?.cards) ? update.cards : [];
    log.info(`Assistant update: ${cards.length} cards`);
    mainWindow.webContents.send('assistant-update', update);
}

function sendAudioLevelUpdate(update) {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    mainWindow.webContents.send('audio-level-update', update);
}

async function captureDesktopScreenshot() {
    const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1600, height: 1000 }
    });

    const source = sources
        .filter((item) => item && item.thumbnail && !item.thumbnail.isEmpty())
        .sort((left, right) => {
            const leftSize = left.thumbnail.getSize();
            const rightSize = right.thumbnail.getSize();
            return (rightSize.width * rightSize.height) - (leftSize.width * leftSize.height);
        })[0];

    if (!source) {
        throw new Error('No screen source was available.');
    }

    return {
        mimeType: 'image/png',
        data: source.thumbnail.toPNG().toString('base64')
    };
}

function getMeetingAssistant() {
    if (meetingAssistant) {
        return meetingAssistant;
    }

    const settings = loadSettings();

    meetingAssistant = createMeetingAssistant({
        settings,
        intervalMs: Number(process.env.LM_STUDIO_ASSISTANT_INTERVAL_MS || 30000),
        utteranceSettleMs: Number(process.env.CLYDE_INTENT_UTTERANCE_SETTLE_MS || 700),
        maxTurns: Number(process.env.LM_STUDIO_ASSISTANT_MAX_TURNS || 6),
        maxTokens: Number(process.env.LM_STUDIO_ASSISTANT_MAX_TOKENS || 800),
        timeout: Number(process.env.LM_STUDIO_ASSISTANT_TIMEOUT_MS || 60000),
        axiosClient: axios,
        logger: console,
        knowledgeManager,
        sendStatus: sendAudioStatus,
        sendUpdate: sendAssistantUpdate
    });
    
    meetingAssistant.setContext(buildAssistantContext(settings));

    return meetingAssistant;
}

function getTranscriptionProcessor(source) {
    if (!transcriptionProcessors) {
        transcriptionProcessors = new Map();
    }

    if (transcriptionProcessors.has(source.id)) {
        return transcriptionProcessors.get(source.id);
    }

    const settings = loadSettings();

    const processor = createTranscriptionProcessor({
        settings,
        minRms: Number(process.env.CLYDE_MIN_RMS || 100),
        hallucinationRms: Number(process.env.CLYDE_HALLUCINATION_RMS || 350),
        timeout: Number(process.env.TRANSCRIPTION_TIMEOUT_MS || 120000),
        diagnostics: process.env.CLYDE_AUDIO_DEBUG === '1',
        sourceId: source.id,
        speaker: source.label,
        speakerColor: source.color,
        sampleRate: source.sampleRate || 44100,
        axiosClient: axios,
        logger: console,
        sendStatus: (status) => sendTranscriptionStatus(source, status),
        sendTranscript: sendTranscriptUpdate
    });

    transcriptionProcessors.set(source.id, processor);
    return processor;
}

async function processAudioChunk(source, chunk, sampleRate) {
    const sourceWithRate = sampleRate
        ? { ...source, sampleRate }
        : source;
    updateLiveAudioLevel(sourceWithRate, chunk);
    await getTranscriptionProcessor(sourceWithRate).processAudioChunk(chunk);
}

function closeTranscriptionProcessors() {
    if (!transcriptionProcessors) {
        return;
    }

    for (const processor of transcriptionProcessors.values()) {
        if (processor && typeof processor.close === 'function') {
            processor.close();
        }
    }
}

function stopAudioCaptures() {
    if (audioCaptures) {
        for (const capture of audioCaptures) {
            capture.stop();
        }
        audioCaptures = null;
    }

    stopRustAudioEngineCapture();
    closeTranscriptionProcessors();
    transcriptionProcessors = null;
    meetingAssistant = null;
    stopLiveAudioLevels();
}

function startLiveAudioLevels() {
    const sources = getAudioSources();
    liveAudioLevels = new Map(sources.map((source) => [source.id, {
        label: source.label,
        color: source.color,
        rms: 0,
        level: 0,
        chunks: 0,
        speaking: false
    }]));

    if (liveAudioLevelTimer) {
        clearInterval(liveAudioLevelTimer);
    }

    liveAudioLevelTimer = setInterval(() => {
        sendAudioLevelUpdate({
            type: 'live-levels',
            sources: Array.from(liveAudioLevels.entries()).map(([id, value]) => ({
                id,
                ...value
            }))
        });
    }, 120);

    sendAudioLevelUpdate({
        type: 'live-started',
        sources: Array.from(liveAudioLevels.entries()).map(([id, value]) => ({
            id,
            ...value
        }))
    });
}

function stopLiveAudioLevels() {
    if (liveAudioLevelTimer) {
        clearInterval(liveAudioLevelTimer);
        liveAudioLevelTimer = null;
    }

    liveAudioLevels = null;
    sendAudioLevelUpdate({ type: 'live-stopped' });
}

function updateLiveAudioLevel(source, chunk) {
    if (!liveAudioLevels || !source || !chunk) {
        return;
    }

    const current = liveAudioLevels.get(source.id);

    if (!current) {
        return;
    }

    const rms = calculatePcmRms(chunk);
    current.rms = rms;
    current.level = rmsToMeterLevel(rms);
    current.chunks += 1;
    current.speaking = rms >= Number(process.env.CLYDE_VOICE_ACTIVE_RMS || 450);
}

function updateLiveAudioLevelFromRms(source, rms, peak = 0) {
    if (!liveAudioLevels || !source) {
        return;
    }

    const current = liveAudioLevels.get(source.id);

    if (!current) {
        return;
    }

    current.rms = Number(rms) || 0;
    current.peak = Number(peak) || 0;
    current.level = rmsToMeterLevel(current.rms);
    current.chunks += 1;
    current.speaking = current.rms >= Number(process.env.CLYDE_VOICE_ACTIVE_RMS || 450);
}

function updateRustAudioLevelTest(event) {
    if (!rustAudioLevelTestLevels || !event || !event.source) {
        return;
    }

    const current = rustAudioLevelTestLevels.get(event.source.id);

    if (!current) {
        return;
    }

    current.rms = Number(event.rms) || 0;
    current.peak = Number(event.peak) || 0;
    current.level = rmsToMeterLevel(current.rms);
    current.chunks += 1;
}

function startAudioLevelTest() {
    stopAudioLevelTest();

    const settings = loadSettings();
    const sources = getAudioSources(settings);
    const levels = new Map(sources.map((source) => [source.id, {
        label: source.label,
        color: source.color,
        rms: 0,
        level: 0,
        chunks: 0
    }]));

    if (shouldUseRustAudioEngine(settings)) {
        rustAudioLevelTestLevels = levels;
        const sidecar = getRustAudioEngineSidecar();
        const startResult = sidecar.start();
        const captureResult = startResult.ok
            ? sidecar.startCapture({
                microphoneDeviceId: settings.microphoneDeviceId || '',
                systemAudioDeviceId: settings.systemAudioDeviceId || ''
            })
            : startResult;

        if (!captureResult.ok) {
            sendAudioLevelUpdate({ type: 'error', message: captureResult.message });
            stopAudioLevelTest();
            return;
        }

        audioLevelCaptures = [{
            stop: () => sidecar.stop()
        }];
        audioLevelTimer = setInterval(() => {
            sendAudioLevelUpdate({
                type: 'levels',
                sources: Array.from(levels.entries()).map(([id, value]) => ({
                    id,
                    ...value
                }))
            });
        }, 150);
        sendAudioLevelUpdate({
            type: 'started',
            sources: Array.from(levels.entries()).map(([id, value]) => ({
                id,
                ...value
            }))
        });
        return;
    }

    audioLevelCaptures = sources.map((source) => createAudioCapture({
        env: process.env,
        logger: console,
        recordOptions: {
            device: source.device
        },
        onStatus: (status) => sendAudioLevelUpdate({
            type: 'status',
            sourceId: source.id,
            label: source.label,
            status
        }),
        processAudioChunk: (chunk) => {
            const rms = calculatePcmRms(chunk);
            const current = levels.get(source.id);

            current.rms = rms;
            current.level = rmsToMeterLevel(rms);
            current.chunks += 1;
        }
    }));

    const results = audioLevelCaptures.map((capture) => capture.start());
    const failed = results.find((result) => !result.ok);

    if (failed) {
        sendAudioLevelUpdate({ type: 'error', message: failed.message });
        stopAudioLevelTest();
        return;
    }

    audioLevelTimer = setInterval(() => {
        sendAudioLevelUpdate({
            type: 'levels',
            sources: Array.from(levels.entries()).map(([id, value]) => ({
                id,
                ...value
            }))
        });
    }, 150);

    sendAudioLevelUpdate({
        type: 'started',
        sources: Array.from(levels.entries()).map(([id, value]) => ({
            id,
            ...value
        }))
    });
}

function stopAudioLevelTest() {
    if (audioLevelTimer) {
        clearInterval(audioLevelTimer);
        audioLevelTimer = null;
    }

    if (audioLevelCaptures) {
        for (const capture of audioLevelCaptures) {
            capture.stop();
        }
        audioLevelCaptures = null;
    }

    rustAudioLevelTestLevels = null;
    sendAudioLevelUpdate({ type: 'stopped' });
}

function rmsToMeterLevel(rms) {
    if (!rms || rms <= 0) {
        return 0;
    }

    return Math.max(0, Math.min(100, Math.round((20 * Math.log10(rms / 32768) + 60) / 60 * 100)));
}

function createWindow () {
  log.info('🪟 createWindow() - Creating BrowserWindow');
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    show: true,
    icon: getAppIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  log.info(`✅ BrowserWindow created. Visible: ${mainWindow.isVisible()}`);

  const settings = loadSettings();
  applyCaptureProtection(settings);

  const rendererIndex = path.join(__dirname, 'src', 'renderer-dist', 'index.html');
  const legacyRendererIndex = path.join(__dirname, 'src', 'index.html');
  const filePath = fs.existsSync(rendererIndex) ? rendererIndex : legacyRendererIndex;
  log.info(`📄 Loading renderer from: ${filePath}`);
  mainWindow.loadFile(filePath);

  mainWindow.webContents.on('did-finish-load', () => {
      log.info(`🔄 did-finish-load event. Window visible: ${mainWindow.isVisible()}`);
      if (!mainWindow.isVisible()) {
          log.info('📢 Window not visible, calling show()');
          mainWindow.show();
          log.info(`✅ show() called. Now visible: ${mainWindow.isVisible()}`);
      }
      
      // Enable DevTools for debugging
      log.info('🔧 Opening DevTools for debugging...');
      mainWindow.webContents.openDevTools({ mode: 'detach' });
      
      sendAudioStatus({ state: 'idle', message: 'Ready. Press Start to begin.' });
      checkServiceHealth(loadSettings());
      healthCheckTimer = setInterval(() => checkServiceHealth(loadSettings()), Number(process.env.CLYDE_HEALTH_INTERVAL_MS || 10000));
  });

  interviewManager = createInterviewManager({
      appPath: app.getPath('userData'),
      axiosClient: axios,
      settings,
      onStatus: sendAudioStatus
  });

  sessionManager = createSessionManager({
      appPath: app.getPath('userData')
  });

    knowledgeManager = createKnowledgeManager({
        appPath: app.getPath('userData'),
        logger: console
    });

    mockInterviewManager = createMockInterviewManager({
        appPath: app.getPath('userData'),
        axiosClient: axios,
        knowledgeManager,
        logger: console
    });

    calendarStore = createCalendarStore({
        appPath: app.getPath('userData')
    });

    syncStore = createSyncStore({
        appPath: app.getPath('userData')
    });

    googleClient = createGoogleClient({
        axiosClient: axios,
        openExternal: (url) => shell.openExternal(url)
    });

    googleSyncService = createGoogleSyncService({
        googleClient,
        syncStore,
        sessionManager,
        calendarStore,
        axiosClient: axios
    });

    startGoogleSyncTimer(settings);
    startGoogleSyncOnLaunch(settings);

    const Store = require('electron-store').default || require('electron-store');
    const store = new Store();
    if (!store.get('knowledgeBackfillDone_v2')) {
        backfillKnowledgeFromSessions(settings).then(() => {
            store.set('knowledgeBackfillDone_v2', true);
            refreshSystemKnowledgeFromState('knowledge-backfill');
        }).catch((error) => {
            console.warn('Knowledge base backfill failed:', error);
        });
    }
    refreshSystemKnowledgeFromState('startup');

  // Setup IPC communication for start/stop transcription
  ipcMain.on('start-audio-capture', async (event) => {
      log.info('🎤 IPC: start-audio-capture received');
      log.info(`   Window state - Visible: ${mainWindow?.isVisible()}, Destroyed: ${mainWindow?.isDestroyed()}`);
      if (audioCaptureRunning) {
          sendAudioStatus({ state: 'capturing', message: 'Audio capture is already running.' });
          enterActiveCaptureWindow();
          return;
      }

      fullSessionTranscript = []; // Reset full session transcript on new start
      capturePaused = false;
      getMeetingAssistant(); // ensure initialized
      const settings = loadSettings();
      startLiveAudioLevels();
      const failed = shouldUseRustAudioEngine(settings)
          ? await startRustAudioEngineCapture(settings).then((result) => result.ok ? null : result)
          : initializeAudioCaptures(settings).map((capture) => capture.start()).find((result) => !result.ok);

      if (failed) {
          log.error(`❌ Audio capture failed: ${failed.message}`);
          audioCaptureRunning = false;
          stopLiveAudioLevels();
          sendAudioStatus({ state: 'error', message: failed.message });
      } else {
          const sourceNames = getAudioSources().map((source) => source.label).join(' and ');
          const message = sourceNames
              ? `Capturing audio from ${sourceNames}.`
              : 'Capturing audio.';
          log.info(`✅ Audio capture started: ${message}`);

          audioCaptureRunning = true;
          sendAudioStatus({ state: 'capturing', message });
          enterActiveCaptureWindow();
          updateHealth('capture', { state: 'ready', detail: message });
      }
  });

  ipcMain.on('stop-audio-capture', () => {
      capturePaused = false;
      audioCaptureRunning = false;
      if (audioCaptures) {
          stopAudioCaptures();
          sendAudioStatus({ state: 'idle', message: 'Audio capture stopped.' });
          restoreNormalWindowBounds();
          updateHealth('capture', { state: 'idle', detail: 'Stopped.' });
      } else {
          stopLiveAudioLevels();
          sendAudioStatus({ state: 'idle', message: 'Audio capture stopped.' });
          restoreNormalWindowBounds();
      }
  });

  ipcMain.handle('toggle-pause-capture', async () => {
      if (!audioCaptures) {
          capturePaused = false;
          sendAudioStatus({ state: 'idle', message: 'Audio capture is not running.' });
          return { paused: false };
      }

      capturePaused = !capturePaused;
      const results = initializeAudioCaptures().map((capture) => (
          capturePaused && typeof capture.pause === 'function'
              ? capture.pause()
              : typeof capture.resume === 'function'
                  ? capture.resume()
                  : capture.start()
      ));
      const failed = results.find((result) => !result.ok);

      if (failed) {
          sendAudioStatus({ state: 'error', message: failed.message || 'Audio capture pause failed.' });
          return { paused: capturePaused, ok: false };
      }

      const message = capturePaused ? 'Audio capture paused.' : 'Audio capture resumed.';
      sendAudioStatus({ state: capturePaused ? 'paused' : 'capturing', message });
      updateHealth('capture', { state: capturePaused ? 'warning' : 'ready', detail: capturePaused ? 'Paused.' : 'Capturing audio.' });
      return { paused: capturePaused, ok: true };
  });

  ipcMain.on('reset-session', () => {
      fullSessionTranscript = [];
      closeTranscriptionProcessors();
      transcriptionProcessors = null;
      if (meetingAssistant) {
          meetingAssistant.resetTranscript();
      }
      
      if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('session-reset');
      }
  });

  ipcMain.on('start-audio-level-test', () => {
      startAudioLevelTest();
  });

  ipcMain.on('stop-audio-level-test', () => {
      stopAudioLevelTest();
  });

  ipcMain.handle('request-suggestion', async (event, payload = {}) => {
      let screenshot = null;
      let screenshotWarning = '';

      if (payload && payload.includeScreenshot) {
          try {
              screenshot = await captureDesktopScreenshot();
          } catch (error) {
              screenshotWarning = `Screenshot was unavailable: ${error.message}`;
          }
      }

      return getMeetingAssistant().requestSuggestion({
          prompt: payload && payload.prompt,
          screenshot,
          screenshotWarning,
          sources: payload && payload.sources,
          intent: payload && payload.intent,
          mode: payload && payload.mode
      });
  });

  ipcMain.handle('save-settings', (event, settings) => {
      saveSettings(settings);
      refreshSystemKnowledgeFromState('settings-saved');
      return true;
  });

  ipcMain.handle('load-settings', (event) => {
      return loadSettings();
  });

  ipcMain.handle('get-tier-status', () => {
      const settings = loadSettings();
      return settings.userTier === 'pro' ? 'pro' : 'free';
  });

  ipcMain.handle('get-realtime-token', async () => {
      const settings = loadSettings();
      const apiKey = settings.transcriptionApiKey || (settings.llmProvider === 'openai' ? settings.llmApiKey : '') || settings.openAiApiKey || process.env.OPENAI_API_KEY || '';
      const realtimeModel = settings.proRealtimeModel || 'gpt-realtime-2';

      if (!apiKey) {
          throw new Error('OpenAI API key is missing. Please configure it in settings to use realtime voice agents.');
      }

      const axios = require('axios');
      const crypto = require('node:crypto');
      const safetyIdentifier = crypto
          .createHash('sha256')
          .update(settings.googleAccountEmail || 'clyde-local-user')
          .digest('hex');

      try {
          const response = await axios.post('https://api.openai.com/v1/realtime/client_secrets', {
              session: {
                  type: 'realtime',
                  model: realtimeModel,
                  output_modalities: ['audio'],
                  audio: {
                      input: {
                          turn_detection: { type: 'semantic_vad' }
                      },
                      output: {
                          voice: 'marin'
                      }
                  }
              }
          }, {
              headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                  'OpenAI-Safety-Identifier': safetyIdentifier
              }
          });
          const clientSecret = response.data?.value || response.data?.client_secret?.value;
          if (!clientSecret) {
              throw new Error('Realtime client secret response did not include a token.');
          }
          return clientSecret;
      } catch (error) {
          throw new Error(`Failed to generate realtime token: ${error?.response?.data?.error?.message || error.message}`);
      }
  });

  ipcMain.handle('start-agent-chat', (event, payload = {}) => {
      return getAgentChat().startChat(payload || {});
  });

  ipcMain.handle('send-agent-chat-message', async (event, payload = {}) => {
      const settings = loadSettings();
      return getAgentChat().sendMessage({
          ...(payload || {}),
          settings,
          tier: settings.userTier === 'pro' ? 'pro' : 'free'
      });
  });

  ipcMain.handle('confirm-agent-action', async (event, payload = {}) => {
      return getAgentChat().confirmAction(payload || {});
  });

  ipcMain.handle('list-agent-sources', async (event, filters = {}) => {
      return getAgentChat().listSources(filters || {});
  });

  ipcMain.handle('load-floating-agent-prefs', () => {
      const Store = require('electron-store').default || require('electron-store');
      const store = new Store();
      return store.get('floatingAgentPrefs', { enabled: true, x: 24, y: 120, panelOpen: false });
  });

  ipcMain.handle('save-floating-agent-prefs', (event, prefs = {}) => {
      const Store = require('electron-store').default || require('electron-store');
      const store = new Store();
      const current = store.get('floatingAgentPrefs', { enabled: true, x: 24, y: 120, panelOpen: false });
      const next = {
          ...current,
          ...(prefs || {}),
          enabled: prefs.enabled !== undefined ? Boolean(prefs.enabled) : current.enabled,
          panelOpen: prefs.panelOpen !== undefined ? Boolean(prefs.panelOpen) : current.panelOpen
      };
      store.set('floatingAgentPrefs', next);
      return next;
  });

  ipcMain.handle('connect-google-sync', async () => {
      if (!googleClient) {
          throw new Error('Google sync is not ready.');
      }
      const settings = loadSettings();
      const result = await googleClient.connect({
          clientId: getGoogleOAuthClientId(),
          clientSecret: getGoogleOAuthClientSecret()
      });
      saveGoogleTokens(result.tokens);
      const nextSettings = {
          ...settings,
          googleAccountEmail: result.profile?.email || settings.googleAccountEmail || '',
          googleSyncEnabled: true
      };
      saveSettings(nextSettings);
      syncStore?.addAudit({
          type: 'google-connect',
          status: 'success',
          message: `Connected Google account ${nextSettings.googleAccountEmail || ''}`.trim()
      });
      return getGoogleSyncStatus();
  });

  ipcMain.handle('disconnect-google-sync', () => {
      const settings = loadSettings();
      clearGoogleTokens();
      saveSettings({
          ...settings,
          googleSyncEnabled: false,
          googleAccountEmail: ''
      });
      syncStore?.addAudit({
          type: 'google-disconnect',
          status: 'success',
          message: 'Disconnected Google sync.'
      });
      return getGoogleSyncStatus();
  });

  ipcMain.handle('get-google-sync-status', () => {
      return getGoogleSyncStatus();
  });

  ipcMain.handle('scan-google-sync', async () => {
      await runGoogleSyncScan({ manual: true });
      return {
          status: getGoogleSyncStatus(),
          proposals: syncStore ? syncStore.listProposals({ status: 'pending' }) : []
      };
  });

  ipcMain.handle('list-sync-proposals', (event, filters = {}) => {
      return syncStore ? syncStore.listProposals(filters || {}) : [];
  });

  ipcMain.handle('approve-sync-proposal', async (event, payload = {}) => {
      return approveSyncProposal(payload || {});
  });

  ipcMain.handle('dismiss-sync-proposal', (event, proposalId) => {
      return dismissSyncProposal(proposalId);
  });

  ipcMain.handle('list-sync-audit-log', (event, limit = 100) => {
      return syncStore ? syncStore.listAudit(limit) : [];
  });

  ipcMain.handle('mark-sync-audit-read', (event, ids = []) => {
      if (syncStore) {
          syncStore.markAuditRead(ids);
          notifyDataChanged({ reason: 'google-sync-audit-read' });
          return true;
      }
      return false;
  });

  ipcMain.handle('list-calendar-events', () => {
      return calendarStore ? calendarStore.listEvents() : [];
  });

  ipcMain.handle('save-calendar-event', (event, calendarEvent = {}) => {
      if (!calendarStore) {
          throw new Error('Calendar is not ready.');
      }
      const saved = calendarStore.saveEvent(calendarEvent || {});
      notifyDataChanged({ reason: 'calendar-changed', eventId: saved.id });
      return saved;
  });

  ipcMain.handle('delete-calendar-event', (event, id) => {
      if (!calendarStore) {
          return false;
      }
      const deleted = calendarStore.deleteEvent(id);
      notifyDataChanged({ reason: 'calendar-changed', eventId: id });
      return deleted;
  });

  ipcMain.handle('import-calendar-events', (event, events = []) => {
      if (!calendarStore) {
          return [];
      }
      const imported = calendarStore.importEvents(events);
      notifyDataChanged({ reason: 'calendar-changed' });
      return imported;
  });

  ipcMain.handle('list-knowledge', (event, filters = {}) => {
      return knowledgeManager ? knowledgeManager.listKnowledge(filters || {}) : [];
  });

  ipcMain.handle('ingest-knowledge-file', async (event, filePath) => {
      if (!knowledgeManager) {
          throw new Error('Knowledge base is not ready.');
      }

      return knowledgeManager.ingestFile(filePath, loadSettings());
  });

  ipcMain.handle('upload-knowledge-to-pinecone', async (event, id) => {
        if (!knowledgeManager) {
            throw new Error('Knowledge base is not ready.');
        }

        return knowledgeManager.uploadToPinecone(id, loadSettings());
    });

    ipcMain.handle('generate-mock-interview-assessment', async (event, payload = {}) => {
        if (!mockInterviewManager) {
            throw new Error('Mock interview manager is not ready.');
        }

        return mockInterviewManager.generateAssessment(payload || {}, loadSettings());
    });

    ipcMain.handle('save-mock-interview', async (event, payload = {}) => {
        if (!mockInterviewManager) {
            throw new Error('Mock interview manager is not ready.');
        }

        const saved = await mockInterviewManager.saveMockInterview(payload || {}, loadSettings());
        notifyDataChanged({
            mode: 'interview',
            entityId: saved.opportunity?.id,
            reason: 'mock-interview-saved'
        });
        return saved;
    });

    ipcMain.handle('list-mock-interviews', () => {
        return mockInterviewManager ? mockInterviewManager.listMockInterviews() : [];
    });

    ipcMain.handle('delete-mock-interview', async (event, id) => {
        if (!mockInterviewManager) {
            return false;
        }

        const deleted = await mockInterviewManager.deleteMockInterview(id, loadSettings());
        if (deleted) {
            notifyDataChanged({ mode: 'interview', reason: 'mock-interview-deleted' });
        }
        return deleted;
    });

    ipcMain.handle('delete-knowledge-item', async (event, id) => {
        if (!knowledgeManager) {
            return false;
        }

        return knowledgeManager.deleteKnowledgeItem(id, loadSettings());
    });

  ipcMain.handle('set-pinned-knowledge', (event, ids = []) => {
      const settings = loadSettings();
      const pinnedKnowledgeIds = Array.isArray(ids) ? ids.filter(Boolean).slice(0, 3) : [];
      const nextSettings = {
          ...settings,
          pinnedKnowledgeIds
      };
      saveSettings(nextSettings);
      return knowledgeManager ? knowledgeManager.getPinnedKnowledge(pinnedKnowledgeIds) : [];
  });

  ipcMain.handle('get-pinned-knowledge', () => {
      const ids = getPinnedKnowledgeIds();
      return knowledgeManager ? knowledgeManager.getPinnedKnowledge(ids) : [];
  });

  ipcMain.handle('open-knowledge-file-dialog', async () => {
      if (!knowledgeManager) {
          return [];
      }

      const result = await dialog.showOpenDialog(mainWindow, {
          title: 'Add knowledge files',
          properties: ['openFile', 'multiSelections'],
          filters: [
              { name: 'Knowledge files', extensions: ['txt', 'md', 'pdf'] }
          ]
      });

      if (result.canceled || !result.filePaths?.length) {
          return [];
      }

      const settings = loadSettings();
      const ingested = [];
      for (const filePath of result.filePaths) {
          ingested.push(await knowledgeManager.ingestFile(filePath, settings));
      }
      return ingested;
  });

  ipcMain.handle('open-entity-file-dialog', async (event, context = {}) => {
      if (!knowledgeManager) {
          return [];
      }
      const mode = context.mode === 'meeting' ? 'meeting' : 'interview';
      const entityId = String(context.entityId || '').trim();
      if (!entityId) {
          throw new Error('Entity is required for pinned files.');
      }

      const result = await dialog.showOpenDialog(mainWindow, {
          title: mode === 'meeting' ? 'Add meeting files' : 'Add opportunity files',
          properties: ['openFile', 'multiSelections'],
          filters: [
              { name: 'Knowledge files', extensions: ['txt', 'md', 'pdf'] }
          ]
      });

      if (result.canceled || !result.filePaths?.length) {
          return [];
      }

      const settings = loadSettings();
      const ingested = [];
      for (const filePath of result.filePaths) {
          ingested.push(await knowledgeManager.ingestFile(filePath, settings, {
              mode,
              entityId,
              entityName: context.entityName || entityId
          }));
      }
      if (meetingAssistant) {
          meetingAssistant.setContext(buildAssistantContext(loadSettings()));
      }
      return ingested;
  });

  ipcMain.handle('list-entity-files', (event, context = {}) => {
      if (!knowledgeManager?.listEntityKnowledge) {
          return [];
      }
      return knowledgeManager.listEntityKnowledge({
          mode: context.mode === 'meeting' ? 'meeting' : 'interview',
          entityId: context.entityId || ''
      });
  });

  ipcMain.handle('remove-entity-file', async (event, id) => {
      if (!knowledgeManager) {
          return false;
      }
      const deleted = await knowledgeManager.deleteKnowledgeItem(id, loadSettings());
      if (meetingAssistant) {
          meetingAssistant.setContext(buildAssistantContext(loadSettings()));
      }
      return deleted;
  });

  ipcMain.handle('list-audio-devices', async () => {
      const sidecar = getRustAudioEngineSidecar();
      const startResult = sidecar.start();

      if (!startResult.ok) {
          return {
              ok: false,
              message: startResult.message,
              microphones: [],
              systemOutputs: []
          };
      }

      try {
          const devices = await sidecar.listDevices({ timeoutMs: 5000 });
          return { ok: true, ...devices };
      } catch (error) {
          return {
              ok: false,
              message: error.message,
              microphones: [],
              systemOutputs: []
          };
      }
  });

  ipcMain.handle('set-audio-devices', (event, devices = {}) => {
      const currentSettings = loadSettings();
      const nextSettings = {
          ...currentSettings,
          audioEngine: devices.audioEngine || currentSettings.audioEngine,
          microphoneDeviceId: devices.microphoneDeviceId || '',
          systemAudioDeviceId: devices.systemAudioDeviceId || ''
      };

      saveSettings(nextSettings);
      return nextSettings;
  });

  ipcMain.handle('get-companies', (event) => {
      return interviewManager.getCompanies();
  });

  ipcMain.handle('get-roles', (event) => {
      return interviewManager.getRoles();
  });

  ipcMain.handle('get-interviews', (event, company) => {
      return interviewManager.getInterviews(company);
  });

  ipcMain.handle('delete-company', (event, company) => {
      interviewManager.deleteCompany(company);
      sessionManager.deleteEntity('interview', company);
      deleteTrendAnalysis(app.getPath('userData'), company);
      return true;
  });

  ipcMain.handle('rename-company', (event, oldName, newName) => {
      interviewManager.renameCompany(oldName, newName);
      renameTrendAnalysis(app.getPath('userData'), oldName, newName);
      return true;
  });

  ipcMain.handle('set-company-role', (event, companyName, role) => {
      interviewManager.setCompanyRole(companyName, role);
      deleteTrendAnalysis(app.getPath('userData'), companyName);
      return true;
  });

  ipcMain.handle('get-company-jd', (event, companyName) => {
      return interviewManager.getCompanyJobDescription(companyName);
  });

  ipcMain.handle('set-company-jd', (event, companyName, jdText) => {
      interviewManager.setCompanyJobDescription(companyName, jdText);
      deleteTrendAnalysis(app.getPath('userData'), companyName);
      return true;
  });

  ipcMain.handle('delete-interview', (event, company, id) => {
      interviewManager.deleteInterview(company, id);
      return true;
  });

  ipcMain.handle('save-interview', (event, metadata) => {
      if (!fullSessionTranscript || fullSessionTranscript.length === 0) {
          throw new Error("No transcript data recorded.");
      }
      return interviewManager.saveInterview({ ...metadata, transcript: fullSessionTranscript });
  });

  ipcMain.handle('save-manual-interview', (event, metadata) => {
      return interviewManager.saveInterview(metadata);
  });

  ipcMain.handle('get-sessions', (event, filters) => {
      return sessionManager.getSessions(filters || {});
  });

  function refreshInterviewEntityConfidences() {
      try {
          const entities = sessionManager.getSessionEntities('interview');
          for (const entity of entities) {
              const sessions = sessionManager.getSessions({ mode: 'interview', entityId: entity.id });
              const confidence = calculateEntityConfidence(sessions, entity);
              if (entity.confidence !== confidence.confidence_score || entity.trend !== confidence.trend) {
                  sessionManager.updateEntityConfidence(entity.id, confidence.confidence_score, confidence.trend);
              }
          }
      } catch (error) {
          console.warn('Failed to refresh interview confidence scores:', error);
      }
  }

  ipcMain.handle('get-session-entities', (event, mode) => {
      const normalizedMode = mode || 'interview';
      if (normalizedMode === 'interview') {
          refreshInterviewEntityConfidences();
      }
      return sessionManager.getSessionEntities(normalizedMode);
  });

  ipcMain.handle('get-outcome-calibration-summary', (event, entity = {}) => {
      return buildOutcomeCalibrationSummary(entity);
  });

  ipcMain.handle('save-session', async (event, record) => {
      const sessionId = sessionManager.saveSession(record || {});
      
      // If it's an interview session that needs grading, trigger background grading
      const hasTranscript = record && Array.isArray(record.transcript) && record.transcript.length > 0;
      const isInterviewSession = record && record.mode === 'interview' && record.entity;
      const currentSettings = loadSettings();
      if (hasTranscript) {
         archiveSessionKnowledge(record, currentSettings).catch(console.error);
      }
      if (isInterviewSession) {
         deleteTrendAnalysis(app.getPath('userData'), record.entity.id);
         sendSessionDataChanged({
             mode: 'interview',
             entityId: record.entity.id,
             reason: 'session-saved'
         });
         refreshSystemKnowledgeFromState('session-saved');
      }

      if (isInterviewSession && record.grading && record.grading.status === 'pending' && hasTranscript) {
         processInterviewCleanupAndGradingInBackground(sessionId, record, currentSettings).catch(console.error);
      } else if (record && record.mode === 'meeting' && hasTranscript) {
         await processMeetingCleanupAndNotesInBackground(sessionId, record, currentSettings);
      } else if (isInterviewSession && !hasTranscript) {
         sessionManager.updateEntityConfidence(record.entity.id, 0, 'neutral');
      } else if (isInterviewSession && hasTranscript) {
         processSessionConfidenceInBackground(record.entity, loadSettings()).catch(console.error);
      }
      
      return sessionId;
  });

  async function processInterviewCleanupAndGradingInBackground(sessionId, record, settings) {
      try {
          const cleanedTranscript = await processTranscriptCleanupInBackground(record, settings);
          const nextRecord = cleanedTranscript && cleanedTranscript.length
              ? { ...record, transcript: cleanedTranscript }
              : record;

          if (cleanedTranscript && cleanedTranscript.length) {
              sessionManager.saveSession(nextRecord);
              await archiveSessionKnowledge(nextRecord, settings);
          }

          await processSessionGradingInBackground(sessionId, nextRecord, settings);
      } catch (error) {
          console.error("Transcript cleanup failed", error);
          await processSessionGradingInBackground(sessionId, record, settings);
      }
  }

  async function processMeetingCleanupAndNotesInBackground(sessionId, record, settings) {
      try {
          const processed = await processMeetingPostProcessing(record, settings);
          if (!processed) {
              return;
          }

          const processedRecord = {
              ...record,
              transcript: processed.transcript,
              notes: processed.notes
          };
          sessionManager.saveSession(processedRecord);
          await archiveSessionKnowledge(processedRecord, settings);
      } catch (error) {
          console.error(`Meeting post-processing failed for session ${sessionId}`, error);
      }
  }

  async function processTranscriptCleanupInBackground(record, settings) {
      if (!record?.transcript || record.transcript.length === 0) {
          return [];
      }

      const provider = settings.llmProvider || 'local';
      const apiKey = settings.llmApiKey || '';
      const model = settings.llmModel || '';
      const localUrl = settings.localLlmUrl;
      const prompt = buildTranscriptCleanupPrompt(record.transcript);

      const responseText = await generateChat({
          provider,
          apiKey,
          model,
          temperature: 0,
          maxTokens: 8192,
          axiosClient: axios,
          localUrl,
          jsonSchema: {
              name: 'transcript_cleanup',
              schema: {
                  type: 'object',
                  properties: {
                      transcript: {
                          type: 'array',
                          items: {
                              type: 'object',
                              properties: {
                                  speaker: { type: 'string' },
                                  text: { type: 'string' }
                              },
                              required: ['speaker', 'text'],
                              additionalProperties: false
                          }
                      }
                  },
                  required: ['transcript'],
                  additionalProperties: false
              }
          },
          messages: [{ role: 'user', content: prompt }]
      });

      const cleanedTranscript = normalizeCleanedTranscriptResponse(responseText, record.transcript);
      if (cleanedTranscript) {
          return cleanedTranscript;
      }

      try {
          console.error('Failed to parse cleaned transcript JSON:', responseText);
      } catch (_error) {}

      return null;
  }

  async function processMeetingPostProcessing(record, settings) {
      if (!record?.transcript || record.transcript.length === 0) {
          return null;
      }

      const provider = settings.llmProvider || 'local';
      const apiKey = settings.llmApiKey || '';
      const model = settings.llmModel || '';
      const localUrl = settings.localLlmUrl;
      const prompt = buildMeetingPostProcessPrompt(
          record.transcript,
          Array.isArray(record.attendees) && record.attendees.length ? record.attendees : (settings.meetingAttendees || [])
      );

      const responseText = await generateChat({
          provider,
          apiKey,
          model,
          temperature: 0,
          maxTokens: 8192,
          axiosClient: axios,
          localUrl,
          jsonSchema: {
              name: 'meeting_post_process',
              schema: {
                  type: 'object',
                  properties: {
                      transcript: {
                          type: 'array',
                          items: {
                              type: 'object',
                              properties: {
                                  speaker: { type: 'string' },
                                  text: { type: 'string' }
                              },
                              required: ['speaker', 'text'],
                              additionalProperties: false
                          }
                      },
                      notes: {
                          type: 'object',
                          properties: {
                              summary: { type: 'string' },
                              actionItems: {
                                  type: 'array',
                                  items: {
                                      type: 'object',
                                      properties: {
                                          attendee: { type: 'string' },
                                          items: {
                                              type: 'array',
                                              items: { type: 'string' }
                                          }
                                      },
                                      required: ['attendee', 'items'],
                                      additionalProperties: false
                                  }
                              }
                          },
                          required: ['summary', 'actionItems'],
                          additionalProperties: false
                      }
                  },
                  required: ['transcript', 'notes'],
                  additionalProperties: false
              }
          },
          messages: [{ role: 'user', content: prompt }]
      });

      return normalizeMeetingPostProcessResponse(responseText, record.transcript);
  }

  async function processSessionGradingInBackground(sessionId, record, settings) {
      sendAudioStatus({ state: 'processing', message: `Grading interview for ${record.entity.name}...` });

      try {
          const provider = settings.llmProvider || 'local';
          const apiKey = settings.llmApiKey || '';
          const model = settings.llmModel || '';
          const localUrl = settings.localLlmUrl;

          const transcriptText = transcriptToText(record.transcript);
          const roleStr = record.entity.role ? `\nRole/Job Title: ${record.entity.role}` : '';
          const jd = interviewManager.getCompanyJobDescription(record.entity.name) || interviewManager.getCompanyJobDescription(record.entity.id);
          const jdStr = jd ? `\nJob Description Context:\n${jd}` : '';
          const outcomeCalibrationSection = buildOutcomeCalibrationSection(record.entity);
          
          const prompt = `You are an expert technical recruiter and hiring manager. Evaluate the candidate ("You") based on the interview transcript.
          Company: ${record.entity.name}${roleStr}${jdStr}
          
          Return transcript_rating as a whole number from 0 to 5 based on this single transcript. 0 means unusable or no evidence. 1 means weak. 2 means below bar. 3 means acceptable. 4 means strong. 5 means excellent. Rate clarity, technical accuracy, conciseness, professionalism, and concrete evidence. Be strict and exact.
          Write a detailed evaluation in exactly 4 short professional sections using markdown headers: **Overall assessment:**, **Evidence:**, **Risks:**, and **Outlook:**.
          Use concrete details from the transcript. Do not write a generic one-paragraph summary. Finish every sentence. Keep examples separate from the written evaluation.
          Address the user directly as "you". Do not call the user "the candidate" or use third-person pronouns like he, she, his, or her for the user.
          Real outcome calibration examples are included below when Clyde has labeled local examples. Use them as local hiring-market context. Base this transcript rating on its own evidence.

          ${outcomeCalibrationSection}
          
          Transcript:
          ${transcriptText}`;

          const resultText = await generateChat({
              provider,
              apiKey,
              model,
              temperature: 0.2,
              maxTokens: 1800,
              axiosClient: axios,
              localUrl,
              jsonSchema: {
                  name: 'grading',
                  schema: {
                      type: 'object',
                      properties: {
                          transcript_rating: { type: 'integer', minimum: 0, maximum: 5 },
                          reasoning: { type: 'string', description: 'The detailed evaluation formatted in exactly 4 sections with markdown headers: **Overall assessment:**, **Evidence:**, **Risks:**, **Outlook:**' },
                          examples: { type: 'array', items: { type: 'string' } }
                      },
                      required: ['transcript_rating', 'reasoning', 'examples'],
                      additionalProperties: false
                  }
              },
              messages: [{ role: 'user', content: prompt }]
          });

          let gradeData = { transcript_rating: 0, reasoning: 'Failed to generate proper evaluation.', examples: [] };
          try {
              let cleanedText = resultText.trim();
              if (cleanedText.startsWith('\`\`\`json')) {
                  cleanedText = cleanedText.replace(/^\`\`\`json/g, '').replace(/\`\`\`$/g, '').trim();
              } else if (cleanedText.startsWith('\`\`\`')) {
                  cleanedText = cleanedText.replace(/^\`\`\`/g, '').replace(/\`\`\`$/g, '').trim();
              }
              gradeData = JSON.parse(cleanedText);
          } catch (e) {
              console.error("Failed to parse grading score JSON:", resultText);
          }

          // Update record and save it
          record.grading = {
              status: 'complete',
              transcriptRating: normalizeTranscriptRating(gradeData.transcript_rating),
              reasoning: directAddressFeedback(gradeData.reasoning),
              examples: Array.isArray(gradeData.examples) ? gradeData.examples.map(directAddressFeedback).filter(Boolean) : [],
              scoredAt: new Date().toISOString()
          };
          sessionManager.saveSession(record);
          await archiveSessionKnowledge(record, settings);
          deleteTrendAnalysis(app.getPath('userData'), record.entity.id);

          // Now recompute confidence score
          await processSessionConfidenceInBackground(record.entity, settings);

      } catch (error) {
          console.error("Grading processing error:", error);
          record.grading = { status: 'failed' };
          sessionManager.saveSession(record);
          await archiveSessionKnowledge(record, settings);
          deleteTrendAnalysis(app.getPath('userData'), record.entity.id);
          await processSessionConfidenceInBackground(record.entity, settings);
          sendAudioStatus({ state: 'error', message: `Grading failed for ${record.entity.name}` });
      }
  }

  async function processSessionConfidenceInBackground(entity, settings) {
      sendAudioStatus({ state: 'processing', message: `Computing confidence score for ${entity.name}...` });
      
      try {
          const allSessions = sessionManager.getSessions({ mode: 'interview', entityId: entity.id });
          if (allSessions.length === 0) {
              sendAudioStatus({ state: 'success', message: `Evaluation complete for ${entity.name}!` });
              return;
          }

          const confidence = calculateEntityConfidence(allSessions, entity);
          sessionManager.updateEntityConfidence(entity.id, confidence.confidence_score, confidence.trend);
          sendSessionDataChanged({
              mode: 'interview',
              entityId: entity.id,
              reason: 'confidence-updated'
          });
          sendAudioStatus({ state: 'success', message: `Evaluation complete for ${entity.name}!` });

      } catch (err) {
          console.error("Confidence recompute failed", err);
          sendAudioStatus({ state: 'error', message: `Confidence evaluation failed for ${entity.name}` });
      }
  }

  ipcMain.handle('delete-session', (event, payload) => {
      const nextPayload = payload || {};
      const deleted = sessionManager.deleteSession(nextPayload);

      if (nextPayload.mode === 'interview' && nextPayload.entityId) {
          deleteTrendAnalysis(app.getPath('userData'), nextPayload.entityId);
          sendSessionDataChanged({
              mode: 'interview',
              entityId: nextPayload.entityId,
              reason: 'session-deleted'
          });
          refreshSystemKnowledgeFromState('session-deleted');
          const remaining = sessionManager.getSessions({ mode: 'interview', entityId: nextPayload.entityId });
          if (remaining.length > 0) {
              processSessionConfidenceInBackground(remaining[0].entity, loadSettings()).catch(console.error);
          } else {
              sessionManager.updateEntityConfidence(nextPayload.entityId, 0, 'neutral');
              sendSessionDataChanged({
                  mode: 'interview',
                  entityId: nextPayload.entityId,
                  reason: 'confidence-reset'
              });
              refreshSystemKnowledgeFromState('confidence-reset');
          }
      }

      return deleted;
  });

  ipcMain.handle('delete-session-entity', (event, payload) => {
      const deleted = sessionManager.deleteEntity(payload && payload.mode, payload && payload.entityId);
      if (payload && payload.mode === 'interview') {
          deleteTrendAnalysis(app.getPath('userData'), payload.entityId);
      }
      notifyDataChanged({
          mode: payload && payload.mode,
          entityId: payload && payload.entityId,
          reason: 'entity-deleted'
      });
      return deleted;
  });

  ipcMain.handle('get-trend-analysis', (event, companyId) => {
      return loadTrendAnalysis(app.getPath('userData'), companyId);
  });

  ipcMain.handle('update-session-entity', (event, payload) => {
      const nextEntity = sessionManager.updateEntity(
          payload && payload.mode,
          payload && payload.entityId,
          payload && payload.patch
      );

      if (payload && payload.mode === 'interview' && payload.entityId) {
          const patch = payload.patch || {};
          deleteTrendAnalysis(app.getPath('userData'), payload.entityId);
          if (patch.role !== undefined) {
              try { interviewManager.setCompanyRole(payload.entityId, patch.role); } catch (error) { console.warn(error.message); }
          }
          const shouldRecomputeConfidence = patch.outcome !== undefined || patch.role !== undefined || patch.name !== undefined;
          if (shouldRecomputeConfidence) {
              processSessionConfidenceInBackground(nextEntity, loadSettings()).catch(console.error);
          }
      }

      notifyDataChanged({
          mode: payload && payload.mode,
          entityId: payload && payload.entityId,
          reason: 'entity-updated'
      });
      return nextEntity;
  });

  ipcMain.handle('set-active-session-context', (event, context) => {
      const settings = loadSettings();
      const nextSettings = {
          ...settings,
          appMode: context && context.mode ? context.mode : settings.appMode,
          currentCompany: context && context.company !== undefined ? context.company : settings.currentCompany,
          currentRole: context && context.role !== undefined ? context.role : settings.currentRole,
          meetingTitle: context && context.meetingTitle !== undefined ? context.meetingTitle : settings.meetingTitle,
          meetingAttendees: context && Array.isArray(context.attendees) ? context.attendees : settings.meetingAttendees,
          meetingMemory: context && context.memory !== undefined ? context.memory : settings.meetingMemory
      };

      saveSettings(nextSettings);
      if (meetingAssistant) {
          meetingAssistant.setContext(buildAssistantContext(nextSettings));
      }

      return nextSettings;
  });

  ipcMain.handle('validate-services', async (event, settingsPatch) => {
      const settings = {
          ...loadSettings(),
          ...(settingsPatch || {})
      };
      await checkServiceHealth(settings);
      return JSON.parse(JSON.stringify(healthState));
  });

  ipcMain.handle('generate-trend-analysis', async (event, companyId, options = {}) => {
      const settings = loadSettings();
      const allSessions = sessionManager.getSessions({ mode: 'interview', entityId: companyId });
      if (!allSessions || allSessions.length < 2) {
          return null;
      }

      const sortedSessions = [...allSessions].reverse();
      
      const provider = settings.llmProvider || 'local';
      const apiKey = settings.llmApiKey || '';
      const model = settings.llmModel || '';
      const localUrl = settings.localLlmUrl;

      const combinedTranscripts = sortedSessions.map((inv, idx) => `\n--- Interview ${idx + 1} (${inv.title || inv.phase || 'Phase ' + (idx+1)}) ---\n` + (inv.transcript || []).map(t => `${t.speaker}: ${t.text}`).join('\n')).join('\n');
      const companyName = sortedSessions[0].entity.name || companyId;
      const roleStr = sortedSessions[0].entity.role ? `\nRole/Job Title: ${sortedSessions[0].entity.role}` : '';
      const jd = interviewManager.getCompanyJobDescription(companyName) || interviewManager.getCompanyJobDescription(companyId);
      const jdStr = jd ? `\nJob Description Context:\n${jd}` : '';
      const outcomeCalibrationSection = buildOutcomeCalibrationSection({
          id: companyId,
          name: companyName,
          role: sortedSessions[0].entity.role || ''
      });
      const sessionsSignature = buildTrendAnalysisSessionSignature(sortedSessions);
      const persistedAnalysis = loadTrendAnalysis(app.getPath('userData'), companyId);
      const forceRegenerate = Boolean(options && options.force);

      if (
          !forceRegenerate
          && persistedAnalysis
          && persistedAnalysis.sessionsSignature === sessionsSignature
          && persistedAnalysis.sessionsCount === sortedSessions.length
          && isTrendAnalysisComplete(persistedAnalysis.analysis, sortedSessions.length)
      ) {
          return persistedAnalysis.analysis;
      }

      const prompt = `You are an expert technical recruiter analyzing a candidate's performance trend across multiple interview phases.
Company: ${companyName}${roleStr}${jdStr}

Review the transcripts of all their interviews in chronological order.
1. Determine the overall trend direction ("up", "down", "sideways").
2. Provide a structured deep dive analysis explaining EXACTLY what caused the trend (up, down, or sideways) from phase to phase. Include an executive summary, key strengths, areas for improvement, and a phase-by-phase observation. Cite specific examples.
3. Return exactly ${sortedSessions.length} phase breakdown entries, one for each interview below, in the same chronological order.
4. Return pre_call_prep with exactly 3 detailed bullets for each prep section:
   - cumulative_phase_summary: a cumulative summary of all phases and where you currently stand.
   - probable_focus: likely next-round focus areas based on prior transcripts and the job context.
   - interviewer_question_patterns: actual patterns/themes across previous interviewer questions, not exact question repeats.
   - questions_to_ask: useful questions you can ask in the next round.
Address the user directly as "you". Do not call the user "the candidate" or use third-person pronouns like he, she, his, or her for the user.
Real outcome calibration examples are included below when Clyde has labeled local examples. Use them when judging whether the trend resembles prior rejected, advanced, or offer outcomes.

${outcomeCalibrationSection}

Transcripts:
${combinedTranscripts}`;

      try {
          const response = await generateChat({
              provider,
              apiKey,
              model,
              temperature: 0.2,
              maxTokens: 2600,
              axiosClient: axios,
              localUrl,
              jsonSchema: {
                  name: 'trend_analysis',
                  schema: {
                      type: 'object',
                      properties: {
                          trend: { type: 'string', enum: ['up', 'down', 'sideways'] },
                          executive_summary: { type: 'string' },
                          key_strengths: { type: 'array', items: { type: 'string' } },
                          areas_for_improvement: { type: 'array', items: { type: 'string' } },
                          phase_breakdown: {
                              type: 'array',
                              items: {
                                  type: 'object',
                                  properties: {
                                      phase: { type: 'string' },
                                      observation: { type: 'string' }
                                  },
                                  required: ['phase', 'observation']
                              }
                          },
                          pre_call_prep: {
                              type: 'object',
                              properties: {
                                  cumulative_phase_summary: {
                                      type: 'array',
                                      minItems: 3,
                                      maxItems: 3,
                                      items: { type: 'string' }
                                  },
                                  probable_focus: {
                                      type: 'array',
                                      minItems: 3,
                                      maxItems: 3,
                                      items: { type: 'string' }
                                  },
                                  interviewer_question_patterns: {
                                      type: 'array',
                                      minItems: 3,
                                      maxItems: 3,
                                      items: { type: 'string' }
                                  },
                                  questions_to_ask: {
                                      type: 'array',
                                      minItems: 3,
                                      maxItems: 3,
                                      items: { type: 'string' }
                                  }
                              },
                              required: ['cumulative_phase_summary', 'probable_focus', 'interviewer_question_patterns', 'questions_to_ask'],
                              additionalProperties: false
                          }
                      },
                      required: ['trend', 'executive_summary', 'key_strengths', 'areas_for_improvement', 'phase_breakdown', 'pre_call_prep'],
                      additionalProperties: false
                  }
              },
              messages: [{ role: 'user', content: prompt }]
          });

          let parsed = { trend: 'sideways', executive_summary: 'Failed to generate analysis.', key_strengths: [], areas_for_improvement: [], phase_breakdown: [], pre_call_prep: {} };
          try {
              let cleanedText = response.trim();
              if (cleanedText.startsWith('\`\`\`json')) cleanedText = cleanedText.replace(/^\`\`\`json/g, '').replace(/\`\`\`$/g, '').trim();
              else if (cleanedText.startsWith('\`\`\`')) cleanedText = cleanedText.replace(/^\`\`\`/g, '').replace(/\`\`\`$/g, '').trim();
              parsed = JSON.parse(cleanedText);
          } catch(e) {
              console.error("Failed to parse trend analysis:", response);
          }
          const normalized = normalizeTrendAnalysisResult(parsed, sortedSessions);
          saveTrendAnalysis(app.getPath('userData'), companyId, {
              sessionsCount: sortedSessions.length,
              sessionsSignature,
              analysis: normalized
          });
          return normalized;
      } catch (err) {
          console.error("Trend analysis error:", err);
          return null;
      }
  });

  ipcMain.handle('extract-job-context', async (event, jobDescription) => {
      const settings = loadSettings();
      const provider = settings.llmProvider || 'local';
      const apiKey = settings.llmApiKey || '';
      const model = settings.llmModel || '';
      const localUrl = settings.localLlmUrl;

      const prompt = `You are an expert HR assistant. Your goal is to analyze the provided raw Job Description and perform two tasks:
1. Extract the primary Company Name and the Job Title/Role. If you cannot find one of them, leave it as an empty string.
2. Reorganize and structure the raw Job Description into a clean, consistent Markdown format with the following sections:
   - **Role Overview**: A brief summary of the position.
   - **Key Responsibilities**: A bulleted list of the main duties.
   - **Required Qualifications**: A bulleted list of the absolute must-have skills/experience.
   - **Preferred Qualifications**: A bulleted list of nice-to-have skills/experience (if any).

Raw Job Description:
${jobDescription}`;

      try {
          const response = await generateChat({
              provider,
              apiKey,
              model,
              temperature: 0.1,
              maxTokens: 1500, // Increased to allow formatting the full description
              axiosClient: axios,
              localUrl,
              jsonSchema: {
                  name: 'job_context',
                  schema: {
                      type: 'object',
                      properties: {
                          company: { type: 'string' },
                          role: { type: 'string' },
                          structured_description: { type: 'string', description: 'The fully reorganized and cleaned Markdown job description.' }
                      },
                      required: ['company', 'role', 'structured_description'],
                      additionalProperties: false
                  }
              },
              messages: [{ role: 'user', content: prompt }]
          });

          let parsed = { company: '', role: '', structured_description: jobDescription };
          try {
              let cleanedText = response.trim();
              if (cleanedText.startsWith('```json')) cleanedText = cleanedText.replace(/^```json/g, '').replace(/```$/g, '').trim();
              else if (cleanedText.startsWith('```')) cleanedText = cleanedText.replace(/^```/g, '').replace(/```$/g, '').trim();
              parsed = JSON.parse(cleanedText);
          } catch(e) {
              console.error("Failed to parse extracted context:", response);
          }
          return parsed;
      } catch (err) {
          console.error("Extraction error:", err);
          return { company: '', role: '', structured_description: jobDescription };
      }
  });

  mainWindow.on('resized', () => {
      if (activeCaptureWindow && !activeCaptureMinimized && !suppressActiveBoundsSave && mainWindow) {
          saveActiveCaptureBounds(mainWindow.getBounds());
      }
  });

  mainWindow.on('moved', () => {
      if (activeCaptureWindow && !activeCaptureMinimized && !suppressActiveBoundsSave && mainWindow) {
          saveActiveCaptureBounds(mainWindow.getBounds());
      }
  });

  mainWindow.on('closed', () => {
    if (healthCheckTimer) {
        clearInterval(healthCheckTimer);
        healthCheckTimer = null;
    }
    stopAudioLevelTest();
    stopLiveAudioLevels();
    stopAudioCaptures();
    mainWindow = null;
  });
}

function getAppIconPath() {
  const candidates = app.isPackaged
    ? [
        path.join(process.resourcesPath, 'icon.png'),
        path.join(__dirname, 'build', 'icon.png')
      ]
    : [
        path.join(__dirname, 'build', 'icon.png'),
        path.join(__dirname, 'clyde_ghost.svg')
      ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

app.whenReady().then(() => {
    configureElectronStorage();
    createWindow();

    startAutoUpdater({
        isPackaged: app.isPackaged,
        logger: log
    });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopAudioLevelTest();
    stopLiveAudioLevels();
    stopAudioCaptures();
    if (googleSyncTimer) {
        clearInterval(googleSyncTimer);
        googleSyncTimer = null;
    }
    app.quit();
  }
});

// Expose a simple IPC channel for initial setup if needed later
ipcMain.handle('get-system-info', async (event) => {
    return { os: process.platform, arch: process.arch };
});

ipcMain.handle('close-app', async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.close();
    }
    return true;
});

ipcMain.handle('minimize-app-window', async () => {
    return minimizeAppWindow();
});

ipcMain.handle('maximize-app-window', async () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return false;
    }

    if (appWindowMinimized) {
        restoreAppWindowBounds();
    }
    if (mainWindow.isMinimized()) {
        mainWindow.restore();
    }
    if (!mainWindow.isVisible()) {
        mainWindow.show();
    }
    if (typeof mainWindow.setMinimumSize === 'function') {
        mainWindow.setMinimumSize(ACTIVE_CAPTURE_MIN_WIDTH, ACTIVE_CAPTURE_MIN_HEIGHT);
    }
    mainWindow.setResizable(true);
    mainWindow.maximize();
    mainWindow.focus();
    return true;
});

ipcMain.handle('hide-app', async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        if (typeof mainWindow.hide === 'function') {
            mainWindow.hide();
        } else {
            mainWindow.minimize();
        }
    }
    return true;
});

ipcMain.handle('show-app', async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        if (appWindowMinimized) {
            restoreAppWindowBounds();
        }
        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }
        if (!mainWindow.isVisible()) {
            mainWindow.show();
        }
        mainWindow.focus();
    }
    return true;
});

ipcMain.handle('get-app-window-bounds', async () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return null;
    }

    return mainWindow.getBounds();
});

ipcMain.handle('move-app-window', async (event, bounds = {}) => {
    return moveAppWindowTo(bounds);
});

ipcMain.handle('resize-active-capture-window', async (event, bounds = {}) => {
    return resizeActiveCaptureWindowToContent(bounds);
});

ipcMain.handle('get-active-capture-window-bounds', async () => {
    if (!activeCaptureWindow || !mainWindow || mainWindow.isDestroyed()) {
        return null;
    }

    return mainWindow.getBounds();
});

ipcMain.handle('move-active-capture-window', async (event, bounds = {}) => {
    if (!activeCaptureWindow || !mainWindow || mainWindow.isDestroyed()) {
        return false;
    }

    const currentBounds = mainWindow.getBounds();
    const width = activeCaptureMinimized ? ACTIVE_CAPTURE_MINIMIZED_SIZE : currentBounds.width;
    const height = activeCaptureMinimized ? ACTIVE_CAPTURE_MINIMIZED_SIZE : currentBounds.height;
    const targetPoint = {
        x: Number.isFinite(Number(bounds.x)) ? Number(bounds.x) + Math.round(width / 2) : currentBounds.x + Math.round(width / 2),
        y: Number.isFinite(Number(bounds.y)) ? Number(bounds.y) + Math.round(height / 2) : currentBounds.y + Math.round(height / 2)
    };
    const display = screen.getDisplayNearestPoint(targetPoint);
    const nextBounds = clampBoundsToDisplay({
        x: Number.isFinite(Number(bounds.x)) ? Number(bounds.x) : currentBounds.x,
        y: Number.isFinite(Number(bounds.y)) ? Number(bounds.y) : currentBounds.y,
        width,
        height
    }, display);

    suppressActiveBoundsSave = true;
    mainWindow.setBounds(nextBounds);
    if (activeCaptureMinimized) {
        mainWindow.setResizable(false);
    }
    setTimeout(() => {
        suppressActiveBoundsSave = false;
    }, 120);

    return true;
});
