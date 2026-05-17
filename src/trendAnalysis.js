const GRADE_SCORES = {
  'A+': 98,
  A: 95,
  'A-': 92,
  'B+': 88,
  B: 85,
  'B-': 82,
  'C+': 78,
  C: 75,
  'C-': 72,
  'D+': 68,
  D: 64,
  'D-': 60,
  F: 50
};

function normalizeTrendAnalysisResult(analysis, sessions = []) {
  const source = analysis && typeof analysis === 'object' ? analysis : {};
  const { confidence_scores: _removedConfidenceScores, ...sourceWithoutConfidenceScores } = source;
  const orderedSessions = Array.isArray(sessions) ? sessions : [];
  const sessionMeta = orderedSessions.map((session, index) => {
    const phase = cleanText(session?.phase || session?.title || `Interview ${index + 1}`) || `Interview ${index + 1}`;
    return {
      index,
      phase,
      key: normalizeKey(phase),
      session
    };
  });

  const phaseBreakdown = alignTrendItems(
    Array.isArray(source.phase_breakdown) ? source.phase_breakdown : [],
    sessionMeta,
    (item) => normalizeKey(item?.phase),
    (item, meta) => ({
      phase: meta.phase,
      observation: cleanText(item?.observation) || buildFallbackObservation(meta.session)
    }),
    (meta) => ({
      phase: meta.phase,
      observation: buildFallbackObservation(meta.session)
    })
  );
  const preCallPrep = normalizePreCallPrep(source.pre_call_prep, phaseBreakdown);

  return {
    ...sourceWithoutConfidenceScores,
    phase_breakdown: phaseBreakdown,
    pre_call_prep: preCallPrep,
    key_strengths: Array.isArray(source.key_strengths) ? source.key_strengths : [],
    areas_for_improvement: Array.isArray(source.areas_for_improvement) ? source.areas_for_improvement : []
  };
}

function buildTrendAnalysisSessionSignature(sessions = []) {
  return (Array.isArray(sessions) ? sessions : [])
    .map((session, index) => {
      const transcript = Array.isArray(session?.transcript) ? session.transcript : [];
      const transcriptText = transcript
        .map((turn) => `${cleanText(turn?.speaker || 'Unknown')}:${cleanText(turn?.text || '')}`)
        .join('|');
      const phase = cleanText(session?.phase || session?.title || '');
      const rating = getTranscriptRating(session?.grading);
      const transcriptScore = cleanText(session?.grading?.transcriptScore ?? session?.grading?.transcript_score ?? '');
      const grade = cleanText(session?.grading?.grade || '');
      const status = cleanText(session?.grading?.status || '');

      return [
        cleanText(session?.id || `session-${index}`),
        cleanText(session?.entity?.id || ''),
        cleanText(session?.entity?.name || ''),
        cleanText(session?.entity?.role || ''),
        phase,
        cleanText(session?.date || ''),
        status,
        rating === null ? '' : String(rating),
        transcriptScore,
        grade,
        transcriptText
      ].join('::');
    })
    .join('||');
}

function isTrendAnalysisComplete(analysis, sessionCount) {
  if (!analysis || !Number.isInteger(sessionCount) || sessionCount < 2) {
    return false;
  }

  return Array.isArray(analysis.phase_breakdown) && analysis.phase_breakdown.length === sessionCount
    && typeof analysis.trend === 'string'
    && typeof analysis.executive_summary === 'string'
    && Array.isArray(analysis.key_strengths)
    && Array.isArray(analysis.areas_for_improvement)
    && isPreCallPrepComplete(analysis.pre_call_prep);
}

function normalizePreCallPrep(prep, phaseBreakdown = []) {
  const source = prep && typeof prep === 'object' ? prep : {};
  return {
    cumulative_phase_summary: normalizeBulletList(
      source.cumulative_phase_summary,
      buildFallbackPreCallBullets('cumulative_phase_summary', phaseBreakdown)
    ),
    probable_focus: normalizeBulletList(
      source.probable_focus,
      buildFallbackPreCallBullets('probable_focus', phaseBreakdown)
    ),
    interviewer_question_patterns: normalizeBulletList(
      source.interviewer_question_patterns,
      buildFallbackPreCallBullets('interviewer_question_patterns', phaseBreakdown)
    ),
    questions_to_ask: normalizeBulletList(
      source.questions_to_ask,
      buildFallbackPreCallBullets('questions_to_ask', phaseBreakdown)
    )
  };
}

function normalizeBulletList(items, fallback) {
  const cleaned = (Array.isArray(items) ? items : [])
    .map(cleanText)
    .filter(Boolean)
    .slice(0, 3);
  const fallbackItems = (Array.isArray(fallback) ? fallback : [])
    .map(cleanText)
    .filter(Boolean);

  for (const item of fallbackItems) {
    if (cleaned.length >= 3) {
      break;
    }
    cleaned.push(item);
  }

  while (cleaned.length < 3) {
    cleaned.push('No AI prep detail available yet.');
  }

  return cleaned.slice(0, 3);
}

function buildFallbackPreCallBullets(key, phaseBreakdown = []) {
  const recentObservation = cleanText(phaseBreakdown[phaseBreakdown.length - 1]?.observation || '');
  const summary = recentObservation || 'Prior interviews do not have enough saved analysis yet.';

  if (key === 'cumulative_phase_summary') {
    return [
      `Across the saved phases: ${summary}`,
      'Current standing needs a fresh AI analysis before it can be stated with confidence.',
      'Use the saved transcript ratings and interview summaries as the temporary source of truth.'
    ];
  }

  if (key === 'probable_focus') {
    return [
      'Expect follow-up on the strongest and weakest themes from the latest saved interview.',
      'Prepare concrete examples that connect prior answers to the role requirements.',
      'Be ready to clarify any vague, incomplete, or inconsistent points from earlier rounds.'
    ];
  }

  if (key === 'interviewer_question_patterns') {
    return [
      'Prior question patterns need a fresh AI analysis before reliable themes can be listed.',
      'Review the latest interviewer questions for repeated emphasis across technical, role-fit, and execution topics.',
      'Separate actual repeated themes from one-off questions before planning answers.'
    ];
  }

  return [
    'What are the biggest concerns from the previous round that I should address directly?',
    'Which outcomes would make the next phase successful for this role?',
    'Where should I go deeper based on the team needs you have heard so far?'
  ];
}

function isPreCallPrepComplete(prep) {
  if (!prep || typeof prep !== 'object') {
    return false;
  }

  return [
    prep.cumulative_phase_summary,
    prep.probable_focus,
    prep.interviewer_question_patterns,
    prep.questions_to_ask
  ].every((items) => Array.isArray(items) && items.length === 3 && items.every((item) => cleanText(item)));
}

function alignTrendItems(items, sessionMeta, getKey, buildItem, buildFallback) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const usedIndexes = new Set();
  const aligned = Array.from({ length: sessionMeta.length }, () => null);

  for (const meta of sessionMeta) {
    let matchIndex = normalizedItems.findIndex((item, index) => !usedIndexes.has(index) && getKey(item) && getKey(item) === meta.key);

    if (matchIndex !== -1) {
      usedIndexes.add(matchIndex);
      aligned[meta.index] = buildItem(normalizedItems[matchIndex], meta);
    }
  }

  let nextItemIndex = 0;
  for (const meta of sessionMeta) {
    if (aligned[meta.index]) {
      continue;
    }

    while (nextItemIndex < normalizedItems.length && usedIndexes.has(nextItemIndex)) {
      nextItemIndex += 1;
    }

    if (nextItemIndex < normalizedItems.length) {
      usedIndexes.add(nextItemIndex);
      aligned[meta.index] = buildItem(normalizedItems[nextItemIndex], meta);
      nextItemIndex += 1;
    } else {
      aligned[meta.index] = buildFallback(meta);
    }
  }

  return aligned;
}

function buildFallbackObservation(session) {
  const reasoning = cleanText(session?.grading?.reasoning || '');
  if (reasoning) {
    const firstSentence = reasoning.match(/[^.!?]+[.!?]?/);
    return cleanText(firstSentence ? firstSentence[0] : reasoning);
  }

  const summary = cleanText(session?.notes?.summary || '');
  if (summary) {
    const firstSentence = summary.match(/[^.!?]+[.!?]?/);
    return cleanText(firstSentence ? firstSentence[0] : summary);
  }

  const rating = getTranscriptRating(session?.grading);
  if (rating !== null) {
    return `Transcript rated ${rating} out of 5 stars.`;
  }

  const grade = cleanText(session?.grading?.grade || '');
  if (grade) {
    return `Session graded ${grade}.`;
  }

  return 'No phase analysis available for this session yet.';
}

function cleanText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function clampScore(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function getGradePercentage(grade) {
  const normalized = cleanText(grade).toUpperCase();
  if (normalized && Object.prototype.hasOwnProperty.call(GRADE_SCORES, normalized)) {
    return GRADE_SCORES[normalized];
  }

  return 0;
}

function normalizeTranscriptRating(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(5, Math.round(parsed)));
}

function getTranscriptRating(grading) {
  const gradeInfo = grading && typeof grading === 'object' ? grading : null;
  if (!gradeInfo) {
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(gradeInfo, 'transcriptRating')) {
    return normalizeTranscriptRating(gradeInfo.transcriptRating);
  }

  if (Object.prototype.hasOwnProperty.call(gradeInfo, 'transcript_rating')) {
    return normalizeTranscriptRating(gradeInfo.transcript_rating);
  }

  if (Object.prototype.hasOwnProperty.call(gradeInfo, 'transcriptScore')) {
    return normalizeTranscriptRating(Number(gradeInfo.transcriptScore) / 20);
  }

  if (Object.prototype.hasOwnProperty.call(gradeInfo, 'transcript_score')) {
    return normalizeTranscriptRating(Number(gradeInfo.transcript_score) / 20);
  }

  const gradePercent = getGradePercentage(gradeInfo.grade);
  if (gradePercent > 0) {
    return normalizeTranscriptRating(gradePercent / 20);
  }

  return null;
}

module.exports = {
  buildTrendAnalysisSessionSignature,
  getTranscriptRating,
  isTrendAnalysisComplete,
  getGradePercentage,
  normalizeTranscriptRating,
  normalizePreCallPrep,
  normalizeTrendAnalysisResult
};
