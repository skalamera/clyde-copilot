import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildTrendAnalysisSessionSignature,
  getTranscriptRating,
  isTrendAnalysisComplete
} from './trendAnalysisClient.js';

const logoUrl = new URL('../../clyde.svg', import.meta.url).href;
const ghostUrl = new URL('../../clyde_ghost.svg', import.meta.url).href;

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
    && isTrendAnalysisComplete(analysis, sessionCount)
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
  llmProvider: 'local',
  llmModel: '',
  llmApiKey: '',
  localLlmUrl: 'http://localhost:1234/v1/chat/completions',
  transcriptionProvider: 'local',
  transcriptionApiKey: '',
  localTranscriptionUrl: 'http://localhost:8000/v1/audio/transcriptions',
  resumeText: '',
  currentCompany: '',
  currentRole: '',
  meetingTitle: '',
  meetingAttendees: [],
  meetingMemory: '',
  ragEnabled: false,
  pineconeApiKey: '',
  pineconeHost: '',
  captureProtectionEnabled: true,
  uiOpacity: 100
};

const COMMANDS = [
  { id: 'assist', label: 'AI reply' }
];

const MAX_ASSISTANT_CARDS = 12;

function clampUiOpacity(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 100;
  }

  return Math.max(35, Math.min(200, Math.round(parsed)));
}

function applyUiOpacityToRoot(value) {
  const root = document.documentElement;
  const slider = clampUiOpacity(value);

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
  return ['active', 'advanced', 'rejected', 'offer'].includes(value) ? value : 'active';
}

function getOutcomeLabel(value) {
  return {
    active: 'Active',
    advanced: 'Advanced',
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
    <p className="calibration-note">
      {formatOutcomeCalibrationSummary(summary)}
    </p>
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
  const text = String(value || '').trim();
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
    return entityName ? `Company: ${entityName}` : 'Company';
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
  const [phase, setPhase] = useState('Recruiter Screen');
  const [date, setDate] = useState(toDateTimeLocal(new Date().toISOString()));
  const [rawText, setRawText] = useState('');

  return (
    <div className="drawer-backdrop" style={{ zIndex: 3000 }}>
      <section className="settings-drawer">
        <div className="drawer-head">
          <div>
            <h2>Add New Opportunity</h2>
            <p>Create a company/role tracker. Optionally attach an initial transcript.</p>
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
          
          <hr style={{ borderColor: 'var(--line)', margin: '10px 0' }} />
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Optional: Initial Transcript</p>
          
          <label>
            Phase
            <select value={phase} onChange={(e) => setPhase(e.target.value)}>
              <option value="Recruiter Screen">Recruiter Screen</option>
              <option value="Interview #1">Interview #1</option>
              <option value="Interview #2">Interview #2</option>
              <option value="Interview #3">Interview #3</option>
              <option value="Interview #4">Interview #4</option>
              <option value="Interview #5">Interview #5</option>
              <option value="Interview #6">Interview #6</option>
              <option value="Interview #7">Interview #7</option>
              <option value="Interview #8">Interview #8</option>
              <option value="Interview #9">Interview #9</option>
              <option value="Interview #10">Interview #10</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label>
            Session date
            <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="wide-field">
            Transcript Text
            <textarea 
              value={rawText} 
              onChange={(e) => setRawText(e.target.value)} 
              placeholder={"Interviewer: Hello\nYou: Hi there!"} 
              style={{ minHeight: '150px' }} 
            />
          </label>
        </div>
        <div className="drawer-actions">
          <button type="button" className="primary-action" onClick={() => {
            if (!company || !role) { alert('Company and Role are required.'); return; }
            onSave({ company, role, phase, date, transcript: rawText ? parseRawTranscript(rawText) : [] });
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
  const [memory, setMemory] = useState('');
  const [transcriptText, setTranscriptText] = useState('');

  return (
    <div className="drawer-backdrop" style={{ zIndex: 3000 }}>
      <section className="settings-drawer">
        <div className="drawer-head">
          <div>
            <h2>Add New Meeting</h2>
            <p>Create a meeting record and set it as the active meeting.</p>
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
          <label>
            Session date
            <input type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label className="wide-field">
            Transcript
            <textarea
              value={transcriptText}
              onChange={(event) => setTranscriptText(event.target.value)}
              placeholder={"Sarah Jenkins: Let's review the launch plan.\nMarcus Thorne: I will send the vendor quote today."}
              style={{ minHeight: '180px' }}
            />
          </label>
          <label className="wide-field">
            Meeting memory
            <textarea
              value={memory}
              onChange={(event) => setMemory(event.target.value)}
              placeholder="Optional long-term context, recurring decisions, or person notes."
            />
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
                date,
                memory: memory.trim(),
                transcriptText: transcriptText.trim()
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

function PostSessionSaveModal({ entities, mode, onClose, onSave, settings }) {
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
  const [existingEntityId, setExistingEntityId] = useState(defaultEntity?.id || '');
  const [company, setCompany] = useState(activeInterview?.name || settings.currentCompany || '');
  const [role, setRole] = useState(activeInterview?.role || settings.currentRole || '');
  const [jobDescription, setJobDescription] = useState('');
  const [phase, setPhase] = useState('Live Session');
  const [interviewerName, setInterviewerName] = useState('');
  const [interviewerTitle, setInterviewerTitle] = useState('');
  const [date, setDate] = useState(toDateTimeLocal(new Date().toISOString()));
  const [meetingName, setMeetingName] = useState(activeMeeting?.name || settings.meetingTitle || '');

  const isInterview = mode === 'interview';
  const selectedEntity = entities.find((entity) => entity.id === existingEntityId);
  const canSubmit = isInterview
    ? (destination === 'existing' ? Boolean(existingEntityId) : Boolean(company.trim() && role.trim()))
    : (destination === 'existing' ? Boolean(existingEntityId) : Boolean(meetingName.trim()));

  function submit(event) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    if (isInterview) {
      onSave({
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
        phase: phase.trim() || 'Live Session',
        interviewerName: interviewerName.trim(),
        interviewerTitle: interviewerTitle.trim(),
        date
      });
      return;
    }

    const resolvedColor = associationMode === 'opportunity'
      ? '#00e5ff'
      : associationMode === 'meeting'
        ? '#00ffaa'
        : (color || '#ffaa00');

    onSave({
      mode: 'meeting',
      destination,
      entity: destination === 'existing'
        ? {
          id: selectedEntity?.id || existingEntityId,
          name: selectedEntity?.name || existingEntityId,
          role: ''
        }
        : {
          id: meetingName.trim(),
          name: meetingName.trim(),
          role: ''
        },
      date
    });
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
                  <option value="Recruiter Screen">Recruiter Screen</option>
                  <option value="Interview #1">Interview #1</option>
                  <option value="Interview #2">Interview #2</option>
                  <option value="Interview #3">Interview #3</option>
                  <option value="Interview #4">Interview #4</option>
                  <option value="Interview #5">Interview #5</option>
                  <option value="Interview #6">Interview #6</option>
                  <option value="Interview #7">Interview #7</option>
                  <option value="Interview #8">Interview #8</option>
                  <option value="Interview #9">Interview #9</option>
                  <option value="Interview #10">Interview #10</option>
                  <option value="Live Session">Live Session</option>
                  <option value="Other">Other</option>
                </select>
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
            <label className="wide-field">
              Session date
              <input type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
          )}

          <button type="submit" className="primary-action" disabled={!canSubmit}>
            Save transcript
          </button>
        </form>
      </section>
    </div>
  );
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

function ManualTranscriptModal({ entity, onClose, onSave }) {
  const [phase, setPhase] = useState('Interview #1');
  const [date, setDate] = useState(toDateTimeLocal(new Date().toISOString()));
  const [rawText, setRawText] = useState('');

  return (
    <div className="drawer-backdrop" style={{ zIndex: 3000 }}>
      <section className="settings-drawer">
        <div className="drawer-head">
          <div>
            <h2>Add Manual Transcript</h2>
            <p>For {entity?.name}</p>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <label>
            Phase
            <select value={phase} onChange={(e) => setPhase(e.target.value)}>
              <option value="Recruiter Screen">Recruiter Screen</option>
              <option value="Interview #1">Interview #1</option>
              <option value="Interview #2">Interview #2</option>
              <option value="Interview #3">Interview #3</option>
              <option value="Interview #4">Interview #4</option>
              <option value="Interview #5">Interview #5</option>
              <option value="Interview #6">Interview #6</option>
              <option value="Interview #7">Interview #7</option>
              <option value="Interview #8">Interview #8</option>
              <option value="Interview #9">Interview #9</option>
              <option value="Interview #10">Interview #10</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label>
            Session date
            <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="wide-field">
            Transcript Text
            <textarea 
              value={rawText} 
              onChange={(e) => setRawText(e.target.value)} 
              placeholder={"Interviewer: Let's start...\nYou: Okay!"} 
              style={{ minHeight: '250px' }} 
            />
          </label>
        </div>
        <div className="drawer-actions">
          <button type="button" className="primary-action" onClick={() => {
            if (!rawText) return;
            onSave({ phase, date, transcript: parseRawTranscript(rawText) });
          }}>
            Save & Grade
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
  const [company, setCompany] = useState(session?.entity?.name || '');
  const [role, setRole] = useState(session?.entity?.role || '');
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
    setCompany(session?.entity?.name || '');
    setRole(session?.entity?.role || '');
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
              Company name
              <input value={company} onChange={(event) => setCompany(event.target.value)} />
            </label>
            <label>
              Title
              <input value={role} onChange={(event) => setRole(event.target.value)} />
            </label>
            <label>
              Session title
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label>
              Date
              <input type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
          </div>
          <label className="wide-field">
            {session?.mode === 'meeting' ? 'Meeting notes' : 'Summary'}
            <textarea value={summary} onChange={(event) => setSummary(event.target.value)} />
          </label>
          <label className="wide-field">
            {session?.mode === 'interview' ? 'Examples' : 'Action items by attendee'}
            <textarea
              value={actions}
              onChange={(event) => setActions(event.target.value)}
              placeholder={session?.mode === 'meeting' ? 'Sarah Jenkins: Send recap\nMarcus Thorne: Confirm owner' : 'One item per line'}
            />
          </label>
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
                name: company.trim() || session.entity?.name || 'Interview',
                role: role.trim()
              },
              transcript: parseRawTranscript(transcriptText),
              notes: {
                summary: summary.trim(),
                actionItems: session?.mode === 'interview'
                  ? []
                  : parseActionItemsText(actions)
              },
              grading: session?.mode === 'interview' ? {
                ...(session.grading || {}),
                examples: actions.split('\n').map((item) => item.trim()).filter(Boolean)
              } : session?.grading
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
  const [collapsedOutcomeSections, setCollapsedOutcomeSections] = useState({ rejected: false, offer: false });

  const selected = entities.find((entity) => entity.id === selectedEntity);
  const activeEntities = mode === 'interview'
    ? entities.filter((entity) => !isClosedOpportunityOutcome(entity.outcome))
    : entities;
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
    if (!selected || sessions.length < 2 || !sessionsMatchSelected) {
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
      if (result && isTrendAnalysisComplete(result, sessions.length)) {
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
    <div key={entity.id} className="opportunity-row opportunity-row-compact">
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
    </div>
  );

  return (
    <section className="timeline-view" data-testid="trendsTimeline" style={{ '--timeline-rail-width': `${railWidth}px` }}>
      <div className="timeline-rail">
        <div className="timeline-heading">
          <h2>Trend Analysis</h2>
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

      <div className="timeline-main" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div className="timeline-title" style={{ flexShrink: 0 }}>
          <div>
            <h2>{selected?.name ? `${selected.name} Analysis` : 'Select a record'}</h2>
            <p>{sessions.length} saved sessions</p>
            {mode === 'interview' && selected ? <OutcomeCalibrationNote summary={calibrationSummary} /> : null}
          </div>
        </div>

        {selected ? (
          sessions.length < 2 ? (
            <div style={{ marginTop: '40px' }}>
              <EmptyState title="Not enough data" body="At least 2 interview sessions are required to analyze trends." />
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
                <h4 style={{ margin: '0 0 20px 0', color: 'var(--text)', fontWeight: 500 }}>Transcript Rating Over Time</h4>
                <TrendChart sessions={sortedSessions} />
              </div>

              <div className="trends-analysis-section" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h4 style={{ margin: 0, color: 'var(--text)', fontWeight: 500 }}>Deep Dive Analysis</h4>
                  <button type="button" className="primary-action" onClick={generateAnalysis} disabled={loading} style={{ padding: '8px 16px' }}>
                    {loading ? 'Analyzing...' : (analysis ? 'Regenerate Analysis' : 'Generate Analysis')}
                  </button>
                </div>
                
                {loading ? (
                  <div className="analysis-loading pulse" style={{ padding: '40px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--cyan)', minHeight: '100px', width: '100%' }}>Reading transcripts and computing trends...</div>
                ) : analysis ? (
                  <div className="analysis-result" style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="analysis-kpi" style={{ marginBottom: '15px', fontSize: '1.1rem' }}>
                      <strong style={{ color: 'var(--muted)' }}>AI Trend Direction: </strong> <span style={{ textTransform: 'capitalize', color: 'var(--cyan)', fontWeight: 'bold' }}>{analysis.trend}</span>
                    </div>
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
                    <EmptyState title="No AI analysis yet" body="Click Generate Analysis to ask Clyde to review the transcripts and explain the trend." />
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
    .sort((a, b) => a.session.createdAt - b.session.createdAt);
  
  if (validSessions.length < 2) {
    return <div className="chart-empty" style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted)' }}>Not enough rated sessions to chart.</div>;
  }

  const maxVal = 5;
  const minVal = 0;
  
  const points = validSessions.map(({ session, rating }, i) => {
    const x = padding + (i * ((width - padding * 2) / (validSessions.length - 1)));
    const y = height - padding - ((rating - minVal) / (maxVal - minVal)) * (height - padding * 2);
    return {
      x,
      y,
      label: session.phase || `Session ${i + 1}`,
      rating
    };
  });

  const pathD = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', minWidth: '400px', height: 'auto', display: 'block' }}>
        {[0, 1, 2, 3, 4, 5].map(v => {
          const y = height - padding - ((v - minVal) / (maxVal - minVal)) * (height - padding * 2);
          return <line key={v} x1={padding} y1={y} x2={width - padding} y2={y} stroke="rgba(255,255,255,0.1)" />;
        })}
        
        <path d={pathD} fill="none" stroke="var(--cyan)" strokeWidth="3" />
        
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
`;

function CalendarView({ entities, events, onSaveEvent, onDeleteEvent, onEditEvent, mode }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month'); // 'month', 'week', 'day'

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
              return (
                <div 
                  key={evt.id} 
                  className="calendar-event-chip" 
                  style={{ backgroundColor: evt.color || 'var(--cyan)' }}
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
    const first = curr.getDate() - curr.getDay();
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(curr.setDate(first + i)));
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
                  return (
                    <div 
                      key={evt.id} 
                      className="calendar-event-card" 
                      style={{ borderLeftColor: evt.color || 'var(--cyan)' }}
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
             return (
              <div 
                key={evt.id} 
                className="calendar-event-card large" 
                style={{ borderLeftColor: evt.color || 'var(--cyan)' }}
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
      description: description.trim()
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
                <option value="opportunity">Opportunity</option>
                <option value="meeting">Meeting</option>
                <option value="generic">Generic</option>
              </select>
            </label>
            {associationMode === 'opportunity' && (
              <label>
                Associated Opportunity
                <select value={opportunityId} onChange={(e) => setOpportunityId(e.target.value)}>
                  <option value="">Select opportunity</option>
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
  const [mode, setMode] = useState('interview');
  const [status, setStatus] = useState('Awaiting initialization...');
  const [isStreaming, setIsStreaming] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [assistantCards, setAssistantCards] = useState([]);
  const [askPending, setAskPending] = useState(false);
  const [overlayHidden, setOverlayHidden] = useState(false);
  const [appWindowMinimized, setAppWindowMinimized] = useState(false);
  const [capturePaused, setCapturePaused] = useState(false);
  const [health, setHealth] = useState(DEFAULT_HEALTH);
  const [liveLevels, setLiveLevels] = useState([]);
  const [workspaceView, setWorkspaceView] = useState('live');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(true);
  const [entities, setEntities] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState('');
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
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [calendarTargetEntity, setCalendarTargetEntity] = useState(null);
  const [calendarEditEvent, setCalendarEditEvent] = useState(null);
  const nowMs = useNowMs();

  useEffect(() => {
    applyUiOpacityToRoot(settings.uiOpacity);
  }, [settings.uiOpacity]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('clyde-calendar-events');
      if (stored) {
        const parsed = JSON.parse(stored);
        setCalendarEvents(Array.isArray(parsed) ? parsed : []);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

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
      startCapture();
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
      startCapture();
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

    startCapture();
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
    let mounted = true;

    async function load() {
      if (!api?.loadSettings) {
        return;
      }

      const loaded = await api.loadSettings();
      if (!mounted) {
        return;
      }

      const nextSettings = { ...EMPTY_SETTINGS, ...(loaded || {}) };
      setSettings(nextSettings);
      setMode(nextSettings.appMode === 'meeting' ? 'meeting' : 'interview');
      setSetupOpen(!nextSettings.currentCompany && !nextSettings.meetingTitle);
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
      if ((update?.type === 'live-started' || update?.type === 'live-levels') && Array.isArray(update.sources)) {
        setLiveLevels(update.sources);
      }
      if (update?.type === 'live-stopped') {
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
      const nextCards = Array.isArray(update?.cards) && update.cards.length
        ? update.cards
        : [{ type: 'note', title: update?.title || 'Live help', body: update?.text || '' }];
      setAssistantCards((current) => prependAssistantCards(nextCards, current));
      setAskPending(false);
    });

    api?.onSessionReset?.(() => {
      setTranscript([]);
      setAssistantCards([]);
      setStatus('Session reset.');
    });

    return () => {
      mounted = false;
    };
  }, [api]);

  useEffect(() => {
    reloadSessions(mode).catch((error) => setStatus(`Timeline failed: ${error.message}`));
  }, [mode, reloadSessions]);

  const saveCalendarEvent = (event) => {
    const prev = Array.isArray(calendarEvents) ? calendarEvents : [];
    const nextEvents = event.id 
      ? prev.map(e => e.id === event.id ? event : e)
      : [...prev, { ...event, id: `evt-${Date.now()}` }];
    setCalendarEvents(nextEvents);
    localStorage.setItem('clyde-calendar-events', JSON.stringify(nextEvents));
    setCalendarModalOpen(false);
  };

  const deleteCalendarEvent = (id) => {
    const prev = Array.isArray(calendarEvents) ? calendarEvents : [];
    const nextEvents = prev.filter(e => e.id !== id);
    setCalendarEvents(nextEvents);
    localStorage.setItem('clyde-calendar-events', JSON.stringify(nextEvents));
    setCalendarModalOpen(false);
  };

  async function chooseMode(nextMode) {
    setMode(nextMode);
    const nextSettings = { ...settings, appMode: nextMode };
    setSettings(nextSettings);
    await api?.setActiveSessionContext?.({ mode: nextMode });
    await reloadSessions(nextMode, '');
  }

  async function saveSettings(nextSettings) {
    const normalized = {
      ...settings,
      ...nextSettings,
      appMode: mode,
      uiOpacity: clampUiOpacity(nextSettings.uiOpacity ?? settings.uiOpacity),
      meetingAttendees: parseAttendees(nextSettings.meetingAttendeesText ?? attendeeLines(nextSettings.meetingAttendees || settings.meetingAttendees))
    };

    delete normalized.meetingAttendeesText;
    await api?.saveSettings?.(normalized);
    await api?.setActiveSessionContext?.({
      mode,
      company: normalized.currentCompany,
      role: normalized.currentRole,
      meetingTitle: normalized.meetingTitle,
      attendees: normalized.meetingAttendees,
      memory: normalized.meetingMemory
    });
    setSettings(normalized);
    setSettingsOpen(false);
    setSetupOpen(false);
    setStatus('Settings saved.');
    await reloadSessions(mode);
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

  async function validateServices() {
    setServiceChecking(true);
    try {
      const nextHealth = await api?.validateServices?.(settings);
      if (nextHealth) {
        setHealth(nextHealth);
      }
      setStatus('Service check complete.');
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
    setStatus('Starting audio capture...');
    console.log('📢 About to call setIsStreaming(true)');
    setIsStreaming(true);
    console.log('📢 About to call api?.showApp?()');
    api?.showApp?.();
    console.log('📢 About to call api?.startTranscription?()');
    api?.startTranscription?.();
    console.log('✅ startCapture() completed');
  }

  function stopCapture() {
    api?.stopTranscription?.();
    setIsStreaming(false);
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
    const phase = payload?.phase || 'Live Session';
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
      title: phase,
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
      title: 'Meeting transcript',
      date: fromDateTimeLocal(payload?.date),
      attendees: settings.meetingAttendees || [],
      transcript,
      notes: buildNotes(transcript, assistantCards, 'meeting'),
      cards: assistantCards,
      grading: null
    });

    const nextSettings = await api?.setActiveSessionContext?.({
      mode: 'meeting',
      meetingTitle: entity.name || entity.id,
      attendees: settings.meetingAttendees || []
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
      type: 'note',
      title: 'Asking Clyde...',
      body: payload.prompt ? 'Reading the screen and recent call context.' : 'Reading the screen and preparing live help.'
    };
    setAssistantCards((current) => prependAssistantCards([temporaryCard], current));

    try {
      const result = await api?.requestSuggestion?.(payload);
      if (result?.skipped) {
        setAssistantCards((current) => current.filter((card) => card.id !== temporaryCard.id));
        setAskPending(false);
        setStatus(`Clyde skipped request: ${result.skipped}.`);
      } else if (Array.isArray(result?.cards) && result.cards.length) {
        setAssistantCards((current) => prependAssistantCards(result.cards, current, temporaryCard.id));
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
      attendees: latest?.attendees || []
    });
    if (nextSettings) {
      setSettings(nextSettings);
    }
  }

  async function createMeetingMemory(data) {
    const transcript = parseMeetingTranscriptInput(data);
    const hasTranscript = transcript.length > 0;

    await api?.saveSession?.({
      mode: 'meeting',
      entity: {
        id: data.title,
        name: data.title,
        role: ''
      },
      title: hasTranscript ? 'Meeting transcript' : 'Meeting memory',
      date: fromDateTimeLocal(data.date),
      attendees: data.attendees || [],
      transcript,
      notes: {
        summary: hasTranscript ? '' : (data.memory || ''),
        actionItems: []
      },
      cards: [],
      grading: null
    });

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

  const activeCapture = workspaceView === 'live' && isStreaming;
  
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

  return (
    <div className={`app-shell ${activeCapture ? 'app-shell-active' : ''}`}>
      {activeCapture ? null : (
      <TitleBar
        isStreaming={isStreaming}
        onStartCapture={startCapture}
        entities={entities}
        mode={mode}
        onModeChange={chooseMode}
        onSettings={() => setSettingsOpen(true)}
        settings={settings}
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
      />
      )}

      <main className={`workspace ${workspaceView !== 'live' ? 'workspace-timeline' : ''} ${activeCapture ? 'workspace-active-capture' : ''}`}>
        {activeCapture ? (
          <ActiveCaptureView
            cards={filteredCards}
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
            captureProtectionEnabled={settings?.captureProtectionEnabled}
            liveLevels={liveLevels}
            transcript={transcript}
            onToggleCaptureProtection={toggleCaptureProtection}
          />
        ) : (
        <>
        <WorkspaceNav
            mode={mode}
            onViewChange={setWorkspaceView}
            nextUpcomingEvent={nextUpcomingEvent}
            onStartEvent={startCalendarEvent}
            view={workspaceView}
            onStartCapture={startCapture}
          />

        {workspaceView === 'timeline' ? (
          <TimelineView
              entities={entities}
              mode={mode}
              onStartCapture={startCapture}
              onRefresh={() => reloadSessions(mode, selectedEntity)}
            onAddNewOpportunity={() => setNewOpportunityOpen(true)}
            onAddNewMeeting={() => setNewMeetingOpen(true)}
            onEditEntity={(entity) => setEditEntityTarget(entity)}
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
            sessions={sessions}
            calendarEvents={calendarEvents}
          />
        ) : workspaceView === 'trends' ? (
          <TrendsView
            entities={entities}
            mode={mode}
            onSelectEntity={async (entityId) => {
              setSelectedEntity(entityId);
              const nextSessions = await api?.getSessions?.({ mode, entityId });
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
        ) : <>
            <StatusStrip
              health={health}
              isStreaming={isStreaming}
              mode={mode}
              provider={settings.llmProvider}
              status={status}
              
            />

          {setupOpen ? (
            <SetupPanel
              mode={mode}
              onClose={() => setSetupOpen(false)}
              onSave={saveSettings}
              onValidate={validateServices}
              serviceChecking={serviceChecking}
              settings={settings}
            />
          ) : null}

          <section className="context-full-width">
              <ContextPanel
                onStart={() => startCapture()}
                mode={mode}
                settings={settings}
                entities={entities}
                calendarEvents={calendarEvents}
              />
            </section>
        </>}
        </>
        )}
      </main>

      {settingsOpen ? (
          <SettingsDrawer
            mode={mode}
            onClose={() => setSettingsOpen(false)}
            onSave={saveSettings}
            onValidate={validateServices}
            serviceChecking={serviceChecking}
            settings={settings}
          />
        ) : null}

        {newOpportunityOpen && (
          <NewOpportunityModal 
            onClose={() => setNewOpportunityOpen(false)} 
            onSave={async (data) => {
              if (data.transcript && data.transcript.length > 0) {
                await api?.saveSession?.({
                  mode: 'interview',
                  entity: { id: data.company, name: data.company, role: data.role },
                  title: data.phase,
                  phase: data.phase,
                  date: fromDateTimeLocal(data.date),
                  transcript: data.transcript,
                  grading: { status: 'pending' }
                });
              } else {
                await api?.saveSession?.({
                  mode: 'interview',
                  entity: { id: data.company, name: data.company, role: data.role },
                  title: 'Opportunity created',
                  date: fromDateTimeLocal(data.date),
                  transcript: []
                });
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
            onClose={() => setPostSessionPromptOpen(false)}
            onSave={saveSessionFromPrompt}
            settings={settings}
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
            onClose={() => setManualTranscriptOpen(false)}
            onSave={async (data) => {
              await api?.saveSession?.({
                mode: 'interview',
                entity: manualTargetEntity,
                title: data.phase,
                phase: data.phase,
                date: fromDateTimeLocal(data.date),
                transcript: data.transcript,
                grading: { status: 'pending' }
              });
              setManualTranscriptOpen(false);
              reloadSessions('interview', manualTargetEntity.id);
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
              startCapture();
            }}
          />
        )}
    </div>
  );
}

function TitleBar({ isStreaming, onStartCapture, entities, mode, onModeChange, onSettings, settings, onToggleCaptureProtection,
  onMinimizeApp, onChangeActiveInterview, onChangeActiveMeeting, onAddNewOpportunity, onAddNewMeeting }) {
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
        <img src={logoUrl} alt="" className="brand-mark" />
      </div>

      <div className="title-center">
        <ModeToggle mode={mode} onChange={onModeChange} />
        <button
          className={`capture-protection-toggle ${captureProtectionEnabled ? 'enabled' : 'disabled'}`}
          type="button"
          onClick={onToggleCaptureProtection}
          aria-label={captureProtectionEnabled ? 'Disable screen capture protection' : 'Enable screen capture protection'}
          aria-pressed={captureProtectionEnabled}
          title={captureProtectionEnabled ? 'Screen capture protection enabled' : 'Screen capture protection disabled'}
        >
          <span className="ghost-emoji-icon" aria-hidden="true">👻</span>
        </button>
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

      <div className="title-actions title-icons">
        <button className="icon-button" type="button" onClick={onSettings} aria-label="Settings" title="Settings">
          <GearIcon />
        </button>
        <button className="icon-button" type="button" onClick={onMinimizeApp} aria-label="Minimize Clyde" title="Minimize Clyde">
          <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
            <path d="M6 12h12" />
          </svg>
        </button>
        <button className="icon-button" type="button" onClick={() => api?.maximizeAppWindow?.()} aria-label="Maximize Clyde" title="Maximize Clyde">
          <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
            <path d="M7 7h10v10H7z" />
          </svg>
        </button>
        <button className="icon-button close-button" type="button" onClick={() => api?.closeApp?.()} aria-label="Close app" title="Close app">
          X
        </button>
      </div>
    </header>
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

function WorkspaceNav({ mode, onViewChange, view, nextUpcomingEvent, onStartEvent }) {
  const timelineLabel = mode === 'interview' ? 'Timeline' : 'Memory';
  const timelineHint = mode === 'interview' ? 'Interviews' : 'Meetings';
  const nextEventLabel = resolveEventEntityLabel(nextUpcomingEvent);
  const tabs = [
    { id: 'live', eyebrow: 'Now', label: 'Assist' },
    { id: 'timeline', eyebrow: timelineHint, label: timelineLabel, testId: 'timelineNav' },
    ...(mode === 'interview' ? [{ id: 'trends', eyebrow: 'Analysis', label: 'Trends', testId: 'trendsNav' }] : []),
    { id: 'calendar', eyebrow: 'Schedule', label: 'Calendar', testId: 'calendarNav' }
  ];

  return (
    <nav className="workspace-nav" aria-label="Workspace view">
      <div className="workspace-nav-inner">
        <div className="view-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={view === tab.id ? 'view-tab active' : 'view-tab'}
              data-testid={tab.testId}
              type="button"
              aria-pressed={view === tab.id}
              onClick={() => onViewChange(tab.id)}
            >
              <span>{tab.eyebrow}</span>
              <strong>{tab.label}</strong>
            </button>
          ))}
        </div>

        <section className={nextUpcomingEvent ? 'workspace-nav-event' : 'workspace-nav-event workspace-nav-empty'} aria-label="Next upcoming event">
          {nextUpcomingEvent ? (
            <div className="workspace-nav-event-content">
              <div className="workspace-nav-event-copy">
                <span>Next up</span>
                <strong>{nextUpcomingEvent.title || 'Scheduled item'}</strong>
                {nextEventLabel ? <small>{nextEventLabel}</small> : null}
                <small>{formatEventDateTime(nextUpcomingEvent.date)}</small>
              </div>
              <button
                className="workspace-nav-start primary-action"
                type="button"
                onClick={() => onStartEvent?.(nextUpcomingEvent)}
              >
                Start
              </button>
            </div>
          ) : (
            <>
              <span>Next up</span>
              <strong>No upcoming events</strong>
              <small>Calendar is clear</small>
            </>
          )}
        </section>
      </div>
    </nav>
  );
}

function ModeToggle({ mode, onChange }) {
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
        onClick={() => onChange('meeting')}
      >
        Meeting
      </button>
    </div>
  );
}

function StatusStrip({ health, isStreaming, mode, provider, status }) {
  return (
    <div className="status-strip">
      <div className="status-line" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className={`pulse ${isStreaming ? 'live' : ''}`} />
              <strong>{status}</strong>
            </div>
            
          </div>
      <div className="status-pills">
        <span>{provider === 'local' ? 'Local LLM' : `${provider} cloud`}</span>
        <span>{mode === 'interview' ? 'Candidate context' : 'Long term memory'}</span>
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

function SetupPanel({ mode, onClose, onSave, onValidate, serviceChecking, settings }) {
  return (
    <section className="setup-panel">
      <div>
        <h2>First-run setup</h2>
        <p>Choose context, check providers, test audio, then start a live session.</p>
      </div>
      <SetupFields mode={mode} onSave={onSave} settings={settings} compact />
      <div className="setup-actions">
        <button type="button" onClick={onValidate} disabled={serviceChecking}>
          {serviceChecking ? 'Checking...' : 'Validate services'}
        </button>
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
  transcript
}) {
  const [prompt, setPrompt] = useState('');
  const [promptType, setPromptType] = useState(null);
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  const [includeScreenshot, setIncludeScreenshot] = useState(false);
  const [showMeters, setShowMeters] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);
  const panelRef = useRef(null);
  const controlBarDragRef = useRef({ moved: false });
  const suppressControlBarClickRef = useRef(false);
  const [sources, setSources] = useState(() => getDefaultActiveSources(settings, mode));

  useEffect(() => {
    setSources((current) => normalizeActiveSourcesForMode(current, settings, mode));
  }, [mode, settings?.ragEnabled]);

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
        const scrollContentBottom = Array.from(panel.querySelectorAll('[data-active-size-content]')).reduce((bottom, node) => {
          const rect = node.getBoundingClientRect();
          const availableHeight = Math.max(320, window.innerHeight - rect.top - 16);
          const visibleStackHeight = Math.min(node.scrollHeight, availableHeight);
          node.style.setProperty('--active-card-stack-max-height', `${availableHeight}px`);
          return Math.max(bottom, rect.top - panelRect.top + visibleStackHeight);
        }, 0);
        const contentHeight = Math.max(panel.scrollHeight, contentBounds.bottom, scrollContentBottom);
        const contentWidth = Math.max(panel.scrollWidth, contentBounds.right - contentBounds.left);
        const width = Math.ceil(Math.max(360, contentWidth + 20));
        const height = Math.ceil(Math.max(160, contentHeight + 12));

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
  }, [cards, hidden, includeScreenshot, isAsking, promptType, sourceMenuOpen, showMeters, showTranscript, transcript?.length]);

  async function submitAsk(event) {
    event?.preventDefault?.();
    const cleanPrompt = prompt.trim();
    const isCamera = promptType === 'camera';
    if (!cleanPrompt && !isCamera) return;
    setPrompt('');
    
    await onAsk({
      prompt: cleanPrompt,
      intent: isCamera ? 'screen_question' : 'custom_prompt',
      includeScreenshot: isCamera || includeScreenshot,
      sources: isCamera ? { resume: false, memory: false, rag: false, web: false } : sources,
      mode
    });
    setPromptType(null);
    setSourceMenuOpen(false);
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

  return (
    <section className={`active-capture-shell ${hidden ? 'active-capture-shell-minimized' : ''}`} aria-label="Active capture assistant">
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
        <div className="active-assistant-panel" ref={panelRef}>
          <div style={{ width: '100%', height: '24px', WebkitAppRegion: 'drag', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'grab', marginBottom: '-4px' }}>
            <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px' }} />
          </div>
          {sourceMenuOpen && promptType === 'custom' ? (
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
          {showMeters ? <ActiveGhostMeters liveLevels={liveLevels} /> : null}
          <div
            className="active-capture-bar"
            onClickCapture={handleControlBarClickCapture}
            onPointerDownCapture={handleControlBarPointerDown}
          >
            <button 
              type="button"
              className={`active-icon-btn ghost-toggle ${captureProtectionEnabled ? 'enabled' : 'disabled'}`}
              onClick={onToggleCaptureProtection}
              aria-label="Toggle Capture Protection"
              title="Toggle Capture Protection"
              style={{ filter: captureProtectionEnabled ? 'none' : 'grayscale(1) opacity(0.5)' }}
            >
              <span className="active-capture-icon ghost-emoji-icon" aria-hidden="true">👻</span>
            </button>
            <button type="button" className={`active-icon-btn camera-btn ${promptType === 'camera' ? 'active' : ''}`} onClick={() => { setPromptType(p => p === 'camera' ? null : 'camera'); setSourceMenuOpen(false); }} aria-label="Screenshot Prompt" title="Ask with Screenshot">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{width: "24px", height: "24px"}}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
            </button>
            <button type="button" className="active-icon-btn nudge-btn" onClick={handleNudge} aria-label="Nudge AI" title="What should I say next?">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{width: "24px", height: "24px"}}><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"></path><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"></path><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"></path><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"></path><path d="M22 10l-2 -2m0 6l2 -2" stroke="var(--amber)" strokeWidth="2"></path></svg>
            </button>
            <button type="button" className={`active-icon-btn custom-prompt-btn ${promptType === 'custom' ? 'active' : ''}`} onClick={() => { setPromptType(p => p === 'custom' ? null : 'custom'); setSourceMenuOpen(false); }} aria-label="Custom Prompt" title="Custom Prompt">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{width: "24px", height: "24px"}}><path d="M14 6l4 4"></path><path d="M5 21v-4L15.5 6.5a2.828 2.828 0 1 1 4 4L9 21H5z"></path><path d="M3 10h5M3 14h5" strokeDasharray="2 2"></path></svg>
            </button>
            <button type="button" className={`active-icon-btn transcript-toggle-btn ${showTranscript ? 'active' : ''}`} onClick={() => setShowTranscript((value) => !value)} aria-label={showTranscript ? 'Hide live transcription' : 'Show live transcription'} title={showTranscript ? 'Hide Live Transcription' : 'Show Live Transcription'}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16"></path><path d="M4 10h10"></path><path d="M4 15h16"></path><path d="M4 20h9"></path></svg>
            </button>
            <button type="button" className={`active-icon-btn meter-toggle-btn ${showMeters ? 'active' : ''}`} onClick={() => setShowMeters((value) => !value)} aria-label={showMeters ? 'Hide audio meters' : 'Show audio meters'} title={showMeters ? 'Hide audio meters' : 'Show audio meters'}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M5 17V9"></path>
                <path d="M10 17V5"></path>
                <path d="M15 17v-7"></path>
                <path d="M20 17V7"></path>
              </svg>
            </button>
            <button type="button" className="active-icon-btn reset-btn" onClick={() => { setPromptType(null); onReset(); }} aria-label="Reset session" title="Reset Session">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: '20px', height: '20px'}}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
            </button>
            <button type="button" className={`active-icon-btn pause-btn ${isPaused ? 'active' : ''}`} onClick={onPauseToggle} aria-label={isPaused ? 'Resume capture' : 'Pause capture'} title={isPaused ? 'Resume Capture' : 'Pause Capture'}>
              {isPaused ? (
                <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5v14l11-7z"></path></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect></svg>
              )}
            </button>
            <button type="button" data-testid="stopBtn" className="active-icon-btn stop-btn" onClick={() => { setPromptType(null); onStop(); }} aria-label="Stop capture" title="Stop Capture">
              <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2" ry="2"></rect></svg>
            </button>
            <button type="button" className="active-icon-btn minimize-btn" onClick={() => { setPromptType(null); setSourceMenuOpen(false); onHide(); }} aria-label="Minimize Clyde" title="Minimize Clyde">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M7 12h10"></path></svg>
            </button>
          </div>
          
          {promptType ? (
            <div style={{ position: 'relative' }}>
              <form className="active-ask-form" onSubmit={submitAsk}>
                <input
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder={promptType === 'camera' ? 'Ask about the screen...' : 'Type a custom prompt...'}
                  disabled={isAsking}
                  autoFocus
                />
                {promptType === 'custom' && (
                  <button type="button" className="active-icon-btn active-source-button" onClick={() => setSourceMenuOpen((value) => !value)} aria-label="Sources" title="Sources">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: '18px', height: '18px'}}>
                      <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                      <polyline points="2 12 12 17 22 12"></polyline>
                      <polyline points="2 17 12 22 22 17"></polyline>
                    </svg>
                  </button>
                )}
                <button type="submit" className="active-icon-btn active-send-button" disabled={isAsking || (!prompt.trim() && promptType !== 'camera')} aria-label="Send" title="Send">
                  {isAsking ? (
                     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spin-icon" style={{width: '18px', height: '18px'}}><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
                  ) : (
                     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: '18px', height: '18px'}}><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                  )}
                </button>
              </form>
            </div>
          ) : null}
          {showTranscript ? <ActiveTranscriptPanel transcript={transcript} /> : null}
          <AssistantCards cards={cards} variant="active" onDismissCard={onDismissCard} />
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

function AssistantCards({ cards, variant = 'default', onDismissCard }) {
  const active = variant === 'active';
  const identifiedQuestion = cards.find(c => c.question)?.question;

  return (
    <div className={active ? 'assistant-pane assistant-pane-active' : 'assistant-pane'}>
      {active ? null : <div className="pane-title">
        <h3>Live assistant</h3>
        <span>{cards.length} cards</span>
      </div>}
      <div className="scroll-area card-stack" data-active-size-content={active ? 'assistant-cards' : undefined}>
        {identifiedQuestion ? (
          <div className="card-identified-question">
            <strong>Question:</strong> {identifiedQuestion}
          </div>
        ) : null}
        {cards.length ? cards.map((card, index) => {
          const cardLabel = labelForCard(card.type);
          const cardTitle = String(card.title || '').trim();
          const showCardTitle = cardTitle && cardTitle.toLowerCase() !== cardLabel.toLowerCase();

          return (
            <article className={`assistant-card ${card.type || 'note'}`} key={card.id || `${card.title}-${index}`}>
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
              <div className="card-kicker">{cardLabel}</div>
              {showCardTitle ? <h4>{cardTitle}</h4> : null}
              {card.body ? <p>{card.body}</p> : null}
              {card.bullets?.length ? (
                <ul>
                  {card.bullets.map((bullet, bulletIndex) => <li key={`${bullet}-${bulletIndex}`}>{bullet}</li>)}
                </ul>
              ) : null}
              {card.detail ? <small>{card.detail}</small> : null}
            </article>
          );
        }) : active ? null : (
          <EmptyState
            title="No assistant cards yet"
            body="Clyde will add answers, recaps, risks, and follow-ups here."
          />
        )}
      </div>
    </div>
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

      if (mode !== 'interview' || normalized.length < 2) {
        setTrendAnalysis(null);
        return;
      }

      const sessionSignature = buildTrendAnalysisSessionSignature(normalized);
      const cacheKey = `trend-analysis-${activeId}`;
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (isTrendAnalysisRecordFresh(parsed, sessionSignature, normalized.length)) {
            setTrendAnalysis(unwrapTrendAnalysisRecord(parsed));
            return;
          }
        }
      } catch (error) {
        console.warn('Failed to parse trend analysis cache', error);
      }

      try {
        const stored = await api?.getTrendAnalysis?.(activeId);
        if (isTrendAnalysisRecordFresh(stored, sessionSignature, normalized.length)) {
          const nextAnalysis = unwrapTrendAnalysisRecord(stored);
          setTrendAnalysis(nextAnalysis);
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

          if (isTrendAnalysisComplete(generated, normalized.length)) {
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
  const hasPreCallPrep = Boolean(
    preCallPrep
    && ['cumulative_phase_summary', 'probable_focus', 'interviewer_question_patterns', 'questions_to_ask']
      .every((key) => Array.isArray(preCallPrep[key]) && preCallPrep[key].length === 3)
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
  const prepSessionTitle = nextInterviewEvent?.title || latestSession?.title || 'Next session';
  const interviewSummaryParsed = parseEvaluationText(interviewFallbackSummary);
  const meetingSummaryParsed = parseEvaluationText(latestSession?.notes?.summary || '');

  return (
    <aside className="context-panel">
      <div className="context-section">
        <h3>Pre-call prep</h3>

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

            {activeSessions.length >= 2 ? (
              <>
                {loadingTrend && !hasPreCallPrep ? (
                  <div className="suggestion-box">
                    <strong>Pre-call analysis</strong>
                    <p>Generating AI prep from the saved interviews...</p>
                  </div>
                ) : null}

                {hasPreCallPrep ? (
                  <>
                    <div className="suggestion-box">
                      <strong>Phase-by-Phase Breakdown</strong>
                      <ul className="action-list">
                        {preCallPrep.cumulative_phase_summary.map((item, index) => (
                          <li key={`${item}-${index}`}>{directAddressFeedback(item)}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="suggestion-box">
                      <strong>Probable focus for next round</strong>
                      <ul className="action-list">
                        {preCallPrep.probable_focus.map((item, index) => (
                          <li key={`${item}-${index}`}>{directAddressFeedback(item)}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="suggestion-box">
                      <strong>Previous interviewer question patterns</strong>
                      <ul className="action-list">
                        {preCallPrep.interviewer_question_patterns.map((item, index) => (
                          <li key={`${item}-${index}`}>{directAddressFeedback(item)}</li>
                        ))}
                      </ul>
                    </div>

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

function TimelineView({ entities, mode, onStartCapture, onRefresh, onAddNewOpportunity, onAddNewMeeting, onEditEntity, onEditSession, onSelectEntity, selectedEntity, sessions, settings, onChangeActiveInterview, onChangeActiveMeeting, calendarEvents }) {
  const selected = entities.find((entity) => entity.id === selectedEntity);
  const activeMeetingId = mode === 'meeting'
    ? entities.find((entity) => entity.id === settings?.meetingTitle || entity.name === settings?.meetingTitle)?.id || ''
    : '';
  const [hasJd, setHasJd] = useState(false);
  const [collapsedOutcomeSections, setCollapsedOutcomeSections] = useState({ rejected: false, offer: false });
  const [railWidth, setRailWidth] = useState(390);
  const api = window.electronAPI;
  const calibrationSummary = useOutcomeCalibrationSummary(api, mode, selected);
  const nowMs = useNowMs();
  const activeEntities = mode === 'interview'
    ? entities.filter((entity) => !isClosedOpportunityOutcome(entity.outcome))
    : entities;
  const rejectedEntities = mode === 'interview'
    ? entities.filter((entity) => normalizeOpportunityOutcome(entity.outcome) === 'rejected')
    : [];
  const offerEntities = mode === 'interview'
    ? entities.filter((entity) => normalizeOpportunityOutcome(entity.outcome) === 'offer')
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
          <h2>{mode === 'interview' ? 'Interview timeline' : 'Meeting memory'}</h2>
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
        <div className="entity-list">
          {entities.length ? (
            <>
              {activeEntities.length ? activeEntities.map(renderEntityRow) : (
                <EmptyState title="No active opportunities" body={mode === 'interview' ? 'Rejected and offer opportunities are grouped below.' : 'Save a session to build history.'} />
              )}
              {mode === 'interview' ? (
                <>
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
          <div>
            <h2>{selected?.name || 'Select a record'}</h2>
            <div className="timeline-title-meta">
              <p>{sessions.length} saved sessions</p>
              {mode === 'interview' && selected ? <OutcomeBadge outcome={selected.outcome} /> : null}
            </div>
            {mode === 'interview' && selected ? <OutcomeCalibrationNote summary={calibrationSummary} /> : null}
          </div>
          {selected && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button type="button" className="primary-action" onClick={() => window.dispatchEvent(new CustomEvent('open-calendar-modal', { detail: selected }))}>
                + Add Event
              </button>
              {mode === 'interview' && (
                <button type="button" onClick={() => onEditEntity(selected)}>
                  Edit details
                </button>
              )}
              <button type="button" onClick={handleDeleteEntity} style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer' }} title="Delete Entity">
                🗑️
              </button>
              {mode === 'interview' && (
                <>
              <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-jd-modal', { detail: selected }))}>
                {hasJd ? 'View Job Description' : 'Attach Job Description'}
              </button>
                  <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-manual-transcript-modal', { detail: selected }))}>
                    + Add Manual Transcript
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        
        {selected && entityEvents.length > 0 && (
          <div className="upcoming-events-section" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '20px', marginBottom: '20px', margin: '0 20px 20px 20px' }}>
            <h4 style={{ margin: '0 0 15px 0', color: 'var(--text)', fontWeight: 500 }}>Upcoming Events</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {entityEvents.map(evt => {
                const eventLabel = resolveEventEntityLabel(evt, entities);
                return (
                  <div key={evt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '10px 15px', borderRadius: '8px', borderLeft: `4px solid ${evt.color || 'var(--cyan)'}` }}>
                    <div>
                      <strong style={{ display: 'block', color: 'var(--text)', fontSize: '0.95rem' }}>{evt.title}</strong>
                      <span style={{ display: 'block', color: 'var(--muted)', fontSize: '0.78rem', marginTop: '2px' }}>{eventLabel}</span>
                      <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{new Date(evt.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </div>
                    <button type="button" className="primary-action" style={{ marginRight: '8px' }} onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('start-from-event', { detail: { entity: selected, evt } })); }}>Start</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
    </section>
  );
}

function SessionBlock({ session, onDelete, onEdit }) {
  const transcriptRating = getTranscriptRating(session.grading);

  return (
    <article className="session-block">
      <div className="session-head">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3>{session.title}</h3>
            {onDelete && (
              <button type="button" onClick={onDelete} style={{ padding: '2px 6px', fontSize: '0.8rem', background: 'transparent', border: 'none', cursor: 'pointer' }} title="Delete Session">
                🗑️
              </button>
            )}
            {onEdit && (
              <button type="button" onClick={onEdit} className="small-action">
                Edit
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
          ) : (
            <span className="grade-pill muted">{session.mode === 'interview' ? 'Transcript rating pending' : session.mode}</span>
          )}
        </div>
      </div>
      <EvaluationNotes
        mode={session.mode}
        summary={session.notes?.summary}
        examples={session.mode === 'interview' ? (session.grading?.examples || []) : (session.notes?.actionItems || [])}
      />
      <details>
        <summary>Transcript</summary>
        <div className="session-transcript">
          {session.transcript.map((turn, index) => (
            <p key={`${turn.speaker}-${index}`}>
              <strong>{turn.speaker}:</strong> {turn.text}
            </p>
          ))}
        </div>
      </details>
    </article>
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

function SettingsDrawer(props) {
  const { mode, onClose, onSave, onValidate, serviceChecking, settings } = props;

  return (
    <div className="drawer-backdrop">
      <section className="settings-drawer">
        <div className="drawer-head">
          <div>
            <h2>Settings</h2>
            <p>Provider keys are stored by the Electron main process.</p>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <SetupFields mode={mode} onSave={onSave} settings={settings} />
        <div className="drawer-actions">
          <button type="button" onClick={onValidate} disabled={serviceChecking}>
            {serviceChecking ? 'Checking...' : 'Validate services'}
          </button>
        </div>
      </section>
    </div>
  );
}

function SetupFields({ compact = false, mode, onSave, settings }) {
  const [draft, setDraft] = useState({ ...settings });
  const [activeTab, setActiveTab] = useState('context');

  useEffect(() => {
    setDraft({ ...settings });
  }, [settings]);

  useEffect(() => {
    applyUiOpacityToRoot(draft.uiOpacity);
  }, [draft.uiOpacity]);

  useEffect(() => {
    return () => {
      applyUiOpacityToRoot(settings.uiOpacity);
    };
  }, [settings.uiOpacity]);

  function update(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function renderLlmModelOptions() {
    const provider = draft.llmProvider || 'local';
    let options = [];
    if (provider === 'openai') {
      options = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini', 'o3-mini'];
    } else if (provider === 'anthropic') {
      options = ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'];
    } else if (provider === 'gemini') {
      options = ['gemini-3.1-flash-lite', 'gemini-3.1-pro-preview', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    }
    return options.map(opt => <option key={opt} value={opt} />);
  }

  return (
    <form className={`settings-form ${compact ? 'compact' : ''}`} onSubmit={(event) => {
      event.preventDefault();
      onSave(draft);
    }}>
      <div className="tabs" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <button type="button" className={activeTab === 'context' ? 'active' : ''} onClick={() => setActiveTab('context')}>Context</button>
        <button type="button" className={activeTab === 'llm' ? 'active' : ''} onClick={() => setActiveTab('llm')}>LLM</button>
        <button type="button" className={activeTab === 'transcription' ? 'active' : ''} onClick={() => setActiveTab('transcription')}>Speech</button>
      </div>

      {activeTab === 'context' && (
        <>
          <label className="wide-field" style={{ marginTop: '15px' }}>
            App opacity: {clampUiOpacity(draft.uiOpacity)}%
            <input
              type="range"
              min="35"
              max="200"
              step="1"
              value={clampUiOpacity(draft.uiOpacity)}
              onChange={(event) => update('uiOpacity', Number(event.target.value))}
            />
            <small style={{ color: 'var(--muted)' }}>Left is more translucent. Right is fully opaque.</small>
          </label>
          <label className="wide-field" style={{ marginTop: '15px' }}>
            {mode === 'interview' ? 'Resume / background' : 'Long term memory'}
            <textarea
              style={{ minHeight: '120px' }}
              value={mode === 'interview' ? (draft.resumeText || '') : (draft.meetingMemory || '')}
              onChange={(event) => update(mode === 'interview' ? 'resumeText' : 'meetingMemory', event.target.value)}
              placeholder={mode === 'interview' ? 'Paste resume facts, metrics, and projects.' : 'Persistent context Clyde should use across all meetings.'}
            />
          </label>
          <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid var(--line)' }}>
            <label className="toggle-row" style={{ marginBottom: draft.ragEnabled ? '10px' : '0' }}>
              <input
                type="checkbox"
                checked={Boolean(draft.ragEnabled)}
                onChange={(event) => update('ragEnabled', event.target.checked)}
              />
              Enable Advanced RAG (Pinecone)
            </label>
            {draft.ragEnabled && (
              <div className="form-grid">
                <label>
                  Pinecone API Key
                  <input autoComplete="new-password" type="password" value={draft.pineconeApiKey || ''} onChange={(event) => update('pineconeApiKey', event.target.value)} placeholder="Stored locally" />
                </label>
                <label>
                  Pinecone Host URL
                  <input value={draft.pineconeHost || ''} onChange={(event) => update('pineconeHost', event.target.value)} placeholder="e.g. https://index.pinecone.io" />
                </label>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'llm' && (
        <div className="form-grid">
          <label>
            LLM provider
            <select value={draft.llmProvider || 'local'} onChange={(event) => {
              update('llmProvider', event.target.value);
              // auto-default model
              if (event.target.value === 'openai') update('llmModel', 'gpt-4o');
              if (event.target.value === 'anthropic') update('llmModel', 'claude-3-7-sonnet-20250219');
              if (event.target.value === 'gemini') update('llmModel', 'gemini-3.1-flash-lite');
              if (event.target.value === 'local') update('llmModel', '');
            }}>
              <option value="local">Local LM Studio</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="gemini">Google Gemini</option>
            </select>
          </label>
          <label>
            Model
            <input list="llmModelList" value={draft.llmModel || ''} onChange={(event) => update('llmModel', event.target.value)} placeholder="Model identifier" />
            <datalist id="llmModelList">{renderLlmModelOptions()}</datalist>
          </label>
          {draft.llmProvider !== 'local' && (
            <label>
              API key
              <input autoComplete="new-password" type="password" value={draft.llmApiKey || ''} onChange={(event) => update('llmApiKey', event.target.value)} placeholder="Stored locally" />
            </label>
          )}
          {draft.llmProvider === 'local' && (
            <label>
              Local LLM URL
              <input value={draft.localLlmUrl || ''} onChange={(event) => update('localLlmUrl', event.target.value)} placeholder="http://localhost:1234/v1/chat/completions" />
            </label>
          )}
        </div>
      )}

      {activeTab === 'transcription' && (
        <div className="form-grid">
          <label>
            Transcription provider
            <select value={draft.transcriptionProvider || 'local'} onChange={(event) => update('transcriptionProvider', event.target.value)}>
              <option value="local">Local Whisper</option>
              <option value="openai">OpenAI Whisper</option>
            </select>
          </label>
          {draft.transcriptionProvider === 'local' ? (
            <label>
              Transcription URL
              <input value={draft.localTranscriptionUrl || ''} onChange={(event) => update('localTranscriptionUrl', event.target.value)} placeholder="http://localhost:8000/v1/audio/transcriptions" />
            </label>
          ) : (
            <label>
              OpenAI API Key
              <input autoComplete="new-password" type="password" value={draft.transcriptionApiKey || ''} onChange={(event) => update('transcriptionApiKey', event.target.value)} placeholder="Stored locally" />
            </label>
          )}
        </div>
      )}

      <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <button type="submit" data-testid="saveBtn" className="primary-action">Save setup</button>
      </div>
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
    speakerColor: turn.speakerColor || ''
  };

  if (!normalized.text) {
    return current;
  }

  const last = current[current.length - 1];
  if (last && last.speaker === normalized.speaker) {
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
    detail: card.detail || card.why || ''
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

function prependAssistantCards(cards = [], currentCards = [], replaceCardId = '') {
  const nextCards = cards.map(normalizeCardForRender);
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
    note: 'Note'
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

export default App;
