const assert = require('node:assert/strict');
const test = require('node:test');

function loadConfidenceScoring() {
  try {
    return require('../src/confidenceScoring');
  } catch (error) {
    return {};
  }
}

const { calculateEntityConfidence } = loadConfidenceScoring();

function session(id, rating, date = `2026-05-${10 + Number(id)}T12:00:00.000Z`) {
  return {
    id: String(id),
    date,
    title: `Interview ${id}`,
    mode: 'interview',
    transcript: [{ speaker: 'A', text: 'Saved transcript text.' }],
    grading: {
      status: 'complete',
      transcriptRating: rating
    }
  };
}

test('confidence score is deterministic for the saved session ratings', () => {
  assert.equal(typeof calculateEntityConfidence, 'function');

  const apollo = calculateEntityConfidence([session(1, 5), session(2, 4)], {
    outcome: 'advanced'
  });
  const curbWaste = calculateEntityConfidence([
    session(1, 3),
    session(2, 4),
    session(3, 4),
    session(4, 4)
  ], {
    outcome: 'advanced'
  });

  assert.deepEqual(apollo, { confidence_score: 86, trend: 'down' });
  assert.deepEqual(curbWaste, { confidence_score: 80, trend: 'up' });
});

test('adding and removing a weak session changes the confidence score predictably', () => {
  assert.equal(typeof calculateEntityConfidence, 'function');

  const baselineSessions = [session(1, 5), session(2, 4)];
  const baseline = calculateEntityConfidence(baselineSessions, { outcome: 'advanced' });
  const withWeakTranscript = calculateEntityConfidence([
    ...baselineSessions,
    session(3, 1)
  ], {
    outcome: 'advanced'
  });
  const afterRemoval = calculateEntityConfidence(baselineSessions, { outcome: 'advanced' });

  assert.equal(baseline.confidence_score, 86);
  assert.equal(withWeakTranscript.confidence_score, 52);
  assert.equal(withWeakTranscript.trend, 'down');
  assert.deepEqual(afterRemoval, baseline);
});

test('confidence is reset when there are no scorable sessions', () => {
  assert.equal(typeof calculateEntityConfidence, 'function');

  assert.deepEqual(calculateEntityConfidence([], { outcome: 'active' }), {
    confidence_score: 0,
    trend: 'neutral'
  });
});
