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

export function buildTrendAnalysisSessionSignature(sessions = []) {
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

export function isTrendAnalysisComplete(analysis, sessionCount) {
  if (!analysis || !Number.isInteger(sessionCount) || sessionCount < 1) {
    return false;
  }

  return Array.isArray(analysis.phase_breakdown) && analysis.phase_breakdown.length === sessionCount
    && typeof analysis.trend === 'string'
    && typeof analysis.executive_summary === 'string'
    && Array.isArray(analysis.key_strengths)
    && Array.isArray(analysis.areas_for_improvement)
    && isPreCallPrepComplete(analysis.pre_call_prep);
}

export function isMaterialPreCallPrepComplete(analysis) {
  if (!analysis || typeof analysis !== 'object') {
    return false;
  }

  return analysis.prep_basis === 'materials'
    && isPreCallPrepComplete(analysis.pre_call_prep)
    && Array.isArray(analysis.pre_call_prep.gaps_and_mitigation)
    && analysis.pre_call_prep.gaps_and_mitigation.length === 3
    && analysis.pre_call_prep.gaps_and_mitigation.every((item) => cleanText(item));
}

export function getTranscriptRating(grading) {
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

function normalizeTranscriptRating(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(5, Math.round(parsed)));
}

function getGradePercentage(grade) {
  const normalized = cleanText(grade).toUpperCase();
  if (normalized && Object.prototype.hasOwnProperty.call(GRADE_SCORES, normalized)) {
    return GRADE_SCORES[normalized];
  }

  return 0;
}

function cleanText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}
