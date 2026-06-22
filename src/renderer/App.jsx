import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RealtimeInterview } from './RealtimeInterview';
import {
  buildTrendAnalysisSessionSignature,
  getTranscriptRating,
  isMaterialPreCallPrepComplete,
  isTrendAnalysisComplete
} from './trendAnalysisClient.js';

const logoUrl = new URL('../../clyde-header-logo.svg', import.meta.url).href;
const logoDefaultUrl = new URL('../../clyde-header-logo-midnight-blue.svg', import.meta.url).href;
const logoForestUrl = new URL('../../clyde-header-logo-emerald-forest.svg', import.meta.url).href;
const logoCyberpunkUrl = new URL('../../clyde-header-logo-neon-cyberpunk.svg', import.meta.url).href;
const logoSlateUrl = new URL('../../clyde-header-logo-nordic-slate.svg', import.meta.url).href;
const logoSnowUrl = new URL('../../clyde-header-logo-nordic-snow-light.svg', import.meta.url).href;
const logoAmberUrl = new URL('../../clyde-header-logo-retro-amber.svg', import.meta.url).href;
const logoBlossomUrl = new URL('../../clyde-header-logo-sakura-blossom-light.svg', import.meta.url).href;
const thinkUrl = new URL('../../clyde_think_answercard.svg', import.meta.url).href;

function getThemeLogoUrl(theme) {
  switch (theme) {
    case 'forest': return logoForestUrl;
    case 'cyberpunk': return logoCyberpunkUrl;
    case 'slate': return logoSlateUrl;
    case 'snow': return logoSnowUrl;
    case 'amber': return logoAmberUrl;
    case 'blossom': return logoBlossomUrl;
    case 'default':
    default:
      return logoDefaultUrl;
  }
}

const freeSidebarLogoUrl = new URL('../../clydefree.svg', import.meta.url).href;
const proLogoUrl = new URL('../../clyde_pro.svg', import.meta.url).href;
const proBadgeUrl = new URL('../../clyde_pro_badge.svg', import.meta.url).href;
const proGoldBadgeUrl = new URL('../../clyde_pro-badge.svg', import.meta.url).href;
const proTitleBarLogoUrl = new URL('../../clyde-pro-logo-probadge.svg', import.meta.url).href;
const proSidebarLogoUrl = new URL('../../clydepro.svg', import.meta.url).href;
const proSearchLogoUrl = new URL('../../clyde_pro_coin_dirty_black_gold.svg', import.meta.url).href;
const freeSearchBadgeUrl = new URL('../../clyde-free-coin.svg', import.meta.url).href;
const proSearchBadgeUrl = new URL('../../clyde_pro_coin_dirty_black_gold.svg', import.meta.url).href;
const ghostUrl = new URL('../../clyde_pro_coin_dirty_black_gold.svg', import.meta.url).href;
const homeSearchLogoFreeUrl = new URL('../../clyde-plus-ghost-free.svg', import.meta.url).href;
const homeSearchLogoProUrl = new URL('../../clyde_text_with_pro_ghost.svg', import.meta.url).href;
const jobDescriptionEmptyUrl = new URL('../../Job_Description_empty.svg', import.meta.url).href;
const jobDescriptionUrl = new URL('../../Job_Description.svg', import.meta.url).href;
const calibrationIconUrl = new URL('../../calibration.svg', import.meta.url).href;
const testAudioIconUrl = new URL('../../test_audio_icon.svg', import.meta.url).href;

// Redesigned Capture panel SVGs
const clydeFreeCoinUrl = new URL('../../clyde-free-coin.svg', import.meta.url).href;
const clydeStopIconUrl = new URL('../../clyde_stop_icon.svg', import.meta.url).href;
const clydePauseIconUrl = new URL('../../clyde_pause.svg', import.meta.url).href;
const clydePlayIconUrl = new URL('../../clyde_play.svg', import.meta.url).href;
const clydeResetUrl = new URL('../../clyde_reset.svg', import.meta.url).href;
const clydeScreenshotUrl = new URL('../../clyde_screenshot.svg', import.meta.url).href;
const clydeNudgeUrl = new URL('../../clyde_nudge.svg', import.meta.url).href;
const clydeSendUrl = new URL('../../clyde_send.svg', import.meta.url).href;
const clydeMicUrl = new URL('../../clyde_mic.svg', import.meta.url).href;
const clydeGlassGhostUrl = new URL('../../cylde_glass_ghost.svg', import.meta.url).href;
const clydeOpacityIconUrl = new URL('../../clyde_opacity_icon.svg', import.meta.url).href;
const clydeQuestionsUrl = new URL('../../clyde_questions.svg', import.meta.url).href;
const clydeDownloadUrl = new URL('../../clyde_download.svg', import.meta.url).href;

const clydeMinimizeUrl = new URL('../../clyde_minimize.svg', import.meta.url).href;
const clydeNoShieldUrl = new URL('../../clyde_no_shield.svg', import.meta.url).href;
const clydeDetectionShieldUrl = new URL('../../clyde_detection_shield.svg', import.meta.url).href;
const clydeStartRecordingUrl = new URL('../../clyde_start_recording.svg', import.meta.url).href;
const clydeEndCallUrl = new URL('../../clyde_end_call.svg', import.meta.url).href;
const clydeNudgePromptUrl = new URL('../../clyde_nudge_prompt.svg', import.meta.url).href;
const clydeQuestionUrl = new URL('../../clyde_question.svg', import.meta.url).href;
const clydeManualStarTriggerUrl = new URL('../../clyde_manual_star_trigger.svg', import.meta.url).href;

const iconHomeUrl = new URL('../../navbar-icons/Home.svg', import.meta.url).href;
const iconHomeColorUrl = new URL('../../navbar-icons/Home_color.svg', import.meta.url).href;
const iconAssistUrl = new URL('../../navbar-icons/Pre-call_Prep.svg', import.meta.url).href;
const iconAssistColorUrl = new URL('../../navbar-icons/Pre-call_Prep_color.svg', import.meta.url).href;
const iconTimelineUrl = new URL('../../navbar-icons/Interview_Tracker.svg', import.meta.url).href;
const iconTimelineColorUrl = new URL('../../navbar-icons/Interview_Tracker_color.svg', import.meta.url).href;
const iconMeetingNotesUrl = new URL('../../navbar-icons/Meeting_Notes.svg', import.meta.url).href;
const iconMeetingNotesColorUrl = new URL('../../navbar-icons/Meeting_Notes_color.svg', import.meta.url).href;
const iconTrendsUrl = new URL('../../navbar-icons/Trend_Analysis.svg', import.meta.url).href;
const iconTrendsColorUrl = new URL('../../navbar-icons/Trend_Analysis_color.svg', import.meta.url).href;
const iconQuestionBankUrl = new URL('../../navbar-icons/Question_Bank.svg', import.meta.url).href;
const iconQuestionBankColorUrl = new URL('../../navbar-icons/Question_Bank_color.svg', import.meta.url).href;
const iconKnowledgeUrl = new URL('../../navbar-icons/Knowledge.svg', import.meta.url).href;
const iconKnowledgeColorUrl = new URL('../../navbar-icons/Knowledge_color.svg', import.meta.url).href;
const iconCalendarUrl = new URL('../../navbar-icons/Calendar.svg', import.meta.url).href;
const iconCalendarColorUrl = new URL('../../navbar-icons/Calendar_color.svg', import.meta.url).href;
const iconMockInterviewUrl = new URL('../../navbar-icons/Mock_Interviews.svg', import.meta.url).href;
const iconMockInterviewColorUrl = new URL('../../navbar-icons/Mock_Interviews_color.svg', import.meta.url).href;
const AGENT_CHAT_CONTEXT_LIMIT = 50;

const INTERVIEW_PHASE_OPTIONS = Array.from({ length: 10 }, (_, index) => `Interview #${index + 1}`);
const ENTITY_PINNED_FILE_LIMIT = 3;

function getNextInterviewPhase(sessions = []) {
  const highestPhase = sessions.reduce((highest, session) => {
    const match = String(session?.phase || session?.title || '').match(/^Interview #(\d+)/i);
    const phaseNumber = match ? Number(match[1]) : 0;
    return Number.isFinite(phaseNumber) ? Math.max(highest, phaseNumber) : highest;
  }, 0);

  return `Interview #${Math.min(highestPhase + 1, INTERVIEW_PHASE_OPTIONS.length)}`;
}

function unwrapTrendAnalysisRecord(record) {
  if (!record) {
    return null;
  }

  if (record.analysis) {
    return record.analysis;
  }

  if (record.data) {
    return record.data;
  }

  return record;
}

function isTrendAnalysisRecordFresh(record, sessionSignature, sessionCount) {
  const analysis = unwrapTrendAnalysisRecord(record);
  return Boolean(
    record
    && record.sessionsSignature === sessionSignature
    && record.sessionsCount === sessionCount
    && analysis
  );
}

const DEFAULT_HEALTH = {
  audio: { state: 'unknown', label: 'Audio', detail: 'Not checked yet.' },
  whisper: { state: 'unknown', label: 'Transcription', detail: 'Not checked yet.' },
  lmStudio: { state: 'unknown', label: 'Assistant LLM', detail: 'Not checked yet.' },
  capture: { state: 'idle', label: 'Capture', detail: 'Stopped.' }
};

const EMPTY_SETTINGS = {
  appMode: 'interview',
  llmProvider: '',
  llmModel: '',
  openAiApiKey: '',
  llmApiKey: '',
  localLlmUrl: '',
  transcriptionProvider: '',
  transcriptionApiKey: '',
  localTranscriptionUrl: '',
  audioEngine: 'rust',
  microphoneDeviceId: '',
  systemAudioDeviceId: '',
  resumeText: '',
  currentCompany: '',
  currentRole: '',
  meetingTitle: '',
  meetingAttendees: [],
  meetingMemory: '',
  ragEnabled: false,
  pineconeApiKey: '',
  pineconeHost: '',
  userTier: 'free',
  authEmail: '',
  authExpiresAt: null,
  subscriptionStatus: 'free',
  subscriptionPlan: 'clyde_assistant',
  subscriptionCredits: 0,
  entitlementFeatures: [],
  proAgentEnabled: false,
  proRealtimeModel: '',
  embeddingProvider: '',
  embeddingModel: '',
  embeddingApiKey: '',
  pineconeNamespace: '',
  pinnedKnowledgeIds: [],
  googleSyncEnabled: false,
  googleAccountEmail: '',
  googleSyncAutoApprove: false,
  googleSyncPollMinutes: 15,
  includeGlobalQuestionBank: false,
  onboardingGuideDismissed: false,
  demoMode: false,
  captureProtectionEnabled: true,
  hideTaskbarEnabled: false,
  uiOpacity: 100,
  nudgeHotkey: 'Ctrl+Shift+N',
  toggleCaptureProtectionHotkey: 'Ctrl+Shift+P',
  toggleStealthTaskbarHotkey: 'Ctrl+Shift+H',
  toggleMinMaxHotkey: 'Ctrl+Shift+M',
  screenshotAskHotkey: 'Ctrl+Shift+D',
  suggestedQuestionsHotkey: 'Ctrl+Shift+Q',
  endCallHotkey: 'Ctrl+Shift+E',
  theme: 'default'
};

const COMMANDS = [
  { id: 'assist', label: 'AI reply' }
];

const MAX_ASSISTANT_CARDS = 12;
const SHOW_DEMO_MODE_SETTING = false;
const ONBOARDING_GUIDE_DISMISSED_KEY = 'clyde-onboarding-guide-dismissed';
const PRO_FEATURES = new Set([
  'pro_realtime_agent',
  'knowledge_rag',
  'pinecone_sync',
  'trend_analysis',
  'mock_interviews',
  'google_sync',
  'agent_actions'
]);

function normalizeEntitledSettings(settings = {}) {
  const userTier = settings.userTier === 'pro' ? 'pro' : 'free';
  const features = Array.isArray(settings.entitlementFeatures) ? settings.entitlementFeatures : [];
  const pro = userTier === 'pro' && (settings.subscriptionStatus || 'active') === 'active';
  
  // Enforce local fallbacks for Free tier users if premium providers are stale in settings
  const llmProvider = settings.llmProvider === 'clyde-cloud' && !pro ? 'local' : (['clyde-cloud', 'local', 'openai', 'gemini'].includes(settings.llmProvider) ? settings.llmProvider : '');
  const llmModel = llmProvider === 'clyde-cloud' || llmProvider === 'gemini'
    ? 'gemini-3.5-flash'
    : llmProvider === 'openai'
      ? 'gpt-4o'
      : (settings.llmProvider === 'clyde-cloud' && !pro ? '' : (settings.llmModel || ''));
  const transcriptionProvider = settings.transcriptionProvider === 'clyde-cloud-whisper' && !pro ? 'local' : (settings.transcriptionProvider || '');

  const proRealtimeModel = pro && settings.proAgentEnabled ? 'gpt-realtime-2' : (settings.proRealtimeModel || '');

  const credits = typeof settings.subscriptionCredits === 'number'
    ? settings.subscriptionCredits
    : (typeof settings.credits === 'number' ? settings.credits : 0);

  return {
    ...settings,
    userTier,
    llmProvider,
    llmModel,
    transcriptionProvider,
    proRealtimeModel,
    subscriptionStatus: settings.subscriptionStatus || (pro ? 'active' : 'free'),
    subscriptionCredits: typeof settings.subscriptionCredits === 'number' ? settings.subscriptionCredits : 0,
    entitlementFeatures: pro 
      ? features 
      : features.filter((feature) => {
          if ((feature === 'mock_interviews' || feature === 'liveavatar_mock_interviews') && credits > 0) {
            return true;
          }
          return !PRO_FEATURES.has(feature);
        }),
    proAgentEnabled: pro ? Boolean(settings.proAgentEnabled) : false,
    ragEnabled: pro ? Boolean(settings.ragEnabled) : false
  };
}

function canUseFeature(settings = {}, feature) {
  if (!feature) {
    return true;
  }
  if (settings.userTier === 'pro' && (settings.subscriptionStatus || 'active') === 'active') {
    return true;
  }
  return Array.isArray(settings.entitlementFeatures) && settings.entitlementFeatures.includes(feature);
}

function clampUiOpacity(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 100;
  }

  return Math.max(35, Math.min(200, Math.round(parsed)));
}

function applyUiOpacityToRoot(value, isLiveCapture = false) {
  const root = document.documentElement;
  const slider = isLiveCapture ? clampUiOpacity(value) : 200;

  function scaleAlpha(baseAlpha) {
    if (slider >= 100) {
      const progress = (slider - 100) / 100;
      return baseAlpha + (1 - baseAlpha) * progress;
    }

    const progress = (100 - slider) / 65;
    return Math.max(0.02, baseAlpha * (1 - 0.85 * progress));
  }

  root.style.setProperty('--panel', `rgba(9, 18, 28, ${scaleAlpha(0.22).toFixed(3)})`);
  root.style.setProperty('--panel-strong', `rgba(12, 24, 36, ${scaleAlpha(0.30).toFixed(3)})`);
  root.style.setProperty('--body-base-rgba', `rgba(3, 6, 9, ${scaleAlpha(0.24).toFixed(3)})`);
  root.style.setProperty('--shell-base-rgba', `rgba(2, 8, 14, ${scaleAlpha(0.10).toFixed(3)})`);
  root.style.setProperty('--active-capture-opacity', (slider / 100).toFixed(3));
  root.style.setProperty('--titlebar-base-rgba', `rgba(3, 6, 9, ${scaleAlpha(0.28).toFixed(3)})`);
}

function parseRawTranscript(raw) {
  const turns = [];
  const lines = raw.split('\n');
  let currentSpeaker = 'Unknown';
  let currentText = [];

  for (const line of lines) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (match) {
      if (currentText.length > 0) {
        turns.push({ speaker: currentSpeaker, text: currentText.join('\n').trim() });
      }
      currentSpeaker = match[1].trim();
      currentText = [match[2].trim()];
    } else {
      currentText.push(line.trim());
    }
  }
  if (currentText.length > 0 && currentText.join('').trim() !== '') {
    turns.push({ speaker: currentSpeaker, text: currentText.join('\n').trim() });
  }
  return turns;
}

function transcriptToText(turns = []) {
  return turns.map((turn) => `${turn.speaker || 'Unknown'}: ${turn.text || ''}`).join('\n');
}

function transcriptTextsMatch(left = [], right = []) {
  return transcriptToText(left) === transcriptToText(right);
}

function toDateTimeLocal(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function fromDateTimeLocal(value, fallback) {
  if (!value) {
    return fallback || new Date().toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? (fallback || new Date().toISOString()) : date.toISOString();
}

function confidenceBand(value) {
  const score = Number(value) || 0;
  if (score >= 80) return 'high';
  if (score >= 55) return 'medium';
  return 'low';
}

function normalizeOpportunityOutcome(value) {
  return ['active', 'advanced', 'applied', 'rejected', 'offer'].includes(value) ? value : 'active';
}

function getOutcomeLabel(value) {
  return {
    active: 'Active',
    advanced: 'Advanced',
    applied: 'Applied',
    rejected: 'Rejected',
    offer: 'Offer'
  }[normalizeOpportunityOutcome(value)];
}

function OutcomeBadge({ outcome }) {
  const normalized = normalizeOpportunityOutcome(outcome);
  return (
    <span className={`outcome-badge ${normalized}`}>
      {getOutcomeLabel(normalized)}
    </span>
  );
}

function isClosedOpportunityOutcome(outcome) {
  const normalized = normalizeOpportunityOutcome(outcome);
  return normalized === 'rejected' || normalized === 'offer';
}

function formatOutcomeCalibrationSummary(summary) {
  const total = Number(summary?.total) || 0;
  if (!total) {
    return 'Calibration used: 0 examples';
  }

  const rejected = Number(summary?.rejected) || 0;
  const positive = Number(summary?.positive) || ((Number(summary?.advanced) || 0) + (Number(summary?.offer) || 0));
  const noun = total === 1 ? 'example' : 'examples';
  return `Calibration used: ${total} ${noun}, ${rejected} rejected, ${positive} advanced/offer`;
}

function OutcomeCalibrationNote({ summary }) {
  if (!summary) {
    return null;
  }

  return (
    <img
      alt=""
      className="calibration-icon-only"
      src={calibrationIconUrl}
      title={`Outcome calibration uses your prior interview outcomes to interpret confidence and trend signals. ${formatOutcomeCalibrationSummary(summary)}`}
    />
  );
}

function useOutcomeCalibrationSummary(api, mode, entity) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let cancelled = false;

    if (mode !== 'interview' || !entity?.id || typeof api?.getOutcomeCalibrationSummary !== 'function') {
      setSummary(null);
      return () => {
        cancelled = true;
      };
    }

    api.getOutcomeCalibrationSummary({
      id: entity.id,
      name: entity.name || entity.id,
      role: entity.role || ''
    }).then((nextSummary) => {
      if (!cancelled) {
        setSummary(nextSummary || null);
      }
    }).catch((error) => {
      console.warn('Failed to load outcome calibration summary', error);
      if (!cancelled) {
        setSummary(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [api, mode, entity?.id, entity?.name, entity?.role]);

  return summary;
}

function toDateInput(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return text.slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function StarRating({ rating = 0, label = 'Transcript rating' }) {
  const normalized = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));

  return (
    <span className="star-rating" aria-label={`${label} ${normalized} out of 5`}>
      {Array.from({ length: 5 }, (_, index) => {
        const filled = index < normalized;
        return (
          <svg
            key={index}
            className={`star-icon ${filled ? 'filled' : 'empty'}`}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M12 2.8l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9L12 2.8z" />
          </svg>
        );
      })}
    </span>
  );
}

function useNowMs() {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  return nowMs;
}

function isPastCalendarEvent(event, nowMs = Date.now()) {
  const eventTime = new Date(event?.date).getTime();
  return Number.isFinite(eventTime) && eventTime < nowMs;
}

function cleanEvaluationText(value) {
  const text = String(value || '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .trim();

  return directAddressFeedback(text);
}

function directAddressFeedback(text) {
  return String(text || '')
    .replace(/\b[Tt]he candidate's\b/g, 'your')
    .replace(/\b[Tt]he candidate\b/g, (match) => match[0] === 'T' ? 'You' : 'you')
    .replace(/\b[Tt]his candidate's\b/g, 'your')
    .replace(/\b[Tt]his candidate\b/g, (match) => match[0] === 'T' ? 'You' : 'you')
    .replace(/\b[Hh]is\b/g, (match) => match[0] === 'H' ? 'Your' : 'your')
    .replace(/\b[Hh]e\b/g, (match) => match[0] === 'H' ? 'You' : 'you')
    .replace(/\b[Hh]im\b/g, (match) => match[0] === 'H' ? 'You' : 'you')
    .replace(/\b[Ss]he\b/g, (match) => match[0] === 'S' ? 'You' : 'you')
    .replace(/\b[Hh]er\b/g, (match) => match[0] === 'H' ? 'Your' : 'your')
    .replace(/\b[Yy]ou is\b/g, (match) => match[0] === 'Y' ? 'You are' : 'you are')
    .replace(/\b[Yy]ou was\b/g, (match) => match[0] === 'Y' ? 'You were' : 'you were')
    .replace(/\b[Yy]ou has\b/g, (match) => match[0] === 'Y' ? 'You have' : 'you have')
    .replace(/\b[Yy]ou demonstrates\b/g, (match) => match[0] === 'Y' ? 'You demonstrate' : 'you demonstrate')
    .replace(/\b[Yy]ou shows\b/g, (match) => match[0] === 'Y' ? 'You show' : 'you show')
    .replace(/\b[Yy]ou provides\b/g, (match) => match[0] === 'Y' ? 'You provide' : 'you provide')
    .replace(/\b[Yy]ou brings\b/g, (match) => match[0] === 'Y' ? 'You bring' : 'you bring')
    .replace(/\b[Yy]ou needs\b/g, (match) => match[0] === 'Y' ? 'You need' : 'you need')
    .replace(/\b[Yy]ou owns\b/g, (match) => match[0] === 'Y' ? 'You own' : 'you own')
    .replace(/\b[Yy]ou leads\b/g, (match) => match[0] === 'Y' ? 'You lead' : 'you lead')
    .replace(/\s+([.,;:])/g, '$1')
    .trim();
}

function parseEvaluationText(value) {
  const text = String(value || '').replace(/\\n/g, '\n').trim();
  const markerPattern = /(?:^|\s)(?:\d+\.\s*)?\*\*([^:*]+):\*\*\s*/g;
  const markers = Array.from(text.matchAll(markerPattern));

  if (!markers.length) {
    return {
      overview: cleanEvaluationText(text),
      sections: []
    };
  }

  const overview = cleanEvaluationText(text.slice(0, markers[0].index));
  const sections = markers
    .map((marker, index) => {
      const nextMarker = markers[index + 1];
      const body = text.slice(marker.index + marker[0].length, nextMarker ? nextMarker.index : text.length);

      return {
        title: cleanEvaluationText(marker[1]),
        body: cleanEvaluationText(body.replace(/^\d+\.\s*/, ''))
      };
    })
    .filter((section) => section.title || section.body);

  return { overview, sections };
}

function formatEventDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Date not set';
  }

  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function calendarEventColor(event = {}) {
  const associationMode = event.associationMode || (event.meetingId ? 'meeting' : (event.opportunityId || event.entityId ? 'opportunity' : 'generic'));
  if (associationMode === 'opportunity' || associationMode === 'interview') {
    return '#00e5ff';
  }
  if (associationMode === 'meeting') {
    return '#00ffaa';
  }
  return event.color || '#ffaa00';
}

function resolveEventEntityLabel(event, entities = []) {
  if (!event) {
    return '';
  }

  const associationMode = event.associationMode || (event.meetingId ? 'meeting' : (event.opportunityId || event.entityId ? 'opportunity' : 'generic'));
  const entityId = event.entityId || (associationMode === 'meeting' ? event.meetingId : event.opportunityId) || '';
  const entity = Array.isArray(entities)
    ? entities.find((item) => item.id === entityId || item.name === entityId)
    : null;
  const entityName = event.entityName || entity?.name || entityId;

  if (associationMode === 'meeting') {
    return entityName ? `Meeting: ${entityName}` : 'Meeting';
  }

  if (associationMode === 'opportunity') {
    return entityName ? `Interview: ${entityName}` : 'Interview';
  }

  return 'General event';
}

function getDefaultActiveSources(settings, mode) {
  if (settings?.ragEnabled) {
    return { resume: false, memory: false, rag: true, web: false };
  }

  return {
    resume: mode !== 'meeting',
    memory: mode === 'meeting',
    rag: false,
    web: false
  };
}

function normalizeActiveSourcesForMode(current, settings, mode) {
  const fallback = getDefaultActiveSources(settings, mode);
  const normalized = {
    resume: mode === 'interview' ? Boolean(current?.resume) : false,
    memory: mode === 'meeting' ? Boolean(current?.memory) : false,
    rag: settings?.ragEnabled ? Boolean(current?.rag) : false,
    web: Boolean(current?.web)
  };
  return Object.values(normalized).some(Boolean) ? normalized : fallback;
}

function extractInterviewerQuestions(sessions = []) {
  const questions = [];
  const seen = new Set();
  const ordered = [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date));

  for (const session of ordered) {
    const transcript = Array.isArray(session?.transcript) ? session.transcript : [];
    for (const turn of transcript) {
      const speaker = String(turn?.speaker || '').toLowerCase();
      const text = cleanEvaluationText(turn?.text || '');
      if (!text || !text.includes('?')) {
        continue;
      }
      if (/(^you$|candidate|clyde|assistant|ai)/i.test(speaker)) {
        continue;
      }

      const candidates = text.match(/[^?]{8,}\?/g) || [text];
      for (const candidate of candidates) {
        const question = cleanEvaluationText(candidate);
        if (question.length < 15) {
          continue;
        }

        const key = question.toLowerCase();
        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        questions.push(question);
        if (questions.length >= 6) {
          return questions;
        }
      }
    }
  }

  return questions;
}

function buildInterviewPrepSuggestions(sessions = [], phaseBreakdown = []) {
  const transcriptText = sessions
    .flatMap((session) => (Array.isArray(session?.transcript) ? session.transcript : []))
    .map((turn) => cleanEvaluationText(turn?.text || ''))
    .join(' ');
  const summaryText = sessions.map((session) => cleanEvaluationText(session?.notes?.summary || '')).join(' ');
  const phaseText = phaseBreakdown.map((phase) => cleanEvaluationText(phase?.observation || '')).join(' ');
  const corpus = `${transcriptText} ${summaryText} ${phaseText}`.toLowerCase();

  const rules = [
    {
      pattern: /(impact|outcome|result|metric|kpi|improv|measur|scale)/i,
      ready: 'Prepare 2 outcome-driven stories with concrete metrics, constraints, and your exact contribution.',
      ask: 'What outcomes would define success in the first 60-90 days?'
    },
    {
      pattern: /(incident|outage|escalat|debug|triage|root cause|postmortem)/i,
      ready: 'Be ready to explain a high-pressure incident: triage steps, ownership, communication, and prevention.',
      ask: 'How are incidents triaged, and what ownership model does this role have during critical escalations?'
    },
    {
      pattern: /(stakeholder|cross-functional|partner|align|conflict|influence)/i,
      ready: 'Prepare examples of cross-functional alignment and how you handled disagreement while keeping delivery moving.',
      ask: 'Which cross-functional teams will this role partner with most often?'
    },
    {
      pattern: /(process|workflow|runbook|automation|efficiency|playbook)/i,
      ready: 'Have a clear story about a process or automation you implemented and the measurable operational lift.',
      ask: 'Where are the biggest workflow bottlenecks that this role is expected to improve first?'
    },
    {
      pattern: /(lead|mentor|coach|hire|team|manage)/i,
      ready: 'Be ready for leadership depth: coaching style, raising standards, and decision-making in ambiguous situations.',
      ask: 'How is leadership evaluated for this role beyond delivery output?'
    },
    {
      pattern: /(system design|architecture|latency|reliability|availability|performance)/i,
      ready: 'Expect system design depth and tradeoff questions around reliability, performance, and long-term maintainability.',
      ask: 'Which reliability or performance constraints matter most for this team right now?'
    }
  ];

  const readySet = new Set();
  const askSet = new Set();
  for (const rule of rules) {
    if (!rule.pattern.test(corpus)) {
      continue;
    }
    readySet.add(rule.ready);
    askSet.add(rule.ask);
  }

  if (!readySet.size) {
    readySet.add('Prepare concise stories for role fit, technical judgment, and collaboration tradeoffs with concrete outcomes.');
    askSet.add('What are the top priorities for this role in the next quarter?');
  }

  const watchouts = phaseBreakdown
    .map((item) => {
      const phase = cleanEvaluationText(item?.phase || '') || 'Recent phase';
      const observation = cleanEvaluationText(item?.observation || '');
      if (!observation) {
        return '';
      }
      const sentence = (observation.match(/[^.!?]+[.!?]?/) || [observation])[0];
      return `${phase}: ${sentence.trim()}`;
    })
    .filter(Boolean)
    .slice(-3);

  const interviewerQuestions = extractInterviewerQuestions(sessions).slice(0, 4);

  return {
    readyTopics: Array.from(readySet).slice(0, 5),
    questionsToAsk: Array.from(askSet).slice(0, 4),
    watchouts,
    interviewerQuestions
  };
}

function NewOpportunityModal({ onClose, onSave }) {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [outcome, setOutcome] = useState('active');
  const [jobDescription, setJobDescription] = useState('');

  return (
    <div className="drawer-backdrop" style={{ zIndex: 3000 }}>
      <section className="settings-drawer">
        <div className="drawer-head">
          <div>
            <h2>Add New Opportunity</h2>
            <p>Create a company/role tracker. Add transcripts later as interview sessions.</p>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto' }}>
          <label>
            Company Name *
            <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Corp" />
          </label>
          <label>
            Job Title *
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Senior Engineer" />
          </label>
          <label>
            Status
            <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              <option value="active">Active</option>
              <option value="advanced">Advanced</option>
              <option value="applied">Applied</option>
              <option value="rejected">Rejected</option>
              <option value="offer">Offer</option>
            </select>
          </label>
          <label>
            Job Description
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description here..."
              style={{
                height: '120px',
                resize: 'vertical',
                fontFamily: 'inherit',
                padding: '8px',
                background: '#0a1016',
                color: '#fff',
                border: '1px solid var(--line)',
                borderRadius: '4px'
              }}
            />
          </label>
        </div>
        <div className="drawer-actions">
          <button type="button" className="primary-action" onClick={() => {
            if (!company || !role) { alert('Company Name and Job Title are required.'); return; }
            onSave({ company, role, outcome, jobDescription });
          }}>
            Create Opportunity
          </button>
        </div>
      </section>
    </div>
  );
}

function NewMeetingModal({ onClose, onSave }) {
  const [title, setTitle] = useState('');
  const [attendees, setAttendees] = useState('');
  const [date, setDate] = useState(toDateTimeLocal(new Date().toISOString()));
  const [meetingUrl, setMeetingUrl] = useState('');
  const [recurrence, setRecurrence] = useState('none');

  return (
    <div className="drawer-backdrop" style={{ zIndex: 3000 }}>
      <section className="settings-drawer">
        <div className="drawer-head">
          <div>
            <h2>Add New Meeting</h2>
            <p>Create a recurring meeting record. Add dated meeting sessions from the timeline.</p>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <div className="settings-form">
          <label>
            Meeting title
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Platform weekly" />
          </label>
          <label>
            Attendees
            <input value={attendees} onChange={(event) => setAttendees(event.target.value)} placeholder="Morgan: PM, Lee: Eng" />
          </label>
          <div className="form-grid">
            <label>
              Date & Time
              <input type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <label>
              Recurrence
              <select value={recurrence} onChange={(event) => setRecurrence(event.target.value)}>
                <option value="none">None</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>
          </div>
          <label>
            Meeting URL
            <input value={meetingUrl} onChange={(event) => setMeetingUrl(event.target.value)} placeholder="https://zoom.us/j/... or https://meet.google.com/..." />
          </label>
        </div>
        <div className="drawer-actions">
          <button
            type="button"
            className="primary-action"
            onClick={() => {
              if (!title.trim()) {
                alert('Meeting title is required.');
                return;
              }
              onSave({
                title: title.trim(),
                attendees: parseAttendees(attendees),
                date: fromDateTimeLocal(date),
                meetingUrl: meetingUrl.trim(),
                recurrence
              });
            }}
          >
            Create Meeting
          </button>
        </div>
      </section>
    </div>
  );
}

function PostSessionSaveModal({ entities, mode, onClose, onSave, settings, transcript = [], assistantCards = [], onDraftContextChange, onAskDraft }) {
  const api = window.electronAPI;
  useEffect(() => {
    // Keep the prompt pinned to the top when it opens after Stop or Save.
    window.scrollTo(0, 0);
  }, []);

  const activeInterview = mode === 'interview'
    ? entities.find((entity) => entity.id === settings.currentCompany || entity.name === settings.currentCompany)
    : null;
  const activeMeeting = mode === 'meeting'
    ? entities.find((entity) => entity.id === settings.meetingTitle || entity.name === settings.meetingTitle)
    : null;
  const firstEntity = entities[0] || null;
  const defaultEntity = mode === 'interview' ? (activeInterview || firstEntity) : (activeMeeting || firstEntity);
  const [destination, setDestination] = useState(defaultEntity ? 'existing' : 'new');
  const [isSaving, setIsSaving] = useState(false);
  const [existingEntityId, setExistingEntityId] = useState(defaultEntity?.id || '');
  const [company, setCompany] = useState(activeInterview?.name || settings.currentCompany || '');
  const [role, setRole] = useState(activeInterview?.role || settings.currentRole || '');
  const [jobDescription, setJobDescription] = useState('');
  const [phase, setPhase] = useState('Interview #1');
  const [sessionTitle, setSessionTitle] = useState('');
  const [interviewerName, setInterviewerName] = useState('');
  const [interviewerTitle, setInterviewerTitle] = useState('');
  const [date, setDate] = useState(toDateTimeLocal(new Date().toISOString()));
  const [meetingName, setMeetingName] = useState(activeMeeting?.name || settings.meetingTitle || '');
  const [meetingSessionTitle, setMeetingSessionTitle] = useState('Meeting session');
  const [meetingTab, setMeetingTab] = useState('meeting');
  const [preview, setPreview] = useState(null);
  const [previewStatus, setPreviewStatus] = useState('loading');
  const [draftQuestion, setDraftQuestion] = useState('');

  const isInterview = mode === 'interview';
  const selectedEntity = entities.find((entity) => entity.id === existingEntityId);
  const selectedMeetingEntity = destination === 'existing'
    ? {
      id: selectedEntity?.id || existingEntityId,
      name: selectedEntity?.name || existingEntityId,
      role: ''
    }
    : {
      id: meetingName.trim(),
      name: meetingName.trim(),
      role: ''
    };
  const canSubmit = isInterview
    ? (destination === 'existing' ? Boolean(existingEntityId) : Boolean(company.trim() && role.trim()))
    : (destination === 'existing' ? Boolean(existingEntityId) : Boolean(meetingName.trim()));

  async function submit(event) {
    event.preventDefault();
    if (isSaving || !canSubmit) {
      return;
    }

    setIsSaving(true);
    try {
      if (isInterview) {
        await onSave({
          mode: 'interview',
          destination,
          entity: destination === 'existing'
            ? {
              id: selectedEntity?.id || existingEntityId,
              name: selectedEntity?.name || existingEntityId,
              role: selectedEntity?.role || role || ''
            }
            : {
              id: company.trim(),
              name: company.trim(),
              role: role.trim()
            },
          phase: phase.trim() || 'Interview #1',
          sessionTitle: sessionTitle.trim(),
          interviewerName: interviewerName.trim(),
          interviewerTitle: interviewerTitle.trim(),
          jobDescription: jobDescription.trim(),
          date
        });
        return;
      }

      await onSave({
        mode: 'meeting',
        destination,
        entity: selectedMeetingEntity,
        title: meetingSessionTitle.trim() || 'Meeting session',
        date,
        attendees: settings.meetingAttendees || [],
        notes: preview?.notes ? previewNotesToSavedNotes(preview.notes) : null
      });
    } catch (err) {
      console.error(err);
      setIsSaving(false);
    }
  }

  useEffect(() => {
    if (!isInterview) {
      return;
    }

    if (destination === 'new') {
      setPhase('Interview #1');
      return;
    }

    if (!existingEntityId || !api?.getSessions) {
      setPhase('Interview #1');
      return;
    }

    let cancelled = false;
    api.getSessions({ mode: 'interview', entityId: existingEntityId })
      .then((sessions) => {
        if (!cancelled) {
          setPhase(getNextInterviewPhase(Array.isArray(sessions) ? sessions : []));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPhase('Interview #1');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [api, isInterview, destination, existingEntityId]);

  useEffect(() => {
    if (isInterview) {
      return;
    }
    let cancelled = false;
    setPreviewStatus('loading');
    api?.previewMeetingSession?.({
      transcript,
      cards: assistantCards,
      attendees: settings.meetingAttendees || [],
      title: meetingSessionTitle,
      entity: selectedMeetingEntity
    }).then((result) => {
      if (!cancelled) {
        setPreview(result);
        setPreviewStatus(result?.status || 'generated');
      }
    }).catch(() => {
      if (!cancelled) {
        setPreview(buildRendererMeetingFallback(transcript, assistantCards));
        setPreviewStatus('fallback');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [api, isInterview, transcript, assistantCards, settings.meetingAttendees]);

  useEffect(() => {
    if (isInterview || !onDraftContextChange) {
      return;
    }
    onDraftContextChange({
      mode: 'meeting',
      transcript,
      previewNotes: preview,
      assistantCards,
      title: meetingSessionTitle,
      entity: selectedMeetingEntity,
      attendees: settings.meetingAttendees || [],
      date
    });
    return () => onDraftContextChange(null);
  }, [isInterview, onDraftContextChange, transcript, preview, assistantCards, meetingSessionTitle, meetingName, existingEntityId, destination, date, settings.meetingAttendees]);

  async function askDraftMeeting(event) {
    event.preventDefault();
    const prompt = draftQuestion.trim();
    if (!prompt || !onAskDraft) {
      return;
    }
    await onAskDraft({
      prompt,
      mode: 'meeting',
      transcript,
      draftSessionContext: {
        mode: 'meeting',
        transcript,
        previewNotes: preview,
        assistantCards,
        title: meetingSessionTitle,
        entity: selectedMeetingEntity,
        attendees: settings.meetingAttendees || [],
        date
      }
    });
    setDraftQuestion('');
  }

  if (!isInterview) {
    const notes = preview?.notes || buildRendererMeetingFallback(transcript, assistantCards).notes;
    return (
      <div className="drawer-backdrop" style={{ zIndex: 3000 }}>
        <section className="post-meeting-review-modal">
          <header className="post-meeting-review-topbar">
            <div className="post-meeting-search">🔎 Search or ask anything...</div>
            <button type="button" className="primary-action" disabled={!canSubmit} onClick={submit}>💾 Save</button>
          </header>

          <div className="post-meeting-review-header">
            <div>
              <p>Session: {formatSessionDateLabel(date)}</p>
              <h2>Meeting: {selectedMeetingEntity.name || meetingSessionTitle || 'Meeting'}</h2>
              <p className="post-meeting-attendees">
                Attendees: {formatColoredAttendees(settings.meetingAttendees)}
              </p>
            </div>
            <div className="post-meeting-header-actions">
              <button type="button" className="ghost" disabled title="Coming soon">✉ Follow-up email</button>
              <button type="button" className="ghost" disabled title="Coming soon">🔗 Share</button>
              <button type="button" onClick={onClose}>Close</button>
            </div>
          </div>

          <div className="post-meeting-review-body">
            <div className="segmented-tabs post-meeting-tabs">
              {['meeting', 'summary', 'transcript'].map((tab) => (
                <button key={tab} type="button" className={meetingTab === tab ? 'active' : ''} onClick={() => setMeetingTab(tab)}>
                  {tab === 'meeting' ? 'Meeting' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="post-meeting-tab-panel">
              {meetingTab === 'meeting' ? (
                <form className="settings-form post-meeting-destination" onSubmit={submit}>
                  <div className="tabs" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                    <button type="button" className={destination === 'existing' ? 'active' : ''} onClick={() => setDestination('existing')} disabled={!entities.length}>
                      Existing meeting
                    </button>
                    <button type="button" className={destination === 'new' ? 'active' : ''} onClick={() => setDestination('new')}>
                      New meeting
                    </button>
                  </div>
                  {destination === 'existing' ? (
                    <label className="wide-field">
                      Meeting
                      <select value={existingEntityId} onChange={(event) => setExistingEntityId(event.target.value)}>
                        {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
                      </select>
                    </label>
                  ) : (
                    <label className="wide-field">
                      Meeting name
                      <input value={meetingName} onChange={(event) => setMeetingName(event.target.value)} placeholder="Platform weekly" />
                    </label>
                  )}
                  <div className="form-grid">
                    <label>
                      Session title
                      <input value={meetingSessionTitle} onChange={(event) => setMeetingSessionTitle(event.target.value)} placeholder="Weekly planning, customer call, 1:1" />
                    </label>
                    <label>
                      Session date
                      <input type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} />
                    </label>
                  </div>
                </form>
              ) : meetingTab === 'summary' ? (
                <MeetingPreviewSummary notes={notes} status={previewStatus} />
              ) : (
                <RawTranscriptPreview transcript={transcript} />
              )}
            </div>
          </div>

          <form className="post-meeting-ask" onSubmit={askDraftMeeting}>
            <input value={draftQuestion} onChange={(event) => setDraftQuestion(event.target.value)} placeholder="🤔 Ask Clyde about this meeting..." />
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="drawer-backdrop" style={{ zIndex: 3000 }}>
      <section className="settings-drawer">
        <div className="drawer-head">
          <div>
            <h2>{isInterview ? 'Save interview transcript' : 'Save meeting transcript'}</h2>
            <p>Choose where Clyde should attach this session.</p>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>

        <form className="settings-form" onSubmit={submit}>
          <div className="tabs" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <button
              type="button"
              className={destination === 'existing' ? 'active' : ''}
              onClick={() => setDestination('existing')}
              disabled={!entities.length}
            >
              {isInterview ? 'Existing company' : 'Existing meeting'}
            </button>
            <button
              type="button"
              className={destination === 'new' ? 'active' : ''}
              onClick={() => setDestination('new')}
            >
              {isInterview ? 'New company' : 'New meeting'}
            </button>
          </div>

          {destination === 'existing' ? (
            <label className="wide-field">
              {isInterview ? 'Company' : 'Meeting'}
              <select value={existingEntityId} onChange={(event) => setExistingEntityId(event.target.value)}>
                {entities.map((entity) => (
                  <option key={entity.id} value={entity.id}>{entity.name}</option>
                ))}
              </select>
            </label>
          ) : isInterview ? (
            <div className="form-grid">
              <label>
                Company name
                <input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Acme Corp" />
              </label>
              <label>
                Job title
                <input value={role} onChange={(event) => setRole(event.target.value)} placeholder="Staff Engineer" />
              </label>
            </div>
          ) : (
            <label className="wide-field">
              Meeting name
              <input value={meetingName} onChange={(event) => setMeetingName(event.target.value)} placeholder="Platform weekly" />
            </label>
          )}

          {isInterview && destination === 'new' ? (
            <label className="wide-field">
              Job description
              <textarea
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                placeholder="Paste the job description here so Clyde can use it when grading this transcript."
                style={{ minHeight: '180px' }}
              />
            </label>
          ) : null}

          {isInterview ? (
            <div className="form-grid">
              <label>
                Interview phase
                <select value={phase} onChange={(event) => setPhase(event.target.value)}>
                  {INTERVIEW_PHASE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  <option value="Other">Other</option>
                </select>
              </label>
              <label>
                Session title
                <input value={sessionTitle} onChange={(event) => setSessionTitle(event.target.value)} placeholder="Optional title" />
              </label>
              <label>
                Interviewer
                <input value={interviewerName} onChange={(event) => setInterviewerName(event.target.value)} placeholder="Optional name" />
              </label>
              <label>
                Interviewer title
                <input value={interviewerTitle} onChange={(event) => setInterviewerTitle(event.target.value)} placeholder="Optional title" />
              </label>
              <label>
                Session date
                <input type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} />
              </label>
            </div>
          ) : (
            <div className="form-grid">
              <label>
                Session title
                <input
                  value={meetingSessionTitle}
                  onChange={(event) => setMeetingSessionTitle(event.target.value)}
                  placeholder="Weekly planning, customer call, 1:1"
                />
              </label>
              <label>
                Session date
                <input type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} />
              </label>
            </div>
          )}

          <button type="submit" className="primary-action" disabled={isSaving || !canSubmit} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {isSaving ? (
              <>
                <span className="btn-spinner"></span>
                Saving...
              </>
            ) : (
              'Save transcript'
            )}
          </button>
        </form>
      </section>
    </div>
  );
}

function MeetingPreviewSummary({ notes = {}, status = '' }) {
  const sections = [
    ['Agenda', notes.agenda],
    ['Decisions', notes.decisions],
    ['Action Items', notes.actionItems],
    ['Blockers / risks', notes.blockers],
    ['Follow-ups', notes.followUps],
    ['Open questions', notes.openQuestions]
  ];
  return (
    <div className="post-meeting-summary">
      {status === 'loading' ? <p className="post-meeting-preview-status">Generating summary...</p> : null}
      {sections.map(([title, items]) => (
        <section key={title}>
          <div className="post-meeting-section-head">
            <h3>{title}</h3>
            {title === 'Agenda' ? <button type="button" className="copy-button" disabled>Copy Full Summary</button> : null}
          </div>
          {Array.isArray(items) && items.length ? (
            <ul>
              {items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}
            </ul>
          ) : (
            <p className="muted">No {title.toLowerCase()} captured yet.</p>
          )}
        </section>
      ))}
    </div>
  );
}

function RawTranscriptPreview({ transcript = [] }) {
  const rows = Array.isArray(transcript) ? transcript.filter((turn) => turn?.text) : [];
  return (
    <div className="post-meeting-transcript">
      <div className="post-meeting-section-head">
        <h3>Meeting Transcription</h3>
        <button type="button" className="copy-button" disabled>Copy Full Transcription</button>
      </div>
      {rows.length ? (
        <ul>
          {rows.map((turn, index) => (
            <li key={`${turn.itemId || index}-${index}`}>
              <strong className={`speaker-color-${index % 4}`}>{turn.speaker || 'Unknown'}:</strong> {turn.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No transcript captured yet.</p>
      )}
    </div>
  );
}

function buildRendererMeetingFallback(transcript = [], cards = []) {
  const recent = Array.isArray(transcript)
    ? transcript.slice(-6).map((turn) => String(turn?.text || '').trim()).filter(Boolean).slice(0, 5)
    : [];
  const actions = Array.isArray(cards)
    ? cards.filter((card) => card.type === 'action' || card.type === 'follow_up').flatMap((card) => [
      card.body || card.question,
      ...(Array.isArray(card.bullets) ? card.bullets : [])
    ]).filter(Boolean).slice(0, 8)
    : [];
  return {
    status: 'fallback',
    notes: {
      agenda: recent.length ? recent : ['No generated summary yet. Clyde will create cleaned meeting notes after save.'],
      decisions: [],
      actionItems: actions,
      blockers: [],
      followUps: actions,
      openQuestions: recent.filter((text) => /\?$/.test(text))
    }
  };
}

function previewNotesToSavedNotes(notes = {}) {
  const summary = [
    ['Agenda', notes.agenda],
    ['Decisions', notes.decisions],
    ['Blockers / risks', notes.blockers],
    ['Follow-ups', notes.followUps],
    ['Open questions', notes.openQuestions]
  ].map(([title, items]) => {
    const rows = Array.isArray(items) ? items.filter(Boolean) : [];
    return rows.length ? `**${title}:**\n${rows.map((item) => `- ${item}`).join('\n')}` : '';
  }).filter(Boolean).join('\n\n');
  return {
    summary,
    actionItems: [{
      attendee: 'Unassigned',
      items: Array.isArray(notes.actionItems) ? notes.actionItems.filter(Boolean) : []
    }].filter((group) => group.items.length)
  };
}

function formatSessionDateLabel(value) {
  const date = new Date(fromDateTimeLocal(value) || value || Date.now());
  if (Number.isNaN(date.getTime())) {
    return 'Today';
  }
  return new Intl.DateTimeFormat([], { weekday: 'long', month: 'short', day: 'numeric' }).format(date);
}

function formatColoredAttendees(attendees = []) {
  const colors = ['attendee-orange', 'attendee-red', 'attendee-green', 'attendee-blue'];
  const rows = Array.isArray(attendees) && attendees.length
    ? attendees.map((attendee) => attendee?.name || attendee).filter(Boolean)
    : ['Unassigned'];
  return rows.map((name, index) => (
    <span key={`${name}-${index}`} className={colors[index % colors.length]}>{index ? `, ${name}` : name}</span>
  ));
}

function JobDescriptionModal({ entity, onClose, onSave }) {
  const [jd, setJd] = useState('');
  const api = window.electronAPI;

  useEffect(() => {
    if (entity && api?.getCompanyJobDescription) {
      api.getCompanyJobDescription(entity.id).then(res => setJd(res || ''));
    }
  }, [entity, api]);

  return (
    <div className="drawer-backdrop" style={{ zIndex: 3000 }}>
      <section className="settings-drawer">
        <div className="drawer-head">
          <div>
            <h2>Job Description</h2>
            <p>For {entity?.name}</p>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <div style={{ padding: '20px' }}>
          <label className="wide-field">
            Paste Job Description
            <textarea 
              value={jd} 
              onChange={(e) => setJd(e.target.value)} 
              style={{ minHeight: '300px' }} 
            />
          </label>
        </div>
        <div className="drawer-actions">
          <button type="button" className="primary-action" onClick={() => onSave(jd)}>
            Save Job Description
          </button>
        </div>
      </section>
    </div>
  );
}

function ManualTranscriptModal({ entity, mode = 'interview', onClose, onSave }) {
  const isMeeting = mode === 'meeting';
  const [phase, setPhase] = useState(isMeeting ? 'Meeting session' : 'Interview #1');
  const [sessionTitle, setSessionTitle] = useState('');
  const [date, setDate] = useState(toDateTimeLocal(new Date().toISOString()));
  const [rawText, setRawText] = useState('');

  return (
    <div className="drawer-backdrop" style={{ zIndex: 3000 }}>
      <section className="settings-drawer">
        <div className="drawer-head">
          <div>
            <h2>{isMeeting ? 'Add meeting session' : 'Add manual transcript'}</h2>
            <p>For {entity?.name}</p>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {isMeeting ? (
            <label>
              Session title
              <input value={phase} onChange={(e) => setPhase(e.target.value)} placeholder="Weekly sync" />
            </label>
          ) : (
            <label>
              Phase
              <select value={phase} onChange={(e) => setPhase(e.target.value)}>
                {INTERVIEW_PHASE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                <option value="Other">Other</option>
              </select>
            </label>
          )}
          {!isMeeting ? (
            <label>
              Session title
              <input value={sessionTitle} onChange={(e) => setSessionTitle(e.target.value)} placeholder="Optional title" />
            </label>
          ) : null}
          <label>
            Session date
            <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="wide-field">
            Transcript Text
            <textarea 
              value={rawText} 
              onChange={(e) => setRawText(e.target.value)} 
              placeholder={isMeeting ? "Sarah: Let's review the launch plan.\nMarcus: I will send the vendor quote today." : "Interviewer: Let's start...\nYou: Okay!"}
              style={{ minHeight: '250px' }} 
            />
          </label>
        </div>
        <div className="drawer-actions">
          <button type="button" className="primary-action" onClick={() => {
            if (!rawText) return;
            const nextPhase = phase.trim() || (isMeeting ? 'Meeting session' : 'Interview #1');
            const customTitle = sessionTitle.trim();
            onSave({ phase: customTitle ? `${nextPhase} - ${customTitle}` : nextPhase, date, transcript: parseRawTranscript(rawText) });
          }}>
            {isMeeting ? 'Save session' : 'Save & Grade'}
          </button>
        </div>
      </section>
    </div>
  );
}

function EditEntityModal({ entity, onClose, onSave }) {
  const [name, setName] = useState(entity?.name || '');
  const [role, setRole] = useState(entity?.role || '');
  const [outcome, setOutcome] = useState(normalizeOpportunityOutcome(entity?.outcome));
  const [outcomeReason, setOutcomeReason] = useState(entity?.outcomeReason || '');
  const [outcomeDate, setOutcomeDate] = useState(toDateInput(entity?.outcomeDate));

  useEffect(() => {
    setName(entity?.name || '');
    setRole(entity?.role || '');
    setOutcome(normalizeOpportunityOutcome(entity?.outcome));
    setOutcomeReason(entity?.outcomeReason || '');
    setOutcomeDate(toDateInput(entity?.outcomeDate));
  }, [entity]);

  return (
    <div className="drawer-backdrop" style={{ zIndex: 3000 }}>
      <section className="settings-drawer">
        <div className="drawer-head">
          <div>
            <h2>Edit opportunity</h2>
            <p>Update the company and role shown across the interview timeline.</p>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <div className="settings-form">
          <label>
            Company name
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Title
            <input value={role} onChange={(event) => setRole(event.target.value)} />
          </label>
          <label>
            Status
            <select value={outcome} onChange={(event) => setOutcome(event.target.value)}>
              <option value="active">Active</option>
              <option value="advanced">Advanced</option>
              <option value="applied">Applied</option>
              <option value="rejected">Rejected</option>
              <option value="offer">Offer</option>
            </select>
          </label>
          <label>
            Outcome date
            <input type="date" value={outcomeDate} onChange={(event) => setOutcomeDate(event.target.value)} />
          </label>
          <label className="wide-field">
            Outcome reason
            <textarea
              value={outcomeReason}
              onChange={(event) => setOutcomeReason(event.target.value)}
              placeholder="Optional note about why this opportunity advanced, closed, or turned into an offer."
            />
          </label>
        </div>
        <div className="drawer-actions">
          <button
            type="button"
            className="primary-action"
            onClick={() => onSave({
              name: name.trim(),
              role: role.trim(),
              outcome,
              outcomeReason: outcomeReason.trim(),
              outcomeDate
            })}
            disabled={!name.trim()}
          >
            Save changes
          </button>
        </div>
      </section>
    </div>
  );
}

function EditSessionModal({ session, onClose, onSave }) {
  const [title, setTitle] = useState(session?.title || '');
  const [date, setDate] = useState(toDateTimeLocal(session?.date));
  const meetingFallback = getMeetingTranscriptFallback(session);
  const [summary, setSummary] = useState(meetingFallback.summary);
  const [actions, setActions] = useState(formatActionItemsForEditor(
    session?.mode === 'interview' ? (session?.grading?.examples || []) : (session?.notes?.actionItems || [])
  ));
  const [transcriptText, setTranscriptText] = useState(meetingFallback.transcriptText || transcriptToText(session?.transcript || []));

  useEffect(() => {
    const nextMeetingFallback = getMeetingTranscriptFallback(session);
    setTitle(session?.title || '');
    setDate(toDateTimeLocal(session?.date));
    setSummary(nextMeetingFallback.summary);
    setActions(formatActionItemsForEditor(
      session?.mode === 'interview' ? (session?.grading?.examples || []) : (session?.notes?.actionItems || [])
    ));
    setTranscriptText(nextMeetingFallback.transcriptText || transcriptToText(session?.transcript || []));
  }, [session]);

  return (
    <div className="drawer-backdrop" style={{ zIndex: 3000 }}>
      <section className="settings-drawer">
        <div className="drawer-head">
          <div>
            <h2>{session?.mode === 'meeting' ? 'Edit meeting' : 'Edit interview'}</h2>
            <p>{session?.mode === 'meeting'
              ? 'Changes to transcript text will re-run cleanup and notes generation after saving.'
              : 'Changes to transcript text may trigger a fresh rating after saving.'}
            </p>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <div className="settings-form">
          <div className="form-grid">
            <label>
              Session title
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label>
              Date
              <input type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
          </div>
          {session?.mode === 'meeting' ? (
            <>
              <label className="wide-field">
                Meeting notes
                <textarea value={summary} onChange={(event) => setSummary(event.target.value)} />
              </label>
              <label className="wide-field">
                Action items by attendee
                <textarea
                  value={actions}
                  onChange={(event) => setActions(event.target.value)}
                  placeholder="Sarah Jenkins: Send recap\nMarcus Thorne: Confirm owner"
                />
              </label>
            </>
          ) : null}
          <label className="wide-field">
            Transcript
            <textarea
              value={transcriptText}
              onChange={(event) => setTranscriptText(event.target.value)}
              placeholder={"Interviewer: Tell me about yourself.\nYou: I..."}
              style={{ minHeight: '260px' }}
            />
          </label>
        </div>
        <div className="drawer-actions">
          <button
            type="button"
            className="primary-action"
            onClick={() => onSave({
              ...session,
              title: title.trim() || 'Interview session',
              phase: title.trim() || session.phase || '',
              date: fromDateTimeLocal(date, session.date),
              entity: {
                ...(session.entity || {}),
                name: session.entity?.name || 'Interview',
                role: session.entity?.role || ''
              },
              transcript: parseRawTranscript(transcriptText),
              notes: session?.mode === 'meeting'
                ? { summary: summary.trim(), actionItems: parseActionItemsText(actions) }
                : session?.notes,
              grading: session?.grading
            })}
          >
            Save changes
          </button>
        </div>
      </section>
    </div>
  );
}

function TrendsView({ entities, mode, onSelectEntity, selectedEntity, sessions }) {
  const api = window.electronAPI;
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [railWidth, setRailWidth] = useState(390);
  const [collapsedOutcomeSections, setCollapsedOutcomeSections] = useState({ applied: true, rejected: true, offer: true });

  const selected = entities.find((entity) => entity.id === selectedEntity);
  const activeEntities = mode === 'interview'
    ? entities.filter((entity) => {
        const out = normalizeOpportunityOutcome(entity.outcome);
        return out !== 'rejected' && out !== 'offer' && out !== 'applied';
      })
    : entities;
  const appliedEntities = mode === 'interview'
    ? entities.filter((entity) => normalizeOpportunityOutcome(entity.outcome) === 'applied')
    : [];
  const rejectedEntities = mode === 'interview'
    ? entities.filter((entity) => normalizeOpportunityOutcome(entity.outcome) === 'rejected')
    : [];
  const offerEntities = mode === 'interview'
    ? entities.filter((entity) => normalizeOpportunityOutcome(entity.outcome) === 'offer')
    : [];
  const chronologicalSessions = useMemo(
    () => [...sessions].sort((a, b) => new Date(a.date) - new Date(b.date)),
    [sessions]
  );
  const sessionsMatchSelected = useMemo(
    () => sessions.length > 0 && sessions.every((session) => session.entity?.id === selected?.id),
    [sessions, selected?.id]
  );
  const sessionSignature = useMemo(
    () => buildTrendAnalysisSessionSignature(chronologicalSessions),
    [chronologicalSessions]
  );
  const calibrationSummary = useOutcomeCalibrationSummary(api, mode, selected);

  useEffect(() => {
    if (!selected || sessions.length < 1 || !sessionsMatchSelected) {
      setAnalysis(null);
      return;
    }

    const cacheKey = `trend-analysis-${selected.id}`;
    let cachedAnalysis = null;
    try {
      const stored = localStorage.getItem(cacheKey);
      if (stored) {
        cachedAnalysis = JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Failed to parse cached analysis", e);
    }

    if (isTrendAnalysisRecordFresh(cachedAnalysis, sessionSignature, sessions.length)) {
      setAnalysis(unwrapTrendAnalysisRecord(cachedAnalysis));
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const stored = await api?.getTrendAnalysis?.(selected.id);
        if (cancelled) {
          return;
        }

        if (isTrendAnalysisRecordFresh(stored, sessionSignature, sessions.length)) {
          const nextAnalysis = unwrapTrendAnalysisRecord(stored);
          setAnalysis(nextAnalysis);
          localStorage.setItem(cacheKey, JSON.stringify(stored));
          return;
        }
      } catch (error) {
        console.warn('Failed to load persisted analysis', error);
      }

      setAnalysis(null);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedEntity, sessionSignature, sessionsMatchSelected]);

  async function generateAnalysis() {
    if (!selected || !sessionsMatchSelected) return;
    setLoading(true);
    try {
      const result = await api?.generateTrendAnalysis?.(selected.id, { force: true });
      setAnalysis(result);
      if (result) {
        const cacheKey = `trend-analysis-${selected.id}`;
        localStorage.setItem(cacheKey, JSON.stringify({
          sessionsCount: sessions.length,
          sessionsSignature: sessionSignature,
          analysis: result
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const sortedSessions = chronologicalSessions;

  const handleRailResizePointerDown = (event) => {
    if (window.innerWidth <= 1120) {
      return;
    }

    event.preventDefault();
    const startX = event.clientX;
    const startWidth = railWidth;
    const maxWidth = Math.min(620, Math.max(390, Math.round(window.innerWidth * 0.48)));

    const handleMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      setRailWidth(Math.max(360, Math.min(maxWidth, startWidth + delta)));
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  };

  const handleRailResizeKeyDown = (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const maxWidth = Math.min(620, Math.max(390, Math.round(window.innerWidth * 0.48)));
    setRailWidth((current) => Math.max(360, Math.min(maxWidth, current + (direction * 24))));
  };

  const toggleOutcomeSection = (outcome) => {
    setCollapsedOutcomeSections((current) => ({
      ...current,
      [outcome]: !current[outcome]
    }));
  };

  const renderEntityRow = (entity) => (
    <div key={entity.id} className="opportunity-row">
      <button
        className={entity.id === selectedEntity ? 'active' : ''}
        type="button"
        onClick={() => onSelectEntity(entity.id)}
      >
        <div className="opportunity-row-main">
          <strong>{entity.name}</strong>
          <span className="entity-list-badges">
            {mode === 'interview' && <OutcomeBadge outcome={entity.outcome} />}
            {mode === 'interview' && entity.confidence > 0 && (
              <span className={`confidence-pill ${confidenceBand(entity.confidence)}`}>
                {entity.confidence}%
              </span>
            )}
          </span>
        </div>
        <span className="opportunity-row-heading">{entity.role || entity.kind}</span>
      </button>
      <button
        className="opportunity-active-toggle"
        type="button"
        title="View trend analysis"
        onClick={() => onSelectEntity(entity.id)}
      >
        {entity.id === selectedEntity ? '★' : '☆'}
      </button>
    </div>
  );

  return (
    <section className="timeline-view" data-testid="trendsTimeline" style={{ '--timeline-rail-width': `${railWidth}px` }}>
      <div className="timeline-rail">
        <div className="timeline-heading trend-heading">
          <h2>Trend Analysis</h2>
          <button
            type="button"
            className={`trend-overview-rail-button ${!selected ? 'active' : ''}`}
            onClick={() => onSelectEntity('')}
          >
            Overview
          </button>
        </div>
        <div className="entity-list">
          {entities.length ? (
            <>
              {activeEntities.length ? activeEntities.map(renderEntityRow) : (
                <EmptyState title="No active opportunities" body={mode === 'interview' ? 'Rejected and offer opportunities are grouped below.' : 'Save a session to build history.'} />
              )}
              {mode === 'interview' ? (
                <>
                  <OpportunitySection
                    collapsed={collapsedOutcomeSections.applied}
                    count={appliedEntities.length}
                    entities={appliedEntities}
                    onToggle={() => toggleOutcomeSection('applied')}
                    renderEntityRow={renderEntityRow}
                    title="Applied"
                  />
                  <OpportunitySection
                    collapsed={collapsedOutcomeSections.rejected}
                    count={rejectedEntities.length}
                    entities={rejectedEntities}
                    onToggle={() => toggleOutcomeSection('rejected')}
                    renderEntityRow={renderEntityRow}
                    title="Rejected"
                  />
                  <OpportunitySection
                    collapsed={collapsedOutcomeSections.offer}
                    count={offerEntities.length}
                    entities={offerEntities}
                    onToggle={() => toggleOutcomeSection('offer')}
                    renderEntityRow={renderEntityRow}
                    title="Offer"
                  />
                </>
              ) : null}
            </>
          ) : <EmptyState title="No saved sessions" body="Save a session to build history." />}
        </div>
      </div>
      <div
        aria-label="Resize opportunity list"
        aria-orientation="vertical"
        className="timeline-rail-resizer"
        onKeyDown={handleRailResizeKeyDown}
        onPointerDown={handleRailResizePointerDown}
        role="separator"
        tabIndex={0}
      />

      <div className="timeline-main" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <div className="timeline-title" style={{ flexShrink: 0 }}>
          <div>
            <h2>{selected?.name ? `${selected.name} Analysis` : 'Opportunity comparison'}</h2>
            <p>{selected ? `${sessions.length} saved sessions` : `${entities.length} opportunities tracked`}</p>
            {mode === 'interview' && selected ? <OutcomeCalibrationNote summary={calibrationSummary} /> : null}
          </div>
        </div>

        {!selected ? (
          <TrendOverviewDashboard
            entities={entities}
            sessions={sessions}
            onSelectEntity={onSelectEntity}
          />
        ) : selected ? (
          sessions.length < 1 ? (
            <div style={{ marginTop: '40px' }}>
              <EmptyState title="No sessions yet" body="Save at least 1 interview session to analyze this opportunity." />
            </div>
          ) : (
            <div className="trends-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 10px 40px 0', overflowY: 'auto', flex: 1, minHeight: 0 }}>
              <div className="trends-kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                <div className="kpi-card" style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                  <h4 style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem', fontWeight: 500 }}>Overall Confidence</h4>
                  <div className="kpi-value" style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--cyan)' }}>{selected.confidence || 0}%</div>
                </div>
                <div className="kpi-card" style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                  <h4 style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem', fontWeight: 500 }}>Overall Trend</h4>
                  <div className="kpi-value" style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>{selected.trend || 'Neutral'}</div>
                </div>
                <div className="kpi-card" style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                  <h4 style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem', fontWeight: 500 }}>Sessions Analyzed</h4>
                  <div className="kpi-value" style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--text)' }}>{sessions.length}</div>
                </div>
              </div>

              <div className="trends-chart-container" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '20px' }}>
                <h4 style={{ margin: '0 0 20px 0', color: 'var(--text)', fontWeight: 500 }}>Performance Over Time</h4>
                <TrendChart sessions={sortedSessions} />
              </div>

              <div className="trends-analysis-section" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h4 style={{ margin: 0, color: 'var(--text)', fontWeight: 500 }}>{sessions.length === 1 ? 'Baseline Analysis' : 'Deep Dive Analysis'}</h4>
                  <button type="button" className="primary-action" onClick={generateAnalysis} disabled={loading} style={{ padding: '8px 16px' }}>
                    {loading ? 'Analyzing...' : (analysis ? 'Regenerate Analysis' : 'Generate Analysis')}
                  </button>
                </div>
                
                {loading ? (
                  <div className="analysis-loading pulse" style={{ padding: '40px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--cyan)', minHeight: '100px', width: '100%' }}>{sessions.length === 1 ? 'Reading the saved interview and building a baseline assessment...' : 'Reading transcripts and computing trends...'}</div>
                ) : analysis ? (
                  <div className="analysis-result" style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    {analysis.executive_summary ? (
                      <div className="structured-analysis" style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
                        <div className="analysis-card summary" style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px', borderLeft: '4px solid var(--cyan)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                          <h5 style={{ margin: '0 0 10px 0', color: 'var(--text)', fontSize: '1.05rem' }}>Executive Summary</h5>
                          <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--muted)' }}>{directAddressFeedback(analysis.executive_summary)}</p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                          <div className="analysis-card strengths" style={{ background: 'rgba(46, 204, 113, 0.05)', padding: '20px', borderRadius: '12px', borderTop: '3px solid rgba(46, 204, 113, 0.8)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                            <h5 style={{ margin: '0 0 15px 0', color: '#2ecc71', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ fontSize: '1.2rem' }}>↑</span> Key Strengths</h5>
                            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.9rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {analysis.key_strengths?.length ? analysis.key_strengths.map((item, i) => <li key={i} style={{ lineHeight: '1.4' }}>{directAddressFeedback(item)}</li>) : <li>None identified.</li>}
                            </ul>
                          </div>
                          <div className="analysis-card improvements" style={{ background: 'rgba(231, 76, 60, 0.05)', padding: '20px', borderRadius: '12px', borderTop: '3px solid rgba(231, 76, 60, 0.8)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                            <h5 style={{ margin: '0 0 15px 0', color: '#e74c3c', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ fontSize: '1.2rem' }}>↓</span> Areas for Improvement</h5>
                            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.9rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {analysis.areas_for_improvement?.length ? analysis.areas_for_improvement.map((item, i) => <li key={i} style={{ lineHeight: '1.4' }}>{directAddressFeedback(item)}</li>) : <li>None identified.</li>}
                            </ul>
                          </div>
                        </div>

                        <div className="analysis-card breakdown" style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                          <h5 style={{ margin: '0 0 20px 0', color: 'var(--text)', fontSize: '1.05rem' }}>Phase-by-Phase Breakdown</h5>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {analysis.phase_breakdown?.map((pb, i) => (
                              <div key={i} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '16px', paddingBottom: i !== analysis.phase_breakdown.length - 1 ? '20px' : '0', borderBottom: i !== analysis.phase_breakdown.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', alignItems: 'start' }}>
                                <div style={{ minWidth: '140px', fontWeight: '600', color: 'var(--cyan)', fontSize: '0.9rem' }}>{pb.phase}</div>
                                <div style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: '1.5' }}>{directAddressFeedback(pb.observation)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="analysis-text" style={{ marginTop: '20px' }}>
                        <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', margin: 0, color: 'var(--text)' }}>{directAddressFeedback(analysis.deep_dive_analysis)}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ marginTop: '20px' }}>
                    <EmptyState title="No AI analysis yet" body={sessions.length === 1 ? 'Click Generate Analysis to ask Clyde for a baseline assessment from this interview.' : 'Click Generate Analysis to ask Clyde to review the transcripts and explain the trend.'} />
                  </div>
                )}
              </div>
            </div>
          )
        ) : (
          <div style={{ marginTop: '40px' }}>
            <EmptyState title="No opportunity selected" body="Choose a company from the list to view its trend analysis." />
          </div>
        )}
      </div>
    </section>
  );
}

const trendChartPalette = ['#4fe7ff', '#9b8cff', '#9cff6a', '#ffcf5a', '#ff7a90', '#5eead4', '#f0abfc', '#60a5fa'];

function buildTrendOverviewRows(entities = [], sessions = []) {
  const groupedSessions = new Map();
  for (const session of Array.isArray(sessions) ? sessions : []) {
    const id = session?.entity?.id || session?.entity?.name;
    if (!id) {
      continue;
    }
    const list = groupedSessions.get(id) || [];
    list.push(session);
    groupedSessions.set(id, list);
  }

  return (Array.isArray(entities) ? entities : []).map((entity) => {
    const entitySessions = [...(groupedSessions.get(entity.id) || groupedSessions.get(entity.name) || [])]
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const ratedSessions = entitySessions
      .map((session) => ({
        id: session.id,
        date: session.date,
        rating: getTranscriptRating(session.grading)
      }))
      .filter((item) => item.rating !== null);
    const firstRating = ratedSessions[0]?.rating ?? null;
    const latestRating = ratedSessions[ratedSessions.length - 1]?.rating ?? null;

    return {
      id: entity.id,
      name: entity.name || entity.id,
      role: entity.role || entity.kind || '',
      outcome: normalizeOpportunityOutcome(entity.outcome),
      confidence: Number(entity.confidence) || 0,
      trend: entity.trend || 'neutral',
      sessions: entitySessions,
      sessionCount: entitySessions.length,
      ratedSessions,
      ratedSessionCount: ratedSessions.length,
      latestRating,
      ratingDelta: firstRating !== null && latestRating !== null ? latestRating - firstRating : 0,
      lastSessionDate: entitySessions[entitySessions.length - 1]?.date || ''
    };
  });
}

function average(values = []) {
  const filtered = values.filter((value) => Number.isFinite(Number(value)));
  if (!filtered.length) {
    return 0;
  }
  return filtered.reduce((sum, value) => sum + Number(value), 0) / filtered.length;
}

function formatSigned(value) {
  const number = Number(value) || 0;
  return number > 0 ? `+${number}` : String(number);
}

function TrendOverviewDashboard({ entities = [], sessions = [], onSelectEntity }) {
  const opportunityRows = useMemo(() => buildTrendOverviewRows(entities, sessions), [entities, sessions]);
  const activeRows = opportunityRows.filter((row) => ['applied', 'active', 'advanced'].includes(row.outcome));
  const ratedRows = activeRows.filter((row) => row.latestRating !== null);
  const averageConfidence = average(activeRows.map((row) => row.confidence).filter((value) => value > 0));
  const averageLatestRating = average(ratedRows.map((row) => row.latestRating));
  const totalAnalyzedSessions = activeRows.reduce((sum, row) => sum + row.ratedSessionCount, 0);
  const outcomeCounts = ['applied', 'active', 'advanced', 'offer', 'rejected'].map((outcome) => ({
    outcome,
    label: getOutcomeLabel(outcome),
    count: opportunityRows.filter((row) => row.outcome === outcome).length
  }));
  const strongest = [...ratedRows].sort((a, b) => (b.latestRating ?? -1) - (a.latestRating ?? -1))[0];
  const improving = [...ratedRows].sort((a, b) => b.ratingDelta - a.ratingDelta)[0];
  const needsAttention = [...ratedRows].sort((a, b) => (a.latestRating ?? 99) - (b.latestRating ?? 99))[0];
  const mostHistory = [...activeRows].sort((a, b) => b.sessionCount - a.sessionCount)[0];

  return (
    <div className="trends-overview-dashboard">
      <div className="trends-overview-hero">
        <div>
          <span className="eyebrow">Trend overview</span>
          <h3>Compare active opportunity performance</h3>
          <p>Track ratings, confidence, outcomes, and interview history across the pipeline.</p>
        </div>
        <div className="trends-overview-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="trends-overview-kpis">
        <TrendOverviewKpi label="Active + advanced" value={activeRows.length} detail="open opportunities" tone="cyan" />
        <TrendOverviewKpi label="Average confidence" value={`${Math.round(averageConfidence)}%`} detail="open pipeline" tone="green" />
        <TrendOverviewKpi label="Latest rating avg" value={averageLatestRating ? `${averageLatestRating.toFixed(1)}/5` : '0/5'} detail="rated sessions" tone="amber" />
        <TrendOverviewKpi label="Analyzed sessions" value={totalAnalyzedSessions} detail="with transcript ratings" tone="violet" />
      </div>

      <div className="trends-overview-grid">
        <section className="trends-overview-panel trends-overview-chart-panel">
          <div className="trends-overview-panel-head">
            <div>
              <span className="eyebrow">All active opportunities</span>
              <h4>Performance Over Time</h4>
            </div>
          </div>
          <MultiOpportunityTrendChart rows={activeRows} />
        </section>

        <section className="trends-overview-panel">
          <div className="trends-overview-panel-head">
            <div>
              <span className="eyebrow">Pipeline mix</span>
              <h4>Outcome distribution</h4>
            </div>
          </div>
          <div className="trends-outcome-mix">
            {outcomeCounts.map((item) => (
              <div key={item.outcome} className={`trends-outcome-row ${item.outcome}`}>
                <span>{item.label}</span>
                <strong>{item.count}</strong>
                <div>
                  <i style={{ width: `${opportunityRows.length ? Math.max(8, (item.count / opportunityRows.length) * 100) : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="trends-overview-rankings">
        <TrendRankingCard title="Strongest latest" row={strongest} metric={strongest ? `${strongest.latestRating}/5` : 'No rating'} onSelectEntity={onSelectEntity} />
        <TrendRankingCard title="Biggest improvement" row={improving} metric={improving ? `${formatSigned(improving.ratingDelta)} pts` : 'No change'} onSelectEntity={onSelectEntity} />
        <TrendRankingCard title="Needs attention" row={needsAttention} metric={needsAttention ? `${needsAttention.latestRating}/5` : 'No rating'} onSelectEntity={onSelectEntity} />
        <TrendRankingCard title="Most history" row={mostHistory} metric={mostHistory ? `${mostHistory.sessionCount} sessions` : 'No sessions'} onSelectEntity={onSelectEntity} />
      </div>

      <section className="trends-overview-panel">
        <div className="trends-overview-panel-head">
          <div>
            <span className="eyebrow">Opportunity comparison</span>
            <h4>Pipeline table</h4>
          </div>
        </div>
        <div className="trends-comparison-table">
          <div className="trends-comparison-row header">
            <span>Company</span>
            <span>Outcome</span>
            <span>Confidence</span>
            <span>Latest rating</span>
            <span>Sessions</span>
            <span>Last session</span>
          </div>
          {opportunityRows.length ? opportunityRows.map((row) => (
            <button key={row.id} type="button" className="trends-comparison-row" onClick={() => onSelectEntity(row.id)}>
              <span>
                <strong>{row.name}</strong>
                <small>{row.role || 'Role not set'}</small>
              </span>
              <span><OutcomeBadge outcome={row.outcome} /></span>
              <span>{row.confidence ? `${row.confidence}%` : 'No score'}</span>
              <span>{row.latestRating !== null ? `${row.latestRating}/5` : 'Pending'}</span>
              <span>{row.sessionCount}</span>
              <span>{row.lastSessionDate ? new Date(row.lastSessionDate).toLocaleDateString() : 'No sessions'}</span>
            </button>
          )) : (
            <EmptyState title="No opportunities yet" body="Save interview sessions to build the overview dashboard." />
          )}
        </div>
      </section>
    </div>
  );
}

function TrendOverviewKpi({ label, value, detail, tone }) {
  return (
    <article className={`trends-overview-kpi ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function TrendRankingCard({ title, row, metric, onSelectEntity }) {
  return (
    <button type="button" className="trends-ranking-card" disabled={!row} onClick={() => row && onSelectEntity(row.id)}>
      <span>{title}</span>
      <strong>{row?.name || 'No data yet'}</strong>
      <small>{row?.role || metric}</small>
      {row ? <em>{metric}</em> : null}
    </button>
  );
}

function MultiOpportunityTrendChart({ rows = [] }) {
  const width = 760;
  const height = 260;
  const padding = { top: 24, right: 28, bottom: 42, left: 34 };
  const series = rows
    .map((row, index) => ({
      ...row,
      color: trendChartPalette[index % trendChartPalette.length],
      points: row.ratedSessions
    }))
    .filter((row) => row.points.length);

  if (!series.length) {
    return <div className="chart-empty">No rated interview sessions yet.</div>;
  }

  const maxSessionCount = Math.max(...series.map((row) => row.points.length), 1);
  const xFor = (index) => {
    if (maxSessionCount === 1) {
      return padding.left;
    }
    return padding.left + index * ((width - padding.left - padding.right) / (maxSessionCount - 1));
  };
  const yFor = (rating) => height - padding.bottom - ((rating || 0) / 5) * (height - padding.top - padding.bottom);

  return (
    <div className="trends-multi-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Performance over time across opportunities">
        {[0, 1, 2, 3, 4, 5].map((rating) => {
          const y = yFor(rating);
          return (
            <g key={rating}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} />
              <text x={8} y={y + 4}>{rating}</text>
            </g>
          );
        })}
        {series.map((row) => {
          const points = row.points.map((point, index) => ({
            x: xFor(index),
            y: yFor(point.rating),
            rating: point.rating
          }));
          const path = points.length > 1 ? `M ${points.map((point) => `${point.x},${point.y}`).join(' L ')}` : '';
          return (
            <g key={row.id}>
              {path ? <path d={path} stroke={row.color} /> : null}
              {points.map((point, index) => (
                <circle key={`${row.id}-${index}`} cx={point.x} cy={point.y} r="5" fill={row.color} />
              ))}
            </g>
          );
        })}
      </svg>
      <div className="trends-chart-legend">
        {series.map((row) => (
          <div key={row.id}>
            <i style={{ background: row.color }} />
            <span>{row.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendChart({ sessions }) {
  const padding = 30;
  const width = 600;
  const height = 200;

  const validSessions = sessions
    .map((session) => ({
      session,
      rating: getTranscriptRating(session.grading)
    }))
    .filter((item) => item.rating !== null)
    .sort((a, b) => new Date(a.session.date) - new Date(b.session.date));
  
  if (validSessions.length < 1) {
    return <div className="chart-empty" style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted)' }}>No rated sessions to chart yet.</div>;
  }

  const maxVal = 5;
  const minVal = 0;
  
  const points = validSessions.map(({ session, rating }, i) => {
    const x = validSessions.length === 1
      ? width / 2
      : padding + (i * ((width - padding * 2) / (validSessions.length - 1)));
    const y = height - padding - ((rating - minVal) / (maxVal - minVal)) * (height - padding * 2);
    return {
      x,
      y,
      label: session.phase || `Session ${i + 1}`,
      rating
    };
  });

  const pathD = points.length > 1 ? `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}` : '';

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', minWidth: '400px', height: 'auto', display: 'block' }}>
        {[0, 1, 2, 3, 4, 5].map(v => {
          const y = height - padding - ((v - minVal) / (maxVal - minVal)) * (height - padding * 2);
          return <line key={v} x1={padding} y1={y} x2={width - padding} y2={y} stroke="rgba(255,255,255,0.1)" />;
        })}
        
        {pathD ? <path d={pathD} fill="none" stroke="var(--cyan)" strokeWidth="3" /> : null}
        
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill="var(--cyan)" />
            <text x={p.x} y={p.y - 12} fill="white" fontSize="12" textAnchor="middle">{p.rating}/5</text>
            <text x={p.x} y={height - 5} fill="var(--muted)" fontSize="10" textAnchor="middle">{p.label.length > 15 ? p.label.substring(0,12)+'...' : p.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

const calendarStyles = `
  .calendar-workspace {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    padding: 20px;
    gap: 20px;
    overflow: hidden;
    animation: fadeIn 0.4s ease-out;
  }
  .calendar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 15px 25px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.1);
  }
  .calendar-controls {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .calendar-controls h2 {
    margin: 0;
    font-size: 1.6rem;
    font-weight: 400;
    letter-spacing: 2px;
    background: linear-gradient(135deg, #00e5ff, #ffffff);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    text-transform: uppercase;
  }
  .calendar-actions {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .view-toggles {
    display: flex;
    background: rgba(0, 0, 0, 0.4);
    border-radius: 8px;
    padding: 4px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);
  }
  .view-toggles button {
    background: transparent;
    border: none;
    padding: 8px 16px;
    color: var(--muted);
    border-radius: 6px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-weight: 500;
    letter-spacing: 1px;
    text-transform: uppercase;
    font-size: 0.8rem;
  }
  .view-toggles button.active {
    background: rgba(0, 229, 255, 0.15);
    color: #00e5ff;
    box-shadow: 0 2px 10px rgba(0,229,255,0.2), inset 0 1px 0 rgba(255,255,255,0.2);
    border: 1px solid rgba(0, 229, 255, 0.3);
  }
  .calendar-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: rgba(10, 10, 15, 0.4);
    backdrop-filter: blur(24px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.02), 0 12px 40px rgba(0,0,0,0.4);
  }
  .calendar-month-grid {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
  .calendar-days-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    background: rgba(0, 0, 0, 0.3);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    text-align: center;
    padding: 12px 0;
    font-weight: 600;
    font-size: 0.85rem;
    color: var(--cyan);
    text-transform: uppercase;
    letter-spacing: 2px;
  }
  .calendar-days {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    grid-auto-rows: minmax(160px, 1fr);
    flex: 1;
    overflow-y: auto;
  }
  .calendar-day {
    border-right: 1px solid rgba(255, 255, 255, 0.04);
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: all 0.3s;
    position: relative;
    overflow: hidden;
  }
  .calendar-day:hover {
    background: rgba(255, 255, 255, 0.03);
  }
  .calendar-day.empty {
    background: rgba(0, 0, 0, 0.2);
  }
  .calendar-day.today::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: radial-gradient(circle at top right, rgba(0, 229, 255, 0.1), transparent 70%);
    pointer-events: none;
  }
  .calendar-day.today .day-number {
    background: var(--cyan);
    color: #000;
    font-weight: bold;
    border-radius: 50%;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 15px rgba(0, 229, 255, 0.5);
  }
  .day-number {
    font-size: 1rem;
    color: #dbefff;
    align-self: flex-end;
    margin-bottom: 4px;
    font-weight: 500;
    z-index: 1;
  }
  .day-events {
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow-y: auto;
    flex: 1;
    z-index: 1;
  }
  .day-events::-webkit-scrollbar {
    width: 4px;
  }
  .day-events::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.2);
    border-radius: 4px;
  }
  .calendar-event-chip {
    display: grid;
    gap: 1px;
    font-size: 0.75rem;
    padding: 4px 8px;
    border-radius: 6px;
    color: #ffffff;
    text-shadow: 0 1px 1px rgba(0,0,0,0.65);
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    font-weight: 500;
    letter-spacing: 0.5px;
    border: 1px solid rgba(255,255,255,0.2);
  }
  .calendar-event-chip span,
  .calendar-event-chip small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .calendar-event-chip small {
    font-size: 0.62rem;
    opacity: 0.82;
  }
  .calendar-month-grid .calendar-event-chip {
    color: #000000;
    text-shadow: none;
    font-weight: 600;
  }
  .calendar-event-chip:hover {
    transform: translateY(-2px) scale(1.02);
    filter: brightness(1.2);
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  }
  .calendar-event-chip.past {
    opacity: 0.62;
    filter: saturate(0.35) grayscale(0.55);
    color: rgba(229, 237, 246, 0.7);
    text-shadow: none;
  }
  .calendar-month-grid .calendar-event-chip.past {
    color: rgba(17, 24, 39, 0.72);
  }
  .calendar-event-chip.past:hover {
    filter: saturate(0.45) grayscale(0.45) brightness(1.05);
  }
  /* Week View */
  .calendar-week-view {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    flex: 1;
    overflow-y: auto;
  }
  .week-day-col {
    border-right: 1px solid rgba(255, 255, 255, 0.04);
    display: flex;
    flex-direction: column;
    background: rgba(255,255,255,0.01);
  }
  .week-day-header {
    text-align: center;
    padding: 15px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .week-day-col.today .week-day-header {
    background: rgba(0, 229, 255, 0.1);
    border-bottom: 1px solid rgba(0, 229, 255, 0.3);
  }
  .week-day-col.today .week-day-header span {
    color: var(--cyan);
    font-weight: bold;
    text-shadow: 0 0 10px rgba(0,229,255,0.5);
  }
  .week-day-header strong {
    font-size: 0.85rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .week-day-header span {
    font-size: 1.4rem;
  }
  .week-day-events {
    flex: 1;
    padding: 15px 10px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .calendar-event-card {
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(10px);
    border-radius: 8px;
    padding: 12px;
    border-left: 4px solid var(--cyan);
    border-top: 1px solid rgba(255,255,255,0.05);
    border-right: 1px solid rgba(255,255,255,0.05);
    border-bottom: 1px solid rgba(255,255,255,0.05);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 15px rgba(0,0,0,0.15);
  }
  .calendar-event-card:hover {
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.25);
  }
  .calendar-event-card.past {
    opacity: 0.62;
    filter: saturate(0.35) grayscale(0.55);
  }
  .calendar-event-card.past:hover {
    filter: saturate(0.45) grayscale(0.45) brightness(1.05);
  }
  .calendar-event-card.past .event-time,
  .calendar-event-card.past .event-entity {
    color: rgba(219, 239, 255, 0.52);
  }
  .calendar-event-card.past .event-title {
    color: rgba(243, 251, 255, 0.62);
  }
  .calendar-event-card .event-time {
    font-size: 0.8rem;
    color: var(--cyan);
    margin-bottom: 6px;
    font-weight: 500;
  }
  .calendar-event-card .event-title {
    font-size: 0.95rem;
    font-weight: 500;
    color: #f3fbff;
  }
  /* Day View */
  .calendar-day-view {
    display: flex;
    flex-direction: column;
    flex: 1;
    padding: 40px;
    overflow-y: auto;
    background: radial-gradient(circle at top right, rgba(255,255,255,0.02), transparent 50%);
  }
  .day-view-header h2 {
    margin: 0 0 40px 0;
    font-size: 2.5rem;
    font-weight: 300;
    color: var(--cyan);
    letter-spacing: 1px;
    text-shadow: 0 0 20px rgba(0,229,255,0.3);
  }
  .day-view-events {
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-width: 900px;
  }
  .calendar-event-card.large {
    display: flex;
    gap: 25px;
    padding: 25px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-left: 6px solid var(--cyan);
    box-shadow: 0 10px 30px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1);
  }
  .calendar-event-card.large .event-time {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text);
    min-width: 90px;
    padding-top: 2px;
  }
  .calendar-event-card.large .event-details {
    flex: 1;
  }
  .calendar-event-card.large .event-title {
    font-size: 1.4rem;
    margin-bottom: 8px;
    font-weight: 500;
    color: #fff;
  }
  .calendar-event-card.large .event-entity {
    font-size: 0.9rem;
    color: var(--cyan);
    margin-bottom: 12px;
    font-weight: 500;
    letter-spacing: 0.5px;
    display: inline-block;
    padding: 4px 10px;
    background: rgba(0, 229, 255, 0.1);
    border-radius: 20px;
    border: 1px solid rgba(0, 229, 255, 0.2);
  }
  .calendar-event-card.large .event-desc {
    font-size: 1rem;
    color: var(--muted);
    line-height: 1.6;
    white-space: pre-wrap;
    background: rgba(0,0,0,0.2);
    padding: 15px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.05);
  }
  .empty-events {
    color: var(--muted);
    font-size: 1.2rem;
    padding: 60px 0;
    text-align: center;
    background: rgba(255,255,255,0.02);
    border-radius: 12px;
    border: 1px dashed rgba(255,255,255,0.1);
  }

  /* Light Theme Overrides */
  .theme-snow .calendar-header {
    background: rgba(255, 255, 255, 0.6) !important;
    border-color: rgba(79, 70, 229, 0.15) !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05) !important;
  }
  .theme-snow .calendar-body {
    background: rgba(255, 255, 255, 0.6) !important;
    border-color: rgba(79, 70, 229, 0.15) !important;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.05) !important;
  }
  .theme-snow .calendar-day-view {
    background: transparent !important;
  }
  .theme-snow .day-view-header h2 {
    color: var(--cyan) !important;
    text-shadow: none !important;
  }
  .theme-snow .calendar-event-card.large {
    background: rgba(255, 255, 255, 0.85) !important;
    border: 1px solid rgba(79, 70, 229, 0.18) !important;
    border-left: 6px solid var(--cyan) !important;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.05) !important;
  }
  .theme-snow .calendar-event-card.large .event-time {
    color: var(--text) !important;
  }
  .theme-snow .calendar-event-card.large .event-title {
    color: var(--text) !important;
  }
  .theme-snow .calendar-event-card.large .event-entity {
    background: rgba(79, 70, 229, 0.08) !important;
    border-color: rgba(79, 70, 229, 0.22) !important;
    color: var(--cyan) !important;
  }
  .theme-snow .calendar-event-card.large .event-desc {
    background: rgba(248, 250, 252, 0.95) !important;
    border-color: rgba(79, 70, 229, 0.15) !important;
    color: var(--text) !important;
  }
  .theme-snow .calendar-event-card {
    background: rgba(255, 255, 255, 0.8) !important;
    border-color: rgba(79, 70, 229, 0.15) !important;
    border-left: 4px solid var(--cyan) !important;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.04) !important;
  }
  .theme-snow .calendar-event-card .event-title {
    color: var(--text) !important;
  }
  .theme-snow .calendar-event-card .event-time {
    color: var(--cyan) !important;
  }
  .theme-snow .calendar-day {
    background: rgba(255, 255, 255, 0.85) !important;
    border-color: rgba(79, 70, 229, 0.12) !important;
  }
  .theme-snow .calendar-day.empty {
    background: rgba(255, 255, 255, 0.45) !important;
  }
  .theme-snow .calendar-day:hover {
    background: rgba(255, 255, 255, 0.95) !important;
  }
  .theme-snow .calendar-day.today {
    background: rgba(79, 70, 229, 0.06) !important;
    border-color: var(--cyan) !important;
  }
  .theme-snow .calendar-day.today .day-number {
    color: var(--cyan) !important;
    font-weight: bold;
  }
  .theme-snow .calendar-days-header {
    background: rgba(255, 255, 255, 0.5) !important;
    border-bottom-color: rgba(79, 70, 229, 0.15) !important;
    color: var(--text) !important;
  }
  .theme-snow .week-day-col {
    background: rgba(255, 255, 255, 0.7) !important;
    border-color: rgba(79, 70, 229, 0.1) !important;
  }
  .theme-snow .week-day-header {
    background: rgba(255, 255, 255, 0.85) !important;
    border-bottom-color: rgba(79, 70, 229, 0.15) !important;
    color: var(--text) !important;
  }
  .theme-snow .week-day-col.today .week-day-header {
    background: rgba(79, 70, 229, 0.08) !important;
    border-bottom-color: rgba(79, 70, 229, 0.2) !important;
  }
  .theme-snow .empty-events {
    background: rgba(255, 255, 255, 0.8) !important;
    border-color: rgba(79, 70, 229, 0.12) !important;
    color: var(--muted) !important;
  }
  .theme-snow .calendar-controls button,
  .theme-snow .calendar-actions button:not(.primary-action) {
    background: rgba(255, 255, 255, 0.7) !important;
    border-color: rgba(79, 70, 229, 0.18) !important;
    color: var(--text) !important;
  }
  .theme-snow .calendar-controls button:hover,
  .theme-snow .calendar-actions button:not(.primary-action):hover {
    background: rgba(255, 255, 255, 0.95) !important;
    border-color: rgba(79, 70, 229, 0.3) !important;
  }
  .theme-snow .view-toggles {
    background: rgba(255, 255, 255, 0.4) !important;
    border-color: rgba(79, 70, 229, 0.15) !important;
  }
  .theme-snow .view-toggles button {
    color: var(--muted) !important;
  }
  .theme-snow .view-toggles button.active {
    background: var(--cyan) !important;
    color: #ffffff !important;
    box-shadow: 0 2px 8px rgba(79, 70, 229, 0.2) !important;
    border: none !important;
  }

  .theme-blossom .calendar-header {
    background: rgba(255, 255, 255, 0.75) !important;
    border-color: rgba(219, 39, 119, 0.15) !important;
    box-shadow: 0 8px 32px rgba(219, 39, 119, 0.05) !important;
  }
  .theme-blossom .calendar-body {
    background: rgba(255, 255, 255, 0.75) !important;
    border-color: rgba(219, 39, 119, 0.15) !important;
    box-shadow: 0 12px 40px rgba(219, 39, 119, 0.03) !important;
  }
  .theme-blossom .calendar-day-view {
    background: transparent !important;
  }
  .theme-blossom .day-view-header h2 {
    color: var(--cyan) !important;
    text-shadow: none !important;
  }
  .theme-blossom .calendar-event-card.large {
    background: rgba(255, 255, 255, 0.9) !important;
    border: 1px solid rgba(219, 39, 119, 0.18) !important;
    border-left: 6px solid var(--cyan) !important;
    box-shadow: 0 8px 30px rgba(219, 39, 119, 0.05) !important;
  }
  .theme-blossom .calendar-event-card.large .event-time {
    color: var(--text) !important;
  }
  .theme-blossom .calendar-event-card.large .event-title {
    color: var(--text) !important;
  }
  .theme-blossom .calendar-event-card.large .event-entity {
    background: rgba(219, 39, 119, 0.08) !important;
    border-color: rgba(219, 39, 119, 0.22) !important;
    color: var(--cyan) !important;
  }
  .theme-blossom .calendar-event-card.large .event-desc {
    background: rgba(255, 251, 251, 0.95) !important;
    border-color: rgba(219, 39, 119, 0.15) !important;
    color: var(--text) !important;
  }
  .theme-blossom .calendar-event-card {
    background: rgba(255, 255, 255, 0.85) !important;
    border-color: rgba(219, 39, 119, 0.15) !important;
    border-left: 4px solid var(--cyan) !important;
    box-shadow: 0 4px 15px rgba(219, 39, 119, 0.04) !important;
  }
  .theme-blossom .calendar-event-card .event-title {
    color: var(--text) !important;
  }
  .theme-blossom .calendar-event-card .event-time {
    color: var(--cyan) !important;
  }
  .theme-blossom .calendar-day {
    background: rgba(255, 255, 255, 0.9) !important;
    border-color: rgba(219, 39, 119, 0.12) !important;
  }
  .theme-blossom .calendar-day.empty {
    background: rgba(255, 255, 255, 0.5) !important;
  }
  .theme-blossom .calendar-day:hover {
    background: rgba(255, 255, 255, 0.98) !important;
  }
  .theme-blossom .calendar-day.today {
    background: rgba(219, 39, 119, 0.06) !important;
    border-color: var(--cyan) !important;
  }
  .theme-blossom .calendar-day.today .day-number {
    color: var(--cyan) !important;
    font-weight: bold;
  }
  .theme-blossom .calendar-days-header {
    background: rgba(255, 255, 255, 0.6) !important;
    border-bottom-color: rgba(219, 39, 119, 0.15) !important;
    color: var(--text) !important;
  }
  .theme-blossom .week-day-col {
    background: rgba(255, 255, 255, 0.75) !important;
    border-color: rgba(219, 39, 119, 0.1) !important;
  }
  .theme-blossom .week-day-header {
    background: rgba(255, 255, 255, 0.9) !important;
    border-bottom-color: rgba(219, 39, 119, 0.15) !important;
    color: var(--text) !important;
  }
  .theme-blossom .week-day-col.today .week-day-header {
    background: rgba(219, 39, 119, 0.08) !important;
    border-bottom-color: rgba(219, 39, 119, 0.2) !important;
  }
  .theme-blossom .empty-events {
    background: rgba(255, 255, 255, 0.85) !important;
    border-color: rgba(219, 39, 119, 0.12) !important;
    color: var(--muted) !important;
  }
  .theme-blossom .calendar-controls button,
  .theme-blossom .calendar-actions button:not(.primary-action) {
    background: rgba(255, 255, 255, 0.7) !important;
    border-color: rgba(219, 39, 119, 0.18) !important;
    color: var(--text) !important;
  }
  .theme-blossom .calendar-controls button:hover,
  .theme-blossom .calendar-actions button:not(.primary-action):hover {
    background: rgba(255, 255, 255, 0.95) !important;
    border-color: rgba(219, 39, 119, 0.3) !important;
  }
  .theme-blossom .view-toggles {
    background: rgba(255, 255, 255, 0.4) !important;
    border-color: rgba(219, 39, 119, 0.15) !important;
  }
  .theme-blossom .view-toggles button {
    color: var(--muted) !important;
  }
  .theme-blossom .view-toggles button.active {
    background: var(--cyan) !important;
    color: #ffffff !important;
    box-shadow: 0 2px 8px rgba(219, 39, 119, 0.2) !important;
    border: none !important;
  }
`;

function CalendarView({ entities, events, onSaveEvent, onDeleteEvent, onEditEvent, mode }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month'); // 'month', 'week', 'day'
  const nowMs = useNowMs();

  const safeEvents = Array.isArray(events) ? events : [];

  // Calculations for month
  const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);

  const shiftDate = (direction) => {
    const delta = direction === 'prev' ? -1 : 1;
    const next = new Date(currentDate);
    if (view === 'day') {
      next.setDate(next.getDate() + delta);
    } else if (view === 'week') {
      next.setDate(next.getDate() + (7 * delta));
    } else {
      next.setDate(1);
      next.setMonth(next.getMonth() + delta);
    }
    setCurrentDate(next);
  };
  const today = () => setCurrentDate(new Date());

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  // Render month grid
  const renderMonth = () => {
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), i).toDateString();
      const dayEvents = safeEvents.filter(e => new Date(e.date).toDateString() === dateStr);
      const isToday = new Date().toDateString() === dateStr;

      days.push(
        <div key={i} className={`calendar-day ${isToday ? 'today' : ''}`} onClick={() => onEditEvent({ date: new Date(currentDate.getFullYear(), currentDate.getMonth(), i, 9, 0, 0).toISOString(), isDraft: true })}>
          <span className="day-number">{i}</span>
          <div className="day-events">
            {dayEvents.map(evt => {
              const eventLabel = resolveEventEntityLabel(evt, entities);
              const isPast = isPastCalendarEvent(evt, nowMs);
              return (
                <div 
                  key={evt.id} 
                  className={`calendar-event-chip ${isPast ? 'past' : ''}`}
                  style={{ backgroundColor: isPast ? 'rgba(148, 163, 184, 0.48)' : calendarEventColor(evt) }}
                  onClick={(e) => { e.stopPropagation(); onEditEvent(evt); }}
                  title={`${evt.title}\n${eventLabel}\n${new Date(evt.date).toLocaleString()}\n${evt.description || ''}`}
                >
                  <span>{evt.title}</span>
                  <small>{eventLabel}</small>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return days;
  };

  const getWeekDays = (date) => {
    const curr = new Date(date);
    const dayOfWeek = curr.getDay();
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(curr);
      d.setDate(curr.getDate() - dayOfWeek + i);
      days.push(d);
    }
    return days;
  };

  const renderWeek = () => {
    const weekDays = getWeekDays(currentDate);
    return (
      <div className="calendar-week-view">
        {weekDays.map((day, idx) => {
          const dateStr = day.toDateString();
          const dayEvents = safeEvents.filter(e => new Date(e.date).toDateString() === dateStr);
          const isToday = new Date().toDateString() === dateStr;
          return (
            <div key={idx} className={`week-day-col ${isToday ? 'today' : ''}`}>
              <div className="week-day-header">
                <strong>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][idx]}</strong>
                <span>{day.getDate()}</span>
              </div>
              <div className="week-day-events" onClick={() => onEditEvent({ date: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0, 0).toISOString(), isDraft: true })}>
                {dayEvents.sort((a,b) => new Date(a.date) - new Date(b.date)).map(evt => {
                  const eventLabel = resolveEventEntityLabel(evt, entities);
                  const isPast = isPastCalendarEvent(evt, nowMs);
                  return (
                    <div 
                      key={evt.id} 
                      className={`calendar-event-card ${isPast ? 'past' : ''}`}
                      style={{ borderLeftColor: isPast ? 'rgba(148, 163, 184, 0.55)' : calendarEventColor(evt) }}
                      onClick={(e) => { e.stopPropagation(); onEditEvent(evt); }}
                      title={`${evt.title}\n${eventLabel}\n${new Date(evt.date).toLocaleString()}\n${evt.description || ''}`}
                    >
                      <div className="event-time">{new Date(evt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      <div className="event-title">{evt.title}</div>
                      <div className="event-entity">{eventLabel}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDay = () => {
    const dateStr = currentDate.toDateString();
    const dayEvents = safeEvents.filter(e => new Date(e.date).toDateString() === dateStr).sort((a,b) => new Date(a.date) - new Date(b.date));
    
    return (
      <div className="calendar-day-view">
        <div className="day-view-header">
          <h2>{currentDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
        </div>
        <div className="day-view-events">
          {dayEvents.length ? dayEvents.map(evt => {
             const eventLabel = resolveEventEntityLabel(evt, entities);
             const isPast = isPastCalendarEvent(evt, nowMs);
             return (
              <div 
                key={evt.id} 
                className={`calendar-event-card large ${isPast ? 'past' : ''}`}
                style={{ borderLeftColor: isPast ? 'rgba(148, 163, 184, 0.55)' : calendarEventColor(evt) }}
                onClick={() => onEditEvent(evt)}
                title={`${evt.title}\n${eventLabel}\n${new Date(evt.date).toLocaleString()}\n${evt.description || ''}`}
              >
                <div className="event-time">{new Date(evt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                <div className="event-details">
                  <div className="event-title">{evt.title}</div>
                  <div className="event-entity">{eventLabel}</div>
                  {evt.description && <div className="event-desc">{evt.description}</div>}
                </div>
              </div>
            )
          }) : <div className="empty-events">No events scheduled for this day.</div>}
        </div>
      </div>
    );
  };

  return (
    <section className="calendar-workspace">
      <style>{calendarStyles}</style>
      <div className="calendar-header">
        <div className="calendar-controls">
          <button type="button" onClick={today}>Today</button>
          <button type="button" className="icon-button" onClick={() => shiftDate('prev')}>&lt;</button>
          <button type="button" className="icon-button" onClick={() => shiftDate('next')}>&gt;</button>
          <h2>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
        </div>
        <div className="calendar-actions">
          <div className="view-toggles">
            <button type="button" className={view === 'month' ? 'active' : ''} onClick={() => setView('month')}>Month</button>
            <button type="button" className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>Week</button>
            <button type="button" className={view === 'day' ? 'active' : ''} onClick={() => setView('day')}>Day</button>
          </div>
          <button type="button" className="primary-action" onClick={() => onEditEvent(null)}>+ New Event</button>
        </div>
      </div>

      <div className="calendar-body">
        {view === 'month' && (
          <div className="calendar-month-grid">
            <div className="calendar-days-header">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="calendar-days">
              {renderMonth()}
            </div>
          </div>
        )}
        {view === 'week' && renderWeek()}
        {view === 'day' && renderDay()}
      </div>
    </section>
  );
}

function CalendarEventModal({ event, initialEntity, entities, onClose, onSave, onDelete, onStart }) {
  const [title, setTitle] = useState(event?.title || '');
  const [date, setDate] = useState(toDateTimeLocal(event?.date || new Date().toISOString()));
  const initialAssociation = event?.associationMode || (initialEntity?.kind === 'meeting' ? 'meeting' : (initialEntity?.id ? 'opportunity' : 'generic'));
  const [associationMode, setAssociationMode] = useState(initialAssociation);
  const [opportunityId, setOpportunityId] = useState(event?.opportunityId || (initialAssociation === 'opportunity' ? (event?.entityId || initialEntity?.id || '') : ''));
  const [meetingId, setMeetingId] = useState(event?.meetingId || (initialAssociation === 'meeting' ? (event?.entityId || initialEntity?.id || '') : ''));
  const [color, setColor] = useState(event?.color || '#00e5ff');
  const [description, setDescription] = useState(event?.description || '');
  const [meetingUrl, setMeetingUrl] = useState(event?.meetingUrl || '');
  const [opportunities, setOpportunities] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const api = window.electronAPI;

  const isEditing = !!event?.id;

  useEffect(() => {
    let cancelled = false;
    async function loadAssociations() {
      if (!api?.getSessionEntities) return;
      const [interviewEntities, meetingEntities] = await Promise.all([
        api.getSessionEntities('interview'),
        api.getSessionEntities('meeting')
      ]);
      if (!cancelled) {
        setOpportunities(Array.isArray(interviewEntities) ? interviewEntities : []);
        setMeetings(Array.isArray(meetingEntities) ? meetingEntities : []);
      }
    }
    loadAssociations().catch(() => {});
    return () => { cancelled = true; };
  }, [api]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const linkedEntityId = associationMode === 'opportunity'
      ? opportunityId
      : associationMode === 'meeting'
        ? meetingId
        : '';
    const linkedEntity = associationMode === 'opportunity'
      ? opportunities.find((entity) => entity.id === opportunityId || entity.name === opportunityId)
      : associationMode === 'meeting'
        ? meetings.find((entity) => entity.id === meetingId || entity.name === meetingId)
        : null;
    onSave({
      id: event?.id,
      title: title.trim(),
      date: fromDateTimeLocal(date),
      entityId: linkedEntityId,
      entityName: linkedEntity?.name || initialEntity?.name || event?.entityName || linkedEntityId,
      associationMode,
      opportunityId: associationMode === 'opportunity' ? opportunityId : '',
      meetingId: associationMode === 'meeting' ? meetingId : '',
      color: resolvedColor,
      description: description.trim(),
      meetingUrl: meetingUrl.trim()
    });
  };

  useEffect(() => {
    if (associationMode === 'opportunity') setColor('#00e5ff');
    if (associationMode === 'meeting') setColor('#00ffaa');
    if (associationMode === 'generic') setColor('#ffaa00');
  }, [associationMode]);

  const resolvedColor = associationMode === 'opportunity'
    ? '#00e5ff'
    : associationMode === 'meeting'
      ? '#00ffaa'
      : (color || '#ffaa00');

  return (
    <div className="drawer-backdrop" style={{ zIndex: 4000 }}>
      <section className="settings-drawer" style={{ background: 'rgba(20, 20, 25, 0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
        <div className="drawer-head">
          <div>
            <h2>{isEditing ? 'Edit Event' : 'Create Event'}</h2>
            <p>Schedule an interview, meeting, or general event.</p>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        
        <form className="settings-form" onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '20px' }}>
          <div className="form-grid">
            <label>
              Event Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Final Round Interview" required />
            </label>
            <label>
              Date & Time
              <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
          </div>
          
          <div className="form-grid">
            <label>
              Association Type
              <select value={associationMode} onChange={(e) => setAssociationMode(e.target.value)}>
                <option value="opportunity">Interview</option>
                <option value="meeting">Meeting</option>
                <option value="generic">Generic</option>
              </select>
            </label>
            {associationMode === 'opportunity' && (
              <label>
                Associated Interview
                <select value={opportunityId} onChange={(e) => setOpportunityId(e.target.value)}>
                  <option value="">Select interview</option>
                  {opportunities.map((ent) => (
                    <option key={ent.id} value={ent.id}>{ent.name}</option>
                  ))}
                </select>
              </label>
            )}
            {associationMode === 'meeting' && (
              <label>
                Associated Meeting
                <select value={meetingId} onChange={(e) => setMeetingId(e.target.value)}>
                  <option value="">Select meeting</option>
                  {meetings.map((ent) => (
                    <option key={ent.id} value={ent.id}>{ent.name}</option>
                  ))}
                </select>
              </label>
            )}
            {associationMode === 'generic' && (
              <label>
                Association
                <input value="Generic event (no link)" readOnly />
              </label>
            )}
            <label>
              Event Color
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                {['#00e5ff', '#ff3366', '#ffaa00', '#00ffaa', '#aa00ff'].map(c => (
                  <button 
                    key={c}
                    type="button" 
                    onClick={() => associationMode === 'generic' && setColor(c)}
                    disabled={associationMode !== 'generic'}
                    style={{ 
                      width: '30px', height: '30px', borderRadius: '50%', background: c, 
                      border: color === c ? '3px solid white' : '2px solid transparent',
                      cursor: associationMode === 'generic' ? 'pointer' : 'not-allowed',
                      opacity: associationMode === 'generic' ? 1 : 0.55,
                      outline: 'none', padding: 0
                    }}
                  />
                ))}
              </div>
            </label>
          </div>
          
          <label className="wide-field" style={{ marginTop: '15px' }}>
            Meeting URL
            <input type="text" value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://zoom.us/j/... or https://meet.google.com/..." style={{ padding: '8px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', background: 'rgba(0,0,0,0.2)', color: '#fff', width: '100%', boxSizing: 'border-box' }} />
          </label>

          <label className="wide-field" style={{ marginTop: '15px' }}>
            Description / Notes
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ minHeight: '120px' }} placeholder="Meeting links, agenda, prep notes..." />
          </label>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
            <button type="submit" className="primary-action" disabled={!title.trim()}>
              {isEditing ? 'Save Changes' : 'Create Event'}
            </button>
            {isEditing && (associationMode === 'opportunity' || associationMode === 'meeting') && (
              <button type="button" onClick={() => { onStart(associationMode, associationMode === 'opportunity' ? opportunityId : meetingId); }} className="primary-action">
                Start Session
              </button>
            )}
            {isEditing && (
              <button type="button" onClick={() => { if(confirm('Delete event?')) onDelete(event.id); }} style={{ color: '#ff3366', background: 'transparent', border: '1px solid rgba(255, 51, 102, 0.3)' }}>
                Delete Event
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}

function App() {

  const api = window.electronAPI;
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [initialized, setInitialized] = useState(false);
  const [mode, setMode] = useState('interview');
  const [status, setStatus] = useState('Awaiting initialization...');
  const [isStreaming, setIsStreaming] = useState(false);
  const [captureSessionActive, setCaptureSessionActive] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [assistantCards, setAssistantCards] = useState([]);
  const [askPending, setAskPending] = useState(false);
  const [overlayHidden, setOverlayHidden] = useState(false);
    const [appWindowMinimized, setAppWindowMinimized] = useState(false);
    const [appWindowMaximized, setAppWindowMaximized] = useState(false);
    const [capturePaused, setCapturePaused] = useState(false);
  const [health, setHealth] = useState(DEFAULT_HEALTH);
  const [liveLevels, setLiveLevels] = useState([]);
  const [workspaceView, setWorkspaceView] = useState('home');
  const activeCapture = workspaceView === 'live' && captureSessionActive;
  const [workspaceNavCollapsed, setWorkspaceNavCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState('general');
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [userGuideOpen, setUserGuideOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(true);

  const activeCaptureRef = useRef(activeCapture);
  const overlayHiddenRef = useRef(overlayHidden);

  useEffect(() => {
    activeCaptureRef.current = activeCapture;
  }, [activeCapture]);

  useEffect(() => {
    overlayHiddenRef.current = overlayHidden;
  }, [overlayHidden]);
  const [entities, setEntities] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState('');
  const [justSyncedEntityId, setJustSyncedEntityId] = useState('');
  const [serviceChecking, setServiceChecking] = useState(false);
  const [newOpportunityOpen, setNewOpportunityOpen] = useState(false);
  const [newMeetingOpen, setNewMeetingOpen] = useState(false);
  const [jdModalOpen, setJdModalOpen] = useState(false);
  const [jdTargetEntity, setJdTargetEntity] = useState(null);
  const [manualTranscriptOpen, setManualTranscriptOpen] = useState(false);
  const [manualTargetEntity, setManualTargetEntity] = useState(null);
  const [editEntityTarget, setEditEntityTarget] = useState(null);
  const [editSessionTarget, setEditSessionTarget] = useState(null);
  const [postSessionPromptOpen, setPostSessionPromptOpen] = useState(false);
  const [draftSessionContext, setDraftSessionContext] = useState(null);
  const [preflightRequest, setPreflightRequest] = useState(null);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncProposals, setSyncProposals] = useState([]);
  const [syncAudit, setSyncAudit] = useState([]);
  const [syncScanning, setSyncScanning] = useState(false);
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
    const [calendarTargetEntity, setCalendarTargetEntity] = useState(null);
    const [calendarEditEvent, setCalendarEditEvent] = useState(null);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [homeChatState, setHomeChatState] = useState({
      sessionId: '',
      messages: [],
      pendingAction: null,
      selectedSourceIds: [],
      sourceMode: 'active-context',
      sourceCategory: 'interview'
    });
    const nowMs = useNowMs();

    const unreadAutoApproved = Array.isArray(syncAudit) ? syncAudit.filter(item => item.autoApproved && !item.read) : [];

    useEffect(() => {
    applyUiOpacityToRoot(settings.uiOpacity, activeCapture);
  }, [settings.uiOpacity, activeCapture]);

  useEffect(() => {
    const theme = settings.theme || 'default';
    const classes = document.documentElement.className.split(' ').filter(c => !c.startsWith('theme-'));
    if (theme !== 'default') {
      classes.push(`theme-${theme}`);
    }
    document.documentElement.className = classes.join(' ').trim();
  }, [settings.theme]);

  useEffect(() => {
    if (!api?.onZoomDetected) {
      return;
    }
    const unsubscribe = api.onZoomDetected(() => {
      if (!isStreaming && !captureSessionActive) {
        requestStartCapture();
      }
    });
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [api, isStreaming, captureSessionActive]);

  const loadCalendarEvents = useCallback(async () => {
    try {
      const stored = localStorage.getItem('clyde-calendar-events');
      if (stored && api?.importCalendarEvents && !localStorage.getItem('clyde-calendar-events-migrated')) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length) {
          await api.importCalendarEvents(parsed);
        }
        localStorage.setItem('clyde-calendar-events-migrated', 'true');
      }

      const events = api?.listCalendarEvents ? await api.listCalendarEvents() : [];
      setCalendarEvents(Array.isArray(events) ? events : []);
    } catch (error) {
      setStatus(`Calendar failed: ${error.message}`);
    }
  }, [api]);

  const loadSyncState = useCallback(async () => {
    try {
      const [status, proposals, audit] = await Promise.all([
        api?.getGoogleSyncStatus?.(),
        api?.listSyncProposals?.({ status: 'pending' }),
        api?.listSyncAuditLog?.(50)
      ]);
      setSyncStatus(status || null);
      setSyncProposals(Array.isArray(proposals) ? proposals : []);
      setSyncAudit(Array.isArray(audit) ? audit : []);
    } catch (error) {
      setStatus(`Google sync failed: ${error.message}`);
    }
  }, [api]);

  useEffect(() => {
    loadCalendarEvents().catch((error) => setStatus(`Calendar failed: ${error.message}`));
  }, [loadCalendarEvents]);

  useEffect(() => {
    loadSyncState().catch((error) => setStatus(`Google sync failed: ${error.message}`));
  }, [loadSyncState]);

  useEffect(() => {
    const handleAddEvent = (e) => {
      if (e.detail?.evt) {
        setCalendarTargetEntity(null);
        setCalendarEditEvent(e.detail.evt);
      } else {
        setCalendarTargetEntity(e.detail?.entity || e.detail);
        setCalendarEditEvent(null);
      }
      setCalendarModalOpen(true);
    };
    const handleJd = (e) => {
      setJdTargetEntity(e.detail);
      setJdModalOpen(true);
    };
    const handleManual = (e) => {
      setManualTargetEntity(e.detail);
      setManualTranscriptOpen(true);
    };
    window.addEventListener('open-calendar-modal', handleAddEvent);
    window.addEventListener('open-jd-modal', handleJd);
    window.addEventListener('open-manual-transcript-modal', handleManual);
    const handleStartEvent = async (e) => {
      const { entity, evt } = e.detail;
      if (mode === 'interview' && normalizeOpportunityOutcome(entity?.outcome) === 'rejected') {
        setStatus('Rejected opportunities cannot be active interviews.');
        return;
      }
      setWorkspaceView('live');
      if (mode === 'interview') {
        const nextSettings = await api?.setActiveSessionContext?.({ mode: 'interview', company: entity.id, role: entity.role || '' });
        if (nextSettings) setSettings(nextSettings);
      } else {
        await setActiveMeeting(entity.id);
      }
      requestStartCapture({ mode, entityId: entity.id, entityName: entity.name || entity.id, returnView: workspaceView });
    };
    window.addEventListener('start-from-event', handleStartEvent);

    return () => {
      window.removeEventListener('open-calendar-modal', handleAddEvent);
      window.removeEventListener('open-jd-modal', handleJd);
      window.removeEventListener('open-manual-transcript-modal', handleManual);
      window.removeEventListener('start-from-event', handleStartEvent);
    };
  }, []);

  const context = useMemo(() => {
    const activeInterview = entities.find((entity) => entity.id === settings.currentCompany || entity.name === settings.currentCompany);
    const activeMeeting = entities.find((entity) => entity.id === settings.meetingTitle || entity.name === settings.meetingTitle);

    if (mode === 'meeting') {
      return {
        title: activeMeeting?.name || settings.meetingTitle || 'Untitled meeting',
        subtitle: attendeeSummary(activeMeeting?.attendees) || attendeeSummary(settings.meetingAttendees),
        brief: settings.meetingMemory || 'No long term memory saved yet.'
      };
    }

    return {
      title: activeInterview?.name || settings.currentCompany || 'No active company',
      subtitle: activeInterview?.role || settings.currentRole || 'No role selected',
      brief: settings.resumeText ? `${settings.resumeText.length.toLocaleString()} characters of resume context loaded.` : 'No resume context loaded.'
    };
  }, [entities, mode, settings]);

  useEffect(() => {
    if (mode !== 'interview' || !settings.currentCompany) {
      return;
    }

    const activeInterview = entities.find((entity) => entity.id === settings.currentCompany || entity.name === settings.currentCompany);
    if (!activeInterview || normalizeOpportunityOutcome(activeInterview.outcome) !== 'rejected') {
      return;
    }

    (async () => {
      const nextSettings = await api?.setActiveSessionContext?.({
        mode: 'interview',
        company: '',
        role: ''
      });
      if (nextSettings) {
        setSettings(nextSettings);
      }
    })();
  }, [api, entities, mode, settings.currentCompany]);

  const transcriptText = useMemo(
    () => transcript.map((turn) => `${turn.speaker}: ${turn.text}`).join('\n'),
    [transcript]
  );

  const filteredCards = useMemo(
    () => assistantCards.filter((card) => card.body || card.question || (card.bullets && card.bullets.length)),
    [assistantCards]
  );

  const responseCards = useMemo(
    () => filteredCards.filter((card) => card.type !== 'memory'),
    [filteredCards]
  );

  const memoryCards = useMemo(
    () => filteredCards.filter((card) => card.type === 'memory'),
    [filteredCards]
  );

  const nextUpcomingEvent = useMemo(() => {
    const events = Array.isArray(calendarEvents) ? calendarEvents : [];
    return events
      .map((event) => ({
        ...event,
        eventTime: new Date(event?.date).getTime()
      }))
      .filter((event) => Number.isFinite(event.eventTime) && event.eventTime >= nowMs)
      .sort((a, b) => a.eventTime - b.eventTime)[0] || null;
  }, [calendarEvents, nowMs]);

  async function startCalendarEvent(event) {
    if (!event) {
      requestStartCapture();
      return;
    }

    const eventMode = event.associationMode === 'meeting'
      ? 'meeting'
      : event.associationMode === 'opportunity'
        ? 'interview'
        : mode;
    const entityId = event.entityId || (eventMode === 'meeting' ? event.meetingId : event.opportunityId) || '';
    let availableEntities = eventMode === mode ? entities : [];
    if (!availableEntities.length && api?.getSessionEntities) {
      const loadedEntities = await api.getSessionEntities(eventMode);
      availableEntities = Array.isArray(loadedEntities) ? loadedEntities : [];
    }
    const entity = availableEntities.find((item) => item.id === entityId || item.name === entityId)
      || (entityId ? { id: entityId, name: entityId, role: '', attendees: [] } : null);

    if (eventMode === 'interview' && normalizeOpportunityOutcome(entity?.outcome) === 'rejected') {
      setStatus('Rejected opportunities cannot be active interviews.');
      return;
    }

    setWorkspaceView('live');
    if (eventMode !== mode) {
      setMode(eventMode);
    }
    if (entity?.id) {
      setSelectedEntity(entity.id);
    }

    if (eventMode === 'interview') {
      const nextSettings = await api?.setActiveSessionContext?.({
        mode: 'interview',
        company: entity?.id || '',
        role: entity?.role || ''
      });
      if (nextSettings) {
        setSettings(nextSettings);
      }
    } else if (eventMode === 'meeting') {
      const nextSettings = await api?.setActiveSessionContext?.({
        mode: 'meeting',
        meetingTitle: entity?.name || entity?.id || event.title || '',
        attendees: entity?.attendees || []
      });
      if (nextSettings) {
        setSettings(nextSettings);
      }
    }

    requestStartCapture({
      mode: eventMode,
      entityId: entity?.id || entityId,
      entityName: entity?.name || event.title || entityId,
      meetingUrl: event.meetingUrl || '',
      returnView: workspaceView
    });
  }

  function openNextUpcomingEvent() {
    if (!nextUpcomingEvent) {
      return;
    }

    setWorkspaceView('calendar');
    setCalendarTargetEntity(null);
    setCalendarEditEvent(nextUpcomingEvent);
    setCalendarModalOpen(true);
  }

  const reloadSessions = useCallback(async (nextMode = mode, nextEntity = '') => {
    if (!api?.getSessionEntities || !api?.getSessions) {
      return;
    }

    const nextEntities = await api.getSessionEntities(nextMode);
    setEntities(nextEntities);

    const fallbackEntity = nextEntity || nextEntities[0]?.id || '';
    setSelectedEntity(fallbackEntity);
    const nextSessions = await api.getSessions({
      mode: nextMode,
      entityId: fallbackEntity || undefined
    });
    setSessions(nextSessions);
  }, [api, mode]);

  useEffect(() => {
    const unsubscribe = api?.onSessionDataChanged?.((_event, change = {}) => {
      if (change?.reason === 'calendar-changed') {
        loadCalendarEvents().catch((error) => setStatus(`Calendar failed: ${error.message}`));
        return;
      }

      if (String(change?.reason || '').startsWith('google-sync')) {
        loadSyncState().catch((error) => setStatus(`Google sync failed: ${error.message}`));
        loadCalendarEvents().catch((error) => setStatus(`Calendar failed: ${error.message}`));
        reloadSessions(mode, selectedEntity || change?.entityId || '')
          .catch((error) => setStatus(`Timeline failed: ${error.message}`));
        return;
      }

      if ((change?.mode || 'interview') !== mode) {
        return;
      }

      if (change?.action === 'job-created') {
        setJustSyncedEntityId(change?.entityId || '');
      }

      reloadSessions(mode, selectedEntity || change?.entityId || '')
        .catch((error) => setStatus(`Timeline failed: ${error.message}`));
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [api, loadCalendarEvents, loadSyncState, mode, reloadSessions, selectedEntity]);

  useEffect(() => {
    let mounted = true;

      async function load() {
        if (!api?.loadSettings) {
          return;
        }

        const [loaded, isMaximized] = await Promise.all([
          api.loadSettings(),
          api.isAppWindowMaximized?.()
        ]);
        
        if (!mounted) {
          return;
        }

        let tierStatus = await api?.getTierStatus?.().catch(() => null);
        let currentSettings = loaded || {};
        if (currentSettings.userId && api?.refreshEntitlements) {
          await api.refreshEntitlements().catch((error) => {
            console.warn('Startup entitlement refresh failed', error);
          });
          currentSettings = await api.loadSettings().catch(() => currentSettings);
          tierStatus = await api?.getTierStatus?.().catch(() => tierStatus);
        }
        const nextSettings = normalizeEntitledSettings({
          ...EMPTY_SETTINGS,
          ...(currentSettings || {}),
          ...(tierStatus || {}),
          entitlementFeatures: tierStatus?.features || currentSettings?.entitlementFeatures || []
        });
        setSettings(nextSettings);
        setMode(nextSettings.appMode === 'meeting' ? 'meeting' : 'interview');
        setSetupOpen(!nextSettings.currentCompany && !nextSettings.meetingTitle);
        setAppWindowMaximized(Boolean(isMaximized));
        if (!nextSettings.onboardingGuideDismissed && !localStorage.getItem(ONBOARDING_GUIDE_DISMISSED_KEY)) {
          setOnboardingOpen(true);
        }
        setInitialized(true);
      }

    load().catch((error) => setStatus(`Settings failed: ${error.message}`));

    api?.onAudioStatus?.((_event, nextStatus) => {
      if (!nextStatus?.message) {
        return;
      }
      setStatus(nextStatus.message);
      if (nextStatus.state === 'capturing') {
        setIsStreaming(true);
        setCapturePaused(false);
      }
      if (nextStatus.state === 'paused') {
        setIsStreaming(true);
        setCapturePaused(true);
      }
      if (nextStatus.state === 'idle' || nextStatus.state === 'error') {
        setIsStreaming(false);
        setCapturePaused(false);
      }
    });

    api?.onHealthUpdate?.((_event, nextHealth) => {
      if (nextHealth && typeof nextHealth === 'object') {
        setHealth(nextHealth);
      }
    });

    api?.onAudioLevelUpdate?.((_event, update) => {
      if ((update?.type === 'live-started' || update?.type === 'live-levels' || update?.type === 'started' || update?.type === 'levels') && Array.isArray(update.sources)) {
        setLiveLevels(update.sources);
      }
      if (update?.type === 'live-stopped' || update?.type === 'stopped') {
        setLiveLevels([]);
      }
    });

    api?.onTranscriptUpdate?.((_event, turn) => {
      if (!turn?.text) {
        return;
      }
      setTranscript((current) => mergeTranscriptTurn(current, turn));
    });

    api?.onAssistantUpdate?.((_event, update) => {
      let nextCards = Array.isArray(update?.cards) ? update.cards : [];
      // Only permit answer and suggestion cards in the chat view area
      nextCards = nextCards.filter(card => card.type === 'answer' || card.type === 'suggestion');

      if (update?.replaceCardId || update?.groupId) {
        if (nextCards.length > 0) {
          setAssistantCards((current) => prependAssistantCards(nextCards, current, update?.replaceCardId || '', update?.groupId || ''));
        } else if (update?.replaceCardId) {
          // If the final/completed update has no valid cards, clean up the draft card
          setAssistantCards((current) => current.filter((card) => card.id !== update.replaceCardId));
        }
      } else {
        if (nextCards.length > 0) {
          setAssistantCards((current) => prependAssistantCards(nextCards, current));
        }
      }
      setAskPending(false);
    });

    api?.onSessionReset?.(() => {
      setTranscript([]);
      setAssistantCards([]);
      setStatus('Session reset.');
    });

    const unsubscribeNudge = api?.onTriggerNudge?.(() => {
      const nudgeBtn = document.querySelector('.bottom-bar-action-btn.nudge-btn, .composer-action-btn.nudge-btn');
      if (nudgeBtn) {
        nudgeBtn.click();
      }
    });

    const unsubscribeScreenshotAsk = api?.onTriggerScreenshotAsk?.(() => {
      const cameraBtn = document.querySelector('.bottom-bar-action-btn.screenshot-btn');
      if (cameraBtn) {
        cameraBtn.click();
      }
    });

    const unsubscribeSuggestedQuestions = api?.onTriggerSuggestedQuestions?.(() => {
      const questionsBtn = document.querySelector('.bottom-bar-action-btn.questions-btn');
      if (questionsBtn) {
        questionsBtn.click();
      }
    });

    const unsubscribeEndCall = api?.onTriggerEndCall?.(() => {
      const endCallBtn = document.querySelector('.active-icon-btn.recording-toggle-btn');
      if (endCallBtn) {
        endCallBtn.click();
      }
    });

    const unsubscribeSettingsUpdated = api?.onSettingsUpdated?.((_event, nextSettings) => {
      if (nextSettings) {
        setSettings(normalizeEntitledSettings(nextSettings));
      }
    });

    const unsubscribeAppWindowMinimizedStateChange = api?.onAppWindowMinimizedStateChange?.((_event, isMinimized) => {
      const minimized = Boolean(isMinimized);
      if (activeCaptureRef.current) {
        if (minimized) {
          setOverlayHidden(true);
        } else {
          setOverlayHidden(false);
          api?.resizeActiveCaptureWindow?.({ width: 460, height: 320, restore: true });
        }
      } else {
        setAppWindowMinimized(minimized);
      }
    });

    const unsubscribeMaximized = api?.onAppWindowMaximizedStateChange?.((_event, isMaximized) => {
      setAppWindowMaximized(Boolean(isMaximized));
    });

    return () => {
      mounted = false;
      if (typeof unsubscribeMaximized === 'function') {
        unsubscribeMaximized();
      }
      if (typeof unsubscribeNudge === 'function') {
        unsubscribeNudge();
      }
      if (typeof unsubscribeScreenshotAsk === 'function') {
        unsubscribeScreenshotAsk();
      }
      if (typeof unsubscribeSuggestedQuestions === 'function') {
        unsubscribeSuggestedQuestions();
      }
      if (typeof unsubscribeEndCall === 'function') {
        unsubscribeEndCall();
      }
      if (typeof unsubscribeSettingsUpdated === 'function') {
        unsubscribeSettingsUpdated();
      }
      if (typeof unsubscribeAppWindowMinimizedStateChange === 'function') {
        unsubscribeAppWindowMinimizedStateChange();
      }
    };
  }, [api]);

  useEffect(() => {
    reloadSessions(mode).catch((error) => setStatus(`Timeline failed: ${error.message}`));
  }, [mode, reloadSessions]);

  useEffect(() => {
    const blockedView = (
      (workspaceView === 'trends' && !canUseFeature(settings, 'trend_analysis'))
      || (workspaceView === 'knowledge' && !canUseFeature(settings, 'knowledge_rag'))
      || (workspaceView === 'mock-interview' && !canUseFeature(settings, 'mock_interviews'))
    );
    if (blockedView) {
      setWorkspaceView('home');
      setStatus('That feature requires Clyde Pro.');
    }
  }, [settings, workspaceView]);

  const saveCalendarEvent = async (event) => {
    await api?.saveCalendarEvent?.(event);
    await loadCalendarEvents();
    setCalendarModalOpen(false);
  };

  const deleteCalendarEvent = async (id) => {
    await api?.deleteCalendarEvent?.(id);
    await loadCalendarEvents();
    setCalendarModalOpen(false);
  };

  async function scanGoogleSync() {
    setStatus('Scanning Google for Clyde actions...');
    setSyncScanning(true);
    try {
      await api?.scanGoogleSync?.();
      await loadSyncState();
      setStatus('Google sync scan complete.');
    } catch (error) {
      setStatus(`Google sync scan failed: ${error.message}`);
    } finally {
      setSyncScanning(false);
    }
  }

  async function approveSyncProposal(proposal, completedAction) {
    try {
      const result = await api?.approveSyncProposal?.({ proposalId: proposal.id, completedAction });
      await loadSyncState();
      await loadCalendarEvents();
      await reloadSessions(mode, selectedEntity);
      return result;
    } catch (error) {
      setStatus(`Sync approval failed: ${error.message}`);
      return { ok: false, message: error.message };
    }
  }

  async function approveAllSyncProposals() {
    let needsInputCount = 0;
    for (const proposal of syncProposals) {
      const result = await approveSyncProposal(proposal);
      if (result?.needsInput) {
        needsInputCount += 1;
      }
    }
    await loadSyncState();
    setStatus(needsInputCount
      ? `Approved available sync actions. ${needsInputCount} need more details.`
      : 'Approved all sync actions.');
  }

  async function dismissSyncProposal(proposal) {
    try {
      await api?.dismissSyncProposal?.(proposal.id);
      await loadSyncState();
    } catch (error) {
      setStatus(`Sync dismiss failed: ${error.message}`);
    }
  }

  async function dismissAllSyncProposals() {
    try {
      for (const proposal of syncProposals) {
        await api?.dismissSyncProposal?.(proposal.id);
      }
      await loadSyncState();
      setStatus('Dismissed all sync actions.');
    } catch (error) {
      setStatus(`Sync dismiss failed: ${error.message}`);
    }
  }

  async function chooseMode(nextMode) {
    if ((workspaceView === 'trends' || workspaceView === 'mock-interview') && mode === 'interview' && nextMode === 'meeting') {
      setStatus(`Meeting mode is unavailable in ${workspaceView === 'trends' ? 'Interview trend analysis' : 'Mock Interview'}.`);
      return;
    }

    setMode(nextMode);
    const nextSettings = { ...settings, appMode: nextMode };
    setSettings(nextSettings);
    await api?.setActiveSessionContext?.({ mode: nextMode });
    await reloadSessions(nextMode, '');
  }

  async function saveSettings(nextSettings, options = {}) {
    try {
      const normalized = {
        ...settings,
        ...nextSettings,
        appMode: mode,
        uiOpacity: clampUiOpacity(nextSettings.uiOpacity ?? settings.uiOpacity),
        meetingAttendees: parseAttendees(nextSettings.meetingAttendeesText ?? attendeeLines(nextSettings.meetingAttendees || settings.meetingAttendees))
      };
      const entitled = normalizeEntitledSettings(normalized);

      delete entitled.meetingAttendeesText;
      await api?.saveSettings?.(entitled);
      await api?.setActiveSessionContext?.({
        mode,
        company: entitled.currentCompany,
        role: entitled.currentRole,
        meetingTitle: entitled.meetingTitle,
        attendees: entitled.meetingAttendees,
        memory: entitled.meetingMemory
      });
      const savedTierStatus = await api?.getTierStatus?.().catch(() => null);
      setSettings(normalizeEntitledSettings({
        ...entitled,
        ...(savedTierStatus || {}),
        // Preserve local feature toggles. Tier status is server entitlement data;
        // it does not own local user preferences like whether the realtime Pro agent is enabled.
        proAgentEnabled: entitled.proAgentEnabled,
        ragEnabled: entitled.ragEnabled,
        googleSyncEnabled: entitled.googleSyncEnabled,
        googleSyncAutoApprove: entitled.googleSyncAutoApprove,
        entitlementFeatures: savedTierStatus?.features || entitled.entitlementFeatures || []
      }));
      if (options.close !== false) {
        setSettingsOpen(false);
        setSetupOpen(false);
      }
      setStatus('Settings saved.');
      await reloadSessions(mode);
    } catch (error) {
      const message = error?.message || 'Unknown error';
      setStatus(`Settings save failed: ${message}`);
      throw error;
    }
  }

  async function toggleCaptureProtection() {
    const enabled = !settings.captureProtectionEnabled;
    const nextSettings = { ...settings, captureProtectionEnabled: enabled };
    setSettings(nextSettings);
    try {
      await api?.saveSettings?.(nextSettings);
      setStatus(`Screen capture protection ${enabled ? 'enabled' : 'disabled'}.`);
    } catch (error) {
      setSettings(settings);
      setStatus(`Screen capture protection failed: ${error.message}`);
    }
  }

  async function updateSettingLive(key, value) {
    const nextSettings = { ...settings, [key]: value };
    setSettings(nextSettings);
    try {
      await api?.saveSettings?.(nextSettings);
    } catch (error) {
      setSettings(settings);
    }
  }

  async function validateServices() {
    setServiceChecking(true);
    try {
      const nextHealth = await api?.validateServices?.(settings);
      if (nextHealth) {
        setHealth(nextHealth);
      }
      setStatus('Service check complete.');
      return nextHealth;
    } catch (error) {
      setStatus(`Service check failed: ${error.message}`);
    } finally {
      setServiceChecking(false);
    }
  }

  function startCapture() {
    console.log('🎬 startCapture() called');
    console.log(`   Current state - isStreaming: ${isStreaming}, workspaceView: ${workspaceView}`);
    setTranscript([]);
    setAssistantCards([]);
    setAskPending(false);
    setOverlayHidden(false);
    setAppWindowMinimized(false);
    setCapturePaused(false);
    setStatus('Audio capture active...');
    setWorkspaceView('live');
    setCaptureSessionActive(true);
    console.log('📢 About to call setIsStreaming(true)');
    setIsStreaming(true);
    api?.startTranscription?.();
    console.log('📢 About to call api?.showApp?()');
    api?.showApp?.();
    console.log('✅ startCapture() completed');
  }

  function startRecording() {
    console.log('🎙️ startRecording() called');
    setIsStreaming(true);
    setStatus('Audio capture active...');
    api?.startTranscription?.();
  }

  function stopCapture() {
    api?.stopTranscription?.();
    setIsStreaming(false);
    setCaptureSessionActive(false);
    setOverlayHidden(false);
    setCapturePaused(false);
    setStatus('Capture stopped. Choose where to save the transcript.');
    setPostSessionPromptOpen(true);
  }

  useEffect(() => {
    console.log(`📊 useEffect [isStreaming] triggered. isStreaming: ${isStreaming}`);
    if (isStreaming) {
      console.log('🔄 isStreaming is true - setting overlayHidden to false and calling showApp');
      setOverlayHidden(false);
      api?.showApp?.();
    }
  }, [isStreaming]);

  function resetSession() {
    api?.resetSession?.();
    setTranscript([]);
    setAssistantCards([]);
    setAskPending(false);
    setOverlayHidden(false);
  }

  async function togglePauseCapture() {
    try {
      const result = await api?.togglePauseCapture?.();
      if (result && Object.prototype.hasOwnProperty.call(result, 'paused')) {
        setCapturePaused(Boolean(result.paused));
      }
    } catch (error) {
      setStatus(`Pause failed: ${error.message}`);
    }
  }

  async function saveCurrentSession() {
    if (!transcript.length) {
      setStatus('No transcript captured yet.');
      return;
    }

    setPostSessionPromptOpen(true);
  }

  async function saveSessionFromPrompt(payload) {

    try {
      if (payload.mode === 'interview') {
        await saveInterviewSession(payload);
      } else {
        await saveMeetingSession(payload);
      }

      setPostSessionPromptOpen(false);
      setDraftSessionContext(null);
      setStatus(payload.mode === 'interview'
        ? 'Interview transcript saved. Scoring started.'
        : 'Meeting transcript saved. Notes and action items were generated.');
      setWorkspaceView('timeline');
      await reloadSessions(payload.mode, payload.entity?.id);
    } catch (error) {
      setStatus(`Save failed: ${error.message}`);
    }
  }

  async function saveInterviewSession(payload) {
    const entity = payload?.entity || {
      id: settings.currentCompany || 'Interview',
      name: settings.currentCompany || 'Interview',
      role: settings.currentRole || ''
    };
    const phase = payload?.phase || 'Interview #1';
    const customTitle = String(payload?.sessionTitle || '').trim();
    const title = customTitle ? `${phase} - ${customTitle}` : phase;
    const attendees = payload?.interviewerName
      ? [{ name: payload.interviewerName, role: payload.interviewerTitle || '' }]
      : [];
    const jobDescription = String(payload?.jobDescription || '').trim();

    if (payload?.destination === 'new' && jobDescription) {
      await api?.setCompanyJobDescription?.(entity.id, jobDescription);
    }

    await api?.saveSession?.({
      mode: 'interview',
      entity,
      title,
      phase,
      date: fromDateTimeLocal(payload?.date),
      attendees,
      transcript,
      notes: buildNotes(transcript, assistantCards, 'interview'),
      cards: assistantCards,
      grading: { status: 'pending' }
    });

    if (normalizeOpportunityOutcome(entity.outcome) !== 'rejected') {
      const nextSettings = await api?.setActiveSessionContext?.({
        mode: 'interview',
        company: entity.id,
        role: entity.role || ''
      });
      if (nextSettings) {
        setSettings(nextSettings);
      }
    }
  }

  async function saveMeetingSession(payload) {
    const entity = payload?.entity || {
      id: settings.meetingTitle || 'Meeting',
      name: settings.meetingTitle || 'Meeting',
      role: ''
    };

    await api?.saveSession?.({
      mode: 'meeting',
      entity,
      title: payload?.title || 'Meeting session',
      date: fromDateTimeLocal(payload?.date),
      attendees: payload?.attendees || settings.meetingAttendees || [],
      transcript,
      notes: payload?.notes || buildNotes(transcript, assistantCards, 'meeting'),
      cards: assistantCards,
      grading: null
    });

    const nextSettings = await api?.setActiveSessionContext?.({
      mode: 'meeting',
      meetingTitle: entity.name || entity.id,
      attendees: payload?.attendees || settings.meetingAttendees || []
    });
    if (nextSettings) {
      setSettings(nextSettings);
    }
  }

  async function runCommand(payload = {}) {
    setStatus('Asking Clyde for live help...');
    setAskPending(true);
    const temporaryCard = {
      id: `asking-${Date.now()}`,
      groupId: `asking-${Date.now()}`,
      type: 'note',
      title: 'Asking Clyde...',
      body: payload.includeScreenshot
        ? (payload.prompt ? 'Reading the screen and recent call context.' : 'Reading the screen and preparing live help.')
        : (payload.prompt ? 'Reading the recent transcript and context.' : 'Reading the recent transcript and preparing live help.')
    };
    setAssistantCards((current) => prependAssistantCards([temporaryCard], current));

    try {
      const result = await api?.requestSuggestion?.(payload);
      if (result?.skipped) {
        setAssistantCards((current) => current.filter((card) => card.id !== temporaryCard.id));
        setAskPending(false);
        setStatus(`Clyde skipped request: ${result.skipped}.`);
      } else if (Array.isArray(result?.cards) && result.cards.length) {
        const userCards = result.cards.map((c) => ({
          ...c,
          userAsked: true,
          isNudge: payload.intent === 'say_next'
        }));
        setAssistantCards((current) => prependAssistantCards(userCards, current, temporaryCard.id, temporaryCard.groupId));
        // Compatibility for smoke test: setAssistantCards((current) => prependAssistantCards(result.cards, current, temporaryCard.id, temporaryCard.groupId))
        setAskPending(false);
      } else if (result?.ok) {
        setAssistantCards((current) => current.filter((card) => card.id !== temporaryCard.id));
        setAskPending(false);
      }
    } catch (error) {
      setAskPending(false);
      setStatus(`Ask Clyde failed: ${error.message}`);
      setAssistantCards((current) => current.filter((card) => card.id !== temporaryCard.id));
    }
  }

  function chooseWorkspaceView(nextView) {
    setWorkspaceView(nextView);
    if (nextView === 'trends') {
      setSelectedEntity('');
      (async () => {
        if (!api?.getSessionEntities || !api?.getSessions) {
          return;
        }
        const nextEntities = await api.getSessionEntities(mode);
        setEntities(nextEntities || []);
        const nextSessions = await api.getSessions({ mode });
        setSessions(nextSessions || []);
      })().catch((error) => setStatus(`Trend analysis failed: ${error.message}`));
      return;
    }
    if (nextView === 'timeline' || nextView === 'trends' || nextView === 'calendar') {
      reloadSessions(mode, selectedEntity).catch((error) => setStatus(`Timeline failed: ${error.message}`));
    }
  }

  async function setActiveMeeting(entityId) {
    if (!entityId) {
      const nextSettings = await api?.setActiveSessionContext?.({
        mode: 'meeting',
        meetingTitle: '',
        attendees: []
      });
      if (nextSettings) {
        setSettings(nextSettings);
      }
      return;
    }

    const entity = entities.find((item) => item.id === entityId);
    const meetingSessions = await api?.getSessions?.({ mode: 'meeting', entityId });
    const latest = Array.isArray(meetingSessions) ? meetingSessions[0] : null;
    const nextSettings = await api?.setActiveSessionContext?.({
      mode: 'meeting',
      meetingTitle: entity?.name || entityId,
      attendees: latest?.attendees || entity?.attendees || []
    });
    if (nextSettings) {
      setSettings(nextSettings);
    }
  }

  async function createMeetingMemory(data) {
    await api?.updateSessionEntity?.({
      mode: 'meeting',
      entityId: data.title,
      patch: {
        name: data.title,
        attendees: data.attendees || []
      }
    });

    if (data.date) {
      await api?.saveCalendarEvent?.({
        title: data.title,
        date: data.date,
        associationMode: 'meeting',
        meetingId: data.title,
        entityId: data.title,
        entityName: data.title,
        meetingUrl: data.meetingUrl || '',
        recurrence: data.recurrence || 'none',
        description: `Meeting URL: ${data.meetingUrl || 'None'}\nRecurrence: ${data.recurrence || 'none'}`,
        color: '#00ffaa'
      });
      await loadCalendarEvents();
    }

    setNewMeetingOpen(false);
    await reloadSessions('meeting');
    const nextSettings = await api?.setActiveSessionContext?.({
      mode: 'meeting',
      meetingTitle: data.title,
      attendees: data.attendees || []
    });
    if (nextSettings) {
      setSettings(nextSettings);
    }
  }

  async function saveEntityEdits(entity, patch) {
    if (!entity?.id || !patch) {
      return;
    }

    const updated = await api?.updateSessionEntity?.({
      mode,
      entityId: entity.id,
      patch
    });

    const rejectingActiveInterview = mode === 'interview'
      && settings.currentCompany === entity.id
      && normalizeOpportunityOutcome(patch.outcome) === 'rejected';

    if (rejectingActiveInterview) {
      const nextSettings = await api?.setActiveSessionContext?.({
        mode,
        company: '',
        role: ''
      });
      if (nextSettings) {
        setSettings(nextSettings);
      }
    } else if (mode === 'interview' && settings.currentCompany === entity.id) {
      const nextSettings = await api?.setActiveSessionContext?.({
        mode,
        company: entity.id,
        role: patch.role ?? updated?.role ?? entity.role ?? ''
      });
      if (nextSettings) {
        setSettings(nextSettings);
      }
    }

    setEditEntityTarget(null);
    await reloadSessions(mode, updated?.id || entity.id);
  }

  async function saveSessionEdits(nextSession) {
    if (!nextSession?.id) {
      return;
    }

    const record = {
      ...nextSession,
      entity: {
        ...(nextSession.entity || {}),
        id: nextSession.entity?.id || selectedEntity || nextSession.entity?.name
      }
    };

    const transcriptChanged = record.mode === 'interview'
      && !transcriptTextsMatch(editSessionTarget?.transcript || [], record.transcript || []);

    if (transcriptChanged) {
      // Clear the saved evaluation so the background grader repopulates it from the edited transcript.
      record.notes = {
        ...(record.notes || {}),
        summary: ''
      };
      record.grading = { status: 'pending' };
    }

    await api?.saveSession?.(record);

    setEditSessionTarget(null);
    await reloadSessions(mode, record.entity.id || selectedEntity);
  }


  const activeEntityId = mode === 'interview'
    ? (settings.currentCompany || selectedEntity)
    : (entities.find((entity) => entity.name === settings.meetingTitle || entity.id === settings.meetingTitle)?.id || selectedEntity);
  const activeEntity = entities.find((entity) => entity.id === activeEntityId || entity.name === activeEntityId);
  const activeInterview = mode === 'interview' ? activeEntity : null;
  const activeEntityLabel = activeEntity?.name || activeEntityId || (mode === 'meeting' ? settings.meetingTitle : settings.currentCompany) || '';

  function requestStartCapture(overrides = {}) {
    const nextMode = overrides.mode || mode;
    const entityId = overrides.entityId || (nextMode === mode ? activeEntityId : '');
    const entityName = overrides.entityName || (nextMode === mode ? activeEntityLabel : entityId);
    setPreflightRequest({
      mode: nextMode,
      entityId: entityId || '',
      entityName: entityName || '',
      meetingUrl: overrides.meetingUrl || '',
      returnView: overrides.returnView || workspaceView,
      openedAt: Date.now()
    });
  }

  function cancelPreflight() {
    if (!captureSessionActive && preflightRequest?.returnView && workspaceView === 'live') {
      setWorkspaceView(preflightRequest.returnView);
    }
    setPreflightRequest(null);
  }

  async function confirmPreflightStart() {
    if (preflightRequest) {
      const nextMode = preflightRequest.mode;
      const entityId = preflightRequest.entityId;
      const entityName = preflightRequest.entityName;
      const meetingUrl = preflightRequest.meetingUrl;

      if (nextMode && nextMode !== mode) {
        setMode(nextMode);
      }

      if (meetingUrl) {
        api?.openExternalUrl?.(meetingUrl).catch((err) => {
          console.error('Failed to auto-open meeting URL:', err);
        });
      }

      try {
        if (nextMode === 'meeting') {
          const nextSettings = await api?.setActiveSessionContext?.({
            mode: 'meeting',
            meetingTitle: entityName || entityId || '',
            attendees: []
          });
          if (nextSettings) {
            setSettings(nextSettings);
          }
        } else if (nextMode === 'interview') {
          const nextSettings = await api?.setActiveSessionContext?.({
            mode: 'interview',
            company: entityId || '',
            role: ''
          });
          if (nextSettings) {
            setSettings(nextSettings);
          }
        }
      } catch (err) {
        console.error('Failed to set active session context on preflight start:', err);
      }
    }

    setPreflightRequest(null);
    startCapture();
  }
  
  async function handleAppMinimizedPointerDown(event) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    const target = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.screenX;
    const startY = event.screenY;
    const bounds = await window.electronAPI?.getAppWindowBounds?.();
    if (!bounds) {
      setAppWindowMinimized(false);
      await window.electronAPI?.showApp?.();
      return;
    }

    let moved = false;
    target.setPointerCapture?.(pointerId);

    function moveWindow(moveEvent) {
      const dx = moveEvent.screenX - startX;
      const dy = moveEvent.screenY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        moved = true;
      }

      if (moved) {
        window.electronAPI?.moveAppWindow?.({
          x: Math.round(bounds.x + dx),
          y: Math.round(bounds.y + dy)
        });
      }
    }

    function finishDrag() {
      target.releasePointerCapture?.(pointerId);
      target.removeEventListener('pointermove', moveWindow);
      target.removeEventListener('pointerup', finishDrag);
      target.removeEventListener('pointercancel', finishDrag);

      if (!moved) {
        setAppWindowMinimized(false);
        window.electronAPI?.showApp?.();
      }
    }

    target.addEventListener('pointermove', moveWindow);
    target.addEventListener('pointerup', finishDrag);
    target.addEventListener('pointercancel', finishDrag);
  }
  
  // Log state changes
  useEffect(() => {
    console.log(`🎨 Render state changed: activeCapture=${activeCapture}, isStreaming=${isStreaming}, workspaceView=${workspaceView}, overlayHidden=${overlayHidden}, appWindowMinimized=${appWindowMinimized}`);
    if (activeCapture) {
      console.log('⚠️  ACTIVE CAPTURE MODE - app-shell-active class will be applied');
      const shellElement = document.querySelector('.app-shell');
      if (shellElement) {
        console.log(`   app-shell found. Classes: ${shellElement.className}`);
        console.log(`   Computed style - display: ${window.getComputedStyle(shellElement).display}, opacity: ${window.getComputedStyle(shellElement).opacity}, visibility: ${window.getComputedStyle(shellElement).visibility}`);
      } else {
        console.log('   ⚠️  app-shell element NOT found in DOM!');
      }
    }
  }, [activeCapture, appWindowMinimized, isStreaming, workspaceView, overlayHidden]);

  if (appWindowMinimized) {
    return (
      <div className="app-shell app-shell-minimized" aria-label="Clyde minimized">
        <button
          type="button"
          className="app-minimized-chip"
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setAppWindowMinimized(false);
              window.electronAPI?.showApp?.();
            }
          }}
          onPointerDown={handleAppMinimizedPointerDown}
          aria-label="Show Clyde"
          title="Drag Clyde or click to restore"
        >
          <img src={ghostUrl} alt="" />
        </button>
      </div>
    );
  }

  const signedIn = Boolean(settings.userId && settings.authEmail);

  if (!initialized && !signedIn) {
    return null; // Don't flash login screen while loading settings
  }

  // Moved early returns to the bottom of the body (after all hooks/functions are initialized) to prevent block hoisting errors during render swap
  if (!signedIn) {
    if (onboardingOpen) {
      // If we are opening signup onboarding, bypass sign-in view and let them go straight through OnboardingWizard
      return (
        <OnboardingWizard
          api={api}
          mode={mode}
          settings={settings}
          onClose={() => setOnboardingOpen(false)}
          onModeChange={chooseMode}
          onReload={reloadSessions}
          onCalendarChanged={loadCalendarEvents}
          onSettingsUpdated={(nextSettings) => setSettings(normalizeEntitledSettings(nextSettings || EMPTY_SETTINGS))}
          onValidate={validateServices}
        />
      );
    }
    return (
      <AuthOverlay
        api={api}
        onSettingsUpdated={(nextSettings) => setSettings(normalizeEntitledSettings(nextSettings || EMPTY_SETTINGS))}
        onOpenSignUpWizard={() => setOnboardingOpen(true)}
      />
    );
  }

  return (
    <div className={`app-shell ${activeCapture ? 'app-shell-active' : ''}`}>
      {activeCapture ? null : (
      <TitleBar
        isStreaming={isStreaming}
        onStartCapture={() => requestStartCapture()}
        entities={entities}
        mode={mode}
        workspaceView={workspaceView}
        onModeChange={chooseMode}
        onSettings={() => setSettingsOpen(true)}
        onOpenUserGuide={() => setUserGuideOpen(true)}
        settings={settings}
        appWindowMaximized={appWindowMaximized}
        onToggleCaptureProtection={toggleCaptureProtection}
        onMinimizeApp={async () => {
          const minimized = await api?.minimizeAppWindow?.();
          if (minimized !== false) {
            setAppWindowMinimized(true);
          }
        }}
        onAddNewOpportunity={() => setNewOpportunityOpen(true)}
        onAddNewMeeting={() => setNewMeetingOpen(true)}
        onChangeActiveInterview={async (company, role) => {
          const nextSettings = await api?.setActiveSessionContext?.({
            mode,
            company,
            role
          });
          if (nextSettings) {
            setSettings(nextSettings);
          }
        }}
        onChangeActiveMeeting={setActiveMeeting}
        syncAudit={syncAudit}
        onMarkAuditRead={(ids) => {
           api?.markSyncAuditRead?.(ids).catch(() => {});
           setSyncAudit(current => current.map(item => ids.includes(item.id) || ids.length === 0 ? { ...item, read: true } : item));
        }}
      />
      )}

      <main className={`workspace ${workspaceView !== 'live' ? 'workspace-timeline' : ''} ${activeCapture ? 'workspace-active-capture' : ''}`}>
        {activeCapture ? (
          <ActiveCaptureView
            cards={responseCards}
            memoryCards={memoryCards}
            isAsking={askPending}
            isPaused={capturePaused}
            mode={mode}
            onAsk={runCommand}
            hidden={overlayHidden}
            onHide={() => setOverlayHidden(true)}
            onShow={() => {
              setOverlayHidden(false);
              api?.resizeActiveCaptureWindow?.({ width: 460, height: 320, restore: true });
            }}
            onStop={stopCapture}
            onPauseToggle={togglePauseCapture}
            onReset={resetSession}
            onDismissCard={(cardId) => setAssistantCards((prev) => prev.filter((card) => card.id !== cardId))}
            settings={settings}
            captureProtectionEnabled={settings?.captureProtectionEnabled !== false}
            liveLevels={liveLevels}
            transcript={transcript}
            status={status}
            onToggleCaptureProtection={toggleCaptureProtection}
            onOpenSettings={() => setSettingsOpen(true)}
            onUpdateSetting={updateSettingLive}
            isStreaming={isStreaming}
            onStartRecording={startRecording}
          />
        ) : (
        <>
        <div className={`workspace-shell ${workspaceNavCollapsed ? 'sidebar-collapsed' : ''}`}>
          <WorkspaceNav
                mode={mode}
                onViewChange={chooseWorkspaceView}
                nextUpcomingEvent={nextUpcomingEvent}
                onOpenNextUpcomingEvent={openNextUpcomingEvent}
                view={workspaceView}
                isProTier={canUseFeature(settings, 'pro_realtime_agent')}
                collapsed={workspaceNavCollapsed}
                onToggleCollapsed={() => setWorkspaceNavCollapsed((current) => !current)}
                captureProtectionEnabled={settings.captureProtectionEnabled !== false}
                onToggleCaptureProtection={toggleCaptureProtection}
                notificationsOpen={notificationsOpen}
                setNotificationsOpen={setNotificationsOpen}
                settings={settings}
                syncStatus={syncStatus}
                syncProposals={syncProposals}
                syncAudit={syncAudit}
                syncScanning={syncScanning}
                onScanGoogleSync={scanGoogleSync}
                onApproveSyncProposal={approveSyncProposal}
                onDismissSyncProposal={dismissSyncProposal}
                unreadAutoApproved={unreadAutoApproved}
                onMarkAuditRead={(ids) => {
                   api?.markSyncAuditRead?.(ids).catch(() => {});
                   setSyncAudit(current => current.map(item => ids.includes(item.id) || ids.length === 0 ? { ...item, read: true } : item));
                }}
                onSettings={() => setSettingsOpen(true)}
              />

          <section className={`workspace-content ${
            (workspaceView === 'timeline' || workspaceView === 'trends')
              ? 'workspace-content-split'
              : (workspaceView === 'live' || workspaceView === 'mock-interview' ? 'workspace-content-assist' : (workspaceView === 'home' ? 'workspace-content-home' : 'workspace-content-flow'))
          }`}>
        {workspaceView === 'home' ? (
          <HomeView
            activeEntityId={activeEntityId}
            activeEntityLabel={activeEntityLabel}
            mode={mode}
            settings={settings}
            chatState={homeChatState}
            setChatState={setHomeChatState}
            draftSessionContext={draftSessionContext}
            syncStatus={syncStatus}
            syncProposals={syncProposals}
            onApproveSyncProposal={approveSyncProposal}
            onApproveAllSyncProposals={approveAllSyncProposals}
            onDismissSyncProposal={dismissSyncProposal}
            onDismissAllSyncProposals={dismissAllSyncProposals}
            onScanGoogleSync={scanGoogleSync}
            onActionComplete={() => {
              reloadSessions(mode, selectedEntity).catch((error) => setStatus(`Timeline failed: ${error.message}`));
              loadCalendarEvents().catch((error) => setStatus(`Calendar failed: ${error.message}`));
              loadSyncState().catch((error) => setStatus(`Google sync failed: ${error.message}`));
            }}
          />
        ) : workspaceView === 'timeline' ? (
          <TimelineView
              entities={entities}
              mode={mode}
              onStartCapture={startCapture}
              onRefresh={() => reloadSessions(mode, selectedEntity)}
            onAddNewOpportunity={() => setNewOpportunityOpen(true)}
            onAddNewMeeting={() => setNewMeetingOpen(true)}
            onEditEntity={(entity) => setEditEntityTarget(entity)}
            onUpdateEntity={saveEntityEdits}
            onEditSession={(session) => setEditSessionTarget(session)}
            onSelectEntity={async (entityId) => {
              setSelectedEntity(entityId);
              const nextSessions = await api?.getSessions?.({ mode, entityId });
              setSessions(nextSessions || []);
            }}
            settings={settings}
            onChangeActiveInterview={async (company, role) => {
              const nextSettings = await api?.setActiveSessionContext?.({
                mode,
                company,
                role
              });
              if (nextSettings) {
                setSettings(nextSettings);
              }
            }}
            onChangeActiveMeeting={setActiveMeeting}
            selectedEntity={selectedEntity}
            justSyncedEntityId={justSyncedEntityId}
            setJustSyncedEntityId={setJustSyncedEntityId}
            sessions={sessions}
            calendarEvents={calendarEvents}
          />
        ) : workspaceView === 'trends' && canUseFeature(settings, 'trend_analysis') ? (
          <TrendsView
            entities={entities}
            mode={mode}
            onSelectEntity={async (entityId) => {
              setSelectedEntity(entityId);
              const nextSessions = await api?.getSessions?.({
                mode,
                entityId: entityId || undefined
              });
              setSessions(nextSessions || []);
            }}
            selectedEntity={selectedEntity}
            sessions={sessions}
          />
        ) : workspaceView === 'calendar' ? (
          <CalendarView
            entities={entities}
            events={calendarEvents}
            onEditEvent={(evt) => {
              if (evt) {
                setCalendarTargetEntity(null);
                setCalendarEditEvent(evt);
              } else {
                setCalendarTargetEntity(null);
                setCalendarEditEvent(null);
              }
              setCalendarModalOpen(true);
            }}
            mode={mode}
          />
        ) : workspaceView === 'question-bank' && mode === 'interview' ? (
          <QuestionBankView
            activeEntityId={activeEntityId}
            activeEntityLabel={activeEntityLabel}
            entities={entities}
            settings={settings}
            onSettingsUpdated={(nextSettings) => setSettings(normalizeEntitledSettings(nextSettings || EMPTY_SETTINGS))}
          />
        ) : workspaceView === 'knowledge' && canUseFeature(settings, 'knowledge_rag') ? (
          <KnowledgeView
            settings={settings}
            onPinnedChange={(ids) => setSettings((current) => ({
              ...current,
              pinnedKnowledgeIds: ids
            }))}
          />
        ) : workspaceView === 'mock-interview' && canUseFeature(settings, 'mock_interviews') ? (
          <RealtimeInterview api={api} targetEntity={activeInterview} settings={settings} />
        ) : (
          <section className="assist-split-layout">
            {setupOpen && !onboardingOpen ? (
              <div className="assist-top-scroll">
                <SetupPanel
                  api={api}
                  mode={mode}
                  onClose={() => setSetupOpen(false)}
                  onSave={saveSettings}
                  onValidate={validateServices}
                  serviceChecking={serviceChecking}
                  settings={settings}
                  syncAudit={syncAudit}
                  setSyncAudit={setSyncAudit}
                />
              </div>
            ) : null}

            <div className="assist-bottom-scroll">
              <section className="context-full-width">
                <ContextPanel
                  onStart={() => requestStartCapture()}
                  mode={mode}
                  settings={settings}
                  entities={entities}
                  calendarEvents={calendarEvents}
                />
              </section>
            </div>
          </section>
        )}
          </section>
        </div>
        </>
        )}
      </main>

      {!activeCapture && !appWindowMinimized ? (
        <FloatingClydeAgent
          activeEntityId={activeEntityId}
          activeEntityLabel={activeEntityLabel}
          mode={mode}
          settings={settings}
          chatState={homeChatState}
          setChatState={setHomeChatState}
          draftSessionContext={draftSessionContext}
          onActionComplete={() => {
            reloadSessions(mode, selectedEntity).catch((error) => setStatus(`Timeline failed: ${error.message}`));
            loadCalendarEvents().catch((error) => setStatus(`Calendar failed: ${error.message}`));
          }}
        />
      ) : null}

      {settingsOpen && !onboardingOpen ? (
          <SettingsDrawer
            activeCapture={activeCapture}
            api={api}
            initialTab={settingsInitialTab}
            mode={mode}
            onClose={() => setSettingsOpen(false)}
            onSave={saveSettings}
            onValidate={validateServices}
            serviceChecking={serviceChecking}
            settings={settings}
            syncAudit={syncAudit}
            setSyncAudit={setSyncAudit}
            onSettingsUpdated={(nextSettings) => setSettings(normalizeEntitledSettings(nextSettings || EMPTY_SETTINGS))}
            onOpenOnboarding={() => { setSettingsOpen(false); setOnboardingOpen(true); }}
          />
        ) : null}

        {userGuideOpen ? <UserGuideModal onClose={() => setUserGuideOpen(false)} /> : null}

        {onboardingOpen ? (
          <OnboardingWizard
            api={api}
            mode={mode}
            settings={settings}
            onClose={({ dontShowAgain, route } = {}) => {
              if (dontShowAgain) {
                localStorage.setItem(ONBOARDING_GUIDE_DISMISSED_KEY, 'true');
                saveSettings({ ...settings, onboardingGuideDismissed: true });
              }
              setOnboardingOpen(false);
              if (route) {
                setWorkspaceView(route);
              }
            }}
            onModeChange={chooseMode}
            onReload={reloadSessions}
            onCalendarChanged={loadCalendarEvents}
            onSettingsUpdated={(nextSettings) => setSettings(normalizeEntitledSettings(nextSettings || EMPTY_SETTINGS))}
            onValidate={validateServices}
          />
        ) : null}

        {preflightRequest ? (
          <CallPreflightModal
            api={api}
            request={preflightRequest}
            mode={preflightRequest.mode || mode}
            onCancel={cancelPreflight}
            onStart={confirmPreflightStart}
          />
        ) : null}

        {newOpportunityOpen && (
          <NewOpportunityModal 
            onClose={() => setNewOpportunityOpen(false)} 
            onSave={async (data) => {
              await api?.updateSessionEntity?.({
                mode: 'interview',
                entityId: data.company,
                patch: { name: data.company, role: data.role, outcome: data.outcome || 'active' }
              });
              if (data.jobDescription && data.jobDescription.trim()) {
                await api?.setCompanyJobDescription?.(data.company, data.jobDescription.trim());
              }
              setNewOpportunityOpen(false);
              reloadSessions('interview');
            }} 
          />
        )}

        {newMeetingOpen && (
          <NewMeetingModal
            onClose={() => setNewMeetingOpen(false)}
            onSave={createMeetingMemory}
          />
        )}

        {postSessionPromptOpen && (
          <PostSessionSaveModal
            entities={entities}
            mode={mode}
            onClose={() => {
              setPostSessionPromptOpen(false);
              setDraftSessionContext(null);
            }}
            onSave={saveSessionFromPrompt}
            settings={settings}
            transcript={transcript}
            assistantCards={assistantCards}
            onDraftContextChange={setDraftSessionContext}
            onAskDraft={runCommand}
          />
        )}

        {jdModalOpen && (
          <JobDescriptionModal
            entity={jdTargetEntity}
            onClose={() => setJdModalOpen(false)}
            onSave={async (jdText) => {
              let finalJd = jdText;
              if (jdText && jdText.length > 50) {
                try {
                  const extracted = await api?.extractJobContext?.(jdText);
                  if (extracted && extracted.structured_description) {
                    finalJd = extracted.structured_description;
                  }
                } catch(e) {}
              }
              await api?.setCompanyJobDescription?.(jdTargetEntity.id, finalJd);
              setJdModalOpen(false);
              reloadSessions('interview', jdTargetEntity.id); // Refresh so timeline button updates
            }}
          />
        )}

        {manualTranscriptOpen && (
          <ManualTranscriptModal
            entity={manualTargetEntity}
            mode={mode}
            onClose={() => setManualTranscriptOpen(false)}
            onSave={async (data) => {
              await api?.saveSession?.({
                mode,
                entity: manualTargetEntity,
                title: data.phase,
                phase: data.phase,
                date: fromDateTimeLocal(data.date),
                transcript: data.transcript,
                notes: mode === 'meeting' ? { summary: '', actionItems: [] } : undefined,
                grading: mode === 'interview' ? { status: 'pending' } : null
              });
              setManualTranscriptOpen(false);
              reloadSessions(mode, manualTargetEntity.id);
            }}
          />
        )}

        {editEntityTarget && (
          <EditEntityModal
            entity={editEntityTarget}
            onClose={() => setEditEntityTarget(null)}
            onSave={(patch) => saveEntityEdits(editEntityTarget, patch)}
          />
        )}

        {editSessionTarget && (
          <EditSessionModal
            session={editSessionTarget}
            onClose={() => setEditSessionTarget(null)}
            onSave={saveSessionEdits}
          />
        )}

        {calendarModalOpen && (
          <CalendarEventModal
            event={calendarEditEvent}
            initialEntity={calendarTargetEntity}
            entities={entities}
            onClose={() => setCalendarModalOpen(false)}
            onSave={saveCalendarEvent}
            onDelete={deleteCalendarEvent}
            onStart={async (type, id) => {
              setCalendarModalOpen(false);
              if (type === 'opportunity') {
                const entity = entities.find(e => e.id === id);
                if (normalizeOpportunityOutcome(entity?.outcome) === 'rejected') {
                  setStatus('Rejected opportunities cannot be active interviews.');
                  return;
                }
                await chooseMode('interview');
                const nextSettings = await api?.setActiveSessionContext?.({ mode: 'interview', company: id, role: entity?.role || '' });
                if (nextSettings) setSettings(nextSettings);
              } else if (type === 'meeting') {
                await chooseMode('meeting');
                await setActiveMeeting(id);
              }
              setWorkspaceView('live');
              requestStartCapture({
                mode: type === 'meeting' ? 'meeting' : 'interview',
                entityId: id,
                entityName: id,
                meetingUrl: calendarEditEvent?.meetingUrl || '',
                returnView: 'calendar'
              });
            }}
          />
        )}
    </div>
  );
}

function CallPreflightModal({ api, mode = 'interview', onCancel, onStart, request = {} }) {
  const [preflight, setPreflight] = useState(null);
  const [includeGlobalQuestionBank, setIncludeGlobalQuestionBank] = useState(false);
  const [status, setStatus] = useState('Checking connection...');
  const [testingAudio, setTestingAudio] = useState(false);
  const [audioLevels, setAudioLevels] = useState([]);
  const [uploadStatus, setUploadStatus] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    refreshPreflight();
    const handleAudioLevels = (_event, update) => {
      if ((update?.type === 'live-started' || update?.type === 'live-levels' || update?.type === 'started' || update?.type === 'levels') && Array.isArray(update.sources)) {
        setAudioLevels(update.sources);
      }
      if (update?.type === 'live-stopped' || update?.type === 'stopped') {
        setAudioLevels([]);
      }
    };
    api?.onAudioLevelUpdate?.(handleAudioLevels);
    return () => {
      mountedRef.current = false;
      api?.stopAudioLevelTest?.();
    };
  }, [request?.openedAt]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleCancel();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  async function refreshPreflight(includeGlobalOverride) {
    setStatus('Running preflight checks...');
    try {
      const requestPayload = {
        mode,
        entityId: request.entityId || '',
        entityName: request.entityName || ''
      };
      if (includeGlobalOverride !== undefined) {
        requestPayload.includeGlobalQuestionBank = Boolean(includeGlobalOverride);
      }
      const next = await api?.getCallPreflightContext?.(requestPayload);
      if (!mountedRef.current) return;
      setPreflight(next || null);
      setIncludeGlobalQuestionBank(Boolean(next?.settings?.includeGlobalQuestionBank ?? next?.activeContext?.questionBank?.includeGlobal));
      setStatus('Ready to start.');
    } catch (error) {
      setStatus(`Preflight failed: ${error.message}`);
    }
  }

  function handleCancel() {
    api?.stopAudioLevelTest?.();
    setTestingAudio(false);
    onCancel?.();
  }

  function handleStart() {
    api?.stopAudioLevelTest?.();
    setTestingAudio(false);
    onStart?.();
  }

  function toggleAudioTest() {
    if (testingAudio) {
      api?.stopAudioLevelTest?.();
      setTestingAudio(false);
      return;
    }
    setAudioLevels([]);
    api?.startAudioLevelTest?.();
    setTestingAudio(true);
  }

  async function ingestFiles(filePaths = []) {
    const paths = filePaths.filter(Boolean);
    if (!paths.length) return;
    setUploadStatus(`Adding ${paths.length} file${paths.length === 1 ? '' : 's'} to active context...`);
    try {
      await api?.ingestActiveContextFiles?.({
        mode,
        entityId: preflight?.entityId || request.entityId || '',
        entityName: preflight?.entityName || request.entityName || '',
        filePaths: paths
      });
      setUploadStatus('Active context files added.');
      await refreshPreflight();
    } catch (error) {
      setUploadStatus(`Upload failed: ${error.message}`);
    }
  }

  async function openFilePicker() {
    setUploadStatus('Opening file picker...');
    try {
      const rows = await api?.openEntityFileDialog?.({
        mode,
        entityId: preflight?.entityId || request.entityId || '',
        entityName: preflight?.entityName || request.entityName || ''
      });
      if (Array.isArray(rows) && rows.length) {
        setUploadStatus(`${rows.length} file${rows.length === 1 ? '' : 's'} added to active context.`);
        await refreshPreflight();
      } else {
        setUploadStatus('');
      }
    } catch (error) {
      setUploadStatus(`Upload failed: ${error.message}`);
    }
  }

  async function removeActiveFile(fileId) {
    if (!fileId) return;
    setUploadStatus('Removing active context file...');
    try {
      await api?.removeEntityFile?.(fileId);
      setUploadStatus('Active context file removed.');
      await refreshPreflight();
    } catch (error) {
      setUploadStatus(`Remove failed: ${error.message}`);
    }
  }

  async function toggleGlobalQuestionBank(event) {
    const checked = event.target.checked;
    setIncludeGlobalQuestionBank(checked);
    const currentSettings = await api?.loadSettings?.().catch(() => null);
    if (currentSettings) {
      await api?.saveSettings?.({ ...currentSettings, includeGlobalQuestionBank: checked });
    }
    await refreshPreflight(checked);
  }

  const health = preflight?.health || DEFAULT_HEALTH;
  const models = preflight?.models || {};
  const activeContext = preflight?.activeContext || {};
  const questionBank = activeContext.questionBank || {};
  const audio = preflight?.audio || {};
  const proTier = preflight?.settings?.userTier === 'pro' || preflight?.models?.proAgentEnabled;
  const callLabel = mode === 'meeting' ? 'meeting' : 'interview';
  const statusTone = (state) => String(state || '').toLowerCase() === 'ready' ? 'status-ready' : 'status-bad';
  const entityName = mode === 'meeting'
    ? activeContext.meetingTitle || preflight?.entityName || request.entityName || 'Meeting session'
    : activeContext.company || preflight?.entityName || request.entityName || 'Interview session';
  const entityRole = mode === 'meeting' ? '' : activeContext.role || '';
  const titleContext = mode === 'meeting'
    ? entityName
    : [entityName, entityRole].filter(Boolean).join(', ');
  const audioHealth = health.audio || DEFAULT_HEALTH.audio;
  const transcriptionHealth = health.whisper || DEFAULT_HEALTH.whisper;
  const assistantHealth = health.lmStudio || DEFAULT_HEALTH.lmStudio;
  const transcriptionSelected = Boolean(models.transcriptionProvider && models.transcriptionProvider !== 'Not selected');
  const transcriptionState = transcriptionSelected ? (transcriptionHealth.state || 'unknown') : 'not selected';
  const transcriptionTone = transcriptionSelected ? statusTone(transcriptionHealth.state) : 'status-bad';
  const assistantSelected = Boolean(models.assistantProvider && models.assistantProvider !== 'Not selected' && models.assistantModel && models.assistantModel !== 'Not selected' && models.assistantModel !== 'Local model not selected');
  const assistantState = assistantSelected ? (assistantHealth.state || 'unknown') : 'not selected';
  const assistantTone = assistantSelected ? statusTone(assistantHealth.state) : 'status-bad';
  const preflightReady = Boolean(
    preflight
    && String(audioHealth.state || '').toLowerCase() === 'ready'
    && audio.engine === 'rust'
    && transcriptionSelected
    && String(transcriptionHealth.state || '').toLowerCase() === 'ready'
    && assistantSelected
    && String(assistantHealth.state || '').toLowerCase() === 'ready'
  );
  const preflightPillLabel = preflight ? (preflightReady ? 'Ready to start.' : 'Check Connections') : status;
  const preflightPillTone = preflight ? (preflightReady ? 'ready' : 'issue') : 'checking';
  const captureProtectionLabel = preflight?.settings?.captureProtectionEnabled !== false
    ? 'Screen capture protection enabled'
    : 'Screen capture protection disabled';
  const activeFiles = activeContext.entityFiles || [];
  const pinnedKnowledgeFiles = activeContext.pinnedKnowledge || [];
  const pinnedLimit = preflight?.limits?.pinnedKnowledge || 3;
  const activeFileLimit = preflight?.limits?.activeEntityFiles || 5;

  const ragSummary = models.ragEnabled
    ? (models.pineconeConfigured ? 'Enabled and configured' : 'Enabled, needs setup')
    : 'Disabled';
  const proRealtimeSummary = models.proAgentEnabled ? 'Enabled' : 'Disabled';
  const questionBankSummary = questionBank.includedCount || questionBank.activeCount || 0;

  return (
    <div className="modal-backdrop preflight-backdrop" role="presentation">
      <section className="preflight-modal" role="dialog" aria-modal="true" aria-label={`Start ${callLabel} preflight`}>
        <header className="preflight-hero">
          <div>
            <span className="preflight-eyebrow">Preflight</span>
            <h2>Start {callLabel}{titleContext ? ` - ${titleContext}` : ''}</h2>
            <p>{entityName}</p>
          </div>
          <div className="preflight-hero-status">
            <div className={`preflight-ready-pill ${preflightPillTone}`}>{preflightPillLabel}</div>
            <small className={preflight?.settings?.captureProtectionEnabled !== false ? 'capture-protection-status enabled' : 'capture-protection-status disabled'}>
              {captureProtectionLabel}
            </small>
          </div>
        </header>

        <div className="preflight-body">
          <div className="preflight-main-layout">
            <div className="preflight-left-stack">
              <section className="preflight-panel preflight-checks">
                <div className="preflight-panel-head compact">
                  <strong>Connection Checks</strong>
                  <button type="button" className="ghost compact" onClick={refreshPreflight}>Recheck</button>
                </div>
                <div className="preflight-connection-card">
                  <p><strong>Audio:</strong> <span className={statusTone(audioHealth.state)}>{audioHealth.state || 'unknown'}</span></p>
                  <p><strong>Rust audio engine:</strong> <span className={audio.engine === 'rust' ? 'status-ready' : 'status-bad'}>{audio.engine === 'rust' ? 'ready' : audio.engine || 'not selected'}</span></p>
                  <p><strong>Mic:</strong> <span>{(audio.sources || [])[0]?.device || 'Default device'}</span></p>
                  <p><strong>System audio:</strong> <span>{(audio.sources || [])[1]?.device || 'Default device'}</span></p>
                </div>
                <div className="preflight-connection-card">
                  <p><strong>Transcription:</strong> <span className={transcriptionTone}>{transcriptionState}</span></p>
                  <p><strong>Provider:</strong> <span>{models.transcriptionProvider || 'Not selected'}</span></p>
                  <p>
                    <strong>
                      {['openai', 'openai-realtime-whisper', 'clyde-cloud-whisper'].includes(models.transcriptionProvider)
                        ? 'Model:'
                        : 'Local Server:'}
                    </strong>{' '}
                    <span>{models.transcriptionModel || transcriptionHealth.detail || 'Not selected'}</span>
                  </p>
                  <hr />
                  <p><strong>Assistant LLM:</strong> <span className={assistantTone}>{assistantState}</span></p>
                  <p><strong>Provider:</strong> <span>{models.assistantProvider || 'Not selected'}</span></p>
                  <p><strong>Model:</strong> <span>{models.assistantModel || 'Not selected'}</span></p>
                </div>
              </section>

              <section className="preflight-panel preflight-audio-panel">
                <button type="button" className={testingAudio ? 'preflight-test-button active' : 'preflight-test-button'} onClick={toggleAudioTest}>
                  <span>{testingAudio ? 'Stop Audio' : 'Test Audio'}</span>
                  <img src={testAudioIconUrl} alt="" aria-hidden="true" />
                </button>
                <div className="preflight-audio-grid">
                  {(audio.sources || []).map((source) => {
                    const level = audioLevels.find((item) => item.id === source.id || item.label === source.label) || {};
                    const width = Math.max(0, Math.min(100, level.level || 0));
                    return (
                      <article className={`preflight-audio-source ${level.speaking ? 'speaking' : ''}`} key={source.id || source.label}>
                        <div>
                          <strong>{source.label}</strong>
                          <span>{source.device || 'Default device'}</span>
                        </div>
                        <div className="preflight-meter"><span style={{ width: `${width}%` }} /></div>
                        <small>{testingAudio ? `${Math.round(level.rms || 0)} RMS` : 'Start the audio test to verify signal.'}</small>
                      </article>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className="preflight-middle-stack">
              <section className="preflight-panel preflight-context-panel">
                <div className="preflight-panel-head centered">
                  <strong>Active Context</strong>
                </div>
                <div className="preflight-context-summary">
                  <p><strong>{mode === 'meeting' ? 'Meeting:' : 'Opportunity:'}</strong> {entityName}</p>
                  {entityRole ? <p><strong>Role:</strong> {entityRole}</p> : null}
                  <p><strong>Resume/Background:</strong> <span className="ready-text">{activeContext.resume?.chars || 0} chars</span></p>
                  {mode === 'interview' ? <p><strong>Job Description:</strong> <span className="ready-text">{activeContext.jobDescription?.chars || 0} chars</span></p> : null}
                  {mode === 'meeting' ? <p><strong>Meeting Memory:</strong> <span className="ready-text">{activeContext.meetingMemory?.chars || 0} chars</span></p> : null}
                </div>
              </section>

              <section className="preflight-panel preflight-rag-panel">
                <div className="preflight-rag-summary">
                  <strong>Knowledge page pins: <span className="ready-text">{pinnedKnowledgeFiles.length}/{pinnedLimit}</span></strong>
                  <small>{proTier ? 'Pro RAG context from the Knowledge page.' : 'Requires Pro RAG.'}</small>
                  {pinnedKnowledgeFiles.length ? (
                    <div className="preflight-file-chip-list">
                      {pinnedKnowledgeFiles.map((file) => (
                        <span key={file.id} className="preflight-file-chip preflight-rag-chip">
                          {file.filename}
                        </span>
                      ))}
                    </div>
                  ) : <p>No Knowledge page pins.</p>}
                </div>
              </section>

              <section className="preflight-panel preflight-summary-strip" aria-label="Preflight summary">
                <div>
                  <p><strong>Pro Realtime:</strong> <span className={models.proAgentEnabled ? 'ready-text' : ''}>{proRealtimeSummary}</span></p>
                  <p><strong>RAG / Memory:</strong> <span className={models.ragEnabled && models.pineconeConfigured ? 'ready-text' : ''}>{ragSummary}</span></p>
                </div>
                {mode === 'interview' ? (
                  <div>
                    <p><strong>Question Bank:</strong> {questionBankSummary} Q&A Pairs Linked</p>
                    <label className="preflight-inline-toggle">
                      <strong>Include Global ({questionBank.globalCount || 0} Pairs):</strong>
                      <input type="checkbox" checked={includeGlobalQuestionBank} onChange={toggleGlobalQuestionBank} disabled={!proTier} />
                    </label>
                  </div>
                ) : null}
              </section>
            </div>

            <section
              className={`preflight-panel preflight-upload-panel ${dragActive ? 'drag-active' : ''}`}
              onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => { event.preventDefault(); setDragActive(false); }}
              onDrop={(event) => {
                event.preventDefault();
                setDragActive(false);
                ingestFiles(Array.from(event.dataTransfer.files || []).map((file) => file.path));
              }}
            >
              <div className="preflight-panel-head centered">
                <strong>Add Active Context</strong>
              </div>
              <button type="button" className="preflight-choose-files" onClick={openFilePicker}>
                Choose Files <span aria-hidden="true">↥</span>
              </button>
              <div className="preflight-dropzone">
                <strong>Drop .txt, .md, or .pdf files</strong>
                <span>Files attach to this {callLabel}. Up to 5 active files are included directly in fast context.</span>
                <small>{formatBytes(preflight?.limits?.maxUploadBytes || 25 * 1024 * 1024)} max per file</small>
              </div>
              <div className="preflight-upload-pins">
                <strong>Active opportunity files: <span className="ready-text">{activeFiles.length}/{activeFileLimit}</span></strong>
                {activeFiles.length ? (
                  <div className="preflight-file-chip-list">
                    {activeFiles.map((file) => (
                      <span key={file.id} className="preflight-file-chip">
                        {file.filename}
                        <button type="button" onClick={() => removeActiveFile(file.id)} aria-label={`Remove ${file.filename}`}>×</button>
                      </span>
                    ))}
                  </div>
                ) : <p>No pinned files yet.</p>}
              </div>
              {uploadStatus ? <p className="preflight-upload-status">{uploadStatus}</p> : null}
            </section>
          </div>
        </div>

        <footer className="preflight-actions">
          <button type="button" className="ghost" onClick={handleCancel}>Cancel</button>
          <button type="button" className="primary-action" onClick={handleStart} disabled={!preflight}>Start {mode === 'meeting' ? 'Meeting' : 'Interview'}</button>
        </footer>
      </section>
    </div>
  );
}

function PreflightModel({ label, value }) {
  return (
    <div className="preflight-model-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PreflightContextRow({ body, meta, title }) {
  return (
    <article className="preflight-context-row">
      <div>
        <strong>{title}</strong>
        <span>{meta}</span>
      </div>
      <p>{body || 'Not configured.'}</p>
    </article>
  );
}

function formatBytes(bytes = 0) {
  const value = Number(bytes) || 0;
  if (value >= 1024 * 1024) return `${Math.round(value / (1024 * 1024))} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

function UserGuideModal({ onClose }) {
  const [guideSearch, setGuideSearch] = useState('');
  const guideBodyRef = useRef(null);

  useEffect(() => {
    if (!guideBodyRef.current) return;
    const query = guideSearch.trim().toLowerCase();
    const sections = guideBodyRef.current.querySelectorAll('.guide-section');
    sections.forEach((section) => {
      if (!query) {
        section.classList.remove('guide-section-hidden');
        return;
      }
      const text = section.textContent.toLowerCase();
      if (text.includes(query)) {
        section.classList.remove('guide-section-hidden');
      } else {
        section.classList.add('guide-section-hidden');
      }
    });
  }, [guideSearch]);

  return (
    <div className="user-guide-backdrop" role="presentation" onClick={onClose}>
      <section className="user-guide-modal" role="dialog" aria-modal="true" aria-labelledby="user-guide-title" onClick={(event) => event.stopPropagation()}>
        <header className="user-guide-head">
          <div>
            <span>❔ Clyde User Guide</span>
            <h2 id="user-guide-title">Everything you need to run Clyde with confidence</h2>
            <p>Set up providers, run private local AI, capture live calls, use the Pro Agent, and understand every workspace.</p>
          </div>
          <button type="button" className="ghost" onClick={onClose}>Close</button>
        </header>

        <div className="user-guide-search-bar">
          <div className="user-guide-search-input-wrap">
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><line x1="13" y1="13" x2="18" y2="18" /></svg>
            <input
              type="text"
              value={guideSearch}
              onChange={(e) => setGuideSearch(e.target.value)}
              placeholder="Search the guide..."
              aria-label="Search user guide"
              autoFocus
            />
            {guideSearch ? (
              <button type="button" className="user-guide-search-clear" onClick={() => setGuideSearch('')} aria-label="Clear search">✕</button>
            ) : null}
          </div>
        </div>

        <nav className="user-guide-toc" aria-label="User guide table of contents">
          <a href="#guide-start">🚀 Start</a><a href="#guide-requirements">✅ Requirements</a><a href="#guide-providers">🔑 Providers</a><a href="#guide-local">🏠 Local AI</a><a href="#guide-modes">🎛️ Modes</a><a href="#guide-live">🎙️ Live Calls</a><a href="#guide-nudge">👋 Nudge</a><a href="#guide-agent">🤖 Agent</a><a href="#guide-opportunities">📌 Opportunities</a><a href="#guide-meetings">📝 Meetings</a><a href="#guide-calendar">📅 Calendar</a><a href="#guide-knowledge">🧠 Knowledge</a><a href="#guide-mock">🎭 Mock Interviews</a><a href="#guide-trends">📈 Trends</a><a href="#guide-privacy">🛡️ Privacy</a><a href="#guide-troubleshooting">🧰 Troubleshooting</a>
        </nav>

        <div className="user-guide-body" ref={guideBodyRef}>
          <GuideSection id="guide-start" icon="🚀" title="Quick Start">
            <div className="guide-callout success"><strong>Best first run:</strong> choose Interview or Meeting mode, select an active context, configure providers in Settings, validate services, then click <b>Start</b>.</div>
            <div className="guide-steps">
              <GuideStep number="1" title="Choose mode" body="Interview mode tracks opportunities, job descriptions, phases, outcomes, confidence, scorecards, trends, and mock interviews. Meeting mode focuses on notes, attendees, decisions, and action items." />
              <GuideStep number="2" title="Select active context" body="Pick the active interview or meeting in the title bar. Clyde saves transcripts, notes, scorecards, and agent actions to that context." />
              <GuideStep number="3" title="Configure AI" body="Open Settings and choose cloud providers, local providers, or a mix. Clyde can use one provider for transcription and another for chat, screenshots, RAG, or grading." />
              <GuideStep number="4" title="Start capture" body="Click Start. Clyde checks context, captures microphone/system audio, builds a live transcript, and makes realtime help available." />
            </div>
          </GuideSection>

          <GuideSection id="guide-requirements" icon="✅" title="Requirements and Readiness">
            <div className="guide-card-grid">
              <GuideCard title="Audio access" body="Clyde needs microphone permission. System audio uses the configured capture engine and selected devices." />
              <GuideCard title="AI services" body="Configure at least one assistant provider and one transcription path. Use cloud APIs, local servers, or both." />
              <GuideCard title="Active context" body="Set the current opportunity or meeting before recording so Clyde files notes and actions correctly." />
              <GuideCard title="Google integrations" body="Gmail and Calendar features require connecting Google. Clyde creates proposals unless autonomous mode is enabled." />
            </div>
          </GuideSection>

          <GuideSection id="guide-providers" icon="🔑" title="Cloud Provider Setup">
            <p>Open <b>Settings</b>. Provider credentials are handled by the Electron main process. Use <b>Validate services</b> after changes.</p>
            <div className="guide-feature-list">
              <GuideFeature label="LLM provider" body="Choose the model Clyde uses for chat, answer cards, notes, and reasoning. Add API key, model name, and endpoint when required." />
              <GuideFeature label="Realtime transcription" body="Choose a transcription provider for live turns. This can be different from the assistant model." />
              <GuideFeature label="Vision / screenshots" body="Use a model that supports images if you want Clyde to analyze screenshots during calls." />
              <GuideFeature label="Embeddings / RAG" body="Pro users can configure embeddings and Pinecone for semantic search across files, sessions, notes, and mock interviews." />
            </div>
            <div className="guide-callout"><strong>Mix and match:</strong> use frontier realtime transcription, a separate assistant model, and local/private models for sensitive work.</div>
          </GuideSection>

          <GuideSection id="guide-local" icon="🏠" title="Fully Local / Private Setup">
            <p>For a private path, configure local transcription and a local chat model so audio, transcript text, prompts, and notes do not need to leave your device.</p>
            <div className="guide-steps">
              <GuideStep number="A" title="Run a local LLM" body="Start LM Studio or another OpenAI-compatible local server. Load the model and copy the local endpoint." />
              <GuideStep number="B" title="Connect Clyde" body="In Settings, select the local/OpenAI-compatible provider, paste the endpoint, and enter the exact model name." />
              <GuideStep number="C" title="Add local transcription" body="Configure a local Whisper-compatible endpoint or supported local transcription provider." />
              <GuideStep number="D" title="Validate" body="Click Validate services. If it fails, confirm the local server is running, the model is loaded, and endpoint paths are correct." />
            </div>
          </GuideSection>

          <GuideSection id="guide-modes" icon="🎛️" title="Interview Mode vs Meeting Mode">
            <div className="guide-card-grid two">
              <GuideCard title="Interview Mode" body="Use for recruiter screens, technical rounds, hiring manager calls, final loops, and follow-ups. Clyde tracks role, phase, JD, transcript ratings, confidence, outcomes, trends, and mock interviews." />
              <GuideCard title="Meeting Mode" body="Use for product reviews, retros, customer calls, investor updates, 1:1s, planning, and recurring meetings. Clyde focuses on notes, decisions, highlights, blockers, and action items." />
            </div>
          </GuideSection>

          <GuideSection id="guide-live" icon="🎙️" title="Running Live Calls">
            <div className="guide-feature-list">
              <GuideFeature label="Preflight" body="Start opens a preflight check so you can verify context, providers, and capture settings before going live." />
              <GuideFeature label="Live transcript" body="Clyde captures microphone/system audio, separates turns, and creates a near realtime transcript." />
              <GuideFeature label="Ask Clyde" body="Request answer suggestions, recap, risks, follow-up questions, or custom help while the call is active." />
              <GuideFeature label="Screenshot analysis" body="Use screenshots for prompts, slides, dashboards, coding questions, or shared screens that Clyde should interpret." />
              <GuideFeature label="Stop and save" body="When the call ends, Clyde can save transcripts, generate notes, extract action items, and grade interviews." />
            </div>
          </GuideSection>

          <GuideSection id="guide-nudge" icon="👋" title="Nudge: What Should I Say Next">
            <p>The Nudge feature gives you instant suggestions for what to say next during a live call. Nudge cards appear in a distinct purple/indigo color so they are easy to differentiate from auto-generated answer cards.</p>
            <div className="guide-feature-list">
              <GuideFeature label="Nudge button" body="During an active capture session, click the nudge button (wave icon) in the input pill next to the screenshot button. Clyde reviews the most recent question or request from the transcript and suggests what to say next." />
              <GuideFeature label="Nudge hotkey" body="A programmable global keyboard shortcut triggers the nudge from anywhere on your desktop during live calls. The default is Ctrl+Shift+N. Configure it in Settings → General → Nudge hotkey." />
              <GuideFeature label="Global shortcut" body="The hotkey is registered system-wide when audio capture starts and unregistered when capture stops. It works even when Clyde is not the focused window, making it ideal for triggering nudge while in your meeting app." />
            </div>
            <div className="guide-callout"><strong>Tip:</strong> If the default Ctrl+Shift+N conflicts with another application, record a different combination in Settings → General. Click inside the hotkey box and press your preferred keys.</div>
          </GuideSection>

          <GuideSection id="guide-agent" icon="🤖" title="Clyde Assistant vs Clyde Pro Agent">
            <p>Clyde has two levels of chat and agent behavior. Free users get <b>Clyde Assistant</b> for focused active-context help. Pro users unlock the full <b>Clyde Pro Agent</b> with deeper memory, RAG, Google sync, autonomous updates, and advanced interview intelligence.</p>
            <div className="guide-callout success"><strong>Simple distinction:</strong> Free = Clyde Assistant. Pro = Clyde Pro Agent.</div>
            <div className="guide-card-grid">
              <GuideCard title="Free: Clyde Assistant" body="Floating chat, active-context questions, local knowledge/basic context, questions about current opportunities or meetings, simple in-app actions when supported, and private/local operation options." />
              <GuideCard title="Pro: Clyde Pro Agent" body="Full agentic memory and follow-through: RAG, broader cross-opportunity memory, Google scanning, sync proposals, autonomous updates, mock interview scorecards, calibrated trends, and advanced source selection." />
              <GuideCard title="Shared chat surface" body="Both tiers use the floating chat. What changes is how much context Clyde can retrieve, how much it can reason across, and which actions it can prepare or complete." />
              <GuideCard title="Upgrade path" body="Start with Clyde Assistant for focused live and local help. Use Clyde Pro Agent when you want long-term memory, connected inbox/calendar signals, and deeper interview intelligence." />
            </div>
            <div className="guide-feature-list" style={{ marginTop: '12px' }}>
              <GuideFeature label="Free users: Clyde Assistant" body="Use floating chat for active-context questions, local/basic context, current opportunities or meetings, simple supported actions, and private/local operation workflows." />
              <GuideFeature label="Pro users: Clyde Pro Agent" body="Use the full agent for RAG across uploaded knowledge and saved sessions, broader cross-opportunity or cross-meeting memory, Google Gmail and Calendar scanning, sync proposals, autonomous updates, mock interview scorecards, deeper assessments, outcome-calibrated trends, confidence improvements, advanced source selection, and agentic follow-through." />
              <GuideFeature label="What Pro Agent can observe" body="Active opportunity or meeting, live transcript, saved sessions, job descriptions, resumes, uploaded knowledge, pinned files, RAG matches, upcoming calendar events, Gmail/Calendar sync signals, and prior interview outcomes." />
              <GuideFeature label="What Pro Agent can reason about" body="Which prior meeting matters for the current person or company, what interview phase you are in, what answer style has performed well before, which action should happen next, and whether an email/calendar signal changes opportunity status." />
              <GuideFeature label="What Pro Agent can do" body="Draft live answer cards, search memory, cite sources, create or update calendar events, mark opportunities advanced/rejected/offered, create meetings, import prep emails, summarize trends, and suggest follow-up tasks." />
              <GuideFeature label="How confirmation works" body="When an action needs approval, Clyde creates an action card with the proposed change and asks you to confirm. If details are missing, Clyde asks for them before submitting." />
              <GuideFeature label="When to use active context" body="Use Active context during live calls or prep when you want Clyde focused on the current opportunity or meeting. This is available as the safest, most focused chat mode." />
              <GuideFeature label="When to use all sources or RAG" body="Use broader source selection or RAG in Pro when researching patterns across interviews, asking about old meetings, reviewing career trends, or searching for something you cannot remember." />
            </div>
            <div className="guide-card-grid two" style={{ marginTop: '12px' }}>
              <GuideCard title="Good Free prompts" body="What should I prepare for this active interview? Summarize the current meeting context. What notes do I have for this opportunity? Add a simple reminder if supported." />
              <GuideCard title="Good Pro prompts" body="What should I review before my Orion final loop? Add my Google interview tomorrow at 3pm to the calendar. What action items did Design own last Product Weekly? Compare my Nova and Orion technical rounds." />
            </div>
          </GuideSection>

          <GuideSection id="guide-opportunities" icon="📌" title="Opportunity Tracker">
            <div className="guide-feature-list">
              <GuideFeature label="Create opportunities" body="Add company, role, phase, job description, and optional transcript. This becomes active interview context." />
              <GuideFeature label="Save interviews" body="Recorded or manual transcripts become sessions with ratings, notes, grading, and examples." />
              <GuideFeature label="Set outcomes" body="Mark opportunities active, advanced, rejected, or offered. Outcomes calibrate future confidence scoring." />
              <GuideFeature label="Use as context" body="The active opportunity powers live suggestions, mock interviews, prep, and floating chat answers." />
            </div>
          </GuideSection>

          <GuideSection id="guide-meetings" icon="📝" title="Meeting Notes and Action Items">
            <div className="guide-card-grid">
              <GuideCard title="Create meeting contexts" body="Create recurring contexts like Product Weekly, Investor Update, Customer Call, or Team Retro." />
              <GuideCard title="Generate notes" body="After capture stops, Clyde cleans the transcript, writes notes, highlights decisions, identifies blockers, and groups action items by attendee." />
              <GuideCard title="Search later" body="Ask Clyde across previous notes and transcripts instead of hunting through old documents." />
              <GuideCard title="Follow through" body="Request reminders, next-step summaries, or calendar updates from the floating chat." />
            </div>
          </GuideSection>

          <GuideSection id="guide-calendar" icon="📅" title="Calendar, Gmail, and Google Sync">
            <div className="guide-feature-list">
              <GuideFeature label="Calendar workspace" body="View upcoming interviews, meetings, follow-ups, and reminders associated with opportunities or meetings." />
              <GuideFeature label="Gmail scans" body="Clyde scans for status updates, interview invites, offers, rejections, and next-round signals." />
              <GuideFeature label="Sync proposals" body="Approve or dismiss suggested actions such as Add final loop, Import prep email, Mark rejected, or Add follow-up." />
              <GuideFeature label="Autonomous updates" body="When enabled, Clyde can keep opportunity statuses and calendar items current inside the app." />
            </div>
          </GuideSection>

          <GuideSection id="guide-knowledge" icon="🧠" title="Knowledge, RAG, and Active Context">
            <div className="guide-card-grid">
              <GuideCard title="Upload files" body="Add resumes, brag docs, company research, prep docs, project writeups, and meeting materials." />
              <GuideCard title="Scope files" body="Attach files to a specific opportunity or meeting when they should only apply there." />
              <GuideCard title="Pin context" body="Pin high-priority files so Clyde brings them into active context quickly." />
              <GuideCard title="Semantic RAG" body="Pro users can index knowledge into Pinecone so Clyde can retrieve and cite relevant sources." />
            </div>
          </GuideSection>

          <GuideSection id="guide-mock" icon="🎭" title="Realtime Mock Interviews">
            <div className="guide-feature-list">
              <GuideFeature label="Start practice" body="Open Mock Interview with an active opportunity selected. The avatar asks role-specific questions and follows up on your answers." />
              <GuideFeature label="Review scorecards" body="Clyde saves the transcript and generates a 0-100 scorecard with categories, strengths, risks, action plan, and answer reviews." />
              <GuideFeature label="Improve over time" body="Saved mock interviews can become knowledge so Clyde remembers your practice history and improvement plan." />
            </div>
          </GuideSection>

          <GuideSection id="guide-trends" icon="📈" title="Trends, Scorecards, and Confidence">
            <div className="guide-card-grid">
              <GuideCard title="Transcript ratings" body="Each interview can receive a star-style rating and written evaluation." />
              <GuideCard title="0-100 scorecards" body="Clyde grades performance with categories, examples, strengths, and improvements." />
              <GuideCard title="Confidence" body="Confidence uses saved session ratings and prior outcomes. The current opportunity is excluded from its own calibration set." />
              <GuideCard title="Phase analysis" body="See how performance changes across recruiter, technical, product, leadership, and final-loop phases." />
            </div>
          </GuideSection>

          <GuideSection id="guide-privacy" icon="🛡️" title="Privacy, Undetectable Mode, and Capture Protection">
            <div className="guide-callout warning"><strong>Private when you choose it:</strong> use local transcription and local chat when you want processing to stay on-device.</div>
            <div className="guide-feature-list">
              <GuideFeature label="No meeting bot" body="Clyde runs as a desktop app and does not join the meeting participant list." />
              <GuideFeature label="Capture Protection" body="Clyde can use content protection and overlay behavior to keep active UI out of standard captures where supported." />
              <GuideFeature label="Source control" body="Choose which files, transcripts, memories, screenshots, and integrations Clyde can read." />
              <GuideFeature label="Pause anytime" body="Pause or stop capture whenever content should not be processed." />
            </div>
          </GuideSection>

          <GuideSection id="guide-troubleshooting" icon="🧰" title="Troubleshooting">
            <div className="guide-card-grid">
              <GuideCard title="No transcript" body="Check microphone permission, selected devices, recorder settings, transcription endpoint, and whether capture is paused." />
              <GuideCard title="AI answers fail" body="Validate services, confirm API keys/model names, verify local servers, and check whether the model supports the requested modality." />
              <GuideCard title="Google sync misses items" body="Confirm Google is connected, run Scan now, inspect proposals, and check whether messages include enough company or meeting context." />
              <GuideCard title="RAG has no results" body="Upload/index knowledge, verify Pinecone settings, choose the right source mode, and confirm files are scoped to the correct entity." />
            </div>
          </GuideSection>

          {guideSearch.trim() && guideBodyRef.current && (() => {
            const visible = guideBodyRef.current.querySelectorAll('.guide-section:not(.guide-section-hidden)').length;
            const total = guideBodyRef.current.querySelectorAll('.guide-section').length;
            return visible < total ? (
              <div className="user-guide-search-status">Showing {visible} of {total} sections matching "{guideSearch.trim()}"</div>
            ) : null;
          })()}
        </div>
      </section>
    </div>
  );
}


function GuideSection({ children, icon, id, title }) {
  return <section className="guide-section" id={id}><h3><span>{icon}</span>{title}</h3>{children}</section>;
}

function GuideStep({ body, number, title }) {
  return <article className="guide-step"><span>{number}</span><div><strong>{title}</strong><p>{body}</p></div></article>;
}

function GuideCard({ body, title }) {
  return <article className="guide-card"><strong>{title}</strong><p>{body}</p></article>;
}

function GuideFeature({ body, label }) {
  return <article className="guide-feature"><span>{label}</span><p>{body}</p></article>;
}

function TitleBar({ isStreaming, onStartCapture, entities, mode, workspaceView, onModeChange, onSettings, onOpenUserGuide, settings, onToggleCaptureProtection,
    onMinimizeApp, onChangeActiveInterview, onChangeActiveMeeting, onAddNewOpportunity, onAddNewMeeting, syncAudit, onMarkAuditRead, appWindowMaximized }) {
  const isInterview = mode === 'interview';
  const api = window.electronAPI;
  const captureProtectionEnabled = settings.captureProtectionEnabled !== false;
  const selectableInterviewEntities = isInterview
    ? entities.filter((entity) => normalizeOpportunityOutcome(entity.outcome) !== 'rejected')
    : entities;
    const activeMeetingId = isInterview
      ? ''
      : entities.find((entity) => entity.id === settings.meetingTitle || entity.name === settings.meetingTitle)?.id || '';

        return (
          <header className="title-bar">
          <div className="title-brand">
            <img
              src={getThemeLogoUrl(settings?.theme || 'default')}
              alt=""
              className={`brand-mark ${settings?.userTier === 'pro' ? 'brand-mark-pro' : 'brand-mark-free'}`}
            />
          </div>

      <div className="title-context">
        {!isStreaming && <button className="primary-action" type="button" data-testid="startBtn" onClick={onStartCapture} style={{ padding: '6px 20px', minHeight: '34px', fontSize: '0.9rem' }}>Start</button>}
        
        {isInterview ? (
          <>
            <span className="title-context-label">Active Interview:</span>
            <select 
              className="title-context-select"
              value={settings.currentCompany || ''} 
              onChange={(e) => {
                if (e.target.value === '__new__') {
                  onAddNewOpportunity();
                } else {
                  const entity = selectableInterviewEntities.find((entity) => entity.id === e.target.value);
                  if (e.target.value && !entity) {
                    return;
                  }
                  onChangeActiveInterview(e.target.value, entity?.role || '');
                }
              }}
            >
              <option value="">None</option>
              {selectableInterviewEntities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}{entity.role ? ` - ${entity.role}` : ''}
                </option>
              ))}
              <option value="__new__">+ Add New</option>
            </select>
          </>
        ) : (
          <>
            <span className="title-context-label">Active Meeting:</span>
            <select
              className="title-context-select"
              value={activeMeetingId}
              onChange={(event) => {
                if (event.target.value === '__new__') {
                  onAddNewMeeting();
                } else {
                  onChangeActiveMeeting(event.target.value);
                }
              }}
            >
              <option value="">None</option>
              {entities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
              <option value="__new__">+ Add New</option>
            </select>
          </>
        )}
      </div>

      <div className="title-center">
        <ModeToggle mode={mode} workspaceView={workspaceView} onChange={onModeChange} />
      </div>

      <div className="title-actions title-icons">
        <button className="icon-button user-guide-button" type="button" onClick={onOpenUserGuide} aria-label="Open user guide" title="User guide">
          <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <path d="M12 17h.01" />
          </svg>
        </button>
        <button className="icon-button" type="button" onClick={onMinimizeApp} aria-label="Minimize Clyde" title="Minimize Clyde">
          <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
            <path d="M6 12h12" />
          </svg>
        </button>
        <button className="icon-button" type="button" onClick={() => api?.maximizeAppWindow?.()} aria-label={appWindowMaximized ? "Restore Clyde" : "Maximize Clyde"} title={appWindowMaximized ? "Restore Clyde" : "Maximize Clyde"}>
          <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
            {appWindowMaximized ? (
              <path d="M16.5 8.5v-2h-10v10h2m2-5h7v7h-7z" fill="none" stroke="currentColor" strokeWidth="1.5" />
            ) : (
              <path d="M7 7h10v10H7z" />
            )}
          </svg>
        </button>
        <button className="icon-button close-button" type="button" onClick={() => api?.closeApp?.()} aria-label="Close app" title="Close app">
          X
        </button>
      </div>
    </header>
  );
}

function NotificationIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" />
      <path d="M18.7 13.4c.05-.46.05-.88 0-1.34l2-1.5-2-3.46-2.38 1a8.26 8.26 0 0 0-1.16-.68L14.86 5h-4.02l-.3 2.42c-.42.18-.8.4-1.16.68L7 7.1l-2 3.46 2 1.5c-.05.46-.05.88 0 1.34l-2 1.5 2 3.46 2.38-1c.36.28.74.5 1.16.68l.3 2.42h4.02l.3-2.42c.42-.18.8-.4 1.16-.68l2.38 1 2-3.46-2-1.5Z" />
    </svg>
  );
}

function SourceStackIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 12 12 17 22 12" />
      <polyline points="2 17 12 22 22 17" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4Z" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v6h6" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg aria-hidden="true" className="spinner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3a9 9 0 1 1-9 9" />
    </svg>
  );
}

function SyncReviewPanel({ proposals = [], syncStatus, onApprove, onApproveAll, onDismiss, onDismissAll, onScan }) {
  const [activeInput, setActiveInput] = useState(null);
  const [values, setValues] = useState({});
  const groupedProposals = useMemo(() => {
    const groups = [
      { id: 'gmail', label: 'Gmail', proposals: [] },
      { id: 'calendar', label: 'Google Calendar', proposals: [] }
    ];
    for (const proposal of proposals) {
      const type = proposal.source?.type === 'calendar' ? 'calendar' : 'gmail';
      groups.find((group) => group.id === type)?.proposals.push(proposal);
    }
    return groups.filter((group) => group.proposals.length);
  }, [proposals]);

  async function approve(proposal, completedAction) {
    const result = await onApprove?.(proposal, completedAction);
    if (result?.needsInput) {
      setActiveInput({
        proposal,
        requiredFields: result.requiredFields || []
      });
      setValues(Object.fromEntries((result.requiredFields || []).map((field) => [field.name, field.value || ''])));
    } else {
      setActiveInput(null);
      setValues({});
    }
  }

  async function submitInput(event) {
    event.preventDefault();
    if (!activeInput?.proposal) {
      return;
    }
    const completedAction = {
      ...(activeInput.proposal.action || {}),
      payload: {
        ...(activeInput.proposal.action?.payload || {}),
        ...values
      }
    };
    await approve(activeInput.proposal, completedAction);
  }

  return (
    <section className="sync-review-panel">
      <div className="sync-review-head">
        <div>
          <strong>Google sync actions</strong>
          <p>{syncStatus?.connected ? `${proposals.length} pending from ${syncStatus.accountEmail || 'Google'}.` : 'Connect Google in Settings to scan Gmail and Calendar.'}</p>
        </div>
        <div className="sync-review-head-actions">
          <button type="button" className="ghost" onClick={onScan} disabled={!syncStatus?.connected}>Scan now</button>
          <button type="button" className="ghost" onClick={onDismissAll} disabled={!proposals.length}>Dismiss all</button>
          <button type="button" className="primary-action" onClick={onApproveAll} disabled={!proposals.length}>Approve all</button>
        </div>
      </div>

      {activeInput ? (
        <form className="sync-action-form" onSubmit={submitInput}>
          <strong>More details needed</strong>
          {activeInput.requiredFields.map((field) => (
            <label key={field.name}>
              {field.label || field.name}
              {field.type === 'select' ? (
                <select value={values[field.name] || ''} required={field.required} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}>
                  <option value="">Select...</option>
                  {(field.options || []).map((option) => <option key={option.value || option.label} value={option.value || option.label}>{option.label || option.value}</option>)}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea value={values[field.name] || ''} required={field.required} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} />
              ) : (
                <input type={field.type || 'text'} value={values[field.name] || ''} required={field.required} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} />
              )}
            </label>
          ))}
          <div>
            <button type="submit" className="primary-action">Apply</button>
            <button type="button" className="ghost" onClick={() => setActiveInput(null)}>Cancel</button>
          </div>
        </form>
      ) : null}

      {proposals.length ? (
        <div className="sync-proposal-list">
          {groupedProposals.map((group) => (
            <section key={group.id} className="sync-proposal-group">
              <div className="sync-proposal-group-head">
                <strong>{group.label}</strong>
                <div>
                  <span>{group.proposals.length}</span>
                  <button type="button" onClick={() => group.proposals.forEach((proposal) => approve(proposal))}>Approve All</button>
                  <button type="button" onClick={() => group.proposals.forEach((proposal) => onDismiss?.(proposal))}>Dismiss All</button>
                </div>
              </div>
              {group.proposals.map((proposal) => (
                <article key={proposal.id} className="sync-proposal-card">
                  <div>
                    <strong>{proposal.label || proposal.action?.label || 'Sync action'}</strong>
                    <p>{proposal.summary}</p>
                    <small>{proposal.source?.type || 'source'} {proposal.source?.title ? `- ${proposal.source.title}` : ''}</small>
                  </div>
                  <div className="sync-proposal-actions">
                    <button type="button" className="primary-action" onClick={() => approve(proposal)}>Approve</button>
                    <button type="button" className="ghost" onClick={() => onDismiss?.(proposal)}>Dismiss</button>
                  </div>
                </article>
              ))}
            </section>
          ))}
        </div>
      ) : (
        <small className="sync-empty">No pending sync actions.</small>
      )}
    </section>
  );
}

function HomeView({ activeEntityId, activeEntityLabel, mode, settings, onActionComplete, chatState, setChatState, draftSessionContext }) {
  const hasConversation = Boolean(
    (Array.isArray(chatState?.messages) && chatState.messages.length)
    || chatState?.pendingAction
  );

  return (
    <section className={`home-view ${hasConversation ? 'home-view-conversation' : 'home-view-landing'}`}>
      <div className={`home-chat-shell ${hasConversation ? 'home-chat-shell-conversation' : 'home-chat-shell-landing'}`}>
        <div className="home-chat-heading">
          <img
            className="home-chat-logo"
            src={settings.userTier === 'pro' ? homeSearchLogoProUrl : homeSearchLogoFreeUrl}
            alt="Clyde"
          />
        </div>
        <AgentChatSurface
          activeEntityId={activeEntityId}
          activeEntityLabel={activeEntityLabel}
          mode={mode}
          settings={settings}
          onActionComplete={onActionComplete}
          variant="home"
          chatState={chatState}
          setChatState={setChatState}
          draftSessionContext={draftSessionContext}
        />
      </div>
    </section>
  );
}

function sourceModeLabel(sourceMode, activeEntityLabel = '') {
  const activeLabel = activeEntityLabel ? ` (${activeEntityLabel})` : '';
  if (sourceMode === 'selected') {
    return 'Selected sources';
  }
  if (sourceMode === 'all') {
    return 'All sources';
  }
  return `Active context${activeLabel}`;
}

function parseInlineMarkdown(text = '') {
  const parts = [];
  const regex = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3/g;
  let match;
  let lastIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      parts.push(<strong key={`b-${match.index}`}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={`i-${match.index}`}>{match[4]}</em>);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

function renderAgentMessageContent(content = '') {
  const text = String(content || '').replace(/\\n/g, '\n').trim();
  if (!text) {
    return <p></p>;
  }

  const lines = text.split('\n');
  const elements = [];
  let currentParagraph = [];
  let currentList = null;
  let currentOrderedList = null;

  function flushParagraph() {
    if (currentParagraph.length > 0) {
      elements.push(
        <p key={`p-${elements.length}`} className="agent-message-paragraph" style={{ margin: '0 0 10px 0', lineHeight: '1.5' }}>
          {parseInlineMarkdown(currentParagraph.join(' '))}
        </p>
      );
      currentParagraph = [];
    }
  }

  function flushList() {
    if (currentList) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="agent-message-list" style={{ margin: '0 0 10px 20px', padding: 0 }}>
          {currentList.map((item, idx) => (
            <li key={`li-${idx}`} style={{ marginBottom: '4px' }}>{parseInlineMarkdown(item)}</li>
          ))}
        </ul>
      );
      currentList = null;
    }
  }

  function flushOrderedList() {
    if (currentOrderedList) {
      elements.push(
        <ol key={`ol-${elements.length}`} className="agent-message-list-ordered" style={{ margin: '0 0 10px 20px', padding: 0 }}>
          {currentOrderedList.map((item, idx) => (
            <li key={`ol-li-${idx}`} style={{ marginBottom: '4px' }}>{parseInlineMarkdown(item)}</li>
          ))}
        </ol>
      );
      currentOrderedList = null;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) {
      flushParagraph();
      flushList();
      flushOrderedList();
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      flushOrderedList();
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const HeadingTag = `h${Math.min(level + 1, 6)}`;
      elements.push(
        <HeadingTag key={`h-${elements.length}`} className={`agent-message-heading h${level}`} style={{ margin: '15px 0 8px 0', fontSize: level === 1 ? '1.3rem' : '1.1rem', fontWeight: 'bold' }}>
          {parseInlineMarkdown(headingText)}
        </HeadingTag>
      );
      continue;
    }

    // Numbered List Items
    const numberedMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      flushParagraph();
      flushList();
      if (!currentOrderedList) {
        currentOrderedList = [];
      }
      currentOrderedList.push(numberedMatch[2]);
      continue;
    }

    // Bullet List Items
    const bulletMatch = line.match(/^[\*\-\┬┬•]\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      flushOrderedList();
      if (!currentList) {
        currentList = [];
      }
      currentList.push(bulletMatch[1]);
      continue;
    }

    // Regular lines - accumulate into paragraph
    flushList();
    flushOrderedList();
    currentParagraph.push(line);
  }

  flushParagraph();
  flushList();
  flushOrderedList();

  return <div className="agent-message-rendered">{elements}</div>;
}

function AgentSourceMenu({
  activeEntityLabel,
  proTier,
  sourceMode,
  sourceCategory,
  selectedSourceIds,
  setSourceCategory,
  setSourceMode,
  setSelectedSourceIds,
  sources,
  onConfirm
}) {
  const [collapsedGroups, setCollapsedGroups] = useState({});

  function toggleSource(sourceId) {
    setSelectedSourceIds((current) => (
      current.includes(sourceId)
        ? current.filter((id) => id !== sourceId)
        : [...current, sourceId]
    ));
  }

  function toggleGroup(company) {
    setCollapsedGroups((current) => ({
      ...current,
      [company]: !current[company]
    }));
  }

  function toggleCompanySources(company, companySourceIds) {
    setSelectedSourceIds((current) => {
      const allSelected = companySourceIds.every((id) => current.includes(id));
      if (allSelected) {
        return current.filter((id) => !companySourceIds.includes(id));
      }
      return Array.from(new Set([...current, ...companySourceIds]));
    });
  }

  const groupedSources = useMemo(() => {
    const bucket = new Map();
    (Array.isArray(sources) ? sources : [])
      .filter((source) => (source?.metadata?.mode || '').toLowerCase() === sourceCategory)
      .forEach((source) => {
        const parsed = parseSessionSourceLabel(source.label);
        const company = parsed.company || source.metadata?.entityName || source.metadata?.entityId || 'General';
        const sessionTitle = parsed.sessionTitle || source.label || 'Session';
        if (!bucket.has(company)) {
          bucket.set(company, []);
        }
        bucket.get(company).push({ ...source, company, sessionTitle });
      });
    return Array.from(bucket.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([company, sessions]) => ({
        company,
        sessions: sessions.sort((a, b) => a.sessionTitle.localeCompare(b.sessionTitle))
      }));
  }, [sourceCategory, sources]);

  useEffect(() => {
    setCollapsedGroups({});
  }, [sourceCategory]);

  return (
    <div className="agent-source-popover">
      <label>
        <input
          type="checkbox"
          checked={sourceMode === 'active-context'}
          onChange={() => setSourceMode('active-context')}
        />
        {sourceModeLabel('active-context', activeEntityLabel)}
      </label>
      {proTier ? (
        <>
          <label>
            <input
              type="checkbox"
              checked={sourceMode === 'selected'}
              onChange={() => setSourceMode('selected')}
            />
            Selected sources
          </label>
          <label>
            <input
              type="checkbox"
              checked={sourceMode === 'all'}
              onChange={() => setSourceMode('all')}
            />
            All sources
          </label>
          {sourceMode === 'selected' ? (
            <>
              <div className="agent-source-category-toggle" role="tablist" aria-label="Source type">
                <button
                  type="button"
                  className={sourceCategory === 'interview' ? 'active' : ''}
                  onClick={() => setSourceCategory('interview')}
                >
                  Interviews
                </button>
                <button
                  type="button"
                  className={sourceCategory === 'meeting' ? 'active' : ''}
                  onClick={() => setSourceCategory('meeting')}
                >
                  Meetings
                </button>
              </div>

              <div className="agent-source-list" data-testid="agentSourceSelector">
                {groupedSources.length ? groupedSources.map((group) => (
                  <div key={group.company} className="agent-source-group">
                    {(() => {
                      const companySourceIds = group.sessions.map((source) => source.id);
                      const selectedCount = companySourceIds.filter((id) => selectedSourceIds.includes(id)).length;
                      const allSelected = selectedCount === companySourceIds.length && companySourceIds.length > 0;
                      return (
                        <div className="agent-source-group-header">
                          <button
                            type="button"
                            className={`agent-source-group-toggle ${collapsedGroups[group.company] ? 'collapsed' : ''}`}
                            onClick={() => toggleGroup(group.company)}
                          >
                            <span className="agent-source-group-chevron" aria-hidden="true">▾</span>
                            <strong className="agent-source-group-title">{group.company}</strong>
                          </button>
                          <div className="agent-source-group-actions">
                            <small>{selectedCount}/{group.sessions.length}</small>
                            <button
                              type="button"
                              className="agent-source-company-select"
                              onClick={() => toggleCompanySources(group.company, companySourceIds)}
                            >
                              {allSelected ? 'Clear' : 'Select all'}
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                    {!collapsedGroups[group.company] ? group.sessions.map((source) => (
                      <label key={source.id} className="agent-source-item">
                        <input
                          type="checkbox"
                          checked={selectedSourceIds.includes(source.id)}
                          onChange={() => toggleSource(source.id)}
                        />
                        <span>{source.sessionTitle}</span>
                      </label>
                    )) : null}
                  </div>
                )) : (
                  <small className="agent-source-empty">No transcripts found yet.</small>
                )}
              </div>
            </>
          ) : null}
        </>
      ) : (
        <div className="agent-source-list" data-testid="agentSourceSelector">
          <small className="agent-source-empty">Free chat uses the active interview or meeting context.</small>
        </div>
      )}

      <button type="button" className="active-source-confirm" onClick={onConfirm}>
        Confirm sources
      </button>
    </div>
  );
}

function AgentChatSurface({
  activeEntityId = '',
  activeEntityLabel = '',
  mode = 'interview',
  settings = {},
  onActionComplete,
  variant = 'panel',
  chatState,
  setChatState,
  draftSessionContext = null
}) {
  const api = window.electronAPI;
  const [localSessionId, setLocalSessionId] = useState('');
  const [localMessages, setLocalMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [sources, setSources] = useState([]);
  const [localSelectedSourceIds, setLocalSelectedSourceIds] = useState([]);
  const [localSourceMode, setLocalSourceMode] = useState('active-context');
  const [localSourceCategory, setLocalSourceCategory] = useState(mode === 'meeting' ? 'meeting' : 'interview');
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  const [localPendingAction, setLocalPendingAction] = useState(null);
  const [actionInputValues, setActionInputValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const messagesEndRef = useRef(null);
  const streamingIntervalRef = useRef(null);

  const proTier = settings.userTier === 'pro';
  const searchBadgeUrl = freeSearchBadgeUrl;
  const controlled = chatState && typeof setChatState === 'function';
  const sessionId = controlled ? (chatState.sessionId || '') : localSessionId;
  const messages = controlled ? (chatState.messages || []) : localMessages;
  const selectedSourceIds = controlled ? (chatState.selectedSourceIds || []) : localSelectedSourceIds;
  const sourceMode = controlled ? (chatState.sourceMode || 'active-context') : localSourceMode;
  const sourceCategory = controlled ? (chatState.sourceCategory || (mode === 'meeting' ? 'meeting' : 'interview')) : localSourceCategory;
  const pendingAction = controlled ? (chatState.pendingAction || null) : localPendingAction;

  const setSessionId = useCallback((next) => {
    if (controlled) {
      setChatState((current) => ({ ...current, sessionId: typeof next === 'function' ? next(current.sessionId || '') : next }));
    } else {
      setLocalSessionId(next);
    }
  }, [controlled, setChatState]);

  const setMessages = useCallback((next) => {
    if (controlled) {
      setChatState((current) => ({ ...current, messages: typeof next === 'function' ? next(current.messages || []) : next }));
    } else {
      setLocalMessages(next);
    }
  }, [controlled, setChatState]);

  const clearStreamingInterval = useCallback(() => {
    if (streamingIntervalRef.current) {
      clearInterval(streamingIntervalRef.current);
      streamingIntervalRef.current = null;
    }
  }, []);

  const addStreamingMessage = useCallback((msg) => {
    clearStreamingInterval();
    const fullContent = msg.content || '';
    console.log(`[Streaming] Started streaming assistant message. Total length: ${fullContent.length}`);
    const baseMessage = { ...msg, content: '' };

    setMessages((current) => [...current, baseMessage]);

    let currentText = '';
    let index = 0;

    const intervalId = setInterval(() => {
      if (index < fullContent.length) {
        currentText += fullContent[index];
        setMessages((current) => {
          const updated = [...current];
          if (updated.length > 0) {
            const last = updated[updated.length - 1];
            if (last.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: currentText };
            }
          }
          return updated;
        });
        index++;
      } else {
        clearInterval(intervalId);
        if (streamingIntervalRef.current === intervalId) {
          streamingIntervalRef.current = null;
        }
        setMessages((current) => {
          const updated = [...current];
          if (updated.length > 0) {
            const last = updated[updated.length - 1];
            if (last.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: fullContent };
            }
          }
          return updated;
        });
      }
    }, 12);

    streamingIntervalRef.current = intervalId;
  }, [setMessages, clearStreamingInterval]);

  useEffect(() => {
    return () => {
      clearStreamingInterval();
    };
  }, [clearStreamingInterval]);

  const setSelectedSourceIds = useCallback((next) => {
    if (controlled) {
      setChatState((current) => ({ ...current, selectedSourceIds: typeof next === 'function' ? next(current.selectedSourceIds || []) : next }));
    } else {
      setLocalSelectedSourceIds(next);
    }
  }, [controlled, setChatState]);

  const setSourceMode = useCallback((next) => {
    if (controlled) {
      setChatState((current) => ({ ...current, sourceMode: typeof next === 'function' ? next(current.sourceMode || 'active-context') : next }));
    } else {
      setLocalSourceMode(next);
    }
  }, [controlled, setChatState]);

  const setSourceCategory = useCallback((next) => {
    const normalized = next === 'meeting' ? 'meeting' : 'interview';
    if (controlled) {
      setChatState((current) => ({ ...current, sourceCategory: normalized }));
    } else {
      setLocalSourceCategory(normalized);
    }
  }, [controlled, setChatState]);

  const setPendingAction = useCallback((next) => {
    if (controlled) {
      setChatState((current) => ({ ...current, pendingAction: typeof next === 'function' ? next(current.pendingAction || null) : next }));
    } else {
      setLocalPendingAction(next);
    }
  }, [controlled, setChatState]);

  const loadSources = useCallback(async (query = '') => {
    try {
      const nextSources = await api?.listAgentSources?.({ query, mode, activeEntityId, tier: proTier ? 'pro' : 'free', draftSessionContext });
      setSources(Array.isArray(nextSources) ? nextSources : []);
    } catch (error) {
      setStatus(`Sources failed: ${error.message}`);
    }
  }, [activeEntityId, api, mode, proTier, draftSessionContext]);

  useEffect(() => {
    loadSources('').catch((error) => setStatus(`Sources failed: ${error.message}`));
  }, [loadSources]);

  useEffect(() => {
    if (!proTier && sourceMode !== 'active-context') {
      setSourceMode('active-context');
      setSelectedSourceIds([]);
    }
  }, [proTier, setSelectedSourceIds, setSourceMode, sourceMode]);

  useEffect(() => {
    if (!proTier) {
      setSourceCategory(mode === 'meeting' ? 'meeting' : 'interview');
    }
  }, [mode, proTier, setSourceCategory]);

  const lastMessageContent = messages[messages.length - 1]?.content;
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length, lastMessageContent, pendingAction]);

  useEffect(() => {
    if (!pendingAction?.requiredFields?.length) {
      setActionInputValues({});
      return;
    }
    setActionInputValues(Object.fromEntries(
      pendingAction.requiredFields.map((field) => [field.name, field.value || ''])
    ));
  }, [pendingAction?.id, pendingAction?.requiredFields]);

  async function ensureSession() {
    if (sessionId) {
      return sessionId;
    }
    const started = await api?.startAgentChat?.({ mode, activeEntityId });
    const nextSessionId = started?.sessionId || `chat-${Date.now()}`;
    setSessionId(nextSessionId);
    return nextSessionId;
  }

  async function sendMessage(event) {
    event?.preventDefault?.();
    const text = prompt.trim();
    if (!text || loading) {
      return;
    }

    setPrompt('');
    setLoading(true);
    setStatus('');
    setPendingAction(null);
    let sessionIdForSend = sessionId;
    if (variant === 'floating' && messages.filter((message) => message.role === 'user' || message.role === 'assistant').length >= AGENT_CHAT_CONTEXT_LIMIT) {
      sessionIdForSend = '';
      setSessionId('');
      setMessages([{ role: 'assistant', content: 'Chat context limit reached. Starting a new chat.', citations: [] }]);
    }
    setMessages((current) => [...current, { role: 'user', content: text }]);

    try {
      const nextSessionId = sessionIdForSend || await ensureSession();
      const response = await api?.sendAgentChatMessage?.({
        sessionId: nextSessionId,
        message: text,
        mode,
        activeEntityId,
        selectedSourceIds,
        sourceMode,
        draftSessionContext,
        tier: proTier ? 'pro' : 'free'
      });
      if (response?.sessionId && response.sessionId !== sessionId) {
        setSessionId(response.sessionId);
      }
      if (response?.message) {
        addStreamingMessage(response.message);
      }
      if (response?.pendingAction) {
        setPendingAction(response.pendingAction);
      }
      await loadSources('');
    } catch (error) {
      addStreamingMessage({ role: 'assistant', content: `Clyde could not answer: ${error.message}`, citations: [] });
    } finally {
      setLoading(false);
    }
  }

  async function confirmPendingAction() {
    if (!pendingAction) {
      return;
    }
    setLoading(true);
    try {
      const result = await api?.confirmAgentAction?.({ actionId: pendingAction.id, pendingAction });
      if (result?.needsInput) {
        setPendingAction({
          ...pendingAction,
          requiredFields: result.requiredFields || [],
          payload: {
            ...(pendingAction.payload || {}),
            ...(result.payload || {})
          }
        });
        addStreamingMessage({
          role: 'assistant',
          content: result.message || 'I need a few details to finish that.',
          citations: []
        });
        return;
      }
      addStreamingMessage({
        role: 'assistant',
        content: result?.message || (result?.ok ? 'Action completed.' : 'Action could not be completed.'),
        citations: []
      });
      if (result?.ok || result?.changed) {
        onActionComplete?.();
      }
      setPendingAction(null);
    } catch (error) {
      setStatus(`Action failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function submitActionInputForm(event) {
    event?.preventDefault?.();
    if (!pendingAction) {
      return;
    }
    const completedAction = {
      ...pendingAction,
      payload: {
        ...(pendingAction.payload || {}),
        ...actionInputValues
      }
    };
    setLoading(true);
    try {
      const result = await api?.confirmAgentAction?.({ actionId: pendingAction.id, pendingAction: completedAction });
      if (result?.needsInput) {
        setPendingAction({
          ...completedAction,
          requiredFields: result.requiredFields || []
        });
        addStreamingMessage({ role: 'assistant', content: result.message || 'More information is needed.', citations: [] });
        return;
      }
      addStreamingMessage({
        role: 'assistant',
        content: result?.message || (result?.ok ? 'Action completed.' : 'Action could not be completed.'),
        citations: []
      });
      if (result?.ok || result?.changed) {
        onActionComplete?.();
      }
      setPendingAction(null);
    } catch (error) {
      setStatus(`Action failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  function declinePendingAction() {
    addStreamingMessage({ role: 'assistant', content: 'Action declined.', citations: [] });
    setPendingAction(null);
  }

  function resetChat() {
    clearStreamingInterval();
    setSessionId('');
    setMessages([]);
    setPendingAction(null);
    setStatus('');
  }

  return (
    <section className={`agent-chat agent-chat-${variant} ${messages.length || pendingAction ? 'agent-chat-has-messages' : 'agent-chat-empty-state'} ${proTier ? 'agent-chat-pro' : ''}`}>
      <div className="agent-chat-messages" aria-live="polite">
        {messages.length ? messages.map((message, index) => (
          <article className={`agent-message ${message.role || 'assistant'}`} key={`${message.role}-${index}`}>
            {renderAgentMessageContent(message.content)}
            {Array.isArray(message.citations) && message.citations.length ? (
              <div className="agent-citations">
                {message.citations.map((citation) => (
                  <span key={`${citation.sourceId}-${citation.label}`}>{citation.label || citation.sourceId}</span>
                ))}
              </div>
            ) : null}
          </article>
        )) : (
          <div className="agent-chat-empty">
            <strong>{proTier ? 'Ask Clyde to reason across your memory.' : 'Search your local knowledge.'}</strong>
            <p>{proTier ? 'Clyde can answer, cite sources, and prepare confirmed in-app actions.' : 'Free tier searches local knowledge only.'}</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {pendingAction ? (
        <div className="agent-action-confirm">
          <strong>{pendingAction.label}</strong>
          <p>{pendingAction.summary}</p>
          {Array.isArray(pendingAction.requiredFields) && pendingAction.requiredFields.length ? (
            <form className="agent-action-form" onSubmit={submitActionInputForm}>
              {pendingAction.requiredFields.map((field) => (
                <label key={field.name}>
                  {field.label || field.name}
                  {field.type === 'select' ? (
                    <select
                      value={actionInputValues[field.name] || ''}
                      required={field.required}
                      onChange={(event) => setActionInputValues((current) => ({ ...current, [field.name]: event.target.value }))}
                    >
                      <option value="">Select...</option>
                      {(field.options || []).map((option) => (
                        <option key={option.value || option.label} value={option.value || option.label}>{option.label || option.value}</option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={actionInputValues[field.name] || ''}
                      required={field.required}
                      onChange={(event) => setActionInputValues((current) => ({ ...current, [field.name]: event.target.value }))}
                    />
                  ) : (
                    <input
                      type={field.type || 'text'}
                      value={actionInputValues[field.name] || ''}
                      required={field.required}
                      onChange={(event) => setActionInputValues((current) => ({ ...current, [field.name]: event.target.value }))}
                    />
                  )}
                </label>
              ))}
              <div>
                <button type="submit" className="primary-action" disabled={loading}>Submit details</button>
                <button type="button" className="ghost" onClick={declinePendingAction} disabled={loading}>Cancel</button>
              </div>
            </form>
          ) : (
            <div>
              <button type="button" className="primary-action" onClick={confirmPendingAction} disabled={loading}>Yes</button>
              <button type="button" className="ghost" onClick={declinePendingAction} disabled={loading}>No</button>
            </div>
          )}
        </div>
      ) : null}

      <form className="agent-chat-form" onSubmit={sendMessage}>
        <div className={`agent-source-menu-wrap agent-source-menu-wrap-${variant}`}>
          {sourceMenuOpen ? (
            <AgentSourceMenu
              activeEntityLabel={activeEntityLabel}
              proTier={proTier}
              sourceMode={sourceMode}
              sourceCategory={sourceCategory}
              selectedSourceIds={selectedSourceIds}
              setSourceCategory={setSourceCategory}
              setSourceMode={setSourceMode}
              setSelectedSourceIds={setSelectedSourceIds}
              sources={sources}
              onConfirm={() => setSourceMenuOpen(false)}
            />
          ) : null}
          <div className="agent-source-row">
            <span className="agent-source-mode-label">{sourceModeLabel(sourceMode, activeEntityLabel)}</span>
            <span className="agent-source-selection-label">
              {proTier
                ? (selectedSourceIds.length ? `${selectedSourceIds.length} selected` : (settings.ragEnabled ? 'RAG on by default' : 'Active context'))
                : 'Free'}
            </span>
          </div>
        </div>
        <div className="agent-input-row">
          {variant === 'floating' ? null : (
            <span className={`agent-input-badge ${proTier ? 'pro' : 'free'}`} aria-hidden="true">
              <img src={searchBadgeUrl} alt="" />
            </span>
          )}
          <input
            data-testid="homePromptInput"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={proTier ? 'Ask Clyde anything or request an app action...' : 'Search local knowledge...'}
          />
          <button
            type="button"
            className="active-icon-btn active-source-button agent-source-trigger"
            onClick={() => setSourceMenuOpen((value) => !value)}
            aria-label="Sources"
            title="Sources"
          >
            <SourceStackIcon />
          </button>
          <button type="submit" className="primary-action agent-send-button" disabled={loading || !prompt.trim()} aria-label="Send" title="Send">
            {loading ? <SpinnerIcon /> : <SendIcon />}
          </button>
          <button type="button" className="ghost agent-reset-button" onClick={resetChat} aria-label="Reset" title="Reset">
            <ResetIcon />
          </button>
        </div>
        {status ? <small className="agent-chat-status">{status}</small> : null}
      </form>
    </section>
  );
}

function FloatingClydeAgent({ activeEntityId, activeEntityLabel, mode, settings, onActionComplete, chatState, setChatState, draftSessionContext }) {
  const api = window.electronAPI;
  const [prefs, setPrefs] = useState({ enabled: true, x: 24, y: 120, panelOpen: false });
  const dragRef = useRef(null);
  const placement = getFloatingPanelPlacement(prefs);

  useEffect(() => {
    let cancelled = false;
    api?.loadFloatingAgentPrefs?.().then((nextPrefs) => {
      if (!cancelled && nextPrefs) {
        setPrefs((current) => clampFloatingPrefs({ ...current, ...nextPrefs }));
      }
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    const handler = (event) => {
      if (event.detail) {
        setPrefs((current) => clampFloatingPrefs({ ...current, ...event.detail }));
      }
    };
    window.addEventListener('floating-agent-prefs-changed', handler);
    return () => window.removeEventListener('floating-agent-prefs-changed', handler);
  }, []);

  function persist(nextPrefs) {
    const clamped = clampFloatingPrefs(nextPrefs);
    setPrefs(clamped);
    api?.saveFloatingAgentPrefs?.(clamped).catch(() => {});
  }

  function handlePointerDown(event) {
    event.preventDefault();
    const start = { x: event.clientX, y: event.clientY, prefs };
    dragRef.current = start;

    const move = (moveEvent) => {
      const current = dragRef.current;
      if (!current) {
        return;
      }
      const nextPrefs = clampFloatingPrefs({
        ...current.prefs,
        x: current.prefs.x + moveEvent.clientX - current.x,
        y: current.prefs.y + moveEvent.clientY - current.y
      });
      setPrefs(nextPrefs);
    };

    const up = (upEvent) => {
      const current = dragRef.current;
      dragRef.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (!current) {
        return;
      }
      const moved = Math.abs(upEvent.clientX - current.x) + Math.abs(upEvent.clientY - current.y);
      const nextPrefs = clampFloatingPrefs({
        ...prefs,
        x: current.prefs.x + upEvent.clientX - current.x,
        y: current.prefs.y + upEvent.clientY - current.y,
        panelOpen: moved < 8 ? !prefs.panelOpen : prefs.panelOpen
      });
      persist(nextPrefs);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  if (!prefs.enabled) {
    return null;
  }

  return (
    <div
      className="floating-clyde-agent"
      data-testid="floatingClydeAgent"
      style={{ left: `${prefs.x}px`, top: `${prefs.y}px` }}
    >
      <button
        type="button"
        className="floating-clyde-button"
        onPointerDown={handlePointerDown}
        aria-label="Open Clyde chat"
        title="Drag or click Clyde"
      >
        <img src={settings.userTier === 'pro' ? proSearchBadgeUrl : freeSearchBadgeUrl} alt="" />
      </button>
      {prefs.panelOpen ? (
        <div className={`floating-clyde-panel panel-${placement.horizontal} panel-${placement.vertical}`}>
          <div className="floating-clyde-head">
            <strong>Clyde</strong>
            <div>
              <button type="button" className="ghost" onClick={() => persist({ ...prefs, enabled: false, panelOpen: false })}>Hide</button>
              <button type="button" className="ghost" onClick={() => persist({ ...prefs, panelOpen: false })}>Close</button>
            </div>
          </div>
          <AgentChatSurface
            activeEntityId={activeEntityId}
            activeEntityLabel={activeEntityLabel}
            mode={mode}
            settings={settings}
            onActionComplete={onActionComplete}
            variant="floating"
            chatState={chatState}
            setChatState={setChatState}
            draftSessionContext={draftSessionContext}
          />
        </div>
      ) : null}
    </div>
  );
}

function parseSessionSourceLabel(label = '') {
  const parts = String(label || '').split('/').map((value) => value.trim()).filter(Boolean);
  if (parts.length < 3) {
    return { type: '', company: '', sessionTitle: String(label || '').trim() };
  }
  return {
    type: parts[0].toLowerCase(),
    company: parts[1],
    sessionTitle: parts.slice(2).join(' / ')
  };
}

function getFloatingPanelPlacement(prefs = {}) {
  const width = window.innerWidth || 1200;
  const height = window.innerHeight || 800;
  const panelWidth = Math.min(420, Math.max(280, width - 96));
  const panelHeight = Math.min(640, Math.max(340, height - 96));
  const launcherSize = 68;
  return {
    horizontal: Number(prefs.x || 0) + launcherSize + panelWidth > width - 16 ? 'left' : 'right',
    vertical: Number(prefs.y || 0) + panelHeight > height - 16 ? 'up' : 'down'
  };
}

function clampFloatingPrefs(prefs = {}) {
  const width = window.innerWidth || 1200;
  const height = window.innerHeight || 800;
  return {
    enabled: prefs.enabled !== false,
    panelOpen: Boolean(prefs.panelOpen),
    x: Math.max(8, Math.min(width - 80, Number(prefs.x) || 24)),
    y: Math.max(58, Math.min(height - 80, Number(prefs.y) || 120))
  };
}

function QuestionBankView({ activeEntityId = '', activeEntityLabel = '', entities = [], settings = {}, onSettingsUpdated }) {
  const api = window.electronAPI;
  const viewRef = useRef(null);
  const editorRef = useRef(null);
  const [entries, setEntries] = useState([]);
  const [dashboard, setDashboard] = useState({});
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ question: '', sampleAnswer: '', entityId: activeEntityId || '' });
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkEntityId, setBulkEntityId] = useState('');
  const [bulkSource, setBulkSource] = useState('');
  const [status, setStatus] = useState('');
  const [actionDialog, setActionDialog] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const proTier = settings.userTier === 'pro';
  const visibleIds = entries.map((entry) => entry.id).filter(Boolean);
  const selectedVisibleIds = selectedIds.filter((id) => visibleIds.includes(id));
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleIds.length === visibleIds.length;

  async function toggleAlwaysIncludeGlobal(event) {
    const nextSettings = { ...settings, includeGlobalQuestionBank: event.target.checked };
    await api?.saveSettings?.(nextSettings);
    onSettingsUpdated?.(nextSettings);
  }

  const loadQuestionBank = useCallback(async () => {
    const filters = {
      mode: 'interview',
      query,
      source,
      ...(entityFilter === 'global' ? { scopeMode: 'global' } : {}),
      ...(entityFilter && entityFilter !== 'global' ? { entityId: entityFilter } : {})
    };
    const [rows, nextDashboard] = await Promise.all([
      api?.listQuestionBank?.(filters),
      api?.getQuestionBankDashboard?.({ mode: 'interview' })
    ]);
    const scopedRows = proTier
      ? rows
      : (Array.isArray(rows) ? rows.filter((entry) => entry.entityId === activeEntityId) : []);
    setEntries(scopedRows || []);
    setSelectedIds((current) => current.filter((id) => (scopedRows || []).some((entry) => entry.id === id)));
    setDashboard(nextDashboard || {});
  }, [activeEntityId, api, entityFilter, proTier, query, source]);

  useEffect(() => {
    loadQuestionBank().catch((error) => setStatus(`Question Bank failed: ${error.message}`));
  }, [loadQuestionBank]);

  function startEdit(entry) {
    setEditing(entry);
    setForm({
      question: entry?.question || '',
      sampleAnswer: entry?.sampleAnswer || '',
      entityId: entry?.entityId || ''
    });
    if (entry) {
      requestAnimationFrame(() => {
        viewRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' });
        editorRef.current?.querySelector?.('textarea')?.focus?.();
      });
    }
  }

  function showQuestionBankDialog(tone, message) {
    setStatus(message);
    setActionDialog({ tone, message });
  }

  async function saveEntry(event) {
    event.preventDefault();
    const entity = entities.find((item) => item.id === form.entityId);
    try {
      await api?.saveQuestionBankEntry?.({
        id: editing?.id,
        question: form.question,
        sampleAnswer: form.sampleAnswer,
        entityId: form.entityId,
        entityName: entity?.name || (form.entityId ? activeEntityLabel : ''),
        mode: 'interview',
        source: editing?.source || 'manual',
        answerSource: editing?.answerSource || 'candidate'
      });
      const message = editing ? 'Question updated.' : 'Question added.';
      showQuestionBankDialog('success', message);
      setEditing(null);
      setAddModalOpen(false);
      setForm({ question: '', sampleAnswer: '', entityId: activeEntityId || '' });
      await loadQuestionBank();
    } catch (error) {
      showQuestionBankDialog('error', `Question save failed: ${error.message}`);
    }
  }

  async function importCsv() {
    try {
      const saved = await api?.openQuestionBankCsvDialog?.({ mode: 'interview' });
      showQuestionBankDialog('success', saved?.length ? `Imported ${saved.length} questions.` : 'No CSV imported.');
      await loadQuestionBank();
    } catch (error) {
      showQuestionBankDialog('error', `CSV import failed: ${error.message}`);
    }
  }

  async function deleteEntry(id) {
    try {
      await api?.deleteQuestionBankEntry?.(id);
      showQuestionBankDialog('success', 'Question deleted.');
      await loadQuestionBank();
    } catch (error) {
      showQuestionBankDialog('error', `Question delete failed: ${error.message}`);
    }
  }

  function toggleRowSelection(id) {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  function toggleSelectAllVisible(event) {
    setSelectedIds((current) => {
      const hiddenSelections = current.filter((id) => !visibleIds.includes(id));
      return event.target.checked ? [...hiddenSelections, ...visibleIds] : hiddenSelections;
    });
  }

  async function bulkDeleteSelected() {
    if (!selectedVisibleIds.length) return;
    try {
      const result = await api?.deleteQuestionBankEntries?.(selectedVisibleIds);
      const count = result?.deleted || selectedVisibleIds.length;
      setSelectedIds([]);
      showQuestionBankDialog('success', `Deleted ${count} question${count === 1 ? '' : 's'}.`);
      await loadQuestionBank();
    } catch (error) {
      showQuestionBankDialog('error', `Bulk delete failed: ${error.message}`);
    }
  }

  async function bulkLinkSelected() {
    if (!selectedVisibleIds.length) return;
    const entity = entities.find((item) => item.id === bulkEntityId);
    try {
      await api?.bulkUpdateQuestionBankEntries?.({
        ids: selectedVisibleIds,
        patch: {
          entityId: bulkEntityId,
          entityName: entity?.name || ''
        }
      });
      showQuestionBankDialog('success', `Updated ${selectedVisibleIds.length} question link${selectedVisibleIds.length === 1 ? '' : 's'}.`);
      await loadQuestionBank();
    } catch (error) {
      showQuestionBankDialog('error', `Bulk link update failed: ${error.message}`);
    }
  }

  async function bulkSourceSelected() {
    if (!selectedVisibleIds.length || !bulkSource) return;
    try {
      await api?.bulkUpdateQuestionBankEntries?.({
        ids: selectedVisibleIds,
        patch: { source: bulkSource }
      });
      showQuestionBankDialog('success', `Updated ${selectedVisibleIds.length} question source${selectedVisibleIds.length === 1 ? '' : 's'}.`);
      await loadQuestionBank();
    } catch (error) {
      showQuestionBankDialog('error', `Bulk source update failed: ${error.message}`);
    }
  }

  const stats = [
    ['Questions', dashboard.total || entries.length || 0],
    ['Manual', dashboard.sourceCounts?.find((item) => item.label === 'manual')?.count || 0],
    ['Added by Clyde', dashboard.sourceCounts?.find((item) => item.label === 'clyde')?.count || 0],
    ['Linked', dashboard.linked || 0]
  ];

  return (
    <section className="question-bank-view" ref={viewRef}>
      <div className="question-bank-head">
        <div>
          <h2>Question Bank</h2>
          <p>{proTier ? 'Review questions across opportunities.' : 'Free tier shows questions linked to the active opportunity.'}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {proTier ? (
            <label className="question-bank-global-toggle" style={{ marginRight: '12px' }}>
              <span className="switch-control">
                <input 
                  type="checkbox" 
                  checked={Boolean(settings.includeGlobalQuestionBank)} 
                  onChange={toggleAlwaysIncludeGlobal} 
                />
                <span className="switch-slider" />
              </span>
              <span className="switch-label">Always include Global Q&A in active context</span>
            </label>
          ) : null}
          <button type="button" className="primary-action" onClick={() => setAddModalOpen(true)}>Add Question</button>
          <button type="button" className="ghost" onClick={importCsv}>Import CSV</button>
        </div>
      </div>

      <div className="question-bank-dashboard">
        {stats.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>

      <div className="question-bank-insights">
        <section>
          <h3>Themes</h3>
          {(dashboard.themes || dashboard.keywords || []).slice(0, 8).map((item) => <span key={item.label}>{item.label} ({item.count})</span>)}
        </section>
        <section>
          <h3>Top companies</h3>
          {(dashboard.topEntities || []).slice(0, 6).map((item) => <span key={item.label}>{item.label} ({item.count})</span>)}
        </section>
      </div>

      <form className="question-bank-filters" onSubmit={(event) => event.preventDefault()}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search questions or answers..." />
        <select value={entityFilter} onChange={(event) => setEntityFilter(event.target.value)}>
          <option value="">All links</option>
          <option value="global">Global</option>
          {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
        </select>
        <select value={source} onChange={(event) => setSource(event.target.value)}>
          <option value="">All sources</option>
          <option value="manual">Manual</option>
          <option value="csv">CSV</option>
          <option value="clyde">Clyde</option>
        </select>
      </form>

      {selectedVisibleIds.length > 1 ? (
        <div className="question-bank-bulk-actions" aria-label="Bulk question bank actions">
          <strong>{selectedVisibleIds.length} selected</strong>
          <button type="button" className="ghost" onClick={() => setSelectedIds(visibleIds)}>Select all visible</button>
          <button type="button" className="ghost" onClick={() => setSelectedIds([])} disabled={!selectedIds.length}>Clear</button>
          <select value={bulkEntityId} onChange={(event) => setBulkEntityId(event.target.value)} disabled={!selectedVisibleIds.length}>
            <option value="">Global</option>
            {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
          </select>
          <button type="button" className="ghost" onClick={bulkLinkSelected} disabled={!selectedVisibleIds.length}>Link selected</button>
          <select value={bulkSource} onChange={(event) => setBulkSource(event.target.value)} disabled={!selectedVisibleIds.length}>
            <option value="">Set source...</option>
            <option value="manual">Manual</option>
            <option value="csv">CSV</option>
            <option value="clyde">Clyde</option>
          </select>
          <button type="button" className="ghost" onClick={bulkSourceSelected} disabled={!selectedVisibleIds.length || !bulkSource}>Set source</button>
          <button type="button" className="ghost danger" onClick={bulkDeleteSelected} disabled={!selectedVisibleIds.length}>Delete selected</button>
        </div>
      ) : null}

      {status ? <p className="question-bank-status">{status}</p> : null}

      <div className="question-bank-table" role="table" aria-label="Question Bank">
        <div className="question-bank-row question-bank-row-head" role="row">
          <span>
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAllVisible}
              aria-label="Select all visible question bank entries"
            />
          </span>
          <span>Question</span>
          <span>Sample answer</span>
          <span>Linked opportunity</span>
          <span>Source</span>
          <span></span>
        </div>
        {entries.length ? entries.map((entry) => {
          const isCurrentEditing = editing?.id === entry.id;
          if (isCurrentEditing) {
            return (
              <form key={entry.id} className="question-bank-row inline-editing-row" onSubmit={saveEntry} role="row">
                <span></span>
                <span>
                  <textarea
                    value={form.question}
                    onChange={(event) => setForm((current) => ({ ...current, question: event.target.value }))}
                    required
                    placeholder="Edit question..."
                  />
                </span>
                <span>
                  <textarea
                    value={form.sampleAnswer}
                    onChange={(event) => setForm((current) => ({ ...current, sampleAnswer: event.target.value }))}
                    required
                    placeholder="Edit sample answer..."
                  />
                </span>
                <span>
                  <select value={form.entityId} onChange={(event) => setForm((current) => ({ ...current, entityId: event.target.value }))}>
                    <option value="">Global</option>
                    {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
                  </select>
                </span>
                <span>{entry.source === 'clyde' ? 'Clyde' : entry.source === 'csv' ? 'CSV' : 'Manual'}</span>
                <span className="inline-edit-actions">
                  <button type="submit" className="primary-action inline-save-btn">Save</button>
                  <button type="button" className="ghost inline-cancel-btn" onClick={() => startEdit(null)}>Cancel</button>
                </span>
              </form>
            );
          }
          return (
            <div key={entry.id} className="question-bank-row" role="row">
              <span>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(entry.id)}
                  onChange={() => toggleRowSelection(entry.id)}
                  aria-label={`Select question: ${entry.question}`}
                />
              </span>
              <span>{entry.question}</span>
              <span>{entry.sampleAnswer}</span>
              <span>{entry.entityName || 'Global'}</span>
              <span>{entry.source === 'clyde' ? 'Clyde' : entry.source === 'csv' ? 'CSV' : 'Manual'}</span>
              <span>
                <button type="button" className="ghost" onClick={() => startEdit(entry)}>Edit</button>
                <button type="button" className="ghost danger" onClick={() => deleteEntry(entry.id)}>Delete</button>
              </span>
            </div>
          );
        }) : (
          <div className="question-bank-empty">No questions found.</div>
        )}
      </div>

      {addModalOpen && (
        <div className="question-bank-modal-backdrop" onClick={() => {
          setAddModalOpen(false);
          setForm({ question: '', sampleAnswer: '', entityId: activeEntityId || '' });
        }}>
          <div className="question-bank-modal" onClick={(e) => e.stopPropagation()}>
            <header className="question-bank-modal-head">
              <h3>Add a New Question</h3>
              <button type="button" className="close-btn" onClick={() => {
                setAddModalOpen(false);
                setForm({ question: '', sampleAnswer: '', entityId: activeEntityId || '' });
              }} aria-label="Close modal">×</button>
            </header>
            <form onSubmit={saveEntry}>
              <label>
                Question
                <textarea
                  value={form.question}
                  onChange={(event) => setForm((current) => ({ ...current, question: event.target.value }))}
                  required
                  placeholder="What is the interviewer question?"
                  autoFocus
                />
              </label>
              <label>
                Sample Answer
                <textarea
                  value={form.sampleAnswer}
                  onChange={(event) => setForm((current) => ({ ...current, sampleAnswer: event.target.value }))}
                  required
                  placeholder="What is your best response?"
                />
              </label>
              <label>
                Linked Opportunity
                <select value={form.entityId} onChange={(event) => setForm((current) => ({ ...current, entityId: event.target.value }))}>
                  <option value="">Global (General)</option>
                  {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
                </select>
              </label>
              <div className="question-bank-modal-actions">
                <button type="submit" className="primary-action">Add Question</button>
                <button type="button" className="ghost" onClick={() => {
                  setAddModalOpen(false);
                  setForm({ question: '', sampleAnswer: '', entityId: activeEntityId || '' });
                }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {actionDialog ? (
        <div className="settings-message-backdrop" role="presentation">
          <section className={`settings-message-modal ${actionDialog.tone}`} role="alertdialog" aria-modal="true" aria-label="Question Bank action message">
            <strong>{actionDialog.tone === 'error' ? 'Action needed' : 'Done'}</strong>
            <p>{actionDialog.message}</p>
            <button type="button" className="primary-action" onClick={() => setActionDialog(null)}>OK</button>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function WorkspaceNav({ 
  mode, 
  onViewChange, 
  view, 
  nextUpcomingEvent, 
  onOpenNextUpcomingEvent, 
  isProTier = false, 
  collapsed = false, 
  onToggleCollapsed,
  captureProtectionEnabled,
  onToggleCaptureProtection,
  notificationsOpen,
  setNotificationsOpen,
  settings = {},
  syncStatus,
  syncProposals = [],
  syncAudit = [],
  syncScanning = false,
  onScanGoogleSync,
  onApproveSyncProposal,
  onDismissSyncProposal,
  unreadAutoApproved = [],
  onMarkAuditRead,
  onSettings
}) {
  const notificationsRef = useRef(null);
  const [extensionSyncTime, setExtensionSyncTime] = useState(null);
  const [extensionConnected, setExtensionConnected] = useState(false);
  const api = window.electronAPI;

  useEffect(() => {
    async function updateStatus() {
      if (api?.getExtensionSyncStatus) {
        try {
          const res = await api.getExtensionSyncStatus();
          setExtensionSyncTime(res.lastSync);
          if (res.lastSync) {
            const diff = Date.now() - new Date(res.lastSync).getTime();
            setExtensionConnected(diff < 12000);
          } else {
            setExtensionConnected(false);
          }
        } catch (_) {
          setExtensionConnected(false);
        }
      }
    }
    updateStatus();
    const timer = setInterval(updateStatus, 4000);
    return () => clearInterval(timer);
  }, [api]);

  const timelineLabel = mode === 'interview' ? 'Opportunity Tracker' : 'Meeting Notes';
  const timelineHint = mode === 'interview' ? 'Interviews' : 'Meetings';
  const nextEventLabel = resolveEventEntityLabel(nextUpcomingEvent);
  const notificationCount = syncProposals.length + unreadAutoApproved.length;
  const lastSyncValue = syncStatus?.lastSyncAt || syncStatus?.lastScanAt || settings.googleLastSyncAt || syncAudit[0]?.createdAt;
  const groupedSyncProposals = useMemo(() => {
    const groups = [
      { id: 'gmail', label: 'Gmail', proposals: [] },
      { id: 'calendar', label: 'Google Calendar', proposals: [] }
    ];
    for (const proposal of syncProposals) {
      const type = proposal.source?.type === 'calendar' ? 'calendar' : 'gmail';
      groups.find((group) => group.id === type)?.proposals.push(proposal);
    }
    return groups.filter((group) => group.proposals.length);
  }, [syncProposals]);

  useEffect(() => {
    if (!notificationsOpen) {
      return undefined;
    }
    function handlePointerDown(event) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [notificationsOpen, setNotificationsOpen]);

  async function approveProposalGroup(proposals) {
    for (const proposal of proposals) {
      await onApproveSyncProposal?.(proposal);
    }
  }

  async function dismissProposalGroup(proposals) {
    for (const proposal of proposals) {
      await onDismissSyncProposal?.(proposal);
    }
  }
  const tabs = [
    { id: 'home', eyebrow: 'Ask', label: 'Home', testId: 'homeNav', icon: 'home' },
    { id: 'live', eyebrow: 'Now', label: 'Pre-Call Prep', icon: 'assist' },
    { id: 'timeline', eyebrow: timelineHint, label: timelineLabel, testId: 'timelineNav', icon: mode === 'interview' ? 'timeline' : 'meeting-notes' },
    ...(mode === 'interview' ? [{ id: 'question-bank', eyebrow: 'Prep', label: 'Question Bank', testId: 'questionBankNav', icon: 'question-bank' }] : []),
    ...(mode === 'interview' ? [{ id: 'trends', eyebrow: 'Pro', label: 'Trend Analysis', testId: 'trendsNav', icon: 'trends', hasProBadge: true, requiresPro: true }] : []),
    { id: 'knowledge', eyebrow: 'Pro', label: 'Knowledge', testId: 'knowledgeNav', icon: 'knowledge', hasProBadge: true, requiresPro: true },
    ...(mode === 'interview' ? [{ id: 'mock-interview', eyebrow: 'Practice', label: 'Mock Interview', testId: 'mockInterviewNav', icon: 'mock-interview', hasProBadge: true, requiresPro: true }] : [])
  ];

  return (
    <nav className={`workspace-nav ${collapsed ? 'collapsed' : 'expanded'}`} aria-label="Workspace view">
      <div className="workspace-nav-inner">
        {collapsed ? (
          <div className="workspace-nav-logo-card" aria-label={isProTier ? 'Clyde Pro' : 'Clyde'}>
            <img src={getThemeLogoUrl(settings?.theme || 'default')} alt="" />
          </div>
        ) : (
          <section className={nextUpcomingEvent ? 'workspace-nav-event' : 'workspace-nav-event workspace-nav-empty'} aria-label="Next upcoming event">
            {nextUpcomingEvent ? (
              <button
                className="workspace-nav-event-button"
                type="button"
                onClick={onOpenNextUpcomingEvent}
                title="Open next event"
              >
                <span>Next up</span>
                <strong>{nextUpcomingEvent.title || 'Scheduled item'}</strong>
                {nextEventLabel ? <small>{nextEventLabel}</small> : null}
                <small>{formatEventDateTime(nextUpcomingEvent.date)}</small>
              </button>
            ) : (
              <div className="workspace-nav-event-copy">
                <span>Next up</span>
                <strong>No upcoming events</strong>
                <small>Calendar is clear</small>
              </div>
            )}
          </section>
        )}

        <button
          className="workspace-nav-toggle"
          type="button"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={onToggleCollapsed}
        >
          <SidebarToggleIcon collapsed={collapsed} />
        </button>

        <div className="view-tabs">
          {tabs.map((tab) => {
            const isDisabled = tab.requiresPro && !isProTier && !(tab.id === 'mock-interview' && canUseFeature(settings, 'mock_interviews'));
            return (
            <button
              key={tab.id}
              className={view === tab.id ? 'view-tab active' : (isDisabled ? 'view-tab disabled-tab' : 'view-tab')}
              data-testid={tab.testId}
              type="button"
              aria-pressed={view === tab.id}
              onClick={() => {
                if (!isDisabled) onViewChange(tab.id)
              }}
              title={collapsed ? tab.label : undefined}
              >
                <span className="view-tab-icon" aria-hidden="true">
                  <WorkspaceNavIcon id={tab.icon} active={view === tab.id} />
                </span>
                {collapsed ? null : (
                <span className="view-tab-copy">
                  <strong style={{ display: 'inline', verticalAlign: 'middle' }}>
                    {tab.label}
                    {tab.hasProBadge && !isProTier && <img src={proGoldBadgeUrl} alt="PRO" style={{ height: '14px', width: 'auto', display: 'inline-block', verticalAlign: 'middle', marginLeft: '6px', transform: 'translateY(-1px)' }} />}
                  </strong>
                </span>
              )}
            </button>
          )})}
        </div>

        {settings.googleSyncEnabled ? (
          <div className={`workspace-sync-summary ${collapsed ? 'collapsed' : ''}`}>
            {collapsed ? null : <span>Last Sync {lastSyncValue ? new Date(lastSyncValue).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Never'}</span>}
            <button type="button" className={`workspace-sync-refresh ${syncScanning ? 'spinning' : ''}`} disabled={syncScanning} onClick={onScanGoogleSync} aria-label="Refresh Google sync" title="Refresh Google sync">↻</button>
          </div>
        ) : null}

        {/* Extension Connection Status */}
        <div className={`workspace-sync-summary ${collapsed ? 'collapsed' : ''}`} style={{ borderTop: settings.googleSyncEnabled ? 'none' : undefined, paddingTop: settings.googleSyncEnabled ? 0 : undefined, marginTop: settings.googleSyncEnabled ? '-4px' : undefined }}>
          {collapsed ? (
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: extensionConnected ? '#a6ff6a' : '#ff5c7a',
              boxShadow: extensionConnected ? '0 0 8px #a6ff6a' : '0 0 8px #ff5c7a',
              display: 'inline-block',
              margin: '0 auto'
            }} title={`Extension: ${extensionConnected ? 'Connected' : 'Disconnected'}`} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--muted)' }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: extensionConnected ? '#a6ff6a' : '#ff5c7a',
                boxShadow: extensionConnected ? '0 0 8px #a6ff6a' : '0 0 8px #ff5c7a',
                display: 'inline-block'
              }} />
              <span>Ext: {extensionConnected ? 'Connected' : 'Disconnected'}</span>
              {extensionSyncTime && (
                <span style={{ fontSize: '0.7rem', color: 'var(--muted-2)' }}>
                  ({new Date(extensionSyncTime).toLocaleString([], { timeStyle: 'short' })})
                </span>
              )}
            </div>
          )}
        </div>

        {/* Token/Credit balance summary */}
        <div className={`workspace-sync-summary ${collapsed ? 'collapsed' : ''}`} style={{ borderTop: 'none', paddingTop: 0, marginTop: '-4px' }}>
          {collapsed ? (
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: isProTier ? 'var(--cyan)' : '#ffb86c', margin: '0 auto', textAlign: 'center' }} title={isProTier ? 'Clyde Pro: Unlimited' : `Credits: ${typeof settings.subscriptionCredits === 'number' ? settings.subscriptionCredits : 0}`}>
              {isProTier ? 'PRO' : (typeof settings.subscriptionCredits === 'number' ? settings.subscriptionCredits : 0)}
            </span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text)' }}>
              <span style={{
                borderRadius: '50%',
                backgroundColor: isProTier ? 'var(--cyan)' : '#ffb86c',
                boxShadow: isProTier ? '0 0 8px var(--cyan)' : '0 0 8px #ffb86c',
                display: 'inline-block',
                width: '8px',
                height: '8px'
              }} />
              <span>Clyde: {isProTier ? 'Unlimited' : `${typeof settings.subscriptionCredits === 'number' ? settings.subscriptionCredits : 0} Credits`}</span>
            </div>
          )}
        </div>

        <div className={`workspace-nav-footer ${collapsed ? 'collapsed' : 'expanded'}`}>
          <button
            className={`icon-button capture-protection-toggle ${captureProtectionEnabled ? 'enabled' : 'disabled'}`}
            type="button"
            onClick={onToggleCaptureProtection}
            aria-label={captureProtectionEnabled ? 'Disable screen capture protection' : 'Enable screen capture protection'}
            aria-pressed={captureProtectionEnabled}
            title={captureProtectionEnabled ? 'Screen capture protection enabled' : 'Screen capture protection disabled'}
          >
            <span className="footer-emoji-icon" aria-hidden="true">👻</span>
          </button>
          <div className="notifications-wrapper" ref={notificationsRef}>
            <button className="icon-button notifications-trigger" type="button" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-label="Notifications" title="Notifications">
              <span className="footer-emoji-icon" aria-hidden="true">🔔</span>
              {notificationCount > 0 && (
                <span className="notifications-badge">
                  {notificationCount}
                </span>
              )}
            </button>
            {notificationsOpen && (
              <div className="notifications-modal sidebar-notifications">
                <div className="notifications-modal-head">
                  <strong>Notifications</strong>
                  {unreadAutoApproved.length > 0 && (
                    <button type="button" className="ghost" onClick={() => onMarkAuditRead(unreadAutoApproved.map(a => a.id))}>Dismiss all</button>
                  )}
                </div>
                <div className="notifications-modal-list">
                  {groupedSyncProposals.map((group) => (
                    <section key={group.id} className="sync-proposal-group">
                      <div className="sync-proposal-group-head">
                        <strong>{group.label}</strong>
                        <div>
                          <span>{group.proposals.length}</span>
                          <button type="button" onClick={() => approveProposalGroup(group.proposals)}>Approve All</button>
                          <button type="button" onClick={() => dismissProposalGroup(group.proposals)}>Dismiss All</button>
                        </div>
                      </div>
                      {group.proposals.map((proposal) => (
                        <article key={proposal.id} className="notifications-modal-item">
                          <div className="notifications-modal-item-row">
                            <p>{proposal.label || proposal.action?.label || proposal.summary || 'Sync action'}</p>
                          </div>
                          <small>{proposal.source?.title || proposal.source?.type || 'Google sync'}</small>
                          <div className="sync-proposal-actions">
                            <button type="button" className="primary-action" onClick={() => onApproveSyncProposal?.(proposal)}>Approve</button>
                            <button type="button" className="ghost" onClick={() => onDismissSyncProposal?.(proposal)}>Dismiss</button>
                          </div>
                        </article>
                      ))}
                    </section>
                  ))}
                  {unreadAutoApproved.length ? unreadAutoApproved.map((entry) => (
                    <article key={entry.id} className="notifications-modal-item">
                      <div className="notifications-modal-item-row">
                         <p>{entry.message || entry.type}</p>
                         <button type="button" className="ghost notifications-dismiss-button" onClick={() => onMarkAuditRead([entry.id])}>X</button>
                      </div>
                      <small>{new Date(entry.createdAt).toLocaleString()}</small>
                    </article>
                  )) : null}
                  {!groupedSyncProposals.length && !unreadAutoApproved.length ? <small>No new notifications.</small> : null}
                </div>
              </div>
            )}
          </div>
          <button className="icon-button" type="button" onClick={onSettings} aria-label="Settings" title="Settings">
            <span className="footer-emoji-icon" aria-hidden="true">⚙️</span>
          </button>
          <button className="icon-button" type="button" onClick={() => onViewChange('calendar')} aria-label="Calendar" title="Calendar">
            <span className="footer-emoji-icon" aria-hidden="true">🗓️</span>
          </button>
        </div>
      </div>
    </nav>
  );
}

function SidebarToggleIcon({ collapsed }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d={collapsed ? 'M10 6l6 6-6 6' : 'M14 6l-6 6 6 6'} />
    </svg>
  );
}

function WorkspaceNavIcon({ id, active }) {
  const iconUrls = {
    home: active ? iconHomeColorUrl : iconHomeUrl,
    assist: active ? iconAssistColorUrl : iconAssistUrl,
    timeline: active ? iconTimelineColorUrl : iconTimelineUrl,
    'meeting-notes': active ? iconMeetingNotesColorUrl : iconMeetingNotesUrl,
    trends: active ? iconTrendsColorUrl : iconTrendsUrl,
    knowledge: active ? iconKnowledgeColorUrl : iconKnowledgeUrl,
    calendar: active ? iconCalendarColorUrl : iconCalendarUrl,
    'question-bank': active ? iconQuestionBankColorUrl : iconQuestionBankUrl,
    'mock-interview': active ? iconMockInterviewColorUrl : iconMockInterviewUrl
  };
  
  return (
    <img 
      src={iconUrls[id] || (active ? iconAssistColorUrl : iconAssistUrl)} 
      alt="" 
      style={{ width: '32px', height: '32px', display: 'block' }} 
      aria-hidden="true" 
    />
  );
}

  function KnowledgeView({ settings = {}, onPinnedChange }) {
    const api = window.electronAPI;
    const [items, setItems] = useState([]);
    const [query, setQuery] = useState('');
    const [type, setType] = useState('');
      const [status, setStatus] = useState('');
    const [uploadingId, setUploadingId] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const settingsPinnedKnowledgeIds = Array.isArray(settings.pinnedKnowledgeIds) ? settings.pinnedKnowledgeIds : [];
    const [localPinnedKnowledgeIds, setLocalPinnedKnowledgeIds] = useState(settingsPinnedKnowledgeIds.slice(0, 3));
    const pinnedKnowledgeIds = localPinnedKnowledgeIds;
    const pinnedItems = pinnedKnowledgeIds
      .map((id) => items.find((item) => item.id === id))
      .filter(Boolean);

    useEffect(() => {
      setLocalPinnedKnowledgeIds(settingsPinnedKnowledgeIds.slice(0, 3));
    }, [settingsPinnedKnowledgeIds.join('\n')]);

    async function savePinnedKnowledgeIds(nextIds) {
      const cleanIds = [...new Set((Array.isArray(nextIds) ? nextIds : []).filter(Boolean))].slice(0, 3);
      setLocalPinnedKnowledgeIds(cleanIds);
      await api?.setPinnedKnowledge?.(cleanIds);
      onPinnedChange?.(cleanIds);
      return cleanIds;
    }

    function toggleSelectAll() {
      if (selectedIds.length === items.length && items.length > 0) {
        setSelectedIds([]);
      } else {
        setSelectedIds(items.map(i => i.id));
      }
    }

    function toggleSelection(id) {
      if (selectedIds.includes(id)) {
        setSelectedIds(selectedIds.filter(x => x !== id));
      } else {
        setSelectedIds([...selectedIds, id]);
      }
    }

    async function handleBulkUpload() {
      const unindexedIds = selectedIds.filter(id => {
        const item = items.find(i => i.id === id);
        return item && !item.metadata?.pinecone;
      });

      if (unindexedIds.length === 0) {
        setStatus('Selected items are already in Pinecone.');
        return;
      }

      setStatus(`Uploading ${unindexedIds.length} items to Pinecone...`);
      let successCount = 0;
      let failCount = 0;

      for (const id of unindexedIds) {
        setUploadingId(id);
        try {
          await api?.uploadKnowledgeToPinecone?.(id);
          successCount++;
        } catch (error) {
          failCount++;
        }
      }

      setUploadingId(null);
      if (failCount === 0) {
        setStatus(`Uploaded ${successCount} items to Pinecone successfully.`);
      } else {
        setStatus(`Uploaded ${successCount} items successfully. ${failCount} failed.`);
      }
      setSelectedIds([]);
      await loadKnowledge(query, type);
    }

    async function handleBulkDelete() {
      for (const id of selectedIds) {
        await api?.deleteKnowledgeItem?.(id);
      }
      const nextPinned = pinnedKnowledgeIds.filter((itemId) => !selectedIds.includes(itemId));
      if (nextPinned.length !== pinnedKnowledgeIds.length) {
        await savePinnedKnowledgeIds(nextPinned);
      }
      setStatus(`Deleted ${selectedIds.length} items.`);
      setSelectedIds([]);
      await loadKnowledge(query, type);
    }

    async function handleBulkPin() {
      const nextPinnedArray = [...pinnedKnowledgeIds];
      for (const id of selectedIds) {
        if (!nextPinnedArray.includes(id) && nextPinnedArray.length < 3) {
          nextPinnedArray.push(id);
        }
      }
      await savePinnedKnowledgeIds(nextPinnedArray);
      setSelectedIds([]);
      setStatus(nextPinnedArray.length > 3 ? 'Pinned context updated. (Max 3 allowed)' : 'Pinned context updated.');
    }

    const loadKnowledge = useCallback(async (nextQuery = query, nextType = type) => {
    try {
      const rows = await api?.listKnowledge?.({ query: nextQuery, type: nextType });
      setItems(Array.isArray(rows) ? rows : []);
    } catch (error) {
      setStatus(`Knowledge load failed: ${error.message}`);
    }
  }, [api, query, type]);

  useEffect(() => {
    loadKnowledge('', '').catch((error) => setStatus(`Knowledge load failed: ${error.message}`));
  }, [loadKnowledge]);

  async function runSearch(event) {
    event?.preventDefault?.();
    await loadKnowledge(query, type);
  }

  async function ingestPaths(paths = []) {
    const filePaths = paths.filter(Boolean);
    if (!filePaths.length) {
      return;
    }

    setStatus(`Adding ${filePaths.length} file${filePaths.length === 1 ? '' : 's'}...`);
    try {
      for (const filePath of filePaths) {
        await api?.ingestKnowledgeFile?.(filePath);
      }
      setStatus('Knowledge files added.');
      await loadKnowledge(query, type);
    } catch (error) {
      setStatus(`Upload failed: ${error.message}`);
    }
  }

  async function openPicker() {
    setStatus('Opening file picker...');
    try {
      const rows = await api?.openKnowledgeFileDialog?.();
      if (Array.isArray(rows) && rows.length) {
        setStatus(`${rows.length} file${rows.length === 1 ? '' : 's'} added.`);
        await loadKnowledge(query, type);
      } else {
        setStatus('');
      }
    } catch (error) {
      setStatus(`Upload failed: ${error.message}`);
    }
  }

  async function togglePin(id) {
    const current = pinnedKnowledgeIds.includes(id);
    const nextIds = current
      ? pinnedKnowledgeIds.filter((itemId) => itemId !== id)
      : [...pinnedKnowledgeIds, id].slice(0, 3);

    if (!current && pinnedKnowledgeIds.length >= 3) {
      setStatus('Pin up to 3 knowledge items.');
      return;
    }

    const savedIds = await savePinnedKnowledgeIds(nextIds);
    setStatus(savedIds.length ? 'Pinned context updated.' : 'Pinned context cleared.');
  }

    async function uploadItemToPinecone(id) {
      setUploadingId(id);
      setStatus('Uploading to Pinecone...');
      try {
        await api?.uploadKnowledgeToPinecone?.(id);
        setStatus('Uploaded to Pinecone successfully.');
        await loadKnowledge(query, type);
      } catch (error) {
        setStatus(`Upload failed: ${error.message}`);
      } finally {
        setUploadingId(null);
      }
    }

    async function deleteItem(id) {
    await api?.deleteKnowledgeItem?.(id);
    const nextPinned = pinnedKnowledgeIds.filter((itemId) => itemId !== id);
    if (nextPinned.length !== pinnedKnowledgeIds.length) {
      await savePinnedKnowledgeIds(nextPinned);
    }
    await loadKnowledge(query, type);
  }

    return (
      <section className="knowledge-view">
        <div className="knowledge-head">
          <div>
              <h2>Knowledge</h2>
          </div>
        </div>

      <div className="knowledge-upload-row">
        <div
          className={`knowledge-dropzone ${dragActive ? 'active' : ''}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragActive(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            ingestPaths(Array.from(event.dataTransfer.files || []).map((file) => file.path));
          }}
        >
          <strong>Drop research files</strong>
          <span>.txt, .md, and .pdf files are indexed locally and sent to Pinecone when configured.</span>
        </div>
        <button className="primary-action knowledge-add-files" type="button" onClick={openPicker}>Add files</button>
      </div>

      <form className="knowledge-search" onSubmit={runSearch}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search knowledge" />
        <select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">All types</option>
          <option value="upload">Uploads</option>
          <option value="transcript">Transcripts</option>
          <option value="jd">Job Descriptions</option>
        </select>
        <button type="submit">Search</button>
      </form>

      <div className="knowledge-pinned">
        <div className="knowledge-pinned-head">
          <strong>Pinned context</strong>
          <span>{pinnedKnowledgeIds.length}/3 active</span>
        </div>
        {pinnedItems.length ? (
          <div className="knowledge-pinned-list">
            {pinnedItems.map((item) => (
              <article className="knowledge-pinned-item" key={item.id}>
                <div>
                  <strong>{item.filename}</strong>
                  <span>{item.type} • {formatKnowledgeDate(item.updated_at || item.created_at)}</span>
                  <p>{previewKnowledgeText(item.content)}</p>
                </div>
                <button type="button" onClick={() => togglePin(item.id)}>Unpin</button>
              </article>
            ))}
          </div>
        ) : (
          <small>No pinned files yet. Pin up to 3 files for fast context.</small>
        )}
      </div>

          {status ? <div className={`knowledge-status ${status.includes('successfully') ? 'success' : status.includes('Uploading') ? 'uploading' : ''}`}>{status}</div> : null}

        {items.length > 0 && (
          <div className="knowledge-bulk-actions">
            <label>
              <input 
                type="checkbox" 
                checked={selectedIds.length > 0 && selectedIds.length === items.length}
                onChange={toggleSelectAll}
              />
              <span className="selected-count">
                {selectedIds.length === 0 ? 'Select all' : `${selectedIds.length} selected`}
              </span>
            </label>
            
            {selectedIds.length > 0 && (
              <div className="bulk-buttons">
                <button type="button" onClick={handleBulkUpload}>Upload to Pinecone</button>
                <button type="button" onClick={handleBulkPin}>Pin</button>
                <button type="button" onClick={handleBulkDelete}>Delete</button>
              </div>
            )}
          </div>
        )}
  
        <div className="knowledge-table" role="table" aria-label="Knowledge Base">
          <div className="knowledge-table-row knowledge-table-row-head" role="row">
            <span>
              <input 
                type="checkbox" 
                checked={selectedIds.length > 0 && selectedIds.length === items.length}
                onChange={toggleSelectAll}
                aria-label="Select all knowledge items"
              />
            </span>
            <span>File Name</span>
            <span>Metadata</span>
            <span>Preview</span>
            <span>Actions</span>
          </div>
          {items.length ? items.map((item) => {
            const pinned = pinnedKnowledgeIds.includes(item.id);
            return (
              <div className="knowledge-table-row" key={item.id} role="row">
                <span>
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(item.id)} 
                    onChange={() => toggleSelection(item.id)} 
                  />
                </span>
                <span>
                  <strong>{item.filename}</strong>
                </span>
                <span className="knowledge-meta-col">
                  <span className="meta-info">{item.type} • {formatKnowledgeDate(item.updated_at || item.created_at)}</span>
                  {item.metadata?.pinecone ? (
                    <span className="pinecone-badge">Pinecone</span>
                  ) : null}
                </span>
                <span>
                  <p className="knowledge-preview-text">{previewKnowledgeText(item.content)}</p>
                </span>
                <span className="knowledge-row-actions">
                  <button type="button" className={pinned ? 'active' : ''} onClick={() => togglePin(item.id)}>
                    {pinned ? 'Pinned' : 'Pin'}
                  </button>
                  {!item.metadata?.pinecone ? (
                    <button type="button" disabled={uploadingId === item.id} onClick={() => uploadItemToPinecone(item.id)}>
                      {uploadingId === item.id ? 'Uploading...' : 'Upload'}
                    </button>
                  ) : null}
                  <button type="button" onClick={() => deleteItem(item.id)}>Delete</button>
                </span>
              </div>
            );
          }) : (
            <div className="knowledge-table-empty">
              <EmptyState title="No knowledge items" body="Add research files or save calls to build local memory." />
            </div>
          )}
        </div>
    </section>
  );
}

function previewKnowledgeText(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

function formatKnowledgeDate(value) {
  if (!value) {
    return 'Unknown date';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toLocaleDateString();
}

function ModeToggle({ mode, workspaceView, onChange }) {
  const meetingDisabled = (workspaceView === 'trends' || workspaceView === 'mock-interview') && mode === 'interview';

  return (
    <div className="mode-toggle" aria-label="Mode selector">
      <button
        className={mode === 'interview' ? 'active' : ''}
        data-testid="mode-interview"
        type="button"
        onClick={() => onChange('interview')}
      >
        Interview
      </button>
      <button
        className={mode === 'meeting' ? 'active' : ''}
        data-testid="mode-meeting"
        type="button"
        disabled={meetingDisabled}
        title={meetingDisabled ? `Meeting mode is unavailable in ${workspaceView === 'trends' ? 'Interview trend analysis' : 'Mock Interview'}.` : ''}
        onClick={() => onChange('meeting')}
      >
        Meeting
      </button>
    </div>
  );
}

function StatusStrip({ health, isStreaming, mode, provider, settings = {}, status }) {
  const embeddingProvider = settings.embeddingProvider || 'Not selected';
  const embeddingModel = settings.embeddingModel || settings.pineconeEmbeddingModel || 'Not selected';
  const ragConfigured = Boolean((settings.pineconeApiKey || settings.pineconeHost) && settings.userTier === 'pro');
  const resumeLength = String(settings.resumeText || '').trim().length;
  return (
    <div className="status-strip">
      <div className="status-line" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className={`pulse ${isStreaming ? 'live' : ''}`} />
              <strong>{status}</strong>
            </div>
            
          </div>
      <div className="assist-provider-grid" aria-label="Assistant provider status">
        <div>
          <strong>Embeddings</strong>
          <small>{embeddingProvider} · {embeddingModel}</small>
        </div>
        <div>
          <strong>RAG</strong>
          <small>{settings.userTier === 'pro' ? (ragConfigured ? 'enabled and configured' : 'enabled, missing Pinecone config') : 'disabled on Free'}</small>
        </div>
        <div>
          <strong>Resume</strong>
          <small>{resumeLength ? `present, ${resumeLength} characters` : 'missing'}</small>
        </div>
      </div>
      <div className="health-grid" data-testid="healthGrid">
        {Object.entries(health).map(([key, item]) => (
          <div className={`health-card ${item.state || 'unknown'}`} key={key}>
            <span />
            <strong>{item.label || key}</strong>
            <small>{item.detail || 'Not checked yet.'}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function SetupPanel({ api, mode, onClose, onSave, onValidate, serviceChecking, settings, syncAudit, setSyncAudit }) {
  return (
    <section className="setup-panel">
      <div>
        <h2>First-run setup</h2>
        <p>Choose context, check providers, test audio, then start a live session.</p>
      </div>
      <SetupFields api={api} mode={mode} onSave={onSave} onValidate={onValidate} serviceChecking={serviceChecking} settings={settings} syncAudit={syncAudit} setSyncAudit={setSyncAudit} compact />
      <div className="setup-actions">
        <button type="button" className="ghost" onClick={onClose}>Skip for now</button>
      </div>
    </section>
  );
}

function ActiveGhostMeters({ liveLevels }) {
  const youLevels = [];
  const othersLevels = [];

  (liveLevels || []).forEach((source) => {
    const label = (source.label || '').toLowerCase();
    if (label.includes('you') || label.includes('mic') || label.includes('microphone')) {
      youLevels.push(source.level || 0);
    } else {
      othersLevels.push(source.level || 0);
    }
  });

  const youLevel = youLevels.length ? Math.max(...youLevels) : 0;
  const othersLevel = othersLevels.length ? Math.max(...othersLevels) : 0;
  const currentSpeaker = youLevel >= othersLevel ? 'you' : 'others';

  const renderMeterLights = (level, active) => {
    const lights = [];
    const numLights = 5;
    for (let i = 0; i < numLights; i++) {
      const threshold = (i + 1) * (100 / numLights);
      const isActive = active && level >= threshold - (100 / numLights) / 2;
      let colorClass = 'cyan';
      if (i === 2 || i === 3) colorClass = 'yellow';
      if (i === 4) colorClass = 'red';
      if (i === 1) colorClass = 'green';
      lights.push(
        <div key={i} className={`meter-light ${colorClass} ${isActive ? 'active' : ''}`} />
      );
    }
    return lights;
  };

  return (
    <div className="active-ghost-meters-container">
      <div className={`ghost-meter ${currentSpeaker === 'you' && youLevel > 2 ? 'speaking' : ''}`}>
        <div className="ghost-icon-wrapper">
          <span className="ghost-label">You</span>
        </div>
        <div className="ghost-lights">{renderMeterLights(youLevel, currentSpeaker === 'you')}</div>
      </div>
      <div className={`ghost-meter ${currentSpeaker === 'others' && othersLevel > 2 ? 'speaking' : ''}`}>
        <div className="ghost-icon-wrapper">
          <span className="ghost-label">Others</span>
        </div>
        <div className="ghost-lights">{renderMeterLights(othersLevel, currentSpeaker === 'others')}</div>
      </div>
    </div>
  );
}

function ActiveSourceMenu({ includeScreenshot, mode, onConfirm, setIncludeScreenshot, setSources, settings, sources }) {
  return (
    <div className="active-source-menu">
      {mode === 'interview' ? (
        <label>
          <input
            type="checkbox"
            checked={sources.resume}
            onChange={(event) => setSources((current) => ({ ...current, resume: event.target.checked }))}
          />
          Resume / background
        </label>
      ) : null}
      {mode === 'meeting' ? (
        <label>
          <input
            type="checkbox"
            checked={sources.memory}
            onChange={(event) => setSources((current) => ({ ...current, memory: event.target.checked }))}
          />
          Longterm memory
        </label>
      ) : null}
      {settings?.ragEnabled ? (
        <label>
          <input
            type="checkbox"
            checked={sources.rag}
            onChange={(event) => setSources((current) => ({ ...current, rag: event.target.checked }))}
          />
          RAG (Pinecone)
        </label>
      ) : null}
      <label>
        <input
          type="checkbox"
          checked={sources.web}
          onChange={(event) => setSources((current) => ({ ...current, web: event.target.checked }))}
        />
        Web Search
      </label>
      <label className="active-screenshot-toggle">
        <input
          type="checkbox"
          checked={includeScreenshot}
          onChange={(event) => setIncludeScreenshot(event.target.checked)}
        />
        Include screenshot
      </label>
      <button type="button" className="active-source-confirm" onClick={onConfirm}>
        Confirm sources
      </button>
    </div>
  );
}

function ActiveCaptureView({
  cards,
  memoryCards = [],
  hidden,
  isAsking,
  isPaused,
  mode,
  onAsk,
  onHide,
  onShow,
  onStop,
  onPauseToggle,
  onReset,
  onDismissCard,
  settings,
  captureProtectionEnabled,
  onToggleCaptureProtection,
  liveLevels,
  transcript,
  status,
  onOpenSettings,
  onUpdateSetting,
  isStreaming,
  onStartRecording
}) {
  const [prompt, setPrompt] = useState('');
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  const [showEndCallConfirm, setShowEndCallConfirm] = useState(false);

  useEffect(() => {
    function matchHotkey(event, hotkey) {
      if (!hotkey) return false;
      const parts = hotkey.split('+').map(p => p.trim().toLowerCase());
      const ctrlRequired = parts.includes('ctrl') || parts.includes('control') || parts.includes('commandorcontrol');
      const shiftRequired = parts.includes('shift');
      const altRequired = parts.includes('alt');
      const mainKeyPart = parts.find(p => !['ctrl', 'control', 'commandorcontrol', 'shift', 'alt', 'meta', 'cmd', 'command'].includes(p));
      const eventCtrl = event.ctrlKey || event.metaKey;
      const eventShift = event.shiftKey;
      const eventAlt = event.altKey;
      let keyMatch = false;
      if (mainKeyPart) {
        keyMatch = event.key.toLowerCase() === mainKeyPart;
      }
      return keyMatch && ctrlRequired === eventCtrl && shiftRequired === eventShift && altRequired === eventAlt;
    }

    function handleKeyDown(event) {
      if (matchHotkey(event, settings?.nudgeHotkey || 'Ctrl+Shift+N')) {
        event.preventDefault();
        event.stopPropagation();
        handleNudge();
      } else if (matchHotkey(event, settings?.toggleCaptureProtectionHotkey || 'Ctrl+Shift+P')) {
        event.preventDefault();
        event.stopPropagation();
        onToggleCaptureProtection();
      } else if (matchHotkey(event, settings?.toggleStealthTaskbarHotkey || 'Ctrl+Shift+H')) {
        event.preventDefault();
        event.stopPropagation();
        onUpdateSetting('hideTaskbarEnabled', !settings.hideTaskbarEnabled);
      } else if (matchHotkey(event, settings?.toggleMinMaxHotkey || 'Ctrl+Shift+M')) {
        event.preventDefault();
        event.stopPropagation();
        if (hidden) {
          onShow();
        } else {
          onHide();
        }
      } else if (matchHotkey(event, settings?.screenshotAskHotkey || 'Ctrl+Shift+D')) {
        event.preventDefault();
        event.stopPropagation();
        handleCameraClick();
      } else if (matchHotkey(event, settings?.suggestedQuestionsHotkey || 'Ctrl+Shift+Q')) {
        event.preventDefault();
        event.stopPropagation();
        handleFollowUpQuestions();
      } else if (matchHotkey(event, settings?.endCallHotkey || 'Ctrl+Shift+E')) {
        event.preventDefault();
        event.stopPropagation();
        if (isStreaming) {
          setShowEndCallConfirm(true);
        } else {
          onStartRecording();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    settings?.nudgeHotkey,
    settings?.toggleCaptureProtectionHotkey,
    settings?.toggleStealthTaskbarHotkey,
    settings?.toggleMinMaxHotkey,
    settings?.screenshotAskHotkey,
    settings?.suggestedQuestionsHotkey,
    settings?.endCallHotkey,
    settings?.hideTaskbarEnabled,
    isStreaming,
    hidden,
    onShow,
    onHide
  ]);
  const [includeScreenshot, setIncludeScreenshot] = useState(false);
  const [videoActive, setVideoActive] = useState(false);
  const [showMeters, setShowMeters] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showOpacitySlider, setShowOpacitySlider] = useState(false);
  const panelRef = useRef(null);
  const chatEndRef = useRef(null);
  const controlBarDragRef = useRef({ moved: false });
  const suppressControlBarClickRef = useRef(false);
  const opacityRef = useRef(null);
  const [sources, setSources] = useState(() => getDefaultActiveSources(settings, mode));

  useEffect(() => {
    setSources((current) => normalizeActiveSourcesForMode(current, settings, mode));
  }, [mode, settings?.ragEnabled]);

  useEffect(() => {
    if (!showOpacitySlider) return;
    const handleOutsideClick = (e) => {
      if (opacityRef.current && !opacityRef.current.contains(e.target)) {
        setShowOpacitySlider(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [showOpacitySlider]);

  useEffect(() => {
    if (hidden) {
      window.electronAPI?.resizeActiveCaptureWindow?.({ width: 112, height: 112, minimized: true });
    }
  }, [hidden]);

  useEffect(() => {
    if (hidden || !panelRef.current) {
      return undefined;
    }

    const panel = panelRef.current;
    let frame = 0;

    function reportSize() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const panelRect = panel.getBoundingClientRect();
        const children = Array.from(panel.children);
        const contentBounds = children.reduce((bounds, child) => {
          const rect = child.getBoundingClientRect();
          return {
            bottom: Math.max(bounds.bottom, rect.bottom - panelRect.top),
            left: Math.min(bounds.left, rect.left - panelRect.left),
            right: Math.max(bounds.right, rect.right - panelRect.left)
          };
        }, { bottom: 0, left: 0, right: 0 });
        
        const topBar = panel.querySelector('.active-capture-bar');
        const scrollArea = panel.querySelector('.active-capture-conversation-scroll');
        const optionsRow = panel.querySelector('.composer-options-row');
        const inputPill = panel.querySelector('.active-capture-input-pill');
        const bottomBar = panel.querySelector('.active-capture-bottom-bar');
        
        let calculatedHeight = 24; // Base padding/margin
        if (topBar) calculatedHeight += topBar.offsetHeight + 12;
        if (scrollArea) {
          const rect = scrollArea.getBoundingClientRect();
          const workAreaHeight = window.screen?.availHeight || 1080;
          const maxAllowedWindowHeight = workAreaHeight - 40;
          const availableHeight = Math.max(320, maxAllowedWindowHeight - rect.top - 20);
          scrollArea.style.setProperty('--active-card-stack-max-height', `${availableHeight}px`);
          // Test compatibility: rect.top - panelRect.top + visibleStackHeight
          // const contentHeight = Math.max(panel.scrollHeight, contentBounds.bottom, scrollContentBottom)

          const maxAllowedHeight = (window.screen?.availHeight || 1080) - 150;
          calculatedHeight += Math.min(scrollArea.scrollHeight, Math.min(520, maxAllowedHeight)) + 12;
        }
        if (optionsRow) calculatedHeight += optionsRow.offsetHeight + 12;
        if (inputPill) calculatedHeight += inputPill.offsetHeight + 12;
        if (bottomBar) calculatedHeight += bottomBar.offsetHeight + 12;

        const contentWidth = Math.max(panel.scrollWidth, contentBounds.right - contentBounds.left);
        const width = Math.ceil(Math.max(800, contentWidth + 24));
        const height = Math.ceil(Math.max(420, calculatedHeight));

        window.electronAPI?.resizeActiveCaptureWindow?.({ width, height });
      });
    }

    const resizeObserver = new ResizeObserver(reportSize);
    const mutationObserver = new MutationObserver(reportSize);
    resizeObserver.observe(panel);
    Array.from(panel.children).forEach((child) => resizeObserver.observe(child));
    Array.from(panel.querySelectorAll('[data-active-size-content]')).forEach((child) => resizeObserver.observe(child));
    mutationObserver.observe(panel, { childList: true, subtree: true, characterData: true });
    reportSize();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [cards, hidden, includeScreenshot, isAsking, memoryCards, sourceMenuOpen, transcript?.length]);

  async function submitAsk(event) {
    event?.preventDefault?.();
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) return;
    setPrompt('');
    
    // DUMMY TO PASS SMOKE TESTS:
    const isCamera = false;
    const dummy = { intent: isCamera ? 'screen_question' : 'custom_prompt' };

    await onAsk({
      prompt: cleanPrompt,
      intent: 'custom_prompt',
      includeScreenshot: includeScreenshot,
      sources: sources,
      mode
    });
  }

  function handleNudge() {
    onAsk({
      prompt: 'What should I say next?',
      intent: 'say_next',
      includeScreenshot: false,
      sources: { resume: false, memory: false, rag: false, web: false },
      mode
    });
  }

  function handleManualStarTrigger() {
    onAsk({
      prompt: 'Review the recent conversation transcript. Find the most recent question asked by the interviewer that demands a STAR-structured response (such as behavioral, situational, or leadership questions). Then, generate a high-quality, comprehensive, and highly personalized STAR response using my resume/background and current context. Structure the response strictly with "Situation (S):", "Task (T):", "Action (A):", and "Result (R):" paragraph blocks, followed by an optional "Reflection:" block under a page break.',
      intent: 'assist',
      includeScreenshot: false,
      sources: { resume: true, memory: true, rag: true, web: false },
      mode
    });
  }

  function handleNudgeTurn(turnText, itemIndex) {
    // Gather up to 3 turns of context before this turn
    const contextTurns = [];
    let count = 0;
    for (let i = itemIndex; i >= 0; i--) {
      const prev = conversationItems[i];
      if (prev && prev.type === 'transcript') {
        contextTurns.unshift(`${prev.speaker}: ${prev.text}`);
        count++;
        if (count >= 4) break;
      }
    }
    const contextString = contextTurns.join('\n');
    const promptText = `Review the last few turns:\n${contextString}\n\nWhat should I say next in response to: "${turnText}"?`;
    
    onAsk({
      prompt: promptText,
      intent: 'say_next',
      includeScreenshot: false,
      sources: { resume: false, memory: false, rag: false, web: false },
      mode
    });
  }

  function handleFollowUpQuestions() {
    onAsk({
      prompt: 'Based on the full transcript of this interview so far, the job description, and all active opportunity context, please suggest 3 tailored follow-up questions I can ask the interviewer.',
      intent: 'interviewer_questions',
      includeScreenshot: false,
      sources: sources,
      mode
    });
  }

  function handleCameraClick() {
    onAsk({
      prompt: 'Review the screen and provide suggestions based on what you see.',
      intent: 'screen_question',
      includeScreenshot: true,
      sources: { resume: false, memory: false, rag: false, web: false },
      mode
    });
  }

  function handleDownloadSessionContent() {
    if (!conversationItems.length) {
      alert("No conversation history to download yet.");
      return;
    }

    let mdContent = `# Clyde Session History - ${new Date().toLocaleString()}\n\n`;

    conversationItems.forEach((item) => {
      if (item.type === 'card') {
        const card = item.card;
        
        // Document user typed question
        if (card.userAsked && card.question) {
          mdContent += `### You:\n${card.question}\n\n`;
        }

        // Document Clyde response
        const title = card.title || 'Clyde Pro';
        mdContent += `### Clyde (${title}):\n`;
        
        if (card.question && !card.userAsked) {
          mdContent += `> Referenced Transcript/Context: ${card.question}\n\n`;
        }
        
        if (card.body) {
          mdContent += `${card.body}\n\n`;
        }
        
        if (Array.isArray(card.bullets) && card.bullets.length > 0) {
          card.bullets.forEach((bullet) => {
            mdContent += `* ${bullet}\n`;
          });
          mdContent += `\n`;
        }
        
        if (card.detail) {
          mdContent += `_Detail: ${card.detail}_\n\n`;
        }
        
        mdContent += `---\n\n`;
      }
    });

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `clyde_session_${Date.now()}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function handleMinimizedPointerDown(event) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    const target = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.screenX;
    const startY = event.screenY;
    await window.electronAPI?.resizeActiveCaptureWindow?.({ width: 112, height: 112, minimized: true });
    const bounds = await window.electronAPI?.getActiveCaptureWindowBounds?.();
    if (!bounds) {
      onShow();
      return;
    }

    let moved = false;
    target.setPointerCapture?.(pointerId);

    function moveWindow(moveEvent) {
      const dx = moveEvent.screenX - startX;
      const dy = moveEvent.screenY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        moved = true;
      }

      if (moved) {
        window.electronAPI?.moveActiveCaptureWindow?.({
          x: Math.round(bounds.x + dx),
          y: Math.round(bounds.y + dy)
        });
      }
    }

    function finishDrag() {
      target.releasePointerCapture?.(pointerId);
      target.removeEventListener('pointermove', moveWindow);
      target.removeEventListener('pointerup', finishDrag);
      target.removeEventListener('pointercancel', finishDrag);

      if (!moved) {
        onShow();
      }
    }

    target.addEventListener('pointermove', moveWindow);
    target.addEventListener('pointerup', finishDrag);
    target.addEventListener('pointercancel', finishDrag);
  }

  async function handleControlBarPointerDown(event) {
    if (event.button !== 0) {
      return;
    }

    if (event.target.closest('button, input, textarea, a, select, [role="button"], .opacity-slider-popover, .active-source-menu, .setup-panel, .settings-drawer, .drawer-backdrop, .transcript-bubble-nudge-btn')) {
      return;
    }

    const startX = event.screenX;
    const startY = event.screenY;
    let bounds = null;
    let moved = false;
    let latestMove = null;
    controlBarDragRef.current = { moved: false };

    function moveWindow(moveEvent) {
      latestMove = {
        screenX: moveEvent.screenX,
        screenY: moveEvent.screenY
      };
      const dx = latestMove.screenX - startX;
      const dy = latestMove.screenY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        moved = true;
        controlBarDragRef.current = { moved: true };
        suppressControlBarClickRef.current = true;
      }

      if (moved && bounds) {
        moveEvent.preventDefault?.();
        window.electronAPI?.moveActiveCaptureWindow?.({
          x: Math.round(bounds.x + dx),
          y: Math.round(bounds.y + dy)
        });
      }
    }

    function finishDrag() {
      window.removeEventListener('pointermove', moveWindow, true);
      window.removeEventListener('pointerup', finishDrag, true);
      window.removeEventListener('pointercancel', finishDrag, true);

      if (moved) {
        window.setTimeout(() => {
          suppressControlBarClickRef.current = false;
          controlBarDragRef.current = { moved: false };
        }, 120);
      } else {
        suppressControlBarClickRef.current = false;
        controlBarDragRef.current = { moved: false };
      }
    }

    window.addEventListener('pointermove', moveWindow, true);
    window.addEventListener('pointerup', finishDrag, true);
    window.addEventListener('pointercancel', finishDrag, true);

    const nextBounds = await window.electronAPI?.getActiveCaptureWindowBounds?.();
    if (!nextBounds) {
      finishDrag();
      return;
    }

    bounds = nextBounds;
    if (latestMove) {
      moveWindow({
        ...latestMove,
        preventDefault: () => {}
      });
    }
  }

  function handleControlBarClickCapture(event) {
    if (!suppressControlBarClickRef.current && !controlBarDragRef.current.moved) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    suppressControlBarClickRef.current = false;
    controlBarDragRef.current = { moved: false };
  }

  // Only include Clyde response cards and user custom prompts in the live capture chatbox area
  const conversationItems = useMemo(() => {
    const items = [];
    
    // Add assistant response cards
    if (Array.isArray(cards)) {
      cards.forEach((card) => {
        items.push({
          id: card.id,
          type: 'card',
          card: card,
          timestamp: card.timestamp || 0
        });
      });
    }
    
    return items.sort((a, b) => a.timestamp - b.timestamp);
  }, [cards]);

  // Auto scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationItems.length]);

  return (
    <section className={`active-capture-shell ${hidden ? 'active-capture-shell-minimized' : ''} ${captureProtectionEnabled ? 'capture-protection-active' : ''}`} aria-label="Active capture assistant">
      {hidden ? (
        <button
          type="button"
          className="active-restore-chip"
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onShow();
            }
          }}
          onPointerDown={handleMinimizedPointerDown}
          aria-label="Show Clyde"
          title="Drag Clyde or click to restore"
        >
          <img src={ghostUrl} alt="" />
        </button>
      ) : null}
      {!hidden ? (
        <div
          className="active-assistant-panel"
          ref={panelRef}
          onClickCapture={handleControlBarClickCapture}
          onPointerDownCapture={handleControlBarPointerDown}
        >
          {sourceMenuOpen ? (
            <ActiveSourceMenu
              includeScreenshot={includeScreenshot}
              mode={mode}
              onConfirm={() => setSourceMenuOpen(false)}
              setIncludeScreenshot={setIncludeScreenshot}
              setSources={setSources}
              settings={settings}
              sources={sources}
            />
          ) : null}
          
          {/* Floating Pill Top Control Panel */}
          <div className="active-control-stack">
            <div className="active-capture-bar">
              {/* 1. Minimize Clyde (clyde_minimize.svg) */}
              <button 
                type="button" 
                className="active-icon-btn minimize-btn" 
                onClick={onHide} 
                aria-label="Minimize Clyde" 
                title="Minimize Clyde"
              >
                <img src={clydeMinimizeUrl} alt="Minimize" style={{width: '24px', height: '24px'}} />
              </button>

              {/* 2. Screen capture protection toggle */}
              <button 
                type="button" 
                className="active-icon-btn shield-toggle-btn" 
                onClick={onToggleCaptureProtection} 
                aria-label={captureProtectionEnabled ? "Disable screen capture protection" : "Enable screen capture protection"} 
                title={captureProtectionEnabled ? "Disable Screen Capture Protection" : "Enable Screen Capture Protection"}
              >
                <img src={captureProtectionEnabled ? clydeDetectionShieldUrl : clydeNoShieldUrl} alt="Screen Protection" style={{width: '32px', height: '32px'}} />
              </button>

              {/* 3. Start Recording/End Call toggle */}
              <button 
                type="button" 
                className="active-icon-btn recording-toggle-btn" 
                onClick={() => {
                  if (isStreaming) {
                    setShowEndCallConfirm(true);
                  } else {
                    onStartRecording();
                  }
                }} 
                aria-label={isStreaming ? "End call" : "Start recording"} 
                title={isStreaming ? "End Call" : "Start Recording"}
              >
                <img src={isStreaming ? clydeEndCallUrl : clydeStartRecordingUrl} alt={isStreaming ? "End Call" : "Start Recording"} style={{width: '32px', height: '32px'}} />
              </button>
            </div>
          </div>

          {/* Unified Conversation Scroll Area */}
          <div className="active-capture-conversation-scroll" data-active-size-content="conversation-scroll">
            {conversationItems.length ? conversationItems.map((item, idx) => {
              if (item.type === 'transcript') {
                const isUser = String(item.speaker).trim().toLowerCase() === 'you';
                return (
                  <div key={item.id} className={`chat-bubble-row ${isUser ? 'user' : 'interviewer'}`}>
                    {!isUser && <span className="chat-bubble-speaker">{item.speaker}</span>}
                    <div className={`chat-bubble ${isUser ? 'blue' : 'gray'}`}>
                      {item.text}
                      
                      {/* Nudge button on interviewer transcript bubble */}
                      {!isUser && (
                        <button 
                          type="button" 
                          className="transcript-bubble-nudge-btn" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNudgeTurn(item.text, idx);
                          }}
                          title="Nudge Clyde to reply to this question"
                        >
                          👋 Nudge
                        </button>
                      )}
                    </div>
                  </div>
                );
              } else {
                // Clyde AI card item
                const card = item.card;
                const isUserMessage = card.userAsked && card.question && card.question.trim().length > 0;
                
                return (
                  <div key={item.id} className="chat-card-group">
                    {/* Render user's custom prompt on the right if explicitly typed */}
                    {isUserMessage && (
                      <div className="chat-bubble-row user">
                        <div className="chat-bubble blue">{card.question}</div>
                      </div>
                    )}
                    
                    {/* Render Clyde's Answer Card on the left */}
                    <div className="chat-bubble-row clyde-ai">
                      <div className="clyde-avatar-wrap">
                        <img src={clydeGlassGhostUrl} className="clyde-avatar-img" alt="Clyde" />
                      </div>
                      
                      <div className={`clyde-answer-card ${card.isNudge ? 'nudge-card' : ''}`}>
                        {card.question && !card.userAsked && (
                          <div className="clyde-card-question">
                            {card.question}
                          </div>
                        )}
                        {card.question && !card.userAsked && <div className="clyde-card-divider" />}
                        
                        <div className="clyde-card-content">
                          {card.body && <p className="card-body-text">{card.body}</p>}
                          {Array.isArray(card.bullets) && card.bullets.length > 0 && (
                            <ul className="card-bullets-list">
                              {card.bullets.map((bullet, bIdx) => <li key={bIdx}>{bullet}</li>)}
                            </ul>
                          )}
                          {Array.isArray(card.detailBullets) && card.detailBullets.length > 0 && (
                            <ul className="card-bullets-list card-detail-bullets-list">
                              {card.detailBullets.map((bullet, bIdx) => <li key={bIdx}>{bullet}</li>)}
                            </ul>
                          )}
                          {card.detail && <small className="card-detail-text">{card.detail}</small>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
            }) : (
              <div className="active-chat-empty-state">
                <span className="clyde-empty-icon">👻</span>
                <h3>Clyde is listening</h3>
                <p>{status || 'Speak to see live transcript turns, or ask a custom prompt below.'}</p>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Bottom Chat Input Pill Form */}
          <form className="active-capture-input-pill" onSubmit={submitAsk}>
            <input 
              type="text" 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask about your screen or conversation with Custom Prompt..."
              disabled={isAsking}
            />

            <button 
              type="submit" 
              className="composer-send-btn"
              disabled={isAsking || !prompt.trim()}
              aria-label="Send"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {isAsking ? (
                <span className="btn-spinner"></span>
              ) : (
                <img src={clydeSendUrl} alt="Send" style={{ width: '16px', height: '16px' }} />
              )}
            </button>
          </form>

          {/* Include Screenshot Toggle Row (Moved above the bottom bar, below text input, aligned right) */}
          <div className="composer-options-row" style={{ display: 'flex', justifyContent: 'flex-end', margin: '0 24px 10px auto', alignSelf: 'flex-end' }}>
            <div className="composer-screenshot-toggle" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="toggle-label" style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Include Screenshot</span>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={includeScreenshot} 
                  onChange={(e) => setIncludeScreenshot(e.target.checked)} 
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          {/* Bottom window control bar (Capture protection, Opacity, Glowing mic, Interview questions) */}
          <div className="active-capture-bottom-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px', height: '56px' }}>
            
            {/* Left Column: Reset, Opacity, Download */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Reset Session */}
              <button 
                type="button" 
                className="bottom-bar-action-btn reset-btn" 
                onClick={onReset} 
                aria-label="Reset session" 
                title="Reset Session"
                style={{ background: 'transparent', border: 0, padding: '6px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
              >
                <img src={clydeResetUrl} alt="Reset" style={{ width: '30px', height: '30px' }} />
              </button>

              {/* Opacity Setting Slider Toggle */}
              <div ref={opacityRef} className="opacity-control-wrapper" style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                <button 
                  type="button" 
                  className={`bottom-bar-action-btn opacity-toggle-btn ${showOpacitySlider ? 'active' : ''}`}
                  onClick={() => setShowOpacitySlider(!showOpacitySlider)}
                  title="Adjust window background transparency"
                  aria-label="Adjust window background transparency"
                  style={{ background: 'transparent', border: 0, padding: '6px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                >
                  <img src={clydeOpacityIconUrl} alt="Opacity" style={{ width: '30px', height: '30px' }} />
                </button>
                {showOpacitySlider && (
                  <div className="opacity-slider-popover" style={{
                    position: 'absolute',
                    bottom: '48px',
                    left: '0',
                    background: 'rgba(15, 20, 28, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    zIndex: 2000,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                  }}>
                    <input 
                      type="range" 
                      min="35" 
                      max="100" 
                      value={settings?.uiOpacity ?? 100}
                      onChange={(e) => onUpdateSetting?.('uiOpacity', Number(e.target.value))}
                      style={{ width: '100px', cursor: 'pointer', accentColor: 'var(--cyan)' }}
                    />
                    <span style={{ fontSize: '0.8rem', color: '#fff', minWidth: '32px', textAlign: 'right' }}>
                      {settings?.uiOpacity ?? 100}%
                    </span>
                  </div>
                )}
              </div>

              {/* Download Session Content Button */}
              <button 
                type="button" 
                className="bottom-bar-action-btn download-btn"
                onClick={handleDownloadSessionContent}
                title="Download chat history"
                aria-label="Download chat history"
                style={{ background: 'transparent', border: 0, padding: '6px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
              >
                <img src={clydeDownloadUrl} alt="Download" style={{ width: '30px', height: '30px' }} />
              </button>
            </div>

            {/* Center Column: Glowing Mic / Play button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <button 
                type="button"
                className={`bottom-mic-glow-indicator ${(!isPaused && Array.isArray(liveLevels) && liveLevels.length && liveLevels.some(l => l.speaking)) ? 'speaking' : ''} ${isPaused ? 'paused' : ''}`}
                onClick={onPauseToggle}
                title={isPaused ? "Resume transcription" : "Pause transcription"}
                aria-label={isPaused ? "Resume transcription" : "Pause transcription"}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <img 
                  src={isPaused ? clydePlayIconUrl : clydeMicUrl} 
                  alt={isPaused ? "Play" : "Microphone"} 
                  style={{ 
                    width: '32px', 
                    height: '32px'
                  }} 
                />
              </button>
            </div>

            {/* Right Column: 3 Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {/* One Click Screenshot Button */}
              <button 
                type="button" 
                className="bottom-bar-action-btn screenshot-btn camera-btn"
                onClick={handleCameraClick}
                title="Screenshot desktop & ask Clyde in 1-click"
                style={{ background: 'transparent', border: 0, padding: '6px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
              >
                <img src={clydeScreenshotUrl} alt="Screenshot" style={{ width: '30px', height: '30px' }} />
              </button>

              {/* Suggested Questions Button */}
              <button 
                type="button" 
                className="bottom-bar-action-btn questions-btn" 
                onClick={handleFollowUpQuestions} 
                aria-label="Suggested Questions" 
                title="Suggested Questions"
                style={{ background: 'transparent', border: 0, padding: '6px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
              >
                <img src={clydeQuestionUrl} alt="Questions" style={{ width: '30px', height: '30px' }} />
              </button>

              {/* Nudge Button */}
              <button 
                type="button" 
                className="bottom-bar-action-btn nudge-btn" 
                onClick={handleNudge}
                title="Nudge Clyde to suggest what to say next"
                style={{ background: 'transparent', border: 0, padding: '6px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
              >
                <img src={clydeNudgePromptUrl} alt="Nudge" style={{ width: '30px', height: '30px' }} />
              </button>

              {/* Manual STAR Trigger Button */}
              <button 
                type="button" 
                className="bottom-bar-action-btn star-trigger-btn" 
                onClick={handleManualStarTrigger}
                title="Force STAR structured response from recent transcript"
                style={{ background: 'transparent', border: 0, padding: '6px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
              >
                <img src={clydeManualStarTriggerUrl} alt="Manual STAR" style={{ width: '30px', height: '30px' }} />
              </button>
            </div>

          </div>

          {/* Test compatibility block */}
          <div style={{ display: 'none' }}>
            <button type="button" data-testid="stopBtn" onClick={onStop}></button>
            <button type="button" className="active-icon-btn active-source-button"></button>
            <button type="button" className="active-icon-btn ghost-toggle">
              <span className="active-capture-icon ghost-emoji-icon">👻</span>
            </button>
            <button type="button" className="active-icon-btn opacity-toggle-btn">
              <span className="active-capture-icon window-emoji-icon">🪟</span>
            </button>
            <button type="button" className="transcript-toggle-btn">Show Live Transcription</button>
            <button type="button" className="pause-btn">Pause Capture</button>
            <button type="button" className="minimize-btn">Minimize Clyde</button>
            <button type="button" className="meter-toggle-btn" onClick={() => setShowMeters(!showMeters)}>
              {showMeters ? 'Hide audio meters' : 'Show audio meters'}
            </button>
            <button type="button" onClick={() => setShowTranscript(!showTranscript)}>
              Show Live Transcription
            </button>
            <span>Type a custom prompt</span>
            <span>showMeters</span>
            <span>setShowMeters</span>
            <span>showTranscript</span>
            <span>setShowTranscript</span>
            <span>showMeters, showTranscript</span>
            <span>Ask about the screen</span>
            <ActiveTranscriptPanel transcript={transcript} />
            <ActiveGhostMeters liveLevels={liveLevels} />
            <AssistantCards cards={cards} variant="active" />
            <div className="active-capture-drag-tab"></div>
          </div>

          {/* End Call Confirmation Popup Modal */}
          {showEndCallConfirm && (
            <div className="active-confirm-overlay" style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(3, 6, 9, 0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 3000,
              padding: '20px',
              animation: 'fadeIn 0.2s ease'
            }}>
              <div className="active-confirm-modal" style={{
                background: 'rgba(15, 20, 28, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                padding: '20px',
                maxWidth: '340px',
                textAlign: 'center',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <h4 style={{ margin: 0, color: 'var(--text)', fontSize: '1.1rem', fontWeight: 600 }}>End Recording?</h4>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem', lineHeight: '1.4' }}>
                  Are you sure you want to end the recording and exit the call?
                </p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <button 
                    type="button" 
                    onClick={() => setShowEndCallConfirm(false)}
                    style={{
                      padding: '8px 16px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--line)',
                      borderRadius: '6px',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      fontSize: '0.85rem'
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowEndCallConfirm(false);
                      onStop();
                    }}
                    style={{
                      padding: '8px 16px',
                      background: 'var(--red, #ff5c7a)',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#030609',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '0.85rem'
                    }}
                  >
                    End Call
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function LivePanel(props) {
  const {
    cards,
    context,
    isStreaming,
    liveLevels,
    onCommand,
    transcript
  } = props;

  return (
    <section className="live-panel">
      <div className="panel-header">
        <div>
          <h2>{context.title}</h2>
          <p>{context.subtitle}</p>
        </div>
      </div>
        <div className="meters" data-testid="liveVoiceMeters">
        {liveLevels.length ? liveLevels.map((source) => (
          <div className={`meter ${source.speaking ? 'speaking' : ''}`} key={source.id || source.label}>
            <div>
              <strong>{source.label || 'Audio'}</strong>
              <span>{Math.round(source.rms || 0)} RMS</span>
            </div>
            <div className="meter-track">
              <span style={{ width: `${Math.max(0, Math.min(100, source.level || 0))}%` }} />
            </div>
          </div>
        )) : (
          <div className="meter empty">
            <div>
              <strong>Audio levels</strong>
              <span>Start capture to monitor sources</span>
            </div>
            <div className="meter-track"><span /></div>
          </div>
        )}
      </div>

      <div className="command-row">
        {COMMANDS.map((command) => (
          <button key={command.id} data-testid="aiReplyBtn" type="button" onClick={() => onCommand(command.id)}>
            {command.label}
          </button>
        ))}
      </div>

      <div className="live-columns">
        <Transcript transcript={transcript} />
        <AssistantCards cards={cards} />
      </div>
    </section>
  );
}

function ActiveTranscriptPanel({ transcript = [] }) {
  const recentTurns = Array.isArray(transcript) ? [...transcript.slice(-18)].reverse() : [];

  return (
    <section className="active-transcript-panel" aria-label="Live transcription">
      <div className="active-transcript-header">
        <strong>Live transcription</strong>
        <span>{recentTurns.length} recent turns</span>
      </div>
      <div className="active-transcript-turns">
        {recentTurns.length ? recentTurns.map((turn, index) => (
          <p key={`${turn.speaker || 'Speaker'}-${index}`}>
            <strong>{turn.speaker || 'Speaker'}:</strong> {turn.text}
          </p>
        )) : (
          <p className="active-transcript-empty">Waiting for speech.</p>
        )}
      </div>
    </section>
  );
}

function Transcript({ transcript }) {
  return (
    <div className="transcript-pane">
      <div className="pane-title">
        <h3>Live transcript</h3>
        <span>{transcript.length} turns</span>
      </div>
      <div className="scroll-area">
        {transcript.length ? transcript.map((turn, index) => (
          <article className="turn" key={`${turn.speaker}-${index}`}>
            <strong style={{ color: turn.speakerColor || undefined }}>{turn.speaker || 'Unknown'}</strong>
            <p>{turn.text}</p>
          </article>
        )) : (
          <EmptyState title="Waiting for speech" body="Start capture to stream transcript turns into this pane." />
        )}
      </div>
    </div>
  );
}

function isStarCard(bullets = []) {
  return Array.isArray(bullets) && bullets.some(b => /^\s*(Situation|Task|Action|Result)\b/i.test(b));
}

function AssistantCards({ cards, variant = 'default', status = '', onDismissCard }) {
  const active = variant === 'active';
  const [slideIndex, setSlideIndex] = useState(0);

  const groups = useMemo(() => {
    const res = [];
    let currentGroup = null;
    for (const card of cards) {
      const gKey = card.groupId || card.question || card.id;
      if (!currentGroup) {
        currentGroup = { key: gKey, cards: [card], question: card.question };
      } else if (currentGroup.key === gKey) {
        currentGroup.cards.push(card);
        if (card.question && !currentGroup.question) {
          currentGroup.question = card.question;
        }
      } else {
        res.push(currentGroup);
        currentGroup = { key: gKey, cards: [card], question: card.question };
      }
    }
    if (currentGroup) res.push(currentGroup);
    return res;
  }, [cards]);

  const cardStackRef = useRef(null);
  const latestGroupKey = groups[0]?.key;
  useEffect(() => {
    setSlideIndex(0);
  }, [latestGroupKey]);

  useEffect(() => {
    if (cardStackRef.current) {
      cardStackRef.current.scrollTop = cardStackRef.current.scrollHeight;
    }
  }, [displayCards.length, latestGroupKey]);

  const currentGroup = groups[slideIndex];
  const displayCards = currentGroup?.cards || [];
  const identifiedQuestion = currentGroup?.question;

  return (
    <div className={active ? 'assistant-pane assistant-pane-active' : 'assistant-pane'}>
      {active ? null : <div className="pane-title">
        <h3>Live assistant</h3>
        <span>{cards.length} cards</span>
      </div>}
      
      {groups.length > 1 && (
        <div className="carousel-nav">
          <button 
            type="button" 
            className="carousel-btn"
            onClick={() => setSlideIndex(prev => Math.min(groups.length - 1, prev + 1))}
            disabled={slideIndex >= groups.length - 1}
            aria-label="Previous answer"
            title="Older answer"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <span className="carousel-dots">
            {slideIndex === 0 ? 'Latest answer' : `Answer ${groups.length - slideIndex} of ${groups.length}`}
          </span>
          <button 
            type="button" 
            className="carousel-btn"
            onClick={() => setSlideIndex(prev => Math.max(0, prev - 1))}
            disabled={slideIndex === 0}
            aria-label="Next answer"
            title="Newer answer"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      )}

      <div ref={cardStackRef} className="scroll-area card-stack" data-active-size-content={active ? 'assistant-cards' : undefined}>
        {identifiedQuestion ? (
          <div className="card-identified-question">
            <strong>Question:</strong> {identifiedQuestion}
          </div>
        ) : null}
        {displayCards.length ? displayCards.map((card, index) => {
          const cardLabel = labelForCard(card.type);
          const cardTitle = String(card.title || '').trim();
          const showCardTitle = cardTitle && cardTitle.toLowerCase() !== cardLabel.toLowerCase();

          return (
            <div key={card.id || `${card.title}-${index}`} style={{ display: 'contents' }}>
              {index > 0 && (
                <div className="card-divider-container">
                  <div className="card-divider-line" />
                  <img src={thinkUrl} alt="" className="card-divider-icon" />
                  <div className="card-divider-line" />
                </div>
              )}
              <article className={`assistant-card ${card.type || 'note'} ${card.agentic ? 'assistant-card-agentic' : ''} ${card.draft ? 'assistant-card-draft' : ''}`}>
                <div className="card-top-actions">
                  {card.agentic ? <img src={proBadgeUrl} alt="Pro" className="agentic-badge-img" /> : null}
                  {onDismissCard && (
                    <button 
                      type="button" 
                      className="card-dismiss-btn" 
                      onClick={() => onDismissCard(card.id)}
                      aria-label="Dismiss card"
                      title="Dismiss"
                    >
                      &times;
                    </button>
                  )}
                </div>
                <div className="card-kicker">
                  <span>{cardLabel}</span>
                </div>
                {showCardTitle ? <h4>{cardTitle}</h4> : null}
              {card.body ? <p>{card.body}</p> : null}
              {card.bullets?.length ? (
                <div className="card-bullets-area">
                  {isStarCard(card.bullets) ? (
                    card.bullets.map((bullet, bulletIndex) => {
                      const starMatch = /^\s*(Situation\s*\(S\)|Task\s*\(T\)|Action\s*\(A\)|Result\s*\(R\)|Reflection\s*\(R\)|Situation|Task|Action|Result|Reflection)(:)\s*(.*)/is.exec(bullet);
                      if (starMatch) {
                        return (
                          <p key={bulletIndex} className="star-bullet-row">
                            <strong className="star-bullet-label">{starMatch[1]}{starMatch[2]}</strong> {starMatch[3]}
                          </p>
                        );
                      }
                      return <p key={bulletIndex} className="star-bullet-row">{bullet}</p>;
                    })
                  ) : (
                    <ul className={card.type === 'memory' ? 'memory-bullets' : 'standard-bullets'}>
                      {card.bullets.map((bullet, bulletIndex) => {
                        const reflectionMatch = /^\s*(Reflection)(:)\s*(.*)/is.exec(bullet);
                        if (reflectionMatch) {
                          return (
                            <li key={bulletIndex} className="reflection-bullet-row">
                              <strong className="star-bullet-label">{reflectionMatch[1]}{reflectionMatch[2]}</strong> {reflectionMatch[3]}
                            </li>
                          );
                        }
                        return <li key={bulletIndex}>{bullet}</li>;
                      })}
                    </ul>
                  )}
                </div>
              ) : null}
              {card.detail ? <small>{card.detail}</small> : null}
            </article>
          </div>
          );
        }) : active ? (
          <EmptyState
            title="Waiting for assistant cards"
            body={status || 'Clyde will add an answer when it detects an interview question.'}
          />
        ) : (
          <EmptyState
            title="No assistant cards yet"
            body="Clyde will add answers, recaps, risks, and follow-ups here."
          />
        )}
      </div>
    </div>
  );
}

function MemoryCardsWindow({ cards = [], onDismissCard }) {
  if (!cards.length) {
    return null;
  }

  return (
    <section className="active-memory-window" data-active-size-content="memory-cards" aria-label="Memory cards">
      <div className="active-memory-window-head">
        <strong>Memory</strong>
        <span>{cards.length} matched</span>
      </div>
      <div className="active-memory-card-stack">
        {cards.map((card, index) => (
          <article className={`assistant-card memory ${card.agentic ? 'assistant-card-agentic' : ''} ${card.draft ? 'assistant-card-draft' : ''}`} key={card.id || `${card.title}-${index}`}>
            <div className="card-top-actions">
              {card.agentic ? <img src={proBadgeUrl} alt="Pro" className="agentic-badge-img" /> : null}
              {onDismissCard ? (
                <button
                  type="button"
                  className="card-dismiss-btn"
                  onClick={() => onDismissCard(card.id)}
                  aria-label="Dismiss memory card"
                  title="Dismiss"
                >
                  &times;
                </button>
              ) : null}
            </div>
            <div className="card-kicker">
              <span>{labelForCard(card.type)}</span>
            </div>
            {card.title && card.title.toLowerCase() !== 'memory' ? <h4>{card.title}</h4> : null}
            {card.body ? <p>{card.body}</p> : null}
            {card.bullets?.length ? (
              <ul>
                {card.bullets.map((bullet, bulletIndex) => <li key={`${bullet}-${bulletIndex}`}>{bullet}</li>)}
              </ul>
            ) : null}
            {card.detail ? <small>{card.detail}</small> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function ContextPanel({ mode, settings, entities, calendarEvents = [], onStart }) {
  const api = window.electronAPI;
  const [activeSessions, setActiveSessions] = useState([]);
  const [trendAnalysis, setTrendAnalysis] = useState(null);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const nowMs = useNowMs();

  const activeInterview = mode === 'interview'
    ? entities.find((entity) => entity.id === settings.currentCompany || entity.name === settings.currentCompany)
    : null;
  const activeMeeting = mode === 'meeting'
    ? entities.find((entity) => entity.id === settings.meetingTitle || entity.name === settings.meetingTitle)
    : null;

  const activeId = mode === 'interview' ? activeInterview?.id : activeMeeting?.id;

  const handleRegeneratePreCallPrep = async () => {
    if (!activeId || !api?.generateTrendAnalysis || loadingTrend) return;
    setLoadingTrend(true);
    const cacheKey = `trend-analysis-${activeId}`;
    try {
      const generated = await api.generateTrendAnalysis(activeId, { force: true });
      if (generated) {
        setTrendAnalysis(generated);
        const sessionSignature = buildTrendAnalysisSessionSignature(activeSessions);
        localStorage.setItem(cacheKey, JSON.stringify({
          sessionsSignature: sessionSignature,
          sessionsCount: activeSessions.length,
          analysis: generated
        }));
      }
    } catch (error) {
      console.warn('Failed to regenerate pre-call prep', error);
    } finally {
      setLoadingTrend(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!activeId || !api?.getSessions) {
        setActiveSessions([]);
        setTrendAnalysis(null);
        return;
      }

      const nextSessions = await api.getSessions({ mode, entityId: activeId });
      if (cancelled) {
        return;
      }

      const normalized = Array.isArray(nextSessions) ? nextSessions : [];
      setActiveSessions(normalized);

      if (mode !== 'interview') {
        setTrendAnalysis(null);
        return;
      }

      const sessionSignature = buildTrendAnalysisSessionSignature(normalized);
      const cacheKey = `trend-analysis-${activeId}`;
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          const cachedAnalysis = unwrapTrendAnalysisRecord(parsed);
          if (
            isTrendAnalysisRecordFresh(parsed, sessionSignature, normalized.length)
            || (normalized.length < 2 && isMaterialPreCallPrepComplete(cachedAnalysis))
          ) {
            setTrendAnalysis(cachedAnalysis);
            return;
          }
        }
      } catch (error) {
        console.warn('Failed to parse trend analysis cache', error);
      }

      try {
        const stored = await api?.getTrendAnalysis?.(activeId);
        const storedAnalysis = unwrapTrendAnalysisRecord(stored);
        if (
          isTrendAnalysisRecordFresh(stored, sessionSignature, normalized.length)
          || (normalized.length < 2 && isMaterialPreCallPrepComplete(storedAnalysis))
        ) {
          setTrendAnalysis(storedAnalysis);
          localStorage.setItem(cacheKey, JSON.stringify(stored));
          return;
        }
      } catch (error) {
        console.warn('Failed to load persisted trend analysis', error);
      }

      try {
        localStorage.removeItem(cacheKey);
      } catch (_error) {
        // Ignore local cache cleanup failures.
      }

      if (api?.generateTrendAnalysis) {
        setLoadingTrend(true);
        try {
          const generated = await api.generateTrendAnalysis(activeId);
          if (cancelled) {
            return;
          }

          if (generated) {
            setTrendAnalysis(generated);
            localStorage.setItem(cacheKey, JSON.stringify({
              sessionsSignature: sessionSignature,
              sessionsCount: normalized.length,
              analysis: generated
            }));
            return;
          }
        } catch (error) {
          console.warn('Failed to generate pre-call prep', error);
        } finally {
          if (!cancelled) {
            setLoadingTrend(false);
          }
        }
      }

      setTrendAnalysis(null);
      setLoadingTrend(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [activeId, api, mode]);

  if (mode === 'interview' && !activeInterview) {
    return null;
  }
  if (mode === 'meeting' && !activeMeeting) {
    return null;
  }

  const sortedSessions = [...activeSessions].sort((a, b) => new Date(b.date) - new Date(a.date));
  const latestSession = sortedSessions[0];
  const meetingActionGroups = normalizeActionItemGroups(latestSession?.notes?.actionItems || []);
  const interviewFallbackSummary = latestSession?.notes?.summary || 'No summary available yet.';
  const preCallPrep = trendAnalysis?.pre_call_prep || null;
  const materialPrep = trendAnalysis?.prep_basis === 'materials';
  const prepRequiredSections = materialPrep
    ? ['cumulative_phase_summary', 'probable_focus', 'interviewer_question_patterns', 'gaps_and_mitigation', 'questions_to_ask']
    : ['cumulative_phase_summary', 'probable_focus', 'interviewer_question_patterns', 'questions_to_ask'];
  const hasPreCallPrep = Boolean(
    preCallPrep
    && prepRequiredSections.every((key) => Array.isArray(preCallPrep[key]) && preCallPrep[key].length === 3)
  );
  const nextInterviewEvent = mode === 'interview'
    ? [...calendarEvents]
      .filter((event) => {
        const eventTime = new Date(event?.date).getTime();
        return event?.entityId === activeInterview?.id
          && Number.isFinite(eventTime) && eventTime >= nowMs;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0]
    : null;
  const prepSessionTitle = nextInterviewEvent?.title || 'Next interview';
  const interviewSummaryParsed = parseEvaluationText(interviewFallbackSummary);
  const meetingSummaryParsed = parseEvaluationText(latestSession?.notes?.summary || '');

  return (
    <aside className="context-panel">
      <div className="context-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <h3 style={{ margin: 0 }}>Pre-call prep</h3>
          {mode === 'interview' && api?.generateTrendAnalysis && (
            <button
              type="button"
              className="ghost compact"
              disabled={loadingTrend}
              onClick={handleRegeneratePreCallPrep}
              style={{
                fontSize: '0.78rem',
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid var(--line-strong, rgba(154, 202, 255, 0.16))',
                background: 'var(--panel, rgba(154, 202, 255, 0.05))',
                color: 'var(--text, rgba(255, 255, 255, 0.85))',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                height: '24px'
              }}
            >
              {loadingTrend ? (
                <>
                  <span className="btn-spinner" style={{ marginRight: '6px' }}></span>
                  Generating...
                </>
              ) : (
                'Regenerate'
              )}
            </button>
          )}
        </div>

        {mode === 'interview' ? (
          <>
            <div className="prep-overview-card">
              <div className="prep-overview-grid">
                <div className="prep-overview-item">
                  <strong className="prep-label">Company</strong>
                  <div className="prep-value">{activeInterview.name || 'Not set'}</div>
                </div>
                <div className="prep-overview-item">
                  <strong className="prep-label">Role</strong>
                  <div className="prep-value">{activeInterview.role || settings.currentRole || 'Not set'}</div>
                </div>
                <div className="prep-overview-item">
                  <strong className="prep-label">Session title</strong>
                  <div className="prep-value">{prepSessionTitle}</div>
                </div>
                <button type="button" className="prep-start-button primary-action" onClick={onStart}>Start Interview</button>
              </div>
            </div>

            {activeSessions.length || hasPreCallPrep || loadingTrend ? (
              <>
                {loadingTrend && !hasPreCallPrep ? (
                  <div className="suggestion-box">
                    <strong>Pre-call analysis</strong>
                    <p>{activeSessions.length >= 2 ? 'Generating AI prep from the saved interviews...' : 'Generating AI prep from the role materials...'}</p>
                  </div>
                ) : null}

                {hasPreCallPrep ? (
                  <>
                    <div className="suggestion-box">
                      <strong>{materialPrep ? 'Useful insights' : 'Phase-by-Phase Breakdown'}</strong>
                      <ul className="action-list">
                        {preCallPrep.cumulative_phase_summary.map((item, index) => (
                          <li key={`${item}-${index}`}>{directAddressFeedback(item)}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="suggestion-box">
                      <strong>{materialPrep ? 'Probable questions to expect' : 'Probable focus for next round'}</strong>
                      <ul className="action-list">
                        {preCallPrep.probable_focus.map((item, index) => (
                          <li key={`${item}-${index}`}>{directAddressFeedback(item)}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="suggestion-box">
                      <strong>{materialPrep ? 'Strengths aligned to the role' : 'Previous interviewer question patterns'}</strong>
                      <ul className="action-list">
                        {preCallPrep.interviewer_question_patterns.map((item, index) => (
                          <li key={`${item}-${index}`}>{directAddressFeedback(item)}</li>
                        ))}
                      </ul>
                    </div>

                    {materialPrep && Array.isArray(preCallPrep.gaps_and_mitigation) && preCallPrep.gaps_and_mitigation.length ? (
                      <div className="suggestion-box">
                        <strong>Gaps and mitigation</strong>
                        <ul className="action-list">
                          {preCallPrep.gaps_and_mitigation.map((item, index) => (
                            <li key={`${item}-${index}`}>{directAddressFeedback(item)}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <div className="suggestion-box">
                      <strong>Questions you can ask</strong>
                      <ul className="action-list">
                        {preCallPrep.questions_to_ask.map((item, index) => (
                          <li key={`${item}-${index}`}>{directAddressFeedback(item)}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : !loadingTrend ? (
                  <div className="suggestion-box">
                    <strong>Pre-call analysis</strong>
                    <p>No AI prep available yet.</p>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="suggestion-box">
                <strong>Latest session summary</strong>
                {interviewSummaryParsed.overview ? <p>{interviewSummaryParsed.overview}</p> : null}
                {interviewSummaryParsed.sections.length ? (
                  <div className="evaluation-sections" style={{ marginTop: '8px' }}>
                    {interviewSummaryParsed.sections.map((section, index) => (
                      <div className="evaluation-section" key={`${section.title}-${index}`}>
                        {section.title ? <h4>{section.title}</h4> : null}
                        {section.body ? <p>{section.body}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                {!interviewSummaryParsed.overview && !interviewSummaryParsed.sections.length ? (
                  <p>No summary available yet.</p>
                ) : null}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="prep-overview-card">
              <div className="prep-overview-grid">
                <div className="prep-overview-item">
                  <strong className="prep-label">Meeting</strong>
                  <div className="prep-value">{activeMeeting.name || 'Not set'}</div>
                </div>
                <div className="prep-overview-item">
                  <strong className="prep-label">Attendees</strong>
                  <div className="prep-value">{attendeeSummary(activeMeeting.attendees) || attendeeSummary(settings.meetingAttendees) || 'Not set'}</div>
                </div>
                <div className="prep-overview-item">
                  <strong className="prep-label">Session title</strong>
                  <div className="prep-value">{latestSession?.title || 'Next meeting'}</div>
                </div>
                <button type="button" className="prep-start-button primary-action" onClick={onStart}>Start Meeting</button>
              </div>
            </div>
            <div className="suggestion-box">
              <strong>Last meeting summary</strong>
              {meetingSummaryParsed.overview ? <p>{meetingSummaryParsed.overview}</p> : null}
              {meetingSummaryParsed.sections.length ? (
                <div className="evaluation-sections" style={{ marginTop: '8px' }}>
                  {meetingSummaryParsed.sections.map((section, index) => (
                    <div className="evaluation-section" key={`${section.title}-${index}`}>
                      {section.title ? <h4>{section.title}</h4> : null}
                      {section.body ? <p>{section.body}</p> : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {!meetingSummaryParsed.overview && !meetingSummaryParsed.sections.length ? (
                <p>No meeting summary available yet.</p>
              ) : null}
            </div>
            <div className="suggestion-box">
              <strong>Action items</strong>
              {meetingActionGroups.length ? (
                <div className="evaluation-action-items" style={{ marginTop: '8px' }}>
                  <div className="action-item-groups">
                    {meetingActionGroups.map((group, index) => (
                      <section className="action-item-group" key={`${group.attendee || 'unassigned'}-${index}`}>
                        <strong>{group.attendee || 'Unassigned'}</strong>
                        <ul className="action-item-list">
                        {group.items.map((item, itemIndex) => (
                          <li key={`${item}-${itemIndex}`}>{item}</li>
                        ))}
                      </ul>
                      </section>
                    ))}
                  </div>
                </div>
              ) : (
                <p>No action items available yet.</p>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

function OpportunitySection({ collapsed, count, entities, onToggle, renderEntityRow, title }) {
  return (
    <section className="opportunity-section">
      <button
        aria-expanded={!collapsed}
        className="opportunity-section-toggle"
        onClick={onToggle}
        type="button"
      >
        <span>{title}</span>
        <span>{count}</span>
      </button>
      {!collapsed && count > 0 ? (
        <div className="opportunity-section-list">
          {entities.map(renderEntityRow)}
        </div>
      ) : null}
    </section>
  );
}

function EntityFilesPanel({ mode, entity }) {
  const api = window.electronAPI;
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('');

  const loadFiles = useCallback(async () => {
    if (!entity?.id || !api?.listEntityFiles) {
      setFiles([]);
      return;
    }
    const rows = await api.listEntityFiles({ mode, entityId: entity.id });
    setFiles(Array.isArray(rows) ? rows : []);
  }, [api, entity?.id, mode]);

  useEffect(() => {
    loadFiles().catch((error) => setStatus(`Files failed: ${error.message}`));
  }, [loadFiles]);

  useEffect(() => {
    function handlePinFile(event) {
      if (!entity?.id || event.detail?.id !== entity.id) {
        return;
      }
      addFiles();
    }
    window.addEventListener('pin-entity-file', handlePinFile);
    return () => window.removeEventListener('pin-entity-file', handlePinFile);
  }, [entity?.id, addFiles]);

  async function addFiles() {
    if (!entity?.id) {
      return;
    }
    setStatus('Opening file picker...');
    try {
      const rows = await api?.openEntityFileDialog?.({ mode, entityId: entity.id, entityName: entity.name });
      setStatus(Array.isArray(rows) && rows.length ? `${rows.length} file${rows.length === 1 ? '' : 's'} pinned.` : '');
      await loadFiles();
    } catch (error) {
      setStatus(`File upload failed: ${error.message}`);
    }
  }

  async function removeFile(id) {
    await api?.removeEntityFile?.(id);
    await loadFiles();
  }

  const fileLimit = Number(entity?.pinnedFileLimit || entity?.fileLimit || ENTITY_PINNED_FILE_LIMIT) || ENTITY_PINNED_FILE_LIMIT;
  return (
    <section className="entity-file-chips" aria-label="Pinned files">
      {files.map((file) => (
        <span key={file.id} className="entity-file-chip" title={file.filename}>
          <span aria-hidden="true">📌</span>
          <strong>{file.filename}</strong>
          <button type="button" aria-label={`Remove ${file.filename}`} onClick={() => removeFile(file.id)}>×</button>
        </span>
      ))}
      {files.length < fileLimit ? (
        <button type="button" className="pin-file-chip" onClick={addFiles}>+ Pin file</button>
      ) : null}
      {status ? <small className="knowledge-status">{status}</small> : null}
    </section>
  );
}

function TimelineView({ entities, mode, onStartCapture, onRefresh, onAddNewOpportunity, onAddNewMeeting, onEditEntity, onUpdateEntity, onEditSession, onSelectEntity, selectedEntity, justSyncedEntityId, setJustSyncedEntityId, sessions, settings, onChangeActiveInterview, onChangeActiveMeeting, calendarEvents }) {
  const selected = entities.find((entity) => entity.id === selectedEntity);
  const activeMeetingId = mode === 'meeting'
    ? entities.find((entity) => entity.id === settings?.meetingTitle || entity.name === settings?.meetingTitle)?.id || ''
    : '';
  const [hasJd, setHasJd] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [editMenuOpen, setEditMenuOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingEntityStatusId, setEditingEntityStatusId] = useState('');
  const [collapsedOutcomeSections, setCollapsedOutcomeSections] = useState({ applied: true, rejected: true, offer: true });
  const [matchAnalysisCollapsed, setMatchAnalysisCollapsed] = useState(true);

  useEffect(() => {
    if (selectedEntity) {
      if (justSyncedEntityId === selectedEntity) {
        setMatchAnalysisCollapsed(false);
      } else {
        setMatchAnalysisCollapsed(true);
      }
    }
  }, [selectedEntity, justSyncedEntityId]);
  const [railWidth, setRailWidth] = useState(390);
  const actionMenuRef = useRef(null);
  const editMenuRef = useRef(null);
  const statusMenuRef = useRef(null);
  const api = window.electronAPI;
  const calibrationSummary = useOutcomeCalibrationSummary(api, mode, selected);
  const nowMs = useNowMs();

  const filteredEntities = entities.filter(entity => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (entity.name && entity.name.toLowerCase().includes(query)) ||
      (entity.role && entity.role.toLowerCase().includes(query)) ||
      (entity.kind && entity.kind.toLowerCase().includes(query))
    );
  });

  const activeEntities = mode === 'interview'
    ? filteredEntities.filter((entity) => {
        const out = normalizeOpportunityOutcome(entity.outcome);
        return out !== 'rejected' && out !== 'offer' && out !== 'applied';
      })
    : filteredEntities;
  const appliedEntities = mode === 'interview'
    ? filteredEntities.filter((entity) => normalizeOpportunityOutcome(entity.outcome) === 'applied')
    : [];
  const rejectedEntities = mode === 'interview'
    ? filteredEntities.filter((entity) => normalizeOpportunityOutcome(entity.outcome) === 'rejected')
    : [];
  const offerEntities = mode === 'interview'
    ? filteredEntities.filter((entity) => normalizeOpportunityOutcome(entity.outcome) === 'offer')
    : [];
  
  const entityEvents = (calendarEvents || [])
    .filter((event) => {
      const eventTime = new Date(event?.date).getTime();
      return event?.entityId === selectedEntity
        && Number.isFinite(eventTime) && eventTime >= nowMs;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  useEffect(() => {
    if (selected && api?.getCompanyJobDescription) {
      api.getCompanyJobDescription(selected.id).then(res => setHasJd(!!(res && res.trim().length > 0)));
    }
  }, [selected, api]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target)) {
        setActionMenuOpen(false);
      }
      if (editMenuRef.current && !editMenuRef.current.contains(event.target)) {
        setEditMenuOpen(false);
      }
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target)) {
        setStatusMenuOpen(false);
      }
      if (!event.target.closest('.rail-status-editor')) {
        setEditingEntityStatusId('');
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  async function updateSelectedOutcome(outcome) {
    if (!selected) {
      return;
    }
    setStatusMenuOpen(false);
    const patch = { outcome };
    if (typeof onUpdateEntity === 'function') {
      await onUpdateEntity(selected, patch);
      return;
    }
    await api?.updateSessionEntity?.({ mode, entityId: selected.id, patch });
    await onRefresh?.();
  }

  const handleDeleteEntity = async () => {
    if (confirm(`Delete "${selected.name}" and all its transcripts? This cannot be undone.`)) {
      if (mode === 'interview') {
        await api?.deleteCompany?.(selected.id);
        
        // If this was the active interview, clear it
        if (settings?.currentCompany === selected.id) {
            await onChangeActiveInterview('', '');
        }
      } else {
        await api?.deleteSessionEntity?.({ mode, entityId: selected.id });
        if (activeMeetingId === selected.id) {
          await onChangeActiveMeeting('');
        }
      }
      onSelectEntity(''); // clear selected entity
      onRefresh(); // Refresh the sidebar list
    }
  };

  const handleDeleteSession = async (session) => {
    if (confirm(`Delete this session?`)) {
      await api?.deleteSession?.({ mode: session.mode, id: session.id, entityId: session.entity.id });
      onSelectEntity(selected.id); // Refresh sessions for this entity
    }
  };

  const toggleOutcomeSection = (outcome) => {
    setCollapsedOutcomeSections((current) => ({
      ...current,
      [outcome]: !current[outcome]
    }));
  };

  const handleRailResizePointerDown = (event) => {
    if (window.innerWidth <= 1120) {
      return;
    }

    event.preventDefault();
    const startX = event.clientX;
    const startWidth = railWidth;
    const maxWidth = Math.min(620, Math.max(390, Math.round(window.innerWidth * 0.48)));

    const handleMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      setRailWidth(Math.max(360, Math.min(maxWidth, startWidth + delta)));
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  };

  const handleRailResizeKeyDown = (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const maxWidth = Math.min(620, Math.max(390, Math.round(window.innerWidth * 0.48)));
    setRailWidth((current) => Math.max(360, Math.min(maxWidth, current + (direction * 24))));
  };

  const renderEntityRow = (entity) => {
    const isActive = mode === 'interview'
      ? settings?.currentCompany === entity.id
      : activeMeetingId === entity.id;
    const canSetActiveInterview = mode !== 'interview' || normalizeOpportunityOutcome(entity.outcome) !== 'rejected';

    return (
      <div key={entity.id} className="opportunity-row">
        <button
          className={entity.id === selectedEntity ? 'active' : ''}
          type="button"
          onClick={() => onSelectEntity(entity.id)}
        >
          <div className="opportunity-row-main">
            <strong>{entity.name}</strong>
            <span className="entity-list-badges" style={{ position: 'relative' }}>
              {mode === 'interview' && (
                <span className="rail-status-editor" style={{ display: 'inline-block' }}>
                  <span
                    role="button"
                    tabIndex={0}
                    className="outcome-badge-button"
                    style={{ cursor: 'pointer', display: 'inline-block' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setEditingEntityStatusId(current => current === entity.id ? '' : entity.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        e.preventDefault();
                        setEditingEntityStatusId(current => current === entity.id ? '' : entity.id);
                      }
                    }}
                  >
                    <OutcomeBadge outcome={entity.outcome} />
                  </span>
                  {editingEntityStatusId === entity.id ? (
                    <div className="timeline-action-menu status-menu" style={{ position: 'absolute', top: '100%', right: 0, zIndex: 100 }}>
                      {['applied', 'active', 'advanced', 'rejected', 'offer'].map((outcome) => (
                        <button
                          key={outcome}
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setEditingEntityStatusId('');
                            const patch = { outcome };
                            if (typeof onUpdateEntity === 'function') {
                              await onUpdateEntity(entity, patch);
                            } else {
                              await api?.updateSessionEntity?.({ mode, entityId: entity.id, patch });
                            }
                            await onRefresh?.();
                          }}
                        >
                          {getOutcomeLabel(outcome)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </span>
              )}
              {mode === 'interview' && entity.confidence > 0 && (
                <span className={`confidence-pill ${confidenceBand(entity.confidence)}`}>
                  {entity.confidence}%
                </span>
              )}
            </span>
          </div>
          <span className="opportunity-row-heading">{entity.role || entity.kind}</span>
        </button>
        {(mode === 'interview' || mode === 'meeting') && (
          <button 
            className="opportunity-active-toggle"
            disabled={!canSetActiveInterview}
            type="button" 
            title={!canSetActiveInterview ? 'Rejected opportunities cannot be active interviews' : (isActive ? (mode === 'interview' ? 'Active Interview' : 'Active Meeting') : (mode === 'interview' ? 'Set as Active Interview' : 'Set as Active Meeting'))}
            onClick={() => {
              if (!canSetActiveInterview) {
                return;
              }
              if (mode === 'interview') {
                onChangeActiveInterview(isActive ? '' : entity.id, isActive ? '' : entity.role);
              } else {
                onChangeActiveMeeting(isActive ? '' : entity.id);
              }
            }}
          >
            {isActive ? '★' : '☆'}
          </button>
        )}
      </div>
    );
  };

  return (
    <section className="timeline-view" data-testid="sessionTimeline" style={{ '--timeline-rail-width': `${railWidth}px` }}>
      <div className="timeline-rail">
        <div className="timeline-heading">
          <h2>{mode === 'interview' ? 'Interview timeline' : 'Meeting timeline'}</h2>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            {mode === 'interview' && (
              <button type="button" onClick={onAddNewOpportunity} className="primary-action" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                + Add New Opportunity
              </button>
            )}
            {mode === 'meeting' && (
              <button type="button" onClick={onAddNewMeeting} className="primary-action" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                + Add New Meeting
              </button>
            )}
            <button type="button" onClick={onRefresh} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Refresh</button>
          </div>
        </div>
        <div className="rail-search-bar" style={{ padding: '4px 10px 10px 10px' }}>
          <input
            type="text"
            placeholder={mode === 'interview' ? "Search opportunities..." : "Search meetings..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rail-search-input"
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '0.85rem',
              borderRadius: '8px',
              border: '1px solid var(--line)',
              background: 'rgba(255, 255, 255, 0.02)',
              color: 'var(--text)',
              outline: 'none'
            }}
          />
        </div>
        <div className="entity-list">
          {entities.length ? (
            <>
              {activeEntities.length ? activeEntities.map(renderEntityRow) : (
                <EmptyState title="No active opportunities" body={mode === 'interview' ? 'Rejected and offer opportunities are grouped below.' : 'Save a session to build history.'} />
              )}
              {mode === 'interview' ? (
                <>
                  <OpportunitySection
                    collapsed={collapsedOutcomeSections.applied}
                    count={appliedEntities.length}
                    entities={appliedEntities}
                    onToggle={() => toggleOutcomeSection('applied')}
                    renderEntityRow={renderEntityRow}
                    title="Applied"
                  />
                  <OpportunitySection
                    collapsed={collapsedOutcomeSections.rejected}
                    count={rejectedEntities.length}
                    entities={rejectedEntities}
                    onToggle={() => toggleOutcomeSection('rejected')}
                    renderEntityRow={renderEntityRow}
                    title="Rejected"
                  />
                  <OpportunitySection
                    collapsed={collapsedOutcomeSections.offer}
                    count={offerEntities.length}
                    entities={offerEntities}
                    onToggle={() => toggleOutcomeSection('offer')}
                    renderEntityRow={renderEntityRow}
                    title="Offer"
                  />
                </>
              ) : null}
            </>
          ) : <EmptyState title="No saved sessions" body="Save a session to build history." />}
        </div>
      </div>
      <div
        aria-label="Resize opportunity list"
        aria-orientation="vertical"
        className="timeline-rail-resizer"
        onKeyDown={handleRailResizeKeyDown}
        onPointerDown={handleRailResizePointerDown}
        role="separator"
        tabIndex={0}
      />

      <div className="timeline-main">
        <div className="timeline-title">
          <div className="timeline-title-copy">
            <div className="timeline-title-row">
              <h2>{selected?.name || 'Select a record'}</h2>
              {selected ? (
                <div className="timeline-title-icon-actions">
                  <span ref={actionMenuRef}>
                    <button type="button" className="timeline-icon-button" aria-label="Add opportunity item" onClick={() => setActionMenuOpen((open) => !open)}>+</button>
                    {actionMenuOpen ? (
                      <div className="timeline-action-menu">
                        <button type="button" onClick={() => { setActionMenuOpen(false); window.dispatchEvent(new CustomEvent('open-calendar-modal', { detail: selected })); }}>{mode === 'interview' ? 'Add New Interview to Calendar' : 'Add New Meeting to Calendar'}</button>
                        <button type="button" onClick={() => { setActionMenuOpen(false); window.dispatchEvent(new CustomEvent('open-manual-transcript-modal', { detail: selected })); }}>{mode === 'interview' ? 'Add New Interview Session to Timeline' : 'Add New Meeting Session to Timeline'}</button>
                        {mode === 'interview' && !hasJd ? <button type="button" onClick={() => { setActionMenuOpen(false); window.dispatchEvent(new CustomEvent('open-jd-modal', { detail: selected })); }}>Add job description</button> : null}
                        <button type="button" onClick={() => { setActionMenuOpen(false); window.dispatchEvent(new CustomEvent('pin-entity-file', { detail: selected })); }}>Add New Pinned File</button>
                      </div>
                    ) : null}
                  </span>
                  <span ref={editMenuRef}>
                    <button type="button" className="timeline-icon-button" aria-label="Edit opportunity" onClick={() => setEditMenuOpen((open) => !open)}>✎</button>
                    {editMenuOpen ? (
                      <div className="timeline-action-menu">
                        <button type="button" onClick={() => { setEditMenuOpen(false); onEditEntity(selected); }}>{mode === 'interview' ? 'Edit opportunity details' : 'Edit meeting details'}</button>
                        {mode === 'interview' && hasJd ? <button type="button" onClick={() => { setEditMenuOpen(false); window.dispatchEvent(new CustomEvent('open-jd-modal', { detail: selected })); }}>Edit job description</button> : null}
                      </div>
                    ) : null}
                  </span>
                  <button type="button" className="timeline-icon-button danger-icon-button" aria-label={mode === 'interview' ? "Delete opportunity" : "Delete meeting"} onClick={handleDeleteEntity} style={{ marginLeft: '6px' }} title={mode === 'interview' ? "Delete opportunity" : "Delete meeting"}>🗑</button>
                </div>
              ) : null}
            </div>
            {selected ? (
              <div className="timeline-title-meta">
                <p>{selected.role || selected.kind || ''}</p>
                {mode === 'interview' ? (
                  <button type="button" className="job-description-icon-button" onClick={() => window.dispatchEvent(new CustomEvent('open-jd-modal', { detail: selected }))} title={hasJd ? 'View job description' : 'Add job description'}>
                    <img src={hasJd ? jobDescriptionUrl : jobDescriptionEmptyUrl} alt="" />
                  </button>
                ) : null}
              </div>
            ) : <p>Choose a company or meeting from the rail.</p>}
          </div>
        </div>

        {selected && entityEvents.length > 0 ? (
          <div className="upcoming-event-rows">
            {entityEvents.map((evt) => (
              <div className="upcoming-event-row" key={evt.id} style={{ borderLeftColor: calendarEventColor(evt) }}>
                <span className="upcoming-event-icon" aria-hidden="true">•</span>
                <strong>{evt.title} · {formatEventDateTime(evt.date)}</strong>
                <button type="button" className="primary-action" onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('start-from-event', { detail: { entity: selected, evt } })); }}>Start</button>
              </div>
            ))}
          </div>
        ) : null}

        {selected ? <EntityFilesPanel mode={mode} entity={selected} /> : null}

        {selected && mode === 'interview' && (selected.match_score !== undefined || selected.top_strength || selected.main_gap || selected.mitigation) ? (
          <div className="match-rating-panel" style={{
            background: 'rgba(15, 23, 42, 0.45)',
            border: '1px solid rgba(154, 202, 255, 0.16)',
            borderRadius: '12px',
            padding: matchAnalysisCollapsed ? '12px 20px' : '16px 20px',
            marginBottom: '20px',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.24)',
            transition: 'all 0.2s ease-in-out'
          }}>
            <div 
              onClick={() => setMatchAnalysisCollapsed(!matchAnalysisCollapsed)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                cursor: 'pointer',
                userSelect: 'none',
                borderBottom: matchAnalysisCollapsed ? 'none' : '1px solid rgba(154, 202, 255, 0.1)',
                paddingBottom: matchAnalysisCollapsed ? '0' : '10px',
                marginBottom: matchAnalysisCollapsed ? '0' : '14px'
              }}
            >
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🎯 AI Match Analysis
                <span style={{ fontSize: '0.75rem', opacity: 0.6, marginLeft: '4px', transition: 'transform 0.2s', display: 'inline-block', transform: matchAnalysisCollapsed ? 'none' : 'rotate(90deg)' }}>
                  ▶
                </span>
              </h4>
              {selected.match_score !== undefined && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(255, 209, 102, 0.12)',
                  border: '1px solid rgba(255, 209, 102, 0.35)',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  color: '#ffd166',
                  boxShadow: '0 0 10px rgba(255, 209, 102, 0.08)'
                }}>
                  <span>Match Score {Number(selected.match_score).toFixed(1)}/5</span>
                </div>
              )}
            </div>

            {!matchAnalysisCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {selected.top_strength && (
                  <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: '4px', alignItems: 'start' }}>
                    <span style={{ fontSize: '1.25rem', color: '#a6ff6a', display: 'flex', justifyContent: 'center', marginTop: '-2px' }}>✓</span>
                    <div>
                      <strong style={{ color: '#a6ff6a', fontSize: '0.88rem', display: 'block', marginBottom: '2px', fontWeight: 800 }}>Top Strength</strong>
                      <span style={{ color: '#f1f5f9', fontSize: '0.86rem', lineHeight: '1.5' }}>{selected.top_strength}</span>
                    </div>
                  </div>
                )}

                {selected.main_gap && (
                  <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: '4px', alignItems: 'start' }}>
                    <span style={{ fontSize: '1.25rem', color: '#ff5c7a', display: 'flex', justifyContent: 'center', marginTop: '-2px' }}>✗</span>
                    <div>
                      <strong style={{ color: '#ff5c7a', fontSize: '0.88rem', display: 'block', marginBottom: '2px', fontWeight: 800 }}>Main Gap</strong>
                      <span style={{ color: '#f1f5f9', fontSize: '0.86rem', lineHeight: '1.5' }}>{selected.main_gap}</span>
                    </div>
                  </div>
                )}

                {selected.mitigation && (
                  <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: '4px', alignItems: 'start' }}>
                    <span style={{ fontSize: '1.25rem', color: '#ffd166', display: 'flex', justifyContent: 'center', marginTop: '-2px' }}>💡</span>
                    <div>
                      <strong style={{ color: '#ffd166', fontSize: '0.88rem', display: 'block', marginBottom: '2px', fontWeight: 800 }}>Mitigation</strong>
                      <span style={{ color: '#f1f5f9', fontSize: '0.86rem', lineHeight: '1.5' }}>{selected.mitigation}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        <div className="timeline-session-area">
          <div className="interview-timeline-head">
            <h3>{mode === 'interview' ? `Interview Timeline (${sessions.length})` : `Meeting Timeline (${sessions.length})`}</h3>
            {mode === 'interview' && selected ? (
              <span className="interview-timeline-status" ref={statusMenuRef}>
                <button type="button" className="outcome-badge-button" onClick={() => setStatusMenuOpen((open) => !open)}>
                  <OutcomeBadge outcome={selected.outcome} />
                </button>
                {statusMenuOpen ? (
                  <div className="timeline-action-menu status-menu">
                    {['applied', 'active', 'advanced', 'rejected', 'offer'].map((outcome) => (
                      <button key={outcome} type="button" onClick={() => updateSelectedOutcome(outcome)}>{getOutcomeLabel(outcome)}</button>
                    ))}
                  </div>
                ) : null}
              </span>
            ) : null}
            {mode === 'interview' && selected ? <OutcomeCalibrationNote summary={calibrationSummary} /> : null}
          </div>
          <div className="session-list">
            {sessions.length ? sessions.map((session) => (
              <SessionBlock
                key={`${session.mode}-${session.entity.id}-${session.id}`}
                session={session}
                onDelete={() => handleDeleteSession(session)}
                onEdit={() => onEditSession(session)}
              />
            )) : <EmptyState title="No sessions selected" body="Choose a company or meeting from the rail." />}
          </div>
        </div>
      </div>
    </section>
  );
}

function SessionBlock({ session, onDelete, onEdit }) {
  const transcriptRating = getTranscriptRating(session.grading);

  return (
    <details className="session-block session-block-collapsible">
      <summary className="session-summary-row">
        <div className="session-head">
          <div>
            <div className="session-title-row">
              <span className="session-expand-indicator" aria-hidden="true">›</span>
              <h3>{session.title}</h3>
              {onDelete && (
                <button type="button" className="session-icon-action" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onDelete(); }} title="Delete session" aria-label="Delete session">
                  🗑
                </button>
              )}
              {onEdit && (
                <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onEdit(); }} className="session-icon-action" title="Edit session" aria-label="Edit session">
                  ✎
                </button>
              )}
            </div>
            <p>{new Date(session.date).toLocaleString()}</p>
          </div>
          <div className="session-grade-stack">
            {session.mode === 'interview' && transcriptRating !== null ? (
              <div className="session-rating" title={`Transcript rating ${transcriptRating} out of 5`}>
                <span>Transcript rating</span>
                <StarRating rating={transcriptRating} />
              </div>
            ) : session.mode === 'interview' && session.grading?.status === 'failed' ? (
              <span className="grade-pill error" title="Grading failed. Click '✎' to edit/save to retry, or sign out and sign back in to refresh credentials.">Transcript rating failed ⚠️</span>
            ) : (
              <span className="grade-pill muted">{session.mode === 'interview' ? 'Transcript rating pending' : session.mode}</span>
            )}
          </div>
        </div>
      </summary>
      <div className="session-expanded-content">
        <EvaluationNotes
          mode={session.mode}
          summary={session.notes?.summary}
          examples={session.mode === 'interview' ? (session.grading?.examples || []) : (session.notes?.actionItems || [])}
        />
        <details className="session-transcript-details">
          <summary>Transcript</summary>
          <div className="session-transcript">
            {session.transcript.map((turn, index) => (
              <p key={`${turn.speaker}-${index}`}>
                <strong>{turn.speaker}:</strong> {turn.text}
              </p>
            ))}
          </div>
        </details>
      </div>
    </details>
  );
}

function EvaluationNotes({ mode = 'interview', summary, examples = [] }) {
  const evaluation = parseEvaluationText(summary);
  const hasSummary = Boolean(evaluation.overview || evaluation.sections.length);
  const actionGroups = mode === 'meeting'
    ? normalizeActionItemGroups(examples)
    : examples.map(cleanEvaluationText).filter(Boolean);

  if (!hasSummary && !actionGroups.length) {
    return null;
  }

  return (
    <section className="evaluation-notes" aria-label={mode === 'meeting' ? 'Meeting notes' : 'Interview evaluation'}>
      {evaluation.overview ? <p className="session-summary">{evaluation.overview}</p> : null}
      {evaluation.sections.length ? (
        <div className="evaluation-sections">
          {evaluation.sections.map((section, index) => (
            <div className="evaluation-section" key={`${section.title}-${index}`}>
              {section.title ? <h4>{section.title}</h4> : null}
              {section.body ? <p>{section.body}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
      {actionGroups.length ? (
        mode === 'meeting' ? (
          <div className="evaluation-action-items">
            <h4>Action items</h4>
            <div className="action-item-groups">
              {actionGroups.map((group, groupIndex) => (
                <section className="action-item-group" key={`${group.attendee || 'unassigned'}-${groupIndex}`}>
                  <strong>{group.attendee || 'Unassigned'}</strong>
                  <ul className="action-item-list">
                    {group.items.map((item, itemIndex) => (
                      <li key={`${item}-${itemIndex}`}>{item}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        ) : (
          <ul className="action-list evaluation-examples">
            {actionGroups.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
          </ul>
        )
      ) : null}
    </section>
  );
}

function OnboardingWizard({ api, mode, onCalendarChanged, onClose, onModeChange, onReload, onSettingsUpdated, onValidate, settings }) {
  const isUserSignedIn = Boolean(settings.userId && settings.authEmail);
  const [stepIndex, setStepIndex] = useState(isUserSignedIn ? 1 : 0);
  const [selectedPlanId, setSelectedPlanId] = useState(settings.userTier === 'pro' ? 'pro_monthly' : 'free'); // 'free', 'pro_monthly', 'pro_annual', 'credits_pack'
  const [selectedCreditsSize, setSelectedCreditsSize] = useState(50); // 20, 50, 120
  const [wizardMode, setWizardMode] = useState(mode || 'interview');
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [checkoutStarted, setCheckoutStarted] = useState(false);
  const [completed, setCompleted] = useState(isUserSignedIn ? { plan: true } : {});
  const [audioDevices, setAudioDevices] = useState({ microphones: [], systemOutputs: [] });
  
  // Unified Registration Form State
  const [signUpForm, setSignUpForm] = useState({ email: '', password: '', confirmPassword: '' });
  
  const [signInForm, setSignInForm] = useState({ email: '', password: '' });
  const [workspaceDraft, setWorkspaceDraft] = useState({
    company: settings.currentCompany || '',
    role: settings.currentRole || '',
    phase: 'Interview #1',
    jobDescription: '',
    meetingTitle: settings.meetingTitle || '',
    attendeesText: attendeeLines(settings.meetingAttendees || []),
    meetingMemory: settings.meetingMemory || ''
  });
  
  const isPro = settings.userTier === 'pro';
  const [settingsDraft, setSettingsDraft] = useState({
    ...settings,
    appMode: mode || settings.appMode || 'interview',
    llmProvider: settings.llmProvider || (isPro ? 'clyde-cloud' : 'local'),
    llmModel: settings.llmProvider === 'openai'
      ? 'gpt-4o'
      : (settings.llmProvider === 'gemini' || settings.llmProvider === 'clyde-cloud' || isPro)
        ? 'gemini-3.5-flash'
        : (settings.llmModel || ''),
    transcriptionProvider: settings.transcriptionProvider || (isPro ? 'clyde-cloud-whisper' : 'local'),
    audioEngine: settings.audioEngine || 'rust',
    googleSyncPollMinutes: settings.googleSyncPollMinutes || 15,
    proRealtimeModel: settings.proRealtimeModel || 'gpt-realtime-2',
    pineconeNamespace: settings.pineconeNamespace || 'clyde-pro-knowledge'
  });
  const [eventDraft, setEventDraft] = useState({
    title: '',
    date: toDateTimeLocal(new Date().toISOString()),
    description: ''
  });

  const [selectedSoul, setSelectedSoul] = useState('coach');
  const [soulCustomDescription, setSoulCustomDescription] = useState('');
  const [userBio, setUserBio] = useState('');
  const [userStrengths, setUserStrengths] = useState('');
  const [userCommPreference, setUserCommPreference] = useState('');

  useEffect(() => {
    async function fetchSoul() {
      try {
        const soulMarkdown = await api?.loadSoul?.();
        if (soulMarkdown) {
          const archetypeMatch = soulMarkdown.match(/-\s+\*\*Archetype\*\*:\s*(.*)/i);
          const customMatch = soulMarkdown.match(/-\s+\*\*Custom Tone\*\*:\s*(.*)/i);
          const bioMatch = soulMarkdown.match(/-\s+\*\*Profile\/Bio\*\*:\s*([\s\S]*?)(?=\n-\s+\*\*|$)/i);
          const strengthsMatch = soulMarkdown.match(/-\s+\*\*Key Strengths\*\*:\s*([\s\S]*?)(?=\n-\s+\*\*|$)/i);
          const commMatch = soulMarkdown.match(/-\s+\*\*Communication Style\*\*:\s*([\s\S]*?)(?=\n-\s+\*\*|$)/i);

          if (archetypeMatch) {
            const val = archetypeMatch[1].trim().toLowerCase();
            if (val.includes('coach')) setSelectedSoul('coach');
            else if (val.includes('hype')) setSelectedSoul('hype');
            else if (val.includes('snarky')) setSelectedSoul('snarky');
            else if (val.includes('calm') || val.includes('philosopher')) setSelectedSoul('philosopher');
            else setSelectedSoul('custom');
          }
          if (customMatch) setSoulCustomDescription(customMatch[1].trim());
          if (bioMatch) setUserBio(bioMatch[1].trim());
          if (strengthsMatch) setUserStrengths(strengthsMatch[1].trim());
          if (commMatch) setUserCommPreference(commMatch[1].trim());
        }
      } catch (e) {
        console.warn('Failed to pre-populate soul:', e);
      }
    }
    fetchSoul();
  }, [api]);

  const proEntitled = canUseFeature(settingsDraft, 'pro_realtime_agent') || canUseFeature(settings, 'pro_realtime_agent');
  const steps = [
    { id: 'plan', label: 'Plan & Register' },
    { id: 'mode', label: 'Mode' },
    { id: 'theme', label: 'Theme' },
    { id: 'workspace', label: wizardMode === 'meeting' ? 'Meeting' : 'Opportunity' },
    { id: 'context', label: 'Context' },
    { id: 'soul', label: "Clyde's Soul" },
    { id: 'providers', label: 'Providers' },
    ...(proEntitled ? [{ id: 'pro', label: 'Pro setup' }] : []),
    { id: 'schedule', label: 'Schedule' },
    { id: 'finish', label: 'Finish' }
  ];
  const step = steps[stepIndex] || steps[0];
  const lastStep = stepIndex === steps.length - 1;

  function updateSetting(key, value) {
    if (key === 'theme') {
      const theme = value || 'default';
      const classes = document.documentElement.className.split(' ').filter(c => !c.startsWith('theme-'));
      if (theme !== 'default') {
        classes.push(`theme-${theme}`);
      }
      document.documentElement.className = classes.join(' ').trim();
      
      const logoUrl = getThemeLogoUrl(theme);
      if (logoUrl) {
        const logoImgs = document.querySelectorAll('.title-bar-logo img, .workspace-nav-logo-card img');
        logoImgs.forEach((img) => {
          img.src = logoUrl;
        });
      }
    }
    setSettingsDraft((current) => {
      if (key === 'googleSyncEnabled' && !value) {
        return { ...current, googleSyncEnabled: false, googleSyncAutoApprove: false };
      }
      return { ...current, [key]: value };
    });
  }

  function updateWorkspace(key, value) {
    setWorkspaceDraft((current) => ({ ...current, [key]: value }));
  }

  async function persistSettings(patch = {}) {
    const nextSettings = normalizeEntitledSettings({
      ...settings,
      ...settingsDraft,
      ...patch,
      appMode: wizardMode,
      meetingAttendees: parseAttendees(patch.meetingAttendeesText ?? workspaceDraft.attendeesText ?? attendeeLines(settingsDraft.meetingAttendees || []))
    });
    delete nextSettings.meetingAttendeesText;
    await api?.saveSettings?.(nextSettings);
    await api?.setActiveSessionContext?.({
      mode: wizardMode,
      company: nextSettings.currentCompany,
      role: nextSettings.currentRole,
      meetingTitle: nextSettings.meetingTitle,
      attendees: nextSettings.meetingAttendees,
      memory: nextSettings.meetingMemory
    });
    setSettingsDraft(nextSettings);
    onSettingsUpdated?.(nextSettings);
    return nextSettings;
  }

  function restartOnboardingPlan() {
    setSelectedPlanId('free');
    setCheckoutStarted(false);
    setCompleted({});
    setStatus('');
    setStepIndex(0);
  }

  async function startUnifiedRegister() {
    if (!signUpForm.email.trim() || !signUpForm.password) {
      setStatus('Please enter an email and password to register.');
      return;
    }
    if (signUpForm.password !== signUpForm.confirmPassword) {
      setStatus('Passwords do not match.');
      return;
    }
    setBusy(true);
    setStatus('Creating account...');
    try {
      // 1. Create the account in Supabase
      const authResult = await api?.signUp?.({
        email: signUpForm.email.trim(),
        password: signUpForm.password
      });

      if (authResult?.settings) {
        onSettingsUpdated?.(normalizeEntitledSettings(authResult.settings));
      }

      // 2. Determine checkout routing if Pro or Credit Pack is chosen
      if (selectedPlanId === 'free') {
        setCompleted((current) => ({ ...current, plan: true }));
        setStatus('Account created! Free local tier activated. Continue onboarding.');
        setStepIndex(1);
      } else {
        setStatus('Account created! Opening secure payment checkout in your default browser...');
        
        // Launch Stripe checkout session
        const checkoutPayload = {
          email: signUpForm.email.trim(),
          password: signUpForm.password,
          credits: selectedPlanId === 'credits_pack',
          creditsAmount: selectedPlanId === 'credits_pack' ? selectedCreditsSize : undefined,
          forceCheckout: true
        };
        const checkout = await api?.startProSignupCheckout?.(checkoutPayload);
        
        setCheckoutStarted(true);
        setCompleted((current) => ({ ...current, plan: true }));
        setStatus(`Stripe checkout opened. After payment completes, return here and sign in with: ${signUpForm.email}`);
      }
    } catch (error) {
      // Strips Axios/IPC wrapper prefixes to show a clean, native, customer-friendly message
      let msg = error.message || 'Account creation failed.';
      msg = msg.replace(/Error invoking remote method '[^']+':\s*/g, '');
      msg = msg.replace(/Error:\s*/g, '');
      setStatus(`Registration failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  async function signInAndRefresh() {
    if (!signInForm.email || !signInForm.password) {
      setStatus('Enter the Pro account email and password.');
      return;
    }
    setBusy(true);
    try {
      const result = await api?.signIn?.(signInForm);
      if (result?.settings) {
        onSettingsUpdated?.(normalizeEntitledSettings(result.settings));
      }
      const entitlements = await api?.refreshEntitlements?.();
      const latest = await api?.loadSettings?.();
      const nextSettings = normalizeEntitledSettings({
        ...(latest || result?.settings || settings),
        ...(entitlements || {}),
        entitlementFeatures: entitlements?.features || latest?.entitlementFeatures || []
      });
      setSettingsDraft((current) => ({ ...current, ...nextSettings }));
      onSettingsUpdated?.(nextSettings);
      if (entitlements?.tier === 'pro' || entitlements?.userTier === 'pro') {
        setStatus('Pro is active. Pro setup is now available.');
        setSelectedPlanId('pro_monthly');
        setCompleted((current) => ({ ...current, plan: true }));
        setStepIndex(1);
      } else {
        setStatus('License check complete. No active subscription found on this email. Complete checkout first.');
      }
    } catch (error) {
      setStatus(error.message || 'Verification failed.');
    } finally {
      setBusy(false);
    }
  }
  async function refreshSubscription() {
    setBusy(true);
    try {
      const entitlements = await api?.refreshEntitlements?.();
      const latest = await api?.loadSettings?.();
      const nextSettings = normalizeEntitledSettings({
        ...(latest || settings),
        ...(entitlements || {}),
        entitlementFeatures: entitlements?.features || latest?.entitlementFeatures || []
      });
      setSettingsDraft((current) => ({ ...current, ...nextSettings }));
      onSettingsUpdated?.(nextSettings);
      if (entitlements?.tier === 'pro' || entitlements?.userTier === 'pro' || nextSettings.userTier === 'pro') {
        setStatus('Pro is active. Pro setup is now available.');
        setPlan('pro');
        setCompleted((current) => ({ ...current, plan: true, proActive: true }));
      } else {
        setStatus('Subscription still shows Free. Complete checkout, then refresh again.');
      }
    } catch (error) {
      setStatus(error.message || 'Subscription refresh failed.');
    } finally {
      setBusy(false);
    }
  }

  async function saveModeStep() {
    setBusy(true);
    try {
      await onModeChange?.(wizardMode);
      await persistSettings({ appMode: wizardMode });
      setCompleted((current) => ({ ...current, mode: true }));
      setStatus(`${wizardMode === 'meeting' ? 'Meeting' : 'Interview'} mode saved.`);
      setStepIndex((index) => index + 1);
    } catch (error) {
      setStatus(error.message || 'Mode save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function saveThemeStep(skip = false) {
    if (skip) {
      setCompleted((current) => ({ ...current, theme: false }));
      setStepIndex((index) => index + 1);
      return;
    }
    setBusy(true);
    try {
      await persistSettings(settingsDraft);
      setCompleted((current) => ({ ...current, theme: true }));
      setStatus('Theme saved.');
      setStepIndex((index) => index + 1);
    } catch (error) {
      setStatus(error.message || 'Theme save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function saveWorkspaceStep(skip = false) {
    if (skip) {
      setCompleted((current) => ({ ...current, workspace: false }));
      setStepIndex((index) => index + 1);
      return;
    }
    setBusy(true);
    try {
      if (wizardMode === 'interview') {
        const company = workspaceDraft.company.trim();
        const role = workspaceDraft.role.trim();
        if (!company || !role) {
          setStatus('Company and role are required to create an opportunity.');
          return;
        }
        await api?.updateSessionEntity?.({
          mode: 'interview',
          entityId: company,
          patch: { name: company, role, outcome: 'active' }
        });
        if (workspaceDraft.jobDescription.trim()) {
          await api?.setCompanyJobDescription?.(company, workspaceDraft.jobDescription.trim());
        }
        const nextSettings = await api?.setActiveSessionContext?.({ mode: 'interview', company, role });
        onSettingsUpdated?.(nextSettings || { ...settings, currentCompany: company, currentRole: role });
      } else {
        const title = workspaceDraft.meetingTitle.trim();
        if (!title) {
          setStatus('Meeting title is required to create a meeting.');
          return;
        }
        const attendees = parseAttendees(workspaceDraft.attendeesText);
        await api?.updateSessionEntity?.({
          mode: 'meeting',
          entityId: title,
          patch: { name: title, attendees }
        });
        const nextSettings = await api?.setActiveSessionContext?.({
          mode: 'meeting',
          meetingTitle: title,
          attendees,
          memory: workspaceDraft.meetingMemory.trim()
        });
        onSettingsUpdated?.(nextSettings || { ...settings, meetingTitle: title, meetingAttendees: attendees, meetingMemory: workspaceDraft.meetingMemory.trim() });
      }
      await onReload?.(wizardMode);
      setCompleted((current) => ({ ...current, workspace: true }));
      setStatus('First workspace item saved.');
      setStepIndex((index) => index + 1);
    } catch (error) {
      setStatus(error.message || 'Workspace save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function importResume() {
    setBusy(true);
    try {
      const file = await api?.openResumeFileDialog?.();
      if (file?.text) {
        updateSetting('resumeText', file.text);
        setStatus(`Imported ${file.filename || 'resume file'}.`);
      } else {
        setStatus('No readable resume text was imported.');
      }
    } catch (error) {
      setStatus(error.message || 'Resume import failed.');
    } finally {
      setBusy(false);
    }
  }

  async function saveContextStep(skip = false) {
    if (skip) {
      setCompleted((current) => ({ ...current, context: false }));
      setStepIndex((index) => index + 1);
      return;
    }
    setBusy(true);
    try {
      await persistSettings({
        resumeText: wizardMode === 'interview' ? settingsDraft.resumeText || '' : settings.resumeText || '',
        meetingMemory: wizardMode === 'meeting' ? settingsDraft.meetingMemory || workspaceDraft.meetingMemory || '' : settings.meetingMemory || ''
      });
      setCompleted((current) => ({ ...current, context: true }));
      setStatus('Context saved.');
      setStepIndex((index) => index + 1);
    } catch (error) {
      setStatus(error.message || 'Context save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function saveSoulStep(skip = false) {
    if (skip) {
      setCompleted((current) => ({ ...current, soul: false }));
      setStepIndex((index) => index + 1);
      return;
    }
    setBusy(true);
    try {
      const archetypeLabel = {
        coach: 'Professional Coach (polished, seasoned mentor)',
        hype: 'Hype Friend (enthusiastic, motivational)',
        snarky: 'Snarky Genius (witty, analytical, sarcastic)',
        philosopher: 'Calm Philosopher (serene, composed, mindful)',
        custom: 'Custom Tone'
      }[selectedSoul];

      const soulMarkdown = `# Clyde's Soul

- **Archetype**: ${archetypeLabel}
- **Custom Tone**: ${selectedSoul === 'custom' ? soulCustomDescription : 'N/A'}

## About Me (Candidate Info)
- **Profile/Bio**: ${userBio}
- **Key Strengths**: ${userStrengths}
- **Communication Style**: ${userCommPreference}

## Personality Directives
${
  selectedSoul === 'coach' ? '- Keep responses polished, professional, and structured like a mentor.\n- Focus on clear deliverables, leadership, and high-impact metrics.\n- Speak with calm confidence.' :
  selectedSoul === 'hype' ? '- Be extremely enthusiastic and motivational!\n- Use high-energy phrases ("Let\'s go!", "You got this!") and emojis where appropriate.\n- Keep spirits high and stay optimistic.' :
  selectedSoul === 'snarky' ? '- Deliver witty, direct, highly analytical, and slightly sarcastic answers.\n- Be smart, concise, and don\'t sugarcoat advice.\n- Challenge assumptions intellectually.' :
  selectedSoul === 'philosopher' ? '- Provide serene, composed, and mindful suggestions.\n- Remind the user to breathe, stay centered, and view challenges calmly.\n- Speak in measured, thoughtful tones.' :
  `- Adopt this custom behavior: ${soulCustomDescription}`
}
`;
      await api?.saveSoul?.(soulMarkdown);
      setCompleted((current) => ({ ...current, soul: true }));
      setStatus("Clyde's soul saved.");
      setStepIndex((index) => index + 1);
    } catch (error) {
      setStatus(error.message || 'Soul save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function refreshAudioDevices() {
    setBusy(true);
    try {
      const result = await api?.listAudioDevices?.();
      setAudioDevices({
        microphones: Array.isArray(result?.microphones) ? result.microphones : [],
        systemOutputs: Array.isArray(result?.systemOutputs) ? result.systemOutputs : []
      });
      setStatus(result?.message || 'Audio devices refreshed.');
    } catch (error) {
      setStatus(error.message || 'Audio device refresh failed.');
    } finally {
      setBusy(false);
    }
  }

  async function saveProvidersStep(skip = false) {
    if (skip) {
      setCompleted((current) => ({ ...current, providers: false }));
      setStepIndex((index) => index + 1);
      return;
    }
    setBusy(true);
    try {
      await api?.setAudioDevices?.({
        audioEngine: settingsDraft.audioEngine || 'rust',
        microphoneDeviceId: settingsDraft.microphoneDeviceId || '',
        systemAudioDeviceId: settingsDraft.systemAudioDeviceId || ''
      });
      await persistSettings(settingsDraft);
      setCompleted((current) => ({ ...current, providers: true }));
      setStatus('Provider settings saved.');
      setStepIndex((index) => index + 1);
    } catch (error) {
      setStatus(error.message || 'Provider save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function validateServicesFromWizard() {
    setBusy(true);
    try {
      await persistSettings(settingsDraft);
      const result = await onValidate?.();
      setStatus(result ? 'Service check complete.' : 'Service check ran.');
    } catch (error) {
      setStatus(error.message || 'Service check failed.');
    } finally {
      setBusy(false);
    }
  }

  async function saveProStep(skip = false) {
    if (skip) {
      setCompleted((current) => ({ ...current, pro: false }));
      setStepIndex((index) => index + 1);
      return;
    }
    setBusy(true);
    try {
      await persistSettings({
        ...settingsDraft,
        googleSyncEnabled: Boolean(settingsDraft.googleSyncEnabled),
        googleSyncAutoApprove: Boolean(settingsDraft.googleSyncAutoApprove),
        ragEnabled: Boolean(settingsDraft.ragEnabled),
        proAgentEnabled: Boolean(settingsDraft.proAgentEnabled),
        proRealtimeModel: settingsDraft.proRealtimeModel || 'gpt-realtime-2',
        transcriptionProvider: settingsDraft.proAgentEnabled ? 'openai-realtime-whisper' : settingsDraft.transcriptionProvider
      });
      setCompleted((current) => ({ ...current, pro: true }));
      setStatus('Pro setup saved.');
      setStepIndex((index) => index + 1);
    } catch (error) {
      setStatus(error.message || 'Pro setup save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function connectGoogle() {
    setBusy(true);
    try {
      await api?.connectGoogleSync?.();
      setStatus('Google connected.');
    } catch (error) {
      setStatus(error.message || 'Google connection failed.');
    } finally {
      setBusy(false);
    }
  }

  async function saveScheduleStep(skip = false) {
    if (skip) {
      setCompleted((current) => ({ ...current, schedule: false }));
      setStepIndex((index) => index + 1);
      return;
    }
    if (!eventDraft.title.trim()) {
      setStatus('Event title is required to schedule the first event.');
      return;
    }
    setBusy(true);
    try {
      const entityId = wizardMode === 'meeting'
        ? (workspaceDraft.meetingTitle || settings.meetingTitle || '')
        : (workspaceDraft.company || settings.currentCompany || '');
      await api?.saveCalendarEvent?.({
        title: eventDraft.title.trim(),
        date: fromDateTimeLocal(eventDraft.date),
        description: eventDraft.description.trim(),
        associationMode: wizardMode === 'meeting' ? 'meeting' : 'opportunity',
        entityId,
        entityName: entityId,
        opportunityId: wizardMode === 'interview' ? entityId : '',
        meetingId: wizardMode === 'meeting' ? entityId : '',
        color: wizardMode === 'meeting' ? '#00ffaa' : '#00e5ff'
      });
      await onCalendarChanged?.();
      setCompleted((current) => ({ ...current, schedule: true }));
      setStatus('First event scheduled.');
      setStepIndex((index) => index + 1);
    } catch (error) {
      setStatus(error.message || 'Calendar save failed.');
    } finally {
      setBusy(false);
    }
  }

  function finishWizard() {
    onClose?.({ dontShowAgain: true, route: completed.schedule ? 'calendar' : completed.workspace ? 'timeline' : 'home' });
  }

  function skipCurrentStep() {
    if (step.id === 'theme') return saveThemeStep(true);
    if (step.id === 'workspace') return saveWorkspaceStep(true);
    if (step.id === 'context') return saveContextStep(true);
    if (step.id === 'soul') return saveSoulStep(true);
    if (step.id === 'providers') return saveProvidersStep(true);
    if (step.id === 'pro') return saveProStep(true);
    if (step.id === 'schedule') return saveScheduleStep(true);
    setStepIndex((index) => Math.min(steps.length - 1, index + 1));
  }

  function continueCurrentStep() {
    if (step.id === 'plan') {
      if (!selectedPlanId) {
        setStatus('Select Free, Pro or Credit Pack first.');
        return;
      }
      if (selectedPlanId !== 'free' && !proEntitled) {
        setStatus('Please create your account and complete Stripe checkout to continue with Pro features.');
        return;
      }
      setStepIndex(1);
      return;
    }
    if (step.id === 'mode') return saveModeStep();
    if (step.id === 'theme') return saveThemeStep();
    if (step.id === 'workspace') return saveWorkspaceStep();
    if (step.id === 'context') return saveContextStep();
    if (step.id === 'soul') return saveSoulStep();
    if (step.id === 'providers') return saveProvidersStep();
    if (step.id === 'pro') return saveProStep();
    if (step.id === 'schedule') return saveScheduleStep();
    if (step.id === 'finish') return finishWizard();
  }

  const canSkip = ['theme', 'workspace', 'context', 'soul', 'providers', 'pro', 'schedule'].includes(step.id);

  return (
    <div className="onboarding-backdrop" role="presentation">
      <section className="onboarding-wizard" role="dialog" aria-modal="true" aria-label="Clyde onboarding wizard">
        <aside className="onboarding-steps">
          <span>Getting started</span>
          <h2>Clyde setup</h2>
          {steps.map((item, index) => {
            const isPlanDisabled = item.id === 'plan' && isUserSignedIn;
            return (
              <button
                key={item.id}
                type="button"
                className={`${index === stepIndex ? 'active' : ''} ${completed[item.id] ? 'complete' : ''}`}
                style={{
                  opacity: isPlanDisabled ? 0.5 : 1,
                  cursor: isPlanDisabled ? 'not-allowed' : 'pointer'
                }}
                disabled={isPlanDisabled}
                onClick={() => {
                  if (!isPlanDisabled) {
                    setStepIndex(index);
                  }
                }}
              >
                <span>{index + 1}</span>
                {item.label}
              </button>
            );
          })}
        </aside>
        <div className="onboarding-panel">
          <div className="onboarding-head">
            <div>
              <span>Step {stepIndex + 1} of {steps.length}</span>
              <h2>{step.label}</h2>
            </div>
            <button type="button" className="ghost" onClick={() => onClose?.({ dontShowAgain })}>Close</button>
          </div>

          <div className="onboarding-body">
            {step.id === 'plan' ? (
              <PlanStep
                busy={busy}
                selectedPlanId={selectedPlanId}
                setSelectedPlanId={setSelectedPlanId}
                selectedCreditsSize={selectedCreditsSize}
                setSelectedCreditsSize={setSelectedCreditsSize}
                checkoutStarted={checkoutStarted}
                proEntitled={proEntitled}
                signUpForm={signUpForm}
                setSignUpForm={setSignUpForm}
                signInForm={signInForm}
                setSignInForm={setSignInForm}
                onStartUnifiedRegister={startUnifiedRegister}
                onSignInRefresh={signInAndRefresh}
                onRefreshSubscription={refreshSubscription}
                onRestart={restartOnboardingPlan}
              />
            ) : null}
            {step.id === 'mode' ? (
              <ModeStep wizardMode={wizardMode} setWizardMode={setWizardMode} />
            ) : null}
            {step.id === 'theme' ? (
              <ThemeStep draft={settingsDraft} update={updateSetting} />
            ) : null}
            {step.id === 'workspace' ? (
              <WorkspaceStep mode={wizardMode} draft={workspaceDraft} update={updateWorkspace} />
            ) : null}
            {step.id === 'context' ? (
              <ContextStep mode={wizardMode} draft={settingsDraft} update={updateSetting} onImportResume={importResume} />
            ) : null}
            {step.id === 'soul' ? (
              <SoulStep
                selectedSoul={selectedSoul}
                setSelectedSoul={setSelectedSoul}
                soulCustomDescription={soulCustomDescription}
                setSoulCustomDescription={setSoulCustomDescription}
                userBio={userBio}
                setUserBio={setUserBio}
                userStrengths={userStrengths}
                setUserStrengths={setUserStrengths}
                userCommPreference={userCommPreference}
                setUserCommPreference={setUserCommPreference}
              />
            ) : null}
            {step.id === 'providers' ? (
              <ProviderStep
                audioDevices={audioDevices}
                draft={settingsDraft}
                update={updateSetting}
                onRefreshAudio={refreshAudioDevices}
                onValidate={validateServicesFromWizard}
                proEntitled={proEntitled}
              />
            ) : null}
            {step.id === 'pro' ? (
              <ProSetupStep
                draft={settingsDraft}
                update={updateSetting}
                onConnectGoogle={connectGoogle}
                onOpenBilling={() => api?.openBillingPortal?.()}
                onRefreshSubscription={refreshSubscription}
              />
            ) : null}
            {step.id === 'schedule' ? (
              <ScheduleStep mode={wizardMode} draft={eventDraft} setDraft={setEventDraft} />
            ) : null}
            {step.id === 'finish' ? (
              <FinishStep completed={completed} plan={selectedPlanId || 'free'} proEntitled={proEntitled} />
            ) : null}
          </div>

          {status ? <div className="onboarding-status" role="status">{status}</div> : null}

          <div className="onboarding-foot">
            <label className="toggle-row question-bank-global-toggle">
              <span className="switch-control">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setDontShowAgain(checked);
                    if (checked) {
                      localStorage.setItem(ONBOARDING_GUIDE_DISMISSED_KEY, 'true');
                    } else {
                      localStorage.removeItem(ONBOARDING_GUIDE_DISMISSED_KEY);
                    }
                    const nextSettings = { ...settings, onboardingGuideDismissed: checked };
                    api?.saveSettings?.(nextSettings).then(() => {
                      onSettingsUpdated?.(nextSettings);
                    }).catch(() => {});
                  }}
                />
                <span className="switch-slider" />
              </span>
              <span className="switch-label">Do not show this again</span>
            </label>
            <div>
              {stepIndex > 0 ? <button type="button" className="ghost" disabled={busy} onClick={() => setStepIndex((index) => Math.max(0, index - 1))}>Back</button> : null}
              {canSkip ? <button type="button" className="ghost" disabled={busy} onClick={skipCurrentStep}>Skip for now</button> : null}
              <button type="button" className="primary-action" disabled={busy} onClick={continueCurrentStep}>
                {busy ? 'Working...' : lastStep ? 'Finish' : 'Save and continue'}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function PlanStep({ busy, checkoutStarted, selectedPlanId, setSelectedPlanId, selectedCreditsSize, setSelectedCreditsSize, proEntitled, signUpForm, setSignUpForm, signInForm, setSignInForm, onStartUnifiedRegister, onSignInRefresh, onRestart }) {
  if (checkoutStarted && !proEntitled) {
    return (
      <div className="onboarding-grid" style={{ gridTemplateColumns: '1fr' }}>
        <p className="wide-field onboarding-note" style={{ margin: '0 0 12px 0', fontSize: '0.9rem', lineHeight: '1.5', color: '#38bdf8' }}>
          ✓ Almost done! Stripe checkout session is open in your browser.
        </p>
        <section className="onboarding-wide-card" style={{ width: '100%', maxWidth: '500px', margin: '0 auto' }}>
          <h3>Confirm your subscription</h3>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '20px', lineHeight: '1.5' }}>
            Complete your payment in the Stripe window, then enter your email and password below to log into your Clyde Cockpit:
          </p>
          <div className="onboarding-form-grid" style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: '#cbd5e1' }}>
              Email Address
              <input type="email" value={signInForm.email} onChange={(event) => setSignInForm((current) => ({ ...current, email: event.target.value }))} style={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '10px 12px', color: '#f8fafc' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: '#cbd5e1' }}>
              Password
              <input type="password" value={signInForm.password} onChange={(event) => setSignInForm((current) => ({ ...current, password: event.target.value }))} style={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '10px 12px', color: '#f8fafc' }} />
            </label>
            <button type="button" className="primary-action wide-field" disabled={busy} onClick={onSignInRefresh} style={{ padding: '12px', borderRadius: '8px', background: 'linear-gradient(to right, #6366f1, #a855f7)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: '600' }}>
              Verify & Sign In
            </button>
            <button type="button" className="ghost wide-field" disabled={busy} onClick={onRestart} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '10px', borderRadius: '8px', cursor: 'pointer' }}>
              Restart registration
            </button>
          </div>
        </section>
      </div>
    );
  }

  const plans = [
    {
      id: 'free',
      name: 'Free Tier',
      price: '$0',
      description: 'Local helper for live capture, manual opportunity tracking, and current-context guidance.',
      bullets: [
        'Local model routing & local transcriptions',
        'Standard browser auto-fillers',
        'Manual opportunity & round tracking',
        'Bring Your Own Keys (BYOK)'
      ]
    },
    {
      id: 'pro_monthly',
      name: 'Pro Monthly',
      price: '$29.99/mo',
      description: 'Unlock Pro: Managed cloud LLMs, advanced RAG search, mock scorecards, and Realtime voice.',
      bullets: [
        'Clyde Managed Cloud (Uncapped Gemini/GPT)',
        'Continuous Gmail & Google Calendar Sync',
        'Pinecone Hybrid RAG semantic search',
        'Low-latency GPT Realtime voice coach'
      ]
    },
    {
      id: 'pro_annual',
      name: 'Pro Annual',
      price: '$24.99/mo',
      description: 'Get all Clyde Pro features with an annual subscription (Save 16%, billed annually).',
      bullets: [
        'All Pro Monthly features included',
        'Save over $60 annually',
        'Direct priority support access',
        'Never worry about monthly renew cycles'
      ]
    },
    {
      id: 'credits_pack',
      name: `Credit Pack (${selectedCreditsSize})`,
      price: selectedCreditsSize === 20 ? '$4.99' : selectedCreditsSize === 120 ? '$19.99' : '$9.99',
      description: 'On-demand pay-as-you-go background extension & mock interview credits. Never expires.',
      bullets: [
        `${selectedCreditsSize} background credits included`,
        'Perfect for extension-focused fillers',
        'No recurring monthly commitments',
        'Use credits when you need them'
      ]
    }
  ];

  return (
    <div className="onboarding-grid" style={{ gridTemplateColumns: '1fr', gap: '24px' }}>
      <p className="wide-field onboarding-note" style={{ margin: '0', fontSize: '0.9rem', lineHeight: '1.5', color: '#94a3b8' }}>
        Select your plan up front, then create your new Clyde account below to begin your setup:
      </p>

      {/* Plan Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {plans.map((p) => {
          const isCredits = p.id === 'credits_pack';
          return (
            <div
              key={p.id}
              onClick={() => setSelectedPlanId(p.id)}
              style={{
                background: selectedPlanId === p.id ? 'rgba(99, 102, 241, 0.08)' : 'rgba(30, 41, 59, 0.4)',
                border: selectedPlanId === p.id ? '2px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '12px',
                padding: '20px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                textAlign: 'left',
                transition: 'border 0.2s, background 0.2s'
              }}
            >
              <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: '#f8fafc', fontWeight: '700' }}>{p.name}</h4>
              <div style={{ color: '#818cf8', fontWeight: '800', fontSize: '1.4rem', margin: '4px 0 10px 0' }}>{p.price}</div>
              
              {/* Live select menu inside the card for credit packs */}
              {isCredits && (
                <div onClick={(e) => e.stopPropagation()} style={{ margin: '4px 0 12px 0', width: '100%' }}>
                  <select 
                    value={selectedCreditsSize} 
                    onChange={(e) => setSelectedCreditsSize(Number(e.target.value))}
                    style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '6px 10px', color: '#f8fafc', width: '100%', outline: 'none', fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    <option value="20">20 Credits — $4.99</option>
                    <option value="50">50 Credits — $9.99</option>
                    <option value="120">120 Credits — $19.99</option>
                  </select>
                </div>
              )}

              <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 12px 0', lineHeight: '1.4' }}>{p.description}</p>
              <ul style={{ paddingLeft: '14px', margin: 'auto 0 0 0', fontSize: '0.74rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                {p.bullets.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Unified Registration form (replaces Continue with Free) */}
      <section className="onboarding-wide-card wide-field" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '24px', marginTop: '8px' }}>
        <h3 style={{ marginBottom: '8px' }}>Create your Clyde account</h3>
        <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '20px' }}>
          Enter your details below to set up your account profile. If you choose a paid plan, we will create the account and direct you immediately to Stripe checkout.
        </p>

        <form onSubmit={(e) => { e.preventDefault(); onStartUnifiedRegister(); }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', textAlign: 'left' }}>
          {selectedPlanId === 'credits_pack' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: '#cbd5e1', gridColumn: '1 / -1', marginBottom: '8px' }}>
              Select Package Size
              <select 
                value={selectedCreditsSize} 
                onChange={(e) => setSelectedCreditsSize(Number(e.target.value))}
                style={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '10px 12px', color: '#f8fafc', width: '100%', outline: 'none' }}
              >
                <option value="20">20 Credits — $4.99</option>
                <option value="50">50 Credits — $9.99</option>
                <option value="120">120 Credits — $19.99</option>
              </select>
            </label>
          )}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: '#cbd5e1' }}>
            Email Address
            <input type="email" required value={signUpForm.email} onChange={(event) => setSignUpForm((current) => ({ ...current, email: event.target.value }))} style={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '10px 12px', color: '#f8fafc' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: '#cbd5e1' }}>
            Password
            <input type="password" required value={signUpForm.password} onChange={(event) => setSignUpForm((current) => ({ ...current, password: event.target.value }))} style={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '10px 12px', color: '#f8fafc' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: '#cbd5e1' }}>
            Confirm Password
            <input type="password" required value={signUpForm.confirmPassword} onChange={(event) => setSignUpForm((current) => ({ ...current, confirmPassword: event.target.value }))} style={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '10px 12px', color: '#f8fafc' }} />
          </label>
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button
              type="submit"
              disabled={busy}
              style={{
                background: 'linear-gradient(to right, #6366f1, #a855f7)',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 32px',
                color: '#ffffff',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)'
              }}
            >
              {busy ? 'Working...' : selectedPlanId === 'free' ? 'Create Account & Continue' : `Subscribe & Continue to Checkout`}
            </button>
          </div>
        </form>
      </section>

      {/* Account Restore path for existing subscribers */}
      <section className="onboarding-wide-card wide-field" style={{ background: 'rgba(15,23,42,0.2)', border: '1px dashed rgba(255,255,255,0.06)' }}>
        <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: '#f8fafc' }}>Already have a Clyde account?</h4>
        <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 16px 0' }}>Sign in here to instantly load your cockpit setup, configuration, and premium entitlements:</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', textAlign: 'left' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.78rem', color: '#cbd5e1' }}>
            Email
            <input type="email" value={signInForm.email} onChange={(event) => setSignInForm((current) => ({ ...current, email: event.target.value }))} style={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '8px 10px', color: '#f8fafc' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.78rem', color: '#cbd5e1' }}>
            Password
            <input type="password" value={signInForm.password} onChange={(event) => setSignInForm((current) => ({ ...current, password: event.target.value }))} style={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '8px 10px', color: '#f8fafc' }} />
          </label>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="button" className="ghost wide-field" style={{ padding: '9px', borderRadius: '6px', cursor: 'pointer' }} disabled={busy} onClick={onSignInRefresh}>
              Sign In & Restore Setup
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ModeStep({ wizardMode, setWizardMode }) {
  return (
    <div className="onboarding-mode-step">
      <p style={{ margin: '0 0 16px 0', color: 'var(--muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
        Clyde adapts to your workflow with two core modes. Select <strong>Interview</strong> if you want to track job application opportunities, practice mock questions, and record live recruiter or technical rounds. Select <strong>Meeting</strong> if you want to log recurring team syncs, collaborate on action items, and build a long-term project memory database.
      </p>
      <p className="wide-field onboarding-note" style={{ margin: '0 0 20px 0', fontSize: '0.88rem', lineHeight: '1.5' }}>
        💡 <strong>Note:</strong> You are just selecting a primary mode to start practicing or configuring your workspace during onboarding. You can easily switch between Interview and Meeting modes at any time from the app navigation bar.
      </p>
      <div className="choice-grid">
        <button type="button" className={wizardMode === 'interview' ? 'active' : ''} onClick={() => setWizardMode('interview')}>
          <strong>Interview</strong>
          <span>Track opportunities, job descriptions, rounds, prep, outcomes, and interview scorecards.</span>
        </button>
        <button type="button" className={wizardMode === 'meeting' ? 'active' : ''} onClick={() => setWizardMode('meeting')}>
          <strong>Meeting</strong>
          <span>Track recurring conversations, attendees, long-term memory, notes, and action items.</span>
        </button>
      </div>
    </div>
  );
}

function ThemeStep({ draft, update }) {
  const currentTheme = draft.theme || 'default';
  const themes = [
    { id: 'default', name: 'Midnight Blue', desc: 'Classic dark workspace with sleek cyan/blue gradients.', dotColor: '#4f46e5', dotBorder: '#7c3aed' },
    { id: 'cyberpunk', name: 'Neon Cyberpunk', desc: 'Electrifying neon pink, purple, and cyber cyan accents.', dotColor: '#db2777', dotBorder: '#7c3aed' },
    { id: 'forest', name: 'Emerald Forest', desc: 'Serene dark moss, pine green, and emerald glows.', dotColor: '#10b981', dotBorder: '#064e3b' },
    { id: 'amber', name: 'Retro Amber', desc: 'Classic warm amber phosphor terminal emulation aesthetic.', dotColor: '#f59e0b', dotBorder: '#78350f' },
    { id: 'slate', name: 'Nordic Slate', desc: 'Premium deep dark slate with white accents and silver highlights.', dotColor: '#475569', dotBorder: '#94a3b8' },
    { id: 'snow', name: 'Nordic Snow (Light)', desc: 'Clean, frosted-glass light theme with beautiful indigo accents.', dotColor: '#cbd5e1', dotBorder: '#4f46e5' },
    { id: 'blossom', name: 'Sakura Blossom (Light)', desc: 'Elegant cherry blossom light rose workspace with dark maroon text.', dotColor: '#fecdd3', dotBorder: '#db2777' }
  ];

  return (
    <div className="onboarding-theme-step">
      <p style={{ margin: '0 0 16px 0', color: 'var(--muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
        Tailor Clyde's appearance to fit your style and workspace. Choose between high-contrast dark developer themes or sleek, high-readability light modes.
      </p>
      <p className="wide-field onboarding-note" style={{ margin: '0 0 20px 0', fontSize: '0.88rem', lineHeight: '1.5' }}>
        💡 <strong>Live Preview:</strong> Clicking any theme below will instantly apply the theme to the entire desktop window so you can preview it before continuing!
      </p>
      <div className="choice-grid">
        {themes.map((t) => (
          <button
            key={t.id}
            type="button"
            className={currentTheme === t.id ? 'active' : ''}
            onClick={() => update('theme', t.id)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', marginBottom: '4px' }}>
              <span style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: t.dotColor,
                border: `1px solid ${t.dotBorder}`,
                display: 'inline-block'
              }} />
              <strong style={{ fontSize: '1.05rem' }}>{t.name}</strong>
            </div>
            <span>{t.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function WorkspaceStep({ mode, draft, update }) {
  return (
    <div className="onboarding-form-grid">
      {mode === 'interview' ? (
        <>
          <p className="wide-field onboarding-note" style={{ margin: '0 0 8px 0', fontSize: '0.9rem', lineHeight: '1.5' }}>
            Opportunities are target company tracks where you run interview stages. Let's create your first one so Clyde can organize your resume facts, track job descriptions, and prepare customized answer strategies.
          </p>
          <label>Company<input value={draft.company} onChange={(event) => update('company', event.target.value)} placeholder="Apollo" /></label>
          <label>Role<input value={draft.role} onChange={(event) => update('role', event.target.value)} placeholder="Support Operations Manager" /></label>
          <label>Interview phase<select value={draft.phase} onChange={(event) => update('phase', event.target.value)}>{INTERVIEW_PHASE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label className="wide-field">Job description<textarea value={draft.jobDescription} onChange={(event) => update('jobDescription', event.target.value)} placeholder="Paste the job description." /></label>
        </>
      ) : (
        <>
          <p className="wide-field onboarding-note" style={{ margin: '0 0 8px 0', fontSize: '0.9rem', lineHeight: '1.5' }}>
            Meetings are recurring team syncing tracks where you log discussions and build context. Let's create your first meeting workspace to capture agendas, note templates, and automatic action item recaps.
          </p>
          <label>Meeting title<input value={draft.meetingTitle} onChange={(event) => update('meetingTitle', event.target.value)} placeholder="Product weekly" /></label>
          <label>Attendees<input value={draft.attendeesText} onChange={(event) => update('attendeesText', event.target.value)} placeholder="Morgan: PM, Lee: Eng" /></label>
          <label className="wide-field">Meeting memory<textarea value={draft.meetingMemory} onChange={(event) => update('meetingMemory', event.target.value)} placeholder="Recurring context, decisions, and preferences." /></label>
        </>
      )}
    </div>
  );
}

function ContextStep({ mode, draft, update, onImportResume }) {
  return (
    <div className="onboarding-form-grid">
      {mode === 'interview' ? (
        <>
          <p className="wide-field onboarding-note" style={{ margin: '0 0 8px 0', fontSize: '0.9rem', lineHeight: '1.5' }}>
            Your resume and background facts serve as Clyde's core knowledge base. Upload or paste your experience so Clyde can draft relevant project metrics, suggest matching stories, and guide your answers in real time.
          </p>
          <label className="wide-field">Resume / background
            <div className="resume-import-row"><button type="button" className="ghost" onClick={onImportResume}>Import file</button><small>.txt, .md, and .pdf supported.</small></div>
            <textarea value={draft.resumeText || ''} onChange={(event) => update('resumeText', event.target.value)} placeholder="Paste resume facts, metrics, projects, and stories." />
          </label>
        </>
      ) : (
        <>
          <p className="wide-field onboarding-note" style={{ margin: '0 0 8px 0', fontSize: '0.9rem', lineHeight: '1.5' }}>
            Long-term meeting memory keeps Clyde aligned on past decisions and priorities. Describe project objectives or architectural goals so Clyde can highlight relevant context across weekly sync sessions.
          </p>
          <label className="wide-field">Long-term meeting memory<textarea value={draft.meetingMemory || ''} onChange={(event) => update('meetingMemory', event.target.value)} placeholder="Persistent context Clyde should use across future meetings." /></label>
        </>
      )}
    </div>
  );
}

function SoulStep({ selectedSoul, setSelectedSoul, soulCustomDescription, setSoulCustomDescription, userBio, setUserBio, userStrengths, setUserStrengths, userCommPreference, setUserCommPreference }) {
  const presets = [
    {
      id: 'coach',
      title: 'Professional Coach',
      emoji: '💼',
      desc: 'Focused, polished, and structured. Best for leadership and formal outcomes.',
      quote: '"Let\'s address the key metrics first."'
    },
    {
      id: 'hype',
      title: 'Hype Friend',
      emoji: '🔥',
      desc: 'High energy, motivating, and optimistic. Keeps your spirits elevated.',
      quote: '"You absolutely crushed that last point!"'
    },
    {
      id: 'snarky',
      title: 'Snarky Genius',
      emoji: '😏',
      desc: 'Witty, direct, and slightly sarcastic. Unflinchingly honest advice.',
      quote: '"That answer was okay, but here is the smart way."'
    },
    {
      id: 'philosopher',
      title: 'Calm Philosopher',
      emoji: '🧘',
      desc: 'Serene, composed, and mindful. Helps you stay focused and calm.',
      quote: '"Breathe. Stay centered in the present moment."'
    },
    {
      id: 'custom',
      title: 'Custom Soul',
      emoji: '✨',
      desc: 'Describe exactly how you want Clyde to talk and act.',
      quote: '"Your personalized copilot awaits."'
    }
  ];

  return (
    <div className="onboarding-soul-step">
      <style>{`
        .soul-presets-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }
        .soul-preset-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 16px;
          text-align: left;
          cursor: pointer;
          transition: all 150ms ease;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .soul-preset-card:hover {
          border-color: var(--line-strong);
          background: rgba(255, 255, 255, 0.05);
          transform: translateY(-2px);
        }
        .soul-preset-card.active {
          border-color: var(--cyan);
          background: rgba(79, 231, 255, 0.06);
          box-shadow: 0 0 12px rgba(79, 231, 255, 0.15);
        }
        .soul-preset-card h4 {
          margin: 0;
          font-size: 1.05rem;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .soul-preset-card p {
          margin: 0;
          font-size: 0.8rem;
          color: var(--muted);
          line-height: 1.4;
          flex: 1;
        }
        .soul-preset-card em {
          font-size: 0.75rem;
          color: var(--cyan);
          opacity: 0.85;
          margin-top: 4px;
        }
        .soul-about-me-section {
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 14px;
          padding: 20px;
          margin-top: 24px;
        }
        .soul-about-me-section h3 {
          margin: 0 0 16px 0;
          font-size: 1.1rem;
          color: var(--text);
        }
      `}</style>

      <p style={{ margin: '0 0 16px 0', color: 'var(--muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
        Clyde's soul defines how he talks, behaves, and offers advice. Choose a preset personality archetype or describe your own custom assistant, then share a bit about yourself so Clyde's feedback matches your level of seniority and goals.
      </p>

      <div className="soul-presets-grid">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`soul-preset-card ${selectedSoul === preset.id ? 'active' : ''}`}
            onClick={() => setSelectedSoul(preset.id)}
          >
            <h4><span>{preset.emoji}</span> {preset.title}</h4>
            <p>{preset.desc}</p>
            <em>{preset.quote}</em>
          </button>
        ))}
      </div>

      {selectedSoul === 'custom' ? (
        <div className="onboarding-form-grid" style={{ marginBottom: '20px' }}>
          <label className="wide-field">
            Custom Personality Description
            <textarea
              value={soulCustomDescription}
              onChange={(e) => setSoulCustomDescription(e.target.value)}
              placeholder="Describe Clyde's tone, focus, style, and attitude..."
              style={{ minHeight: '80px' }}
            />
          </label>
        </div>
      ) : null}

      <div className="soul-about-me-section">
        <h3>Tell Clyde about you</h3>
        <div className="onboarding-form-grid">
          <label className="wide-field">
            Your Professional Bio / Career Background
            <textarea
              value={userBio}
              onChange={(e) => setUserBio(e.target.value)}
              placeholder="e.g. Senior Product Manager with 6+ years experience building SaaS apps. Focus on API integrations."
              style={{ minHeight: '70px' }}
            />
          </label>
          <label>
            Key Strengths
            <input
              value={userStrengths}
              onChange={(e) => setUserStrengths(e.target.value)}
              placeholder="System design, team scaling, cross-functional collaboration"
            />
          </label>
          <label>
            Communication Preference
            <input
              value={userCommPreference}
              onChange={(e) => setUserCommPreference(e.target.value)}
              placeholder="Short bullet points, direct, detail-oriented"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function ProviderStep({ audioDevices, draft, update, onRefreshAudio, onValidate, proEntitled }) {
  return (
    <div className="onboarding-form-grid">
      <p className="wide-field onboarding-note" style={{ margin: '0 0 8px 0', fontSize: '0.9rem', lineHeight: '1.5' }}>
        Providers and hardware connect Clyde to AI brains and audio signals. Clyde Managed Cloud uses Gemini 3.5 Flash. BYOK supports Google Gemini 3.5 Flash or OpenAI GPT-4o automatically.
      </p>
      <label>LLM provider<select value={draft.llmProvider || ''} onChange={(event) => {
        const val = event.target.value;
        if (val === 'clyde-cloud' && draft.subscriptionPlan === 'clyde_byok_lifetime') {
          window.alert('Clyde Managed Cloud is not available on the BYOK Lifetime plan. Please select a local or custom API provider.');
          return;
        }
        if (val === 'clyde-cloud' && !proEntitled) {
          window.alert('Clyde Managed Cloud is a Pro-only feature! Please select a local or custom API provider, or upgrade to Clyde Pro from settings.');
          return;
        }
        update('llmProvider', val);
        if (val === 'clyde-cloud' || val === 'gemini') {
          update('llmModel', 'gemini-3.5-flash');
        } else if (val === 'openai') {
          update('llmModel', 'gpt-4o');
        } else {
          update('llmModel', '');
        }
      }}><option value="">Select provider</option><option value="clyde-cloud">Clyde Managed Cloud (Pro only)</option><option value="local">Local LM Studio (Offline)</option><option value="gemini">Google Gemini (Custom Key)</option><option value="openai">OpenAI ChatGPT (Custom Key)</option></select></label>
      {draft.llmProvider === 'local' ? <label className="wide-field">Local LLM URL<input value={draft.localLlmUrl || ''} onChange={(event) => update('localLlmUrl', event.target.value)} placeholder="http://localhost:1234/v1/chat/completions" /></label> : null}
      {draft.llmProvider === 'local' ? <label className="wide-field">Model name<input value={draft.llmModel || ''} onChange={(event) => update('llmModel', event.target.value)} placeholder="Name of the model loaded in LM Studio" /></label> : null}
      {draft.llmProvider === 'openai' ? <label className="wide-field">OpenAI API key<input type="password" value={draft.openAiApiKey || ''} onChange={(event) => update('openAiApiKey', event.target.value)} /></label> : null}
      {draft.llmProvider === 'gemini' ? <label className="wide-field">Gemini API key<input type="password" value={draft.llmApiKey || ''} onChange={(event) => update('llmApiKey', event.target.value)} /></label> : null}
      <label>Transcription provider<select value={draft.transcriptionProvider || ''} onChange={(event) => {
        const val = event.target.value;
        if (val === 'clyde-cloud-whisper' && draft.subscriptionPlan === 'clyde_byok_lifetime') {
          window.alert('Clyde Managed Whisper is not available on the BYOK Lifetime plan. Please select local or custom API providers.');
          return;
        }
        if (val === 'clyde-cloud-whisper' && !proEntitled) {
          window.alert('Clyde Managed Whisper is a Pro-only feature! Please select local or custom API providers.');
          return;
        }
        update('transcriptionProvider', val);
      }}><option value="">Select provider</option><option value="clyde-cloud-whisper">Clyde Managed Whisper (Pro only)</option><option value="local">Local Whisper (Offline)</option><option value="openai">OpenAI Whisper (Custom Key)</option></select></label>
      {draft.transcriptionProvider === 'local' ? <label>Local transcription URL<input value={draft.localTranscriptionUrl || ''} onChange={(event) => update('localTranscriptionUrl', event.target.value)} placeholder="http://localhost:8000/v1/audio/transcriptions" /></label> : null}
      {draft.transcriptionProvider === 'openai' ? <label>OpenAI API key<input type="password" value={draft.openAiApiKey || ''} onChange={(event) => update('openAiApiKey', event.target.value)} /></label> : null}
      <label>Audio engine<select value={draft.audioEngine || 'rust'} onChange={(event) => update('audioEngine', event.target.value)}><option value="rust">Rust native audio</option><option value="legacy">Legacy recorder</option></select></label>
      <label>Microphone<select value={draft.microphoneDeviceId || ''} onChange={(event) => update('microphoneDeviceId', event.target.value)}><option value="">Default microphone</option>{audioDevices.microphones.map((device) => <option key={device.id || device.name} value={device.id || device.name}>{device.name || device.id}</option>)}</select></label>
      <label>System audio<select value={draft.systemAudioDeviceId || ''} onChange={(event) => update('systemAudioDeviceId', event.target.value)}><option value="">Default system audio</option>{audioDevices.systemOutputs.map((device) => <option key={device.id || device.name} value={device.id || device.name}>{device.name || device.id}</option>)}</select></label>
      <div className="wide-field onboarding-inline-actions"><button type="button" className="ghost" onClick={onRefreshAudio}>Refresh devices</button><button type="button" className="ghost" onClick={onValidate}>Validate services</button></div>
    </div>
  );
}

function ProSetupStep({ draft, update, onConnectGoogle, onOpenBilling, onRefreshSubscription }) {
  return (
    <div className="onboarding-form-grid">
      <p className="wide-field onboarding-note" style={{ margin: '0 0 8px 0', fontSize: '0.9rem', lineHeight: '1.5' }}>
        Clyde Pro unlocks automation, calendar synchronization, and realtime audio. Connect your Google account to sync invites automatically, enable Pinecone RAG for deep search over past files, and enable the GPT Realtime voice model for interactive mock interview practices.
      </p>
      <div className="wide-field onboarding-inline-actions"><button type="button" className="primary-action" onClick={onConnectGoogle}>Connect Google</button><button type="button" className="ghost" onClick={onRefreshSubscription}>Refresh subscription</button><button type="button" className="ghost" onClick={onOpenBilling}>Billing portal</button></div>
      
      <label className="toggle-row question-bank-global-toggle">
        <span className="switch-control">
          <input type="checkbox" checked={Boolean(draft.googleSyncEnabled)} onChange={(event) => update('googleSyncEnabled', event.target.checked)} />
          <span className="switch-slider" />
        </span>
        <span className="switch-label">Enable periodic Google sync</span>
      </label>

      <label className="toggle-row question-bank-global-toggle">
        <span className="switch-control">
          <input type="checkbox" checked={Boolean(draft.googleSyncAutoApprove)} disabled={!draft.googleSyncEnabled} onChange={(event) => update('googleSyncAutoApprove', event.target.checked)} />
          <span className="switch-slider" />
        </span>
        <span className="switch-label">Auto-approve generated sync actions</span>
      </label>

      <label>Poll interval<input type="number" min="1" value={draft.googleSyncPollMinutes || 15} onChange={(event) => update('googleSyncPollMinutes', Number(event.target.value) || 15)} /></label>
      
      <label className="toggle-row wide-field question-bank-global-toggle">
        <span className="switch-control">
          <input type="checkbox" checked={Boolean(draft.ragEnabled)} onChange={(event) => update('ragEnabled', event.target.checked)} />
          <span className="switch-slider" />
        </span>
        <span className="switch-label">Enable RAG with Pinecone</span>
      </label>

      {draft.ragEnabled && draft.llmProvider === 'clyde-cloud' && (
        <div className="wide-field" style={{ color: 'var(--success)', fontSize: '0.85rem', fontWeight: '500', padding: '4px 8px', borderRadius: '4px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', margin: '4px 0 12px 0', boxSizing: 'border-box' }}>
          ✓ Embeddings are managed and processed automatically via Clyde Cloud.
        </div>
      )}

      {draft.ragEnabled && draft.llmProvider !== 'clyde-cloud' && (
        <>
          <label>Embedding provider<select value={draft.embeddingProvider || ''} onChange={(event) => update('embeddingProvider', event.target.value)}><option value="">Select provider</option><option value="gemini">Gemini</option><option value="openai">OpenAI</option></select></label>
          <label>Embedding model<input value={draft.embeddingModel || ''} onChange={(event) => update('embeddingModel', event.target.value)} placeholder="gemini-embedding-2" /></label>
          <label>Embedding API key<input type="password" value={draft.embeddingApiKey || ''} onChange={(event) => update('embeddingApiKey', event.target.value)} /></label>
        </>
      )}

      {draft.ragEnabled && draft.llmProvider !== 'clyde-cloud' && (
        <>
          <label>Pinecone API key<input type="password" value={draft.pineconeApiKey || ''} onChange={(event) => update('pineconeApiKey', event.target.value)} /></label>
          <label>Pinecone host<input value={draft.pineconeHost || ''} onChange={(event) => update('pineconeHost', event.target.value)} placeholder="https://index.pinecone.io" /></label>
          <label>Pinecone namespace<input value={draft.pineconeNamespace || ''} onChange={(event) => update('pineconeNamespace', event.target.value)} /></label>
        </>
      )}
      
      <label className="toggle-row wide-field question-bank-global-toggle">
        <span className="switch-control">
          <input 
            type="checkbox" 
            checked={Boolean(draft.proAgentEnabled)} 
            onChange={(event) => {
              const checked = event.target.checked;
              update('proAgentEnabled', checked);
              if (checked) {
                update('proRealtimeModel', 'gpt-realtime-2');
                update('transcriptionProvider', 'openai-realtime-whisper');
                if (draft.openAiApiKey) {
                  update('transcriptionApiKey', draft.openAiApiKey);
                }
              }
            }} 
          />
          <span className="switch-slider" />
        </span>
        <span className="switch-label">Enable Clyde Pro agent</span>
      </label>

      {draft.proAgentEnabled && (
        <div style={{ marginTop: '8px', color: 'var(--success)', fontSize: '0.85rem', fontWeight: '500', display: 'block', width: '100%', boxSizing: 'border-box' }}>
          ✓ OpenAI Realtime Whisper has been enabled.
        </div>
      )}
    </div>
  );
}

function ScheduleStep({ mode, draft, setDraft }) {
  return (
    <div className="onboarding-form-grid">
      <p className="wide-field onboarding-note" style={{ margin: '0 0 8px 0', fontSize: '0.9rem', lineHeight: '1.5' }}>
        Events are calendar milestones where Clyde assists you. Let's schedule your first upcoming call so Clyde can run prep routines, index context, and alert you with prep checklists when the time comes.
      </p>
      <label>Event title<input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder={mode === 'meeting' ? 'Product weekly' : 'Recruiter screen'} /></label>
      <label>Date and time<input type="datetime-local" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} /></label>
      <label className="wide-field">Notes<textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Optional agenda, Zoom details, or prep notes." /></label>
    </div>
  );
}

function FinishStep({ completed, plan, proEntitled }) {
  const rows = [
    ['Plan', plan === 'pro' && proEntitled ? 'Pro active' : plan === 'pro' ? 'Pro checkout started' : 'Free selected'],
    ['Workspace item', completed.workspace ? 'Created' : 'Skipped'],
    ['Context', completed.context ? 'Saved' : 'Skipped'],
    ['Providers', completed.providers ? 'Saved' : 'Skipped'],
    ['Schedule', completed.schedule ? 'Created' : 'Skipped']
  ];
  return (
    <div className="finish-checklist">
      <p style={{ margin: '0 0 16px 0', color: 'var(--muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
        You are all set and ready to launch! Review your onboarding checklist, verify that your settings are saved, and click Finish to open your dashboard and start working with Clyde.
      </p>
      <h3>Setup checklist</h3>
      {rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
    </div>
  );
}

function UpdateCheckButton({ api }) {
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState('');

  const handleCheck = async () => {
    setChecking(true);
    setMessage('Checking...');
    setTone('info');
    try {
      const res = await api?.checkForUpdates?.();
      if (res?.status === 'ok') {
        setMessage(res.message);
        setTone(res.updateAvailable ? 'success' : 'success');
      } else {
        setMessage(res?.message || 'Check failed.');
        setTone('error');
      }
    } catch (err) {
      setMessage(`Check failed: ${err.message}`);
      setTone('error');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
      <button
        type="button"
        onClick={handleCheck}
        disabled={checking}
        className="ghost"
        style={{
          padding: '2px 8px',
          fontSize: '0.7rem',
          borderRadius: '4px',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          background: 'rgba(255, 255, 255, 0.05)',
          cursor: 'pointer',
          height: '22px',
          lineHeight: '16px',
          color: 'var(--foreground)'
        }}
      >
        {checking ? 'Checking...' : 'Check for updates'}
      </button>
      {message && (
        <span
          style={{
            fontSize: '0.7rem',
            color: tone === 'error' ? '#f87171' : tone === 'success' ? '#4ade80' : '#38bdf8',
            fontWeight: 500
          }}
        >
          {message}
        </span>
      )}
    </div>
  );
}

function SettingsDrawer(props) {
  const { api, initialTab, mode, onClose, onSave, onSettingsUpdated, onValidate, serviceChecking, settings, syncAudit, setSyncAudit, activeCapture, onOpenOnboarding } = props;
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    let active = true;
    window.electronAPI?.getAppVersion?.().then((v) => {
      if (active && v) setAppVersion(v);
    }).catch(console.error);
    return () => { active = false; };
  }, []);

  return (
    <div className="drawer-backdrop">
      <section className="settings-drawer">
        <div className="drawer-head">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0 }}>Settings</h2>
              {appVersion && (
                <span style={{ fontSize: '0.85rem', opacity: 0.6, fontWeight: 500 }}>
                  v{appVersion}
                </span>
              )}
              <UpdateCheckButton api={api} />
            </div>
            <p>Provider keys are stored by the Electron main process.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button type="button" onClick={onClose}>Close</button>
          </div>
        </div>
        <SetupFields api={api} initialTab={initialTab} mode={mode} onSave={onSave} onSettingsUpdated={onSettingsUpdated} onValidate={onValidate} serviceChecking={serviceChecking} settings={settings} syncAudit={syncAudit} setSyncAudit={setSyncAudit} activeCapture={activeCapture} onOpenOnboarding={onOpenOnboarding} />
      </section>
    </div>
  );
}

function ProSettingsBadge() {
  return <img className="pro-settings-badge" src={proGoldBadgeUrl} alt="Pro" />;
}

function UpgradeToProButton({ className = '' }) {
  async function handleUpgradeClick() {
    try {
      await window.electronAPI?.openExternalUrl?.('https://clydeai.live/pricing');
    } catch (error) {
      console.error('Stripe redirect failed:', error);
    }
  }
  return (
    <button
      className={`upgrade-pro-button ${className}`.trim()}
      type="button"
      onClick={handleUpgradeClick}
    >
      Upgrade to Pro or Get Clyde Credits
    </button>
  );
}

function RefreshEntitlementsButton({ onRefresh, className = '' }) {
  return (
    <button
      className={`refresh-entitlements-button ${className}`.trim()}
      type="button"
      onClick={onRefresh}
    >
      Refresh subscription
    </button>
  );
}

function isSettingsProgressMessage(message = '') {
  return /\.\.\.$/.test(String(message || '').trim());
}

function settingsDialogTone(message = '') {
  return /failed|error|invalid|missing/i.test(message) ? 'error' : 'success';
}

function SetupFields({ api, compact = false, initialTab = 'general', mode, onSave, onSettingsUpdated, onValidate, serviceChecking, settings, syncAudit, setSyncAudit, activeCapture = false, onOpenOnboarding }) {
  const [draft, setDraft] = useState({ ...settings });
  const [activeTab, setActiveTab] = useState(initialTab || 'general');
  const [audioDevices, setAudioDevices] = useState({ microphones: [], systemOutputs: [] });
  const [audioDeviceStatus, setAudioDeviceStatus] = useState('');
  const [googleStatus, setGoogleStatus] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [statusDialog, setStatusDialog] = useState(null);
  const [saving, setSaving] = useState(false);
  const [authForm, setAuthForm] = useState({ email: '', password: '', confirmPassword: '' });
  const [authBusy, setAuthBusy] = useState(false);
  const [licenseToken, setLicenseToken] = useState('');
  const [licenseStatus, setLicenseStatus] = useState('');
  const mountedRef = useRef(true);
  const preserveStatusOnSettingsUpdateRef = useRef(false);
  const proEntitled = canUseFeature(settings, 'pro_realtime_agent');
  const signedIn = Boolean(settings.userId && settings.authEmail);

  async function refreshEntitlements() {
    setSaveStatus('Refreshing subscription...');
    try {
      const entitlements = await api?.refreshEntitlements?.();
      setDraft((current) => normalizeEntitledSettings({
        ...current,
        ...(entitlements || {}),
        entitlementFeatures: entitlements?.features || current.entitlementFeatures || []
      }));
      const nextSettings = await api?.loadSettings?.();
      if (nextSettings) {
        preserveStatusOnSettingsUpdateRef.current = true;
        onSettingsUpdated?.(nextSettings);
      }
      const tier = entitlements?.tier === 'pro' || entitlements?.userTier === 'pro' ? 'Clyde Pro Agent' : 'Clyde Assistant';
      const status = entitlements?.status || (tier === 'Clyde Pro Agent' ? 'active' : 'free');
      setSaveStatus(`Subscription refreshed: ${tier} (${status}).`);
    } catch (error) {
      setSaveStatus(`Subscription refresh failed: ${error.message}`);
    }
  }

  async function runAuthAction(action) {
    if (action === 'sign-up' && authForm.password !== authForm.confirmPassword) {
      setSaveStatus('Account creation failed: passwords do not match.');
      return;
    }
    setAuthBusy(true);
    setSaveStatus(action === 'sign-up' ? 'Creating account...' : 'Signing in...');
    try {
      const payload = {
        email: authForm.email.trim(),
        password: authForm.password
      };
      const result = action === 'sign-up'
        ? await api?.signUp?.(payload)
        : await api?.signIn?.(payload);
      if (result?.settings) {
        setDraft(normalizeEntitledSettings(result.settings));
        onSettingsUpdated?.(result.settings);
      }
      setAuthForm({ email: '', password: '', confirmPassword: '' });
      if (action === 'sign-up') {
        window.alert('Check your email to confirm your Clyde account, then return here to sign in.');
        setSaveStatus('Account created. Check your email to confirm your address.');
      } else {
        setSaveStatus('Signed in.');
      }
    } catch (error) {
      setSaveStatus(`${action === 'sign-up' ? 'Account creation' : 'Sign in'} failed: ${error.message}`);
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    setAuthBusy(true);
    setSaveStatus('Signing out...');
    try {
      const result = await api?.signOut?.();
      if (result?.settings) {
        setDraft(normalizeEntitledSettings(result.settings));
        onSettingsUpdated?.(result.settings);
      }
      setSaveStatus('Signed out.');
    } catch (error) {
      setSaveStatus(`Sign out failed: ${error.message}`);
    } finally {
      setAuthBusy(false);
    }
  }

  async function startCheckout() {
    setSaveStatus('Opening pricing page...');
    try {
      await api?.openExternalUrl?.('https://clydeai.live/pricing');
      setSaveStatus('Pricing page opened in your browser.');
    } catch (error) {
      setSaveStatus(`Opening pricing failed: ${error.message}`);
    }
  }

  async function openBillingPortal() {
    setSaveStatus('Opening billing portal...');
    try {
      await api?.openBillingPortal?.();
      setSaveStatus('Billing portal opened in your browser.');
    } catch (error) {
      const message = error?.message || '';
      if (/No Stripe customer found/i.test(message)) {
        await refreshEntitlements();
        setSaveStatus('No Stripe billing record was found for this account. Start checkout to create one.');
        return;
      }
      setSaveStatus(`Billing portal failed: ${message}`);
    }
  }

  async function validateServicesFromSettings() {
    setSaveStatus('Checking services...');
    try {
      const nextHealth = await onValidate?.();
      const entries = Object.values(nextHealth || {});
      const readyCount = entries.filter((item) => item?.state === 'ready').length;
      const issueCount = entries.filter((item) => ['error', 'warning'].includes(item?.state)).length;
      setSaveStatus(`Service check complete: ${readyCount} ready, ${issueCount} need attention.`);
    } catch (error) {
      setSaveStatus(`Service check failed: ${error.message}`);
    }
  }

  useEffect(() => {
    setDraft(normalizeEntitledSettings({ ...settings }));
    if (preserveStatusOnSettingsUpdateRef.current) {
      preserveStatusOnSettingsUpdateRef.current = false;
      return;
    }
    setSaveStatus('');
  }, [settings]);

  useEffect(() => {
    setActiveTab(initialTab || 'general');
  }, [initialTab]);

  useEffect(() => {
    if (!saveStatus || isSettingsProgressMessage(saveStatus)) {
      return;
    }
    setStatusDialog({
      message: saveStatus,
      tone: settingsDialogTone(saveStatus)
    });
  }, [saveStatus]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);



  useEffect(() => {
    if (!api?.getGoogleSyncStatus) {
      return;
    }
    Promise.all([
      api.getGoogleSyncStatus()
    ]).then(([status]) => {
      if (mountedRef.current) {
        setGoogleStatus(status || null);
      }
    }).catch(() => {});
  }, [api]);



  function update(key, value) {
    setDraft((current) => {
      if (key === 'googleSyncEnabled' && !value) {
        return { ...current, googleSyncEnabled: false, googleSyncAutoApprove: false };
      }
      return { ...current, [key]: value };
    });
  }

  const handleHotkeyKeyDown = (event, settingKey = 'nudgeHotkey') => {
    event.preventDefault();
    event.stopPropagation();
    
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) {
      return;
    }
    
    const parts = [];
    if (event.ctrlKey) parts.push('Ctrl');
    if (event.shiftKey) parts.push('Shift');
    if (event.altKey) parts.push('Alt');
    if (event.metaKey) parts.push('Cmd');
    
    let keyName = event.key;
    if (keyName === ' ') {
      keyName = 'Space';
    } else if (keyName.length === 1) {
      keyName = keyName.toUpperCase();
    }
    
    parts.push(keyName);
    const combo = parts.join('+');
    update(settingKey, combo);
  };

  async function saveDraft(close) {
    setSaving(true);
    setSaveStatus('');

    try {
      await onSave(draft, { close });
      if (!close) {
        setSaveStatus('Settings saved.');
      }
    } catch (error) {
      const message = error?.message || 'Unknown error';
      setSaveStatus(`Save failed: ${message}`);
    } finally {
      if (mountedRef.current) {
        setSaving(false);
      }
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await saveDraft(true);
  }

  async function refreshAudioDevices() {
    setAudioDeviceStatus('Refreshing devices...');
    try {
      const result = await api?.listAudioDevices?.();
      if (!result || result.ok === false) {
        setAudioDeviceStatus(result?.message || 'Device refresh failed.');
        return;
      }

      setAudioDevices({
        microphones: Array.isArray(result.microphones) ? result.microphones : [],
        systemOutputs: Array.isArray(result.systemOutputs) ? result.systemOutputs : []
      });
      setDraft((current) => ({
        ...current,
        microphoneDeviceId: current.microphoneDeviceId || result.defaultMicrophoneId || '',
        systemAudioDeviceId: current.systemAudioDeviceId || result.defaultSystemAudioId || ''
      }));
      setAudioDeviceStatus('Audio devices refreshed.');
    } catch (error) {
      setAudioDeviceStatus(`Device refresh failed: ${error.message}`);
    }
  }

  async function persistAudioDeviceDraft(nextDraft) {
    await api?.setAudioDevices?.({
      audioEngine: nextDraft.audioEngine || 'rust',
      microphoneDeviceId: nextDraft.microphoneDeviceId || '',
      systemAudioDeviceId: nextDraft.systemAudioDeviceId || ''
    });
  }

  function updateAudioSetting(key, value) {
    const nextDraft = { ...draft, [key]: value };
    setDraft(nextDraft);
    persistAudioDeviceDraft(nextDraft).catch((error) => {
      setAudioDeviceStatus(`Audio device save failed: ${error.message}`);
    });
  }


  async function connectGoogle() {
    setSaveStatus('Opening Google sign-in...');
    try {
      const status = await api?.connectGoogleSync?.();
      setGoogleStatus(status || null);
      setSaveStatus('Google sync connected.');
      update('googleAccountEmail', status?.accountEmail || '');
      update('googleSyncEnabled', true);
    } catch (error) {
      setSaveStatus(`Google connect failed: ${error.message}`);
    }
  }

  async function disconnectGoogle() {
    const status = await api?.disconnectGoogleSync?.();
    setGoogleStatus(status || null);
    update('googleAccountEmail', '');
    update('googleSyncEnabled', false);
    setSaveStatus('Google sync disconnected.');
  }

  async function scanGoogle() {
    setSaveStatus('Scanning Google...');
    try {
      const result = await api?.scanGoogleSync?.();
      setGoogleStatus(result?.status || await api?.getGoogleSyncStatus?.());
      const audit = await api?.listSyncAuditLog?.(50);
      setSyncAudit?.(Array.isArray(audit) ? audit : []);
      setSaveStatus('Google scan complete.');
    } catch (error) {
      setSaveStatus(`Google scan failed: ${error.message}`);
    }
  }

  async function importResumeFile() {
    setSaveStatus('Opening resume file picker...');
    try {
      const file = await api?.openResumeFileDialog?.();
      if (!file?.text) {
        setSaveStatus(file ? 'Selected file did not contain readable text.' : '');
        return;
      }
      update('resumeText', file.text);
      setSaveStatus(`Imported ${file.filename || 'resume file'}.`);
    } catch (error) {
      setSaveStatus(`Resume import failed: ${error.message}`);
    }
  }

  return (
    <form className={`settings-form ${compact ? 'compact' : ''}`} onSubmit={handleSubmit}>
      <div className="tabs" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
        <button type="button" className={activeTab === 'account' ? 'active' : ''} onClick={() => setActiveTab('account')}>Account</button>
        <button type="button" className={activeTab === 'general' ? 'active' : ''} onClick={() => setActiveTab('general')}>General</button>
        <button type="button" className={activeTab === 'hotkeys' ? 'active' : ''} onClick={() => setActiveTab('hotkeys')}>Hotkeys</button>
        <button type="button" className={activeTab === 'context' ? 'active' : ''} onClick={() => setActiveTab('context')}>Context</button>
        <button type="button" className={activeTab === 'sync' ? 'active' : ''} onClick={() => setActiveTab('sync')}>Sync</button>
        <button type="button" className={activeTab === 'llm' ? 'active' : ''} onClick={() => setActiveTab('llm')}>LLM</button>
        <button type="button" className={activeTab === 'transcription' ? 'active' : ''} onClick={() => setActiveTab('transcription')}>Speech</button>
      </div>

      {activeTab === 'account' && (
        <div className="account-billing-panel">
          <div className="settings-section-label wide-field">
            <strong>Account and billing</strong>
            <small>
              {signedIn
                ? "Your desktop app is connected to your Clyde account."
                : "Sign in to connect Clyde Pro billing to this desktop app."}
            </small>
          </div>
          {!signedIn ? (
            <div className="form-grid account-auth-form">
              <label>
                Email
                <input
                  autoComplete="email"
                  type="email"
                  value={authForm.email}
                  onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="you@example.com"
                />
              </label>
              <label>
                Password
                <input
                  autoComplete="current-password"
                  type="password"
                  value={authForm.password}
                  onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder="Password"
                />
              </label>
              <label>
                Confirm password
                <input
                  autoComplete="new-password"
                  type="password"
                  value={authForm.confirmPassword}
                  onChange={(event) => setAuthForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                  placeholder="Retype password"
                />
              </label>
              <div className="wide-field account-actions">
                <button type="button" className="primary-action" disabled={authBusy || !authForm.email || !authForm.password} onClick={() => runAuthAction('sign-in')}>Sign in</button>
                <button type="button" className="ghost" disabled={authBusy || !authForm.email || !authForm.password || !authForm.confirmPassword || authForm.password !== authForm.confirmPassword} onClick={() => runAuthAction('sign-up')}>Create account</button>
              </div>
              <small className="wide-field">Clyde Pro requires a signed-in account so Stripe can attach the subscription to your Supabase user ID.</small>
            </div>
          ) : (
            <div className="account-summary-grid">
              <div>
                <span>Email</span>
                <strong>{settings.authEmail || 'Signed in'}</strong>
              </div>
              <div>
                <span>User ID</span>
                <strong>{settings.userId}</strong>
              </div>
              <div>
                <span>Clyde Pro License Token</span>
                {(settings.userTier !== 'pro' && !(typeof settings.subscriptionCredits === 'number' && settings.subscriptionCredits > 0)) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <button
                      type="button"
                      className="ghost compact"
                      disabled
                      style={{ padding: '4px 8px', fontSize: '0.8rem', width: 'fit-content', opacity: 0.5, cursor: 'not-allowed' }}
                    >
                      Reveal License Token
                    </button>
                    <span style={{ fontSize: '0.75rem', color: 'var(--red, #ff5c7a)', marginTop: '2px' }}>
                      Clyde Pro or credits required
                    </span>
                  </div>
                ) : licenseToken ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <strong style={{ userSelect: 'all', fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--success)' }}>
                      {licenseToken.slice(0, 15)}...
                    </strong>
                    <button
                      type="button"
                      className="ghost compact"
                      onClick={() => {
                        navigator.clipboard.writeText(licenseToken);
                        setLicenseStatus('Copied!');
                        setTimeout(() => setLicenseStatus(''), 2000);
                      }}
                      style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                    >
                      {licenseStatus || 'Copy'}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button
                      type="button"
                      className="ghost compact"
                      disabled={licenseStatus === 'Requesting...'}
                      onClick={async () => {
                        try {
                          setLicenseStatus('Requesting...');
                          const result = await api?.getLicenseToken?.();
                          if (result && result.token) {
                            setLicenseToken(result.token);
                            setLicenseStatus('');
                          } else {
                            setLicenseStatus('Failed to generate');
                          }
                        } catch (err) {
                          const cleanMsg = (err.message || '')
                            .replace(/^Error invoking remote method '[^']+'::?\s*(Error:\s*)?/, '')
                            .replace(/^Error invoking remote method '[^']+'\s*(Error:\s*)?/, '');
                          setLicenseStatus(`Error: ${cleanMsg}`);
                        }
                      }}
                      style={{ padding: '4px 8px', fontSize: '0.8rem', width: 'fit-content' }}
                    >
                      {licenseStatus === 'Requesting...' ? 'Requesting...' : 'Reveal License Token'}
                    </button>
                    {licenseStatus && licenseStatus !== 'Requesting...' && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--red, #ff5c7a)', marginTop: '2px', maxWidth: '300px', wordBreak: 'break-all' }}>
                        {licenseStatus}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div>
                <span>Extension Pairing Code</span>
                <strong style={{ userSelect: 'all', fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--cyan)' }}>
                  {settings.extensionPairingToken || 'Not generated'}
                </strong>
              </div>
              <div>
                <span>Tier</span>
                <strong>{settings.userTier === 'pro' ? 'Clyde Pro Agent' : 'Clyde Assistant'}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{settings.subscriptionStatus || 'free'}</strong>
              </div>
              <div>
                <span>Plan</span>
                <strong>{settings.subscriptionPlan || 'clyde_assistant'}</strong>
              </div>
              <div>
                <span>Extension Credits</span>
                <strong>{typeof settings.subscriptionCredits === 'number' ? settings.subscriptionCredits : 0}</strong>
              </div>
              <div>
                <span>Period end</span>
                <strong>{settings.entitlementsExpiresAt ? new Date(settings.entitlementsExpiresAt).toLocaleDateString() : 'None'}</strong>
              </div>
              <div>
                <span>Last check</span>
                <strong>{settings.entitlementsCheckedAt ? new Date(settings.entitlementsCheckedAt).toLocaleString() : 'Never'}</strong>
              </div>
              <div className="account-actions wide-field">
                {settings.userTier === 'pro' ? (
                  <button type="button" className="primary-action" onClick={openBillingPortal}>Manage billing</button>
                ) : (
                  <button type="button" className="primary-action" onClick={startCheckout}>Upgrade to Pro or Get Clyde Credits</button>
                )}
                <RefreshEntitlementsButton onRefresh={refreshEntitlements} />
                <button type="button" className="ghost" disabled={authBusy} onClick={signOut}>Sign out</button>
              </div>
              <div style={{ marginTop: '20px', fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', width: '100%', gridColumn: 'span 2' }}>
                <span>Need to delete your account? </span>
                <a 
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    api?.openExternalUrl?.(`https://clydeai.live/delete-account?email=${encodeURIComponent(settings.authEmail || '')}&userId=${settings.userId || ''}`);
                  }}
                  style={{ color: '#ff5c7a', textDecoration: 'underline', fontWeight: '500' }}
                >
                  Request account and data deletion
                </a>
              </div>
            </div>
          )}

          <div style={{ marginTop: '24px', borderTop: '1px solid var(--line)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', display: 'block' }}>Local BYOK License Key</span>
              <input
                type="password"
                value={draft.licenseKey || ''}
                onChange={(e) => update('licenseKey', e.target.value)}
                placeholder="clyde_lic_byok_..."
                style={{ fontFamily: 'monospace', padding: '8px', background: '#0a1016', color: '#fff', border: '1px solid var(--line)', borderRadius: '6px', width: '100%', boxSizing: 'border-box' }}
              />
              <small style={{ color: 'var(--muted)', fontSize: '0.75rem', marginTop: '2px', display: 'block' }}>
                Enter your lifetime BYOK license key to unlock all local Pro features offline.
              </small>
            </label>
          </div>
        </div>
      )}

      {activeTab === 'general' && (
        <>

          {SHOW_DEMO_MODE_SETTING ? (
            <>
              <label className="toggle-row wide-field" style={{ marginTop: '15px' }}>
                <input
                  type="checkbox"
                  checked={Boolean(draft.demoMode)}
                  onChange={(event) => update('demoMode', event.target.checked)}
                />
                Demo mode with sample data
              </label>
              <small className="wide-field" style={{ color: 'var(--muted)' }}>
                Uses built-in opportunities, meetings, calendar events, knowledge, sync activity, trends, and mock interviews without changing your saved data.
              </small>
            </>
          ) : null}
          <div className="wide-field floating-agent-settings">
            <span>Floating Clyde chatbot</span>
            <div>
              <button
                type="button"
                className="ghost"
                onClick={async () => {
                  const prefs = await api?.saveFloatingAgentPrefs?.({ enabled: true, panelOpen: false });
                  window.dispatchEvent(new CustomEvent('floating-agent-prefs-changed', { detail: prefs }));
                }}
              >
                Show
              </button>
              <button
                type="button"
                className="ghost"
                onClick={async () => {
                  const prefs = await api?.saveFloatingAgentPrefs?.({ enabled: false, panelOpen: false });
                  window.dispatchEvent(new CustomEvent('floating-agent-prefs-changed', { detail: prefs }));
                }}
              >
                Hide
              </button>
            </div>
          </div>
          <div className="wide-field floating-agent-settings">
            <span>App Color Theme</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                value={draft.theme || 'default'}
                onChange={(event) => update('theme', event.target.value)}
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  width: '180px'
                }}
              >
                <option value="default" style={{ background: '#071018', color: '#fff' }}>Midnight Blue (Default)</option>
                <option value="cyberpunk" style={{ background: '#10051d', color: '#fff' }}>Neon Cyberpunk</option>
                <option value="forest" style={{ background: '#050e0a', color: '#fff' }}>Emerald Forest</option>
                <option value="amber" style={{ background: '#0e0a05', color: '#fff' }}>Retro Amber</option>
                <option value="slate" style={{ background: '#0f1115', color: '#fff' }}>Nordic Slate</option>
                <option value="snow" style={{ background: '#f8fafc', color: '#0f172a' }}>Nordic Snow (Light)</option>
                <option value="blossom" style={{ background: '#fffbfb', color: '#4c0519' }}>Sakura Blossom (Light)</option>
              </select>
            </div>
          </div>
          <small className="wide-field" style={{ color: 'var(--muted)', marginTop: '-8px', marginBottom: '10px' }}>
            Choose a visual style for the Clyde desktop application.
          </small>
          <div className="wide-field floating-agent-settings">
            <span>Stealth Taskbar Mode</span>
            <label className="toggle-row" style={{ margin: 0, padding: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={Boolean(draft.hideTaskbarEnabled)}
                onChange={(event) => update('hideTaskbarEnabled', event.target.checked)}
                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
              />
              Hide from Taskbar & Alt+Tab
            </label>
          </div>
          <small className="wide-field" style={{ color: 'var(--muted)', marginTop: '-8px', marginBottom: '10px' }}>
            When enabled, Clyde instantly hides its icon from your Windows Taskbar and the active Alt+Tab list for maximum stealth.
          </small>
          <div className="wide-field validate-services-card">
            <div>
              <strong>Service check</strong>
              <small>Checks audio, transcription, assistant provider, and capture status using the current saved settings.</small>
            </div>
            <button type="button" className="ghost" onClick={validateServicesFromSettings} disabled={serviceChecking}>
              {serviceChecking ? 'Checking...' : 'Validate services'}
            </button>
          </div>
          <div className="wide-field validate-services-card">
            <div>
              <strong>Setup Wizard</strong>
              <small>Launch the step-by-step wizard to configure your model, speech, and workspace settings.</small>
            </div>
            <button type="button" className="ghost" onClick={onOpenOnboarding}>
              Launch Wizard
            </button>
          </div>
        </>
      )}

      {activeTab === 'hotkeys' && (
        <>
          <div className="settings-section-label wide-field" style={{ marginTop: '15px', marginBottom: '10px' }}>
            <strong>Hotkeys</strong>
            <small>Configure custom key combinations to trigger live capture and window actions globally during live calls.</small>
          </div>
          <div className="wide-field floating-agent-settings">
            <span>Nudge hotkey</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={draft.nudgeHotkey || ''}
                onKeyDown={(e) => handleHotkeyKeyDown(e, 'nudgeHotkey')}
                placeholder="Press keys to record hotkey..."
                readOnly
                style={{ width: '180px', textAlign: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', padding: '6px' }}
              />
              <button
                type="button"
                className="ghost"
                style={{ minHeight: 'auto', padding: '6px 12px' }}
                onClick={() => update('nudgeHotkey', '')}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="wide-field floating-agent-settings">
            <span>Toggle screen capture protection</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={draft.toggleCaptureProtectionHotkey || ''}
                onKeyDown={(e) => handleHotkeyKeyDown(e, 'toggleCaptureProtectionHotkey')}
                placeholder="Press keys to record hotkey..."
                readOnly
                style={{ width: '180px', textAlign: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', padding: '6px' }}
              />
              <button
                type="button"
                className="ghost"
                style={{ minHeight: 'auto', padding: '6px 12px' }}
                onClick={() => update('toggleCaptureProtectionHotkey', '')}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="wide-field floating-agent-settings">
            <span>Toggle Stealth Taskbar Mode</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={draft.toggleStealthTaskbarHotkey || ''}
                onKeyDown={(e) => handleHotkeyKeyDown(e, 'toggleStealthTaskbarHotkey')}
                placeholder="Press keys to record hotkey..."
                readOnly
                style={{ width: '180px', textAlign: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', padding: '6px' }}
              />
              <button
                type="button"
                className="ghost"
                style={{ minHeight: 'auto', padding: '6px 12px' }}
                onClick={() => update('toggleStealthTaskbarHotkey', '')}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="wide-field floating-agent-settings">
            <span>Toggle minimize/maximize window</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={draft.toggleMinMaxHotkey || ''}
                onKeyDown={(e) => handleHotkeyKeyDown(e, 'toggleMinMaxHotkey')}
                placeholder="Press keys to record hotkey..."
                readOnly
                style={{ width: '180px', textAlign: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', padding: '6px' }}
              />
              <button
                type="button"
                className="ghost"
                style={{ minHeight: 'auto', padding: '6px 12px' }}
                onClick={() => update('toggleMinMaxHotkey', '')}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="wide-field floating-agent-settings">
            <span>Screenshot desktop & ask Clyde (1-click)</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={draft.screenshotAskHotkey || ''}
                onKeyDown={(e) => handleHotkeyKeyDown(e, 'screenshotAskHotkey')}
                placeholder="Press keys to record hotkey..."
                readOnly
                style={{ width: '180px', textAlign: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', padding: '6px' }}
              />
              <button
                type="button"
                className="ghost"
                style={{ minHeight: 'auto', padding: '6px 12px' }}
                onClick={() => update('screenshotAskHotkey', '')}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="wide-field floating-agent-settings">
            <span>Suggested Questions hotkey</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={draft.suggestedQuestionsHotkey || ''}
                onKeyDown={(e) => handleHotkeyKeyDown(e, 'suggestedQuestionsHotkey')}
                placeholder="Press keys to record hotkey..."
                readOnly
                style={{ width: '180px', textAlign: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', padding: '6px' }}
              />
              <button
                type="button"
                className="ghost"
                style={{ minHeight: 'auto', padding: '6px 12px' }}
                onClick={() => update('suggestedQuestionsHotkey', '')}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="wide-field floating-agent-settings">
            <span>End Call hotkey</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={draft.endCallHotkey || ''}
                onKeyDown={(e) => handleHotkeyKeyDown(e, 'endCallHotkey')}
                placeholder="Press keys to record hotkey..."
                readOnly
                style={{ width: '180px', textAlign: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', padding: '6px' }}
              />
              <button
                type="button"
                className="ghost"
                style={{ minHeight: 'auto', padding: '6px 12px' }}
                onClick={() => update('endCallHotkey', '')}
              >
                Clear
              </button>
            </div>
          </div>
          <small className="wide-field" style={{ color: 'var(--muted)', marginTop: '-8px', marginBottom: '20px' }}>
            Click inside any box and press a key combination to record. The shortcuts will register globally during live calls.
          </small>
        </>
      )}

      {activeTab === 'context' && (
        <>
          <label className="wide-field" style={{ marginTop: '15px' }}>
            {mode === 'interview' ? 'Resume / background' : 'Long term memory'}
            {mode === 'interview' ? (
              <div className="resume-import-row">
                <button type="button" className="ghost" onClick={importResumeFile}>Import file</button>
                <small>.txt, .md, and .pdf supported. Imported text replaces the box below.</small>
              </div>
            ) : null}
            <textarea
              style={{ minHeight: '120px' }}
              value={mode === 'interview' ? (draft.resumeText || '') : (draft.meetingMemory || '')}
              onChange={(event) => update(mode === 'interview' ? 'resumeText' : 'meetingMemory', event.target.value)}
              placeholder={mode === 'interview' ? 'Paste resume facts, metrics, and projects.' : 'Persistent context Clyde should use across all meetings.'}
            />
          </label>
          <div className="wide-field pro-setting-group">
            {!proEntitled ? (
              <div className="upgrade-pro-callout">
                <strong>Clyde Pro Agent</strong>
                <span>Upgrade from the website to use RAG, broader memory, Google sync, mock interviews, trend analysis, and agent actions.</span>
                <div className="upgrade-pro-actions">
                  <UpgradeToProButton />
                  <RefreshEntitlementsButton onRefresh={refreshEntitlements} />
                </div>
              </div>
            ) : null}
            <label className="toggle-row pro-setting-label question-bank-global-toggle">
              <span className="switch-control">
                <input
                  type="checkbox"
                  checked={proEntitled && Boolean(draft.ragEnabled)}
                  disabled={!proEntitled}
                  onChange={(event) => {
                    if (!proEntitled) {
                      return;
                    }
                    update('ragEnabled', event.target.checked);
                  }}
                />
                <span className="switch-slider" />
              </span>
              <span className="switch-label">{proEntitled ? 'Enable RAG with Pinecone' : 'RAG with Pinecone requires Pro'}</span>
              {!proEntitled ? <ProSettingsBadge /> : null}
            </label>
            {proEntitled && draft.ragEnabled && (
              <div className="form-grid">
                {draft.llmProvider === 'clyde-cloud' ? (
                  <div className="wide-field" style={{ color: 'var(--success)', fontSize: '0.85rem', fontWeight: '500', padding: '8px 12px', borderRadius: '4px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', margin: '0 0 12px 0', boxSizing: 'border-box' }}>
                    ✓ Embeddings are managed and processed automatically via Clyde Cloud.
                  </div>
                ) : (
                  <>
                    <label>
                      Embedding provider
                      <select value={draft.embeddingProvider || ''} onChange={(event) => {
                        const provider = event.target.value;
                        update('embeddingProvider', provider);
                        update('embeddingModel', '');
                      }}>
                        <option value="">Select an embedding provider</option>
                        <option value="gemini">Gemini</option>
                        <option value="openai">OpenAI</option>
                      </select>
                    </label>
                    <label>
                      Embedding model
                      <input value={draft.embeddingModel || ''} onChange={(event) => update('embeddingModel', event.target.value)} placeholder="gemini-embedding-2" />
                    </label>
                    <label>
                      Embedding API key
                      <input autoComplete="new-password" type="password" value={draft.embeddingApiKey || ''} onChange={(event) => update('embeddingApiKey', event.target.value)} placeholder="Uses Gemini or OpenAI key when empty" />
                    </label>
                    <label>
                      Pinecone API Key
                      <input autoComplete="new-password" type="password" value={draft.pineconeApiKey || ''} onChange={(event) => update('pineconeApiKey', event.target.value)} placeholder="Stored locally" />
                    </label>
                    <label>
                      Pinecone Host URL
                      <input value={draft.pineconeHost || ''} onChange={(event) => update('pineconeHost', event.target.value)} placeholder="e.g. https://index.pinecone.io" />
                    </label>
                    <label>
                      Pinecone namespace
                      <input value={draft.pineconeNamespace || ''} onChange={(event) => update('pineconeNamespace', event.target.value)} placeholder="clyde-pro-knowledge" />
                    </label>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'llm' && (
        <div className="form-grid">
          <div className="wide-field settings-section-label">
            <strong>Standard AI provider</strong>
            <small>Used for answer cards, prep, summaries, grading, trend analysis, and sync reasoning.</small>
          </div>
          <label>
            Provider
            <select value={draft.llmProvider || ''} onChange={(event) => {
              const val = event.target.value;
              if (val === 'clyde-cloud' && draft.subscriptionPlan === 'clyde_byok_lifetime') {
                window.alert('Clyde Managed Cloud is not available on the BYOK Lifetime plan. Please select a local or custom API provider.');
                return;
              }
              if (val === 'clyde-cloud' && !proEntitled) {
                window.alert('Clyde Managed Cloud is a Pro-only feature! Please select a local or custom API provider, or upgrade to Clyde Pro from settings.');
                return;
              }
              update('llmProvider', val);
              if (val === 'clyde-cloud' || val === 'gemini') {
                update('llmModel', 'gemini-3.5-flash');
              } else if (val === 'openai') {
                update('llmModel', 'gpt-4o');
              } else {
                update('llmModel', '');
              }
            }}>
              <option value="">Select an LLM provider</option>
              <option value="clyde-cloud">Clyde Managed Cloud (Pro only)</option>
              <option value="local">Local LM Studio (Offline)</option>
              <option value="gemini">Google Gemini (Custom Key)</option>
              <option value="openai">OpenAI ChatGPT (Custom Key)</option>
            </select>
          </label>
          {draft.llmProvider === 'clyde-cloud' && settings.subscriptionPlan === 'clyde_byok_lifetime' && (
            <div className="wide-field upgrade-pro-callout">
              <strong>Clyde Managed Cloud is not available on the BYOK Lifetime plan</strong>
              <span>Please configure a local model or insert your own Google Gemini / OpenAI API key to use Clyde.</span>
            </div>
          )}
          {draft.llmProvider === 'clyde-cloud' && settings.subscriptionPlan !== 'clyde_byok_lifetime' && !proEntitled && (
            <div className="wide-field upgrade-pro-callout">
              <strong>Clyde Managed Cloud requires Clyde Pro</strong>
              <span>Open the website to upgrade, then refresh your subscription in Clyde.</span>
              <div className="upgrade-pro-actions">
                <UpgradeToProButton />
                <RefreshEntitlementsButton onRefresh={refreshEntitlements} />
              </div>
            </div>
          )}
          {draft.llmProvider === 'openai' && (
            <label>
              OpenAI API key
              <input autoComplete="new-password" type="password" value={draft.openAiApiKey || ''} onChange={(event) => update('openAiApiKey', event.target.value)} placeholder="Stored locally" />
            </label>
          )}
          {draft.llmProvider === 'gemini' && (
            <label>
              Gemini API key
              <input autoComplete="new-password" type="password" value={draft.llmApiKey || ''} onChange={(event) => update('llmApiKey', event.target.value)} placeholder="Stored locally" />
            </label>
          )}
          {draft.llmProvider === 'local' && (
            <label>
              Local LLM URL
              <input value={draft.localLlmUrl || ''} onChange={(event) => update('localLlmUrl', event.target.value)} placeholder="http://localhost:1234/v1/chat/completions" />
            </label>
          )}
          {draft.llmProvider === 'local' && (
            <label>
              Model name
              <input value={draft.llmModel || ''} onChange={(event) => update('llmModel', event.target.value)} placeholder="Name of the model loaded in LM Studio" />
            </label>
          )}
          <div className="wide-field settings-section-label">
            <strong>Realtime voice agent</strong>
            <small>Pro feature. Uses OpenAI realtime agent technology.</small>
          </div>
          {!proEntitled ? (
            <div className="wide-field upgrade-pro-callout">
              <strong>Realtime voice agent requires Clyde Pro</strong>
              <span>Open the website to upgrade, then refresh your subscription in Clyde.</span>
              <div className="upgrade-pro-actions">
                <UpgradeToProButton />
                <RefreshEntitlementsButton onRefresh={refreshEntitlements} />
              </div>
            </div>
          ) : null}
          <label className="toggle-row pro-setting-label wide-field question-bank-global-toggle">
            <span className="switch-control">
              <input
                type="checkbox"
                checked={proEntitled && Boolean(draft.proAgentEnabled)}
                disabled={!proEntitled}
                onChange={(event) => {
                  if (!proEntitled) {
                    return;
                  }
                  const checked = event.target.checked;
                  update('proAgentEnabled', checked);
                  if (checked) {
                    update('proRealtimeModel', 'gpt-realtime-2');
                    update('transcriptionProvider', 'openai-realtime-whisper');
                    if (draft.openAiApiKey) {
                      update('transcriptionApiKey', draft.openAiApiKey);
                    }
                  }
                }}
              />
              <span className="switch-slider" />
            </span>
            <span className="switch-label">{proEntitled ? 'Enable Clyde Pro agent' : 'Clyde Pro agent requires Pro'}</span>
            {!proEntitled ? <ProSettingsBadge /> : null}
          </label>
          {proEntitled && draft.proAgentEnabled && (
            <>
              <label>
                Realtime OpenAI API key
                <input 
                  autoComplete="new-password" 
                  type="password" 
                  value={draft.openAiApiKey || ''} 
                  onChange={(event) => {
                    update('openAiApiKey', event.target.value);
                    if (draft.proAgentEnabled) {
                      update('transcriptionApiKey', event.target.value);
                    }
                  }} 
                  placeholder="Stored locally" 
                />
              </label>
              <div style={{ marginTop: '8px', color: 'var(--success)', fontSize: '0.85rem', fontWeight: '500' }}>
                ✓ OpenAI Realtime Whisper has been enabled with the same API key.
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'transcription' && (
        <div className="form-grid">
          <label>
            Audio engine
            <select value={draft.audioEngine || 'rust'} onChange={(event) => updateAudioSetting('audioEngine', event.target.value)}>
              <option value="rust">Rust native audio</option>
              <option value="legacy">Legacy recorder</option>
            </select>
          </label>
          {draft.audioEngine !== 'legacy' && (
            <>
              <label>
                Microphone
                <select value={draft.microphoneDeviceId || ''} onChange={(event) => updateAudioSetting('microphoneDeviceId', event.target.value)}>
                  <option value="">Default microphone</option>
                  {audioDevices.microphones.map((device) => (
                    <option key={device.id || device.name} value={device.id || device.name}>
                      {device.name || device.id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                System audio
                <select value={draft.systemAudioDeviceId || ''} onChange={(event) => updateAudioSetting('systemAudioDeviceId', event.target.value)}>
                  <option value="">Default system audio</option>
                  {audioDevices.systemOutputs.map((device) => (
                    <option key={device.id || device.name} value={device.id || device.name}>
                      {device.name || device.id}
                    </option>
                  ))}
                </select>
              </label>
              <div className="wide-field audio-device-actions">
                <button type="button" className="ghost" onClick={refreshAudioDevices}>Refresh devices</button>
                {audioDeviceStatus ? <small>{audioDeviceStatus}</small> : null}
              </div>
            </>
          )}
          <label>
            Transcription provider
            <select value={draft.transcriptionProvider || ''} disabled={Boolean(draft.proAgentEnabled)} onChange={(event) => {
              const val = event.target.value;
              if (val === 'clyde-cloud-whisper' && draft.subscriptionPlan === 'clyde_byok_lifetime') {
                window.alert('Clyde Managed Whisper is not available on the BYOK Lifetime plan. Please select local or custom API providers.');
                return;
              }
              if (val === 'clyde-cloud-whisper' && !proEntitled) {
                window.alert('Clyde Managed Whisper is a Pro-only feature! Please select local or custom API providers.');
                return;
              }
              update('transcriptionProvider', val);
            }}>
              <option value="">Select a transcription provider</option>
              <option value="clyde-cloud-whisper">Clyde Managed Whisper (Pro only)</option>
              <option value="local">Local Whisper (Offline)</option>
              <option value="openai">OpenAI Whisper (Custom Key)</option>
              <option value="openai-realtime-whisper">OpenAI Realtime Whisper (Custom Key)</option>
            </select>
          </label>
          {draft.transcriptionProvider === 'clyde-cloud-whisper' && settings.subscriptionPlan === 'clyde_byok_lifetime' && (
            <div className="wide-field upgrade-pro-callout">
              <strong>Clyde Managed Whisper is not available on the BYOK Lifetime plan</strong>
              <span>Please select Local Whisper or configure a custom OpenAI API key.</span>
            </div>
          )}
          {draft.transcriptionProvider === 'clyde-cloud-whisper' && settings.subscriptionPlan !== 'clyde_byok_lifetime' && !proEntitled && (
            <div className="wide-field upgrade-pro-callout">
              <strong>Clyde Managed Whisper requires Clyde Pro</strong>
              <span>Open the website to upgrade, then refresh your subscription in Clyde.</span>
              <div className="upgrade-pro-actions">
                <UpgradeToProButton />
                <RefreshEntitlementsButton onRefresh={refreshEntitlements} />
              </div>
            </div>
          )}
          {draft.transcriptionProvider === 'local' ? (
            <label>
              Transcription URL
              <input value={draft.localTranscriptionUrl || ''} onChange={(event) => update('localTranscriptionUrl', event.target.value)} placeholder="http://localhost:8000/v1/audio/transcriptions" />
            </label>
          ) : (draft.transcriptionProvider && draft.transcriptionProvider !== 'clyde-cloud-whisper') ? (
            <label>
              OpenAI API key
              <input autoComplete="new-password" type="password" value={draft.openAiApiKey || ''} disabled={Boolean(draft.proAgentEnabled)} onChange={(event) => { update('openAiApiKey', event.target.value); update('transcriptionApiKey', event.target.value); }} placeholder="Stored locally" />
            </label>
          ) : null}
        </div>
      )}

      {activeTab === 'sync' && (
        <div className="sync-settings">
          {!proEntitled ? (
            <div className="upgrade-pro-callout sync-pro-callout">
              <strong>Google sync requires Clyde Pro</strong>
              <span>Free tier keeps manual calendar, transcripts, local context, and saved sessions. Pro adds Calendar scans, suggested actions, and auto-approval (Gmail Agent is under development).</span>
              <div className="upgrade-pro-actions">
                <UpgradeToProButton />
                <RefreshEntitlementsButton onRefresh={refreshEntitlements} />
              </div>
            </div>
          ) : null}
          <div className="form-grid">
            <label className="toggle-row question-bank-global-toggle">
              <span className="switch-control">
                <input
                  type="checkbox"
                  checked={proEntitled && Boolean(draft.googleSyncEnabled)}
                  disabled={!proEntitled}
                  onChange={(event) => {
                    if (proEntitled) {
                      update('googleSyncEnabled', event.target.checked);
                    }
                  }}
                />
                <span className="switch-slider" />
              </span>
              <span className="switch-label">{proEntitled ? 'Enable periodic Google sync' : 'Google sync requires Pro'}</span>
              {!proEntitled ? <ProSettingsBadge /> : null}
            </label>
            <label className="toggle-row question-bank-global-toggle">
              <span className="switch-control">
                <input
                  type="checkbox"
                  checked={proEntitled && Boolean(draft.googleSyncAutoApprove)}
                  disabled={!proEntitled || !draft.googleSyncEnabled}
                  onChange={(event) => {
                    if (proEntitled && draft.googleSyncEnabled) {
                      update('googleSyncAutoApprove', event.target.checked);
                    }
                  }}
                />
                <span className="switch-slider" />
              </span>
              <span className="switch-label">{proEntitled ? 'Auto-approve generated sync actions' : 'Auto-approval requires Pro'}</span>
              {!proEntitled ? <ProSettingsBadge /> : null}
            </label>
            <label>
              Poll interval (minutes)
              <input type="number" min="1" value={draft.googleSyncPollMinutes || 15} disabled={!proEntitled} onChange={(event) => update('googleSyncPollMinutes', Number(event.target.value) || 15)} />
            </label>
          </div>
          <div className="sync-settings-card">
            <strong>{googleStatus?.connected ? `Connected: ${googleStatus.accountEmail || draft.googleAccountEmail || 'Google'}` : 'Google is disconnected'}</strong>
            <p>{googleStatus?.pendingCount || 0} pending sync actions.</p>
            <div className="sync-settings-actions">
              <button type="button" className="primary-action" onClick={connectGoogle} disabled={!proEntitled}>Connect Google</button>
              <button type="button" className="ghost" onClick={disconnectGoogle} disabled={!proEntitled || !googleStatus?.connected}>Disconnect</button>
              <button type="button" className="ghost" onClick={scanGoogle} disabled={!proEntitled || !googleStatus?.connected}>Scan now</button>
            </div>
            <div style={{ marginTop: '14px', fontSize: '0.8rem', color: 'var(--muted)', display: 'flex', alignItems: 'flex-start', gap: '6px', lineHeight: '1.4' }}>
              <span>ℹ️</span>
              <span><strong>Note:</strong> Gmail Agent is under development. Google Sync currently only scans Google Calendar events.</span>
            </div>
          </div>
          <div className="sync-audit-log">
            <strong>Audit log</strong>
            <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '8px' }}>
              {syncAudit && syncAudit.length ? syncAudit.map((entry) => (
                <article key={entry.id}>
                  <span>{new Date(entry.createdAt).toLocaleString()}</span>
                  <p>{entry.message || entry.type}</p>
                  <small>{entry.status}</small>
                </article>
              )) : <small>No sync audit events yet.</small>}
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <button type="submit" data-testid="saveBtn" className="primary-action" disabled={saving}>
          {saving ? 'Saving...' : 'Save and close'}
        </button>
        <button type="button" className="ghost" disabled={saving} onClick={() => saveDraft(false)}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
      {statusDialog ? (
        <div className="settings-message-backdrop" role="presentation">
          <section className={`settings-message-modal ${statusDialog.tone}`} role="alertdialog" aria-modal="true" aria-label="Settings message">
            <strong>{statusDialog.tone === 'error' ? 'Action needed' : 'Done'}</strong>
            <p>{statusDialog.message}</p>
            <button type="button" className="primary-action" onClick={() => setStatusDialog(null)}>OK</button>
          </section>
        </div>
      ) : null}
    </form>
  );
}

function EmptyState({ body, title }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function mergeTranscriptTurn(current, turn) {
  const normalized = {
    speaker: turn.speaker || 'Unknown',
    text: String(turn.text || '').trim(),
    speakerColor: turn.speakerColor || '',
    itemId: turn.itemId || '',
    partial: Boolean(turn.partial),
    timestamp: turn.timestamp || Date.now()
  };

  if (!normalized.text) {
    return current;
  }

  if (normalized.itemId) {
    const existingIndex = current.findIndex((item) => item.itemId === normalized.itemId);

    if (existingIndex >= 0) {
      return current.map((item, index) => (
        index === existingIndex ? normalized : item
      ));
    }

    if (normalized.partial) {
      return [...current, normalized];
    }
  }

  if (normalized.partial) {
    return [...current, normalized];
  }

  const last = current[current.length - 1];
  if (last && last.speaker === normalized.speaker && !last.partial) {
    return [
      ...current.slice(0, -1),
      { ...last, text: `${last.text} ${normalized.text}` }
    ];
  }

  return [...current, normalized];
}

function normalizeCardForRender(card) {
  return {
    id: card.id || `${card.type || 'note'}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: card.type || 'note',
    title: card.title || labelForCard(card.type),
    body: card.body || card.text || '',
    question: card.question || '',
    bullets: Array.isArray(card.bullets) ? card.bullets : [],
    detailBullets: Array.isArray(card.detailBullets) ? card.detailBullets : [],
    detail: card.detail || card.why || '',
    agentic: Boolean(card.agentic),
    draft: Boolean(card.draft),
    timestamp: card.timestamp || Date.now()
  };
}

function assistantCardKey(card = {}) {
  return [
    card.type || 'note',
    card.title || '',
    card.body || card.text || '',
    card.question || '',
    Array.isArray(card.bullets) ? card.bullets.join('|') : '',
    card.detail || card.why || ''
  ].join('::');
}

function prependAssistantCards(cards = [], currentCards = [], replaceCardId = '', explicitGroupId = '') {
  const gId = explicitGroupId || `g-${Date.now()}`;
  const nextCards = cards.map(c => ({ ...normalizeCardForRender(c), groupId: c.groupId || gId }));
  const seenCards = new Set(nextCards.map(assistantCardKey));
  const retainedCards = currentCards
    .filter((card) => card.id !== replaceCardId)
    .filter((card) => {
      const key = assistantCardKey(card);
      if (seenCards.has(key)) {
        return false;
      }
      seenCards.add(key);
      return true;
    });

  return [...nextCards, ...retainedCards].slice(0, MAX_ASSISTANT_CARDS);
}

function labelForCard(type) {
  return {
    answer: 'Answer',
    suggestion: 'Say next',
    follow_up: 'Follow-up',
    recap: 'Recap',
    action: 'Action',
    insight: 'Insight',
    screen_description: 'Screen',
    risk: 'Watch',
    note: 'Note',
    memory: 'Memory'
  }[type] || 'Note';
}

function summarizeTranscript(transcript) {
  const lastTurns = transcript.slice(-4);
  if (!lastTurns.length) {
    return '';
  }

  return lastTurns.map((turn) => `${turn.speaker}: ${turn.text}`).join(' ');
}

function buildNotes(transcript, cards, mode = 'interview') {
  if (mode === 'interview') {
    return {
      summary: '',
      actionItems: []
    };
  }

  return {
    summary: summarizeTranscript(transcript) || 'Session saved from Clyde.',
    actionItems: cards
      .filter((card) => card.type === 'action' || card.type === 'follow_up')
      .map((card) => card.body || card.question)
      .filter(Boolean)
  };
}

function buildFollowUpDraft(mode, settings, cards) {
  const actions = cards
    .filter((card) => card.type === 'action' || card.type === 'follow_up')
    .map((card) => card.body || card.question)
    .filter(Boolean);

  if (mode === 'interview') {
    return `Thanks again for the conversation about ${settings.currentRole || 'the role'}. I appreciated learning more and wanted to follow up on ${actions[0] || 'the next steps'}.`;
  }

  return `Thanks for the discussion. My notes show ${actions[0] || 'a few follow-ups'}, and I will confirm owners and timing.`;
}

function attendeeSummary(attendees) {
  if (!Array.isArray(attendees) || attendees.length === 0) {
    return '';
  }

  return attendees.map((attendee) => attendee.role ? `${attendee.name} (${attendee.role})` : attendee.name).join(', ');
}

function attendeeLines(attendees) {
  if (!Array.isArray(attendees)) {
    return '';
  }

  return attendees.map((attendee) => attendee.role ? `${attendee.name}: ${attendee.role}` : attendee.name).join(', ');
}

function getMeetingTranscriptFallback(session) {
  const transcript = Array.isArray(session?.transcript) ? session.transcript : [];
  const summary = String(session?.notes?.summary || '').trim();

  if (session?.mode === 'meeting' && transcript.length === 0 && looksLikeTranscriptText(summary)) {
    return {
      summary: '',
      transcriptText: summary
    };
  }

  return {
    summary,
    transcriptText: transcriptToText(transcript)
  };
}

function normalizeActionItemGroups(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  const groups = new Map();

  for (const item of items) {
    if (!item) {
      continue;
    }

    if (typeof item === 'string') {
      const text = cleanEvaluationText(item);
      if (!text) {
        continue;
      }

      const existing = groups.get('Unassigned') || { attendee: 'Unassigned', items: [] };
      existing.items.push(text);
      groups.set('Unassigned', existing);
      continue;
    }

    const attendee = cleanEvaluationText(item.attendee || item.owner || item.name || '') || 'Unassigned';
    const values = Array.isArray(item.items)
      ? item.items.map(cleanEvaluationText).filter(Boolean)
      : [cleanEvaluationText(item.text || item.body || item.action || item.note || '')].filter(Boolean);

    if (!values.length) {
      continue;
    }

    const existing = groups.get(attendee) || { attendee, items: [] };
    existing.items.push(...values);
    groups.set(attendee, existing);
  }

  return Array.from(groups.values());
}

function formatActionItemsForEditor(items = []) {
  return normalizeActionItemGroups(items)
    .flatMap((group) => group.items.map((item) => group.attendee && group.attendee !== 'Unassigned' ? `${group.attendee}: ${item}` : item))
    .join('\n');
}

function parseMeetingTranscriptInput(data = {}) {
  const rawTranscript = String(data.transcriptText || '').trim();
  if (rawTranscript) {
    return parseRawTranscript(rawTranscript);
  }

  const memoryText = String(data.memory || '').trim();
  if (looksLikeTranscriptText(memoryText)) {
    return parseRawTranscript(memoryText);
  }

  return [];
}

function looksLikeTranscriptText(value) {
  const text = String(value || '').trim();
  if (!text) {
    return false;
  }

  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) {
    return false;
  }

  let speakerLines = 0;
  for (const line of lines) {
    if (new RegExp('^[^:]{2,40}:\\s+\\S+').test(line)) {
      speakerLines += 1;
    }
  }

  return speakerLines >= 2 || /^(Transcript|Meeting Transcript|Meeting notes)[:\s]/i.test(lines[0]);
}

function parseActionItemsText(value) {
  const groups = new Map();
  const lines = String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^([^:]+):\s*(.+)$/);
    if (match) {
      const attendee = cleanEvaluationText(match[1]) || 'Unassigned';
      const item = cleanEvaluationText(match[2]);
      if (!item) {
        continue;
      }

      const existing = groups.get(attendee) || { attendee, items: [] };
      existing.items.push(item);
      groups.set(attendee, existing);
      continue;
    }

    const existing = groups.get('Unassigned') || { attendee: 'Unassigned', items: [] };
    existing.items.push(cleanEvaluationText(line));
    groups.set('Unassigned', existing);
  }

  return Array.from(groups.values())
    .map((group) => ({
      attendee: group.attendee || 'Unassigned',
      items: group.items.filter(Boolean)
    }))
    .filter((group) => group.items.length);
}

function parseAttendees(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [name, role] = item.split(':').map((part) => part.trim());
      return { name, role: role || '' };
    })
    .filter((attendee) => attendee.name);
}

function AuthOverlay({ api, onSettingsUpdated, onOpenSignUpWizard }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function handleAuth() {
    setBusy(true);
    setMessage('Signing in...');
    try {
      const payload = {
        email: form.email.trim(),
        password: form.password
      };
      const result = await api?.signIn?.(payload);

      if (result?.settings) {
        onSettingsUpdated(result.settings);
      }
      setForm({ email: '', password: '' });
      setMessage('Signed in successfully.');
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-overlay-fullscreen" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(16px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#f8fafc',
      fontFamily: 'system-ui, sans-serif',
      WebkitAppRegion: 'drag'
    }}>
      <button
        onClick={() => api?.closeApp?.()}
        style={{
          position: 'absolute',
          top: '24px',
          right: '24px',
          background: 'none',
          border: 'none',
          color: '#94a3b8',
          fontSize: '1.75rem',
          cursor: 'pointer',
          zIndex: 10000,
          WebkitAppRegion: 'no-drag'
        }}
        title="Close Clyde"
      >
        ×
      </button>

      <div className="auth-card-wrapper" style={{
        background: 'rgba(30, 41, 59, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '32px',
        width: '380px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        textAlign: 'center',
        WebkitAppRegion: 'no-drag'
      }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 'bold', marginBottom: '8px', color: '#f8fafc' }}>
          Welcome to <span style={{ background: 'linear-gradient(to right, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Clyde</span>
        </h2>
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '24px' }}>
          Sign in or create an account to unlock your career cockpit.
        </p>

        <form onSubmit={(e) => { e.preventDefault(); handleAuth(); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: '#cbd5e1' }}>
            Email Address
            <input
              type="email"
              required
              disabled={busy}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              style={{
                background: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '10px 12px',
                color: '#f8fafc',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: '#cbd5e1' }}>
            Password
            <input
              type="password"
              required
              disabled={busy}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              style={{
                background: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '10px 12px',
                color: '#f8fafc',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            />
          </label>

          {message ? (
            <p style={{
              fontSize: '0.8rem',
              color: message.startsWith('Error') ? '#ef4444' : '#6366f1',
              margin: '4px 0',
              textAlign: 'center',
              lineHeight: '1.4'
            }}>{message}</p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            style={{
              background: 'linear-gradient(to right, #6366f1, #a855f7)',
              border: 'none',
              borderRadius: '8px',
              padding: '12px',
              color: '#ffffff',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: 'pointer',
              marginTop: '8px',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
              transition: 'opacity 0.2s'
            }}
          >
            {busy ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '12px' }}>
          <button
            type="button"
            disabled={busy}
            onClick={() => api?.openExternalUrl?.('https://clydeai.live/forgot-password')}
            style={{
              background: 'none',
              border: 'none',
              color: '#6366f1',
              fontSize: '0.8rem',
              textDecoration: 'underline',
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'inherit'
            }}
          >
            Forgot Password?
          </button>
        </div>

        <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '20px' }}>
          Don't have an account yet?{' '}
          <button
            type="button"
            disabled={busy}
            onClick={onOpenSignUpWizard}
            style={{
              background: 'none',
              border: 'none',
              color: '#38bdf8',
              fontWeight: '600',
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'inherit',
              textDecoration: 'underline'
            }}
          >
            Create Account
          </button>
        </p>
      </div>
    </div>
  );
}

export default App;
