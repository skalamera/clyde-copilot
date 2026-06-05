const { getTranscriptRating } = require('./trendAnalysis');

const RATING_SCORES = {
  0: 5,
  1: 20,
  2: 38,
  3: 56,
  4: 78,
  5: 92
};

function clampConfidenceScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeOutcome(value) {
  const outcome = String(value || '').trim().toLowerCase();
  return ['active', 'advanced', 'applied', 'offer', 'rejected'].includes(outcome) ? outcome : 'active';
}

function getSessionTime(session, fallbackIndex) {
  const time = new Date(session?.date || 0).getTime();
  return Number.isFinite(time) ? time : fallbackIndex;
}

function getScoredSessions(sessions = []) {
  return (Array.isArray(sessions) ? sessions : [])
    .map((session, originalIndex) => ({
      session,
      originalIndex,
      rating: getTranscriptRating(session?.grading)
    }))
    .filter((item) => item.rating !== null)
    .sort((a, b) => {
      const timeDiff = getSessionTime(a.session, a.originalIndex) - getSessionTime(b.session, b.originalIndex);
      return timeDiff || a.originalIndex - b.originalIndex;
    });
}

function calculateTrend(ratings) {
  if (!Array.isArray(ratings) || ratings.length < 2) {
    return 'neutral';
  }

  const first = ratings[0];
  const latest = ratings[ratings.length - 1];
  const previous = ratings[ratings.length - 2];
  const latestChange = latest - previous;
  const totalChange = latest - first;

  if (latestChange <= -0.75 || totalChange <= -1.25) {
    return 'down';
  }

  if (latestChange >= 0.75 || (totalChange >= 0.75 && latestChange >= -0.25)) {
    return 'up';
  }

  return 'neutral';
}

function calculateWeightedRatingScore(ratings) {
  let weightedScore = 0;
  let totalWeight = 0;

  ratings.forEach((rating, index) => {
    const weight = 1 + index * 0.35;
    weightedScore += RATING_SCORES[rating] * weight;
    totalWeight += weight;
  });

  return totalWeight > 0 ? weightedScore / totalWeight : 0;
}

function applyOutcomeScore(score, outcome) {
  if (outcome === 'offer') {
    return Math.max(score, 96);
  }

  if (outcome === 'rejected') {
    return Math.min(score, 25);
  }

  if (outcome === 'advanced' && score >= 50) {
    return score + 2;
  }

  return score;
}

function calculateEntityConfidence(sessions = [], entity = {}) {
  const scoredSessions = getScoredSessions(sessions);
  if (scoredSessions.length === 0) {
    return { confidence_score: 0, trend: 'neutral' };
  }

  const ratings = scoredSessions.map((item) => item.rating);
  const trend = calculateTrend(ratings);
  const spread = Math.max(...ratings) - Math.min(...ratings);
  let score = calculateWeightedRatingScore(ratings);

  if (trend === 'up') {
    score += 4;
  } else if (trend === 'down') {
    score -= 3;
  }

  if (ratings.length >= 2 && ratings.every((rating) => rating >= 4)) {
    score += 3;
  }

  if (spread >= 3) {
    score -= 4;
  }

  score = applyOutcomeScore(score, normalizeOutcome(entity?.outcome));

  return {
    confidence_score: clampConfidenceScore(score),
    trend
  };
}

module.exports = {
  calculateEntityConfidence,
  clampConfidenceScore
};
