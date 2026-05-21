const { getTranscriptRating } = require('./trendAnalysis');
const { sanitizeId } = require('./sessionManager');

const POSITIVE_OUTCOMES = new Set(['advanced', 'offer']);
const TERMINAL_OUTCOMES = new Set(['advanced', 'rejected', 'offer']);

function buildOutcomeCalibrationExamples({
  sessionManager,
  currentEntityId = '',
  role = '',
  limit = 4
} = {}) {
  if (!sessionManager || typeof sessionManager.getSessionEntities !== 'function' || typeof sessionManager.getSessions !== 'function') {
    return [];
  }

  const currentId = currentEntityId ? sanitizeId(currentEntityId) : '';
  const max = Math.max(0, Number(limit) || 0);
  if (max === 0) {
    return [];
  }

  const entities = sessionManager.getSessionEntities('interview');
  const candidates = entities
    .filter((entity) => entity && entity.id !== currentId && TERMINAL_OUTCOMES.has(entity.outcome))
    .map((entity) => buildCalibrationCandidate(sessionManager, entity, role))
    .filter(Boolean);

  const rejected = candidates.filter((example) => example.outcome === 'rejected').sort(compareExamples);
  const positive = candidates.filter((example) => POSITIVE_OUTCOMES.has(example.outcome)).sort(compareExamples);
  const selected = [];

  if (rejected.length) {
    selected.push(rejected.shift());
  }

  if (selected.length < max && positive.length) {
    selected.push(positive.shift());
  }

  const selectedIds = new Set(selected.map((example) => example.entityId));
  const remaining = [...rejected, ...positive]
    .filter((example) => !selectedIds.has(example.entityId))
    .sort(compareExamples);

  for (const example of remaining) {
    if (selected.length >= max) {
      break;
    }
    selected.push(example);
  }

  return selected.slice(0, max);
}

function buildCalibrationCandidate(sessionManager, entity, currentRole) {
  const sessions = sessionManager.getSessions({ mode: 'interview', entityId: entity.id })
    .filter((session) => Array.isArray(session.transcript) && session.transcript.length);

  if (!sessions.length) {
    return null;
  }

  const chronological = [...sessions].sort((a, b) => new Date(a.date) - new Date(b.date));
  const transcriptRatings = chronological
    .map((session) => getTranscriptRating(session.grading))
    .filter((rating) => rating !== null);
  const evidence = buildEvidenceSnippets(chronological);

  return {
    entityId: entity.id,
    company: entity.name || entity.id,
    role: entity.role || '',
    outcome: entity.outcome,
    outcomeReason: entity.outcomeReason || '',
    outcomeDate: entity.outcomeDate || '',
    transcriptCount: sessions.length,
    phases: chronological.map((session) => session.phase || session.title || 'Interview'),
    transcriptRatings,
    evidence,
    roleScore: scoreTextOverlap(currentRole, entity.role || ''),
    recencyMs: getOutcomeTime(entity, chronological)
  };
}

function buildEvidenceSnippets(sessions) {
  const snippets = [];

  for (const session of sessions.slice(-2)) {
    const candidateTurns = session.transcript
      .filter((turn) => /^you$/i.test(String(turn.speaker || '')))
      .map((turn) => cleanText(turn.text))
      .filter(Boolean);

    for (const turn of candidateTurns) {
      snippets.push(truncateText(turn, 220));
      if (snippets.length >= 3) {
        return snippets;
      }
    }
  }

  for (const session of sessions.slice(-2)) {
    for (const turn of session.transcript) {
      const text = cleanText(turn.text);
      if (text) {
        snippets.push(truncateText(`${turn.speaker || 'Unknown'}: ${text}`, 220));
      }
      if (snippets.length >= 3) {
        return snippets;
      }
    }
  }

  return snippets;
}

function formatOutcomeCalibrationExamples(examples = []) {
  const list = Array.isArray(examples) ? examples.filter(Boolean) : [];
  if (!list.length) {
    return '';
  }

  const lines = ['Real outcome calibration examples:'];
  list.forEach((example, index) => {
    const ratings = example.transcriptRatings && example.transcriptRatings.length
      ? example.transcriptRatings.join(', ')
      : 'none';
    const phases = example.phases && example.phases.length
      ? example.phases.join(' > ')
      : 'unknown';
    const evidence = example.evidence && example.evidence.length
      ? example.evidence.join(' | ')
      : 'No transcript excerpt available.';

    lines.push(`${index + 1}. ${example.company} (${example.role || 'role not set'})`);
    lines.push(`Outcome: ${example.outcome}${example.outcomeReason ? `, reason: ${example.outcomeReason}` : ''}`);
    lines.push(`Phases: ${phases}`);
    lines.push(`Transcript ratings: ${ratings}`);
    lines.push(`Transcript evidence: ${evidence}`);
  });

  return lines.join('\n');
}

function summarizeOutcomeCalibrationExamples(examples = []) {
  const list = Array.isArray(examples) ? examples.filter(Boolean) : [];
  const summary = {
    total: list.length,
    rejected: 0,
    advanced: 0,
    offer: 0,
    positive: 0
  };

  for (const example of list) {
    if (example.outcome === 'rejected') {
      summary.rejected += 1;
    } else if (example.outcome === 'advanced') {
      summary.advanced += 1;
      summary.positive += 1;
    } else if (example.outcome === 'offer') {
      summary.offer += 1;
      summary.positive += 1;
    }
  }

  return summary;
}

function compareExamples(left, right) {
  if (right.roleScore !== left.roleScore) {
    return right.roleScore - left.roleScore;
  }
  if (right.recencyMs !== left.recencyMs) {
    return right.recencyMs - left.recencyMs;
  }
  return left.company.localeCompare(right.company);
}

function getOutcomeTime(entity, sessions) {
  const outcomeDate = Date.parse(entity.outcomeDate || entity.outcomeUpdatedAt || '');
  if (Number.isFinite(outcomeDate)) {
    return outcomeDate;
  }

  const lastSession = [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const sessionTime = Date.parse(lastSession?.date || '');
  return Number.isFinite(sessionTime) ? sessionTime : 0;
}

function scoreTextOverlap(left, right) {
  const leftTerms = new Set(tokenize(left));
  const rightTerms = new Set(tokenize(right));
  if (!leftTerms.size || !rightTerms.size) {
    return 0;
  }

  let matches = 0;
  for (const term of leftTerms) {
    if (rightTerms.has(term)) {
      matches += 1;
    }
  }

  return matches / Math.max(leftTerms.size, rightTerms.size);
}

function tokenize(value) {
  return cleanText(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((term) => term.length > 2);
}

function truncateText(value, maxLength) {
  const text = cleanText(value);
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3).trim()}...`;
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

module.exports = {
  buildOutcomeCalibrationExamples,
  formatOutcomeCalibrationExamples,
  summarizeOutcomeCalibrationExamples
};
