const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildTrendAnalysisSessionSignature,
  getTranscriptRating,
  isTrendAnalysisComplete,
  normalizeTrendAnalysisResult
} = require('../src/trendAnalysis');
const {
  deleteTrendAnalysis,
  loadTrendAnalysis,
  renameTrendAnalysis,
  saveTrendAnalysis
} = require('../src/trendAnalysisStore');

test('trend analysis normalization fills missing session entries in order', () => {
  const sessions = [
    { id: '1', phase: 'Interview #1', grading: { transcriptRating: 4 }, transcript: [{ speaker: 'A', text: 'One' }] },
    { id: '2', phase: 'Interview #2', grading: { transcriptRating: 5 }, transcript: [{ speaker: 'A', text: 'Two' }] },
    { id: '3', phase: 'Interview #3', grading: { transcriptRating: 3 }, transcript: [{ speaker: 'A', text: 'Three' }] },
    { id: '4', phase: 'Interview #4', grading: { transcriptRating: 4 }, transcript: [{ speaker: 'A', text: 'Four' }] }
  ];

  const partial = {
    trend: 'up',
    executive_summary: 'Summary',
    key_strengths: ['Strong'],
    areas_for_improvement: ['Sharper'],
    phase_breakdown: [
      { phase: 'Interview 1', observation: 'First' },
      { phase: 'Interview 2', observation: 'Second' },
      { phase: 'Interview 4', observation: 'Fourth' }
    ]
  };

  const normalized = normalizeTrendAnalysisResult(partial, sessions);

  assert.equal(Object.prototype.hasOwnProperty.call(normalized, 'confidence_scores'), false);
  assert.equal(normalized.phase_breakdown.length, 4);
  assert.equal(normalized.phase_breakdown[2].phase, 'Interview #3');
  assert.equal(normalized.phase_breakdown[2].observation, 'Transcript rated 3 out of 5 stars.');
  assert.equal(isTrendAnalysisComplete(normalized, sessions.length), true);
});

test('trend analysis normalizes saved pre-call prep into 3 bullets per section', () => {
  const sessions = [
    { id: '1', phase: 'Interview #1', grading: { transcriptRating: 4 }, transcript: [{ speaker: 'Interviewer', text: 'Tell me about support tooling.' }] },
    { id: '2', phase: 'Interview #2', grading: { transcriptRating: 5 }, transcript: [{ speaker: 'Interviewer', text: 'How did you handle escalations?' }] }
  ];

  const normalized = normalizeTrendAnalysisResult({
    trend: 'up',
    executive_summary: 'Summary',
    key_strengths: ['Strong'],
    areas_for_improvement: ['Sharper'],
    phase_breakdown: [
      { phase: 'Interview #1', observation: 'First' },
      { phase: 'Interview #2', observation: 'Second' }
    ],
    pre_call_prep: {
      cumulative_phase_summary: ['One', 'Two', 'Three', 'Four'],
      probable_focus: ['Focus one', 'Focus two', 'Focus three'],
      interviewer_question_patterns: ['Pattern one', 'Pattern two', 'Pattern three'],
      questions_to_ask: ['Question one?', 'Question two?', 'Question three?']
    }
  }, sessions);

  assert.deepEqual(normalized.pre_call_prep.cumulative_phase_summary, ['One', 'Two', 'Three']);
  assert.equal(normalized.pre_call_prep.probable_focus.length, 3);
  assert.equal(normalized.pre_call_prep.interviewer_question_patterns.length, 3);
  assert.equal(normalized.pre_call_prep.questions_to_ask.length, 3);
  assert.equal(isTrendAnalysisComplete(normalized, sessions.length), true);
});

test('transcript ratings normalize new and legacy grading formats', () => {
  assert.equal(getTranscriptRating({ transcriptRating: 4 }), 4);
  assert.equal(getTranscriptRating({ transcriptRating: 8 }), 5);
  assert.equal(getTranscriptRating({ transcriptRating: -2 }), 0);
  assert.equal(getTranscriptRating({ transcriptScore: 85 }), 4);
  assert.equal(getTranscriptRating({ grade: 'A-' }), 5);
  assert.equal(getTranscriptRating({ grade: 'F' }), 3);
  assert.equal(getTranscriptRating(null), null);
});

test('trend analysis session signatures change when transcript content changes', () => {
  const before = buildTrendAnalysisSessionSignature([
    { id: '1', phase: 'Interview #1', transcript: [{ speaker: 'You', text: 'Hello' }] }
  ]);

  const after = buildTrendAnalysisSessionSignature([
    { id: '1', phase: 'Interview #1', transcript: [{ speaker: 'You', text: 'Hello there' }] }
  ]);

  assert.notEqual(before, after);
});

test('trend analysis store saves, loads, renames, and deletes records', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clyde-trend-analysis-'));

  try {
    const saved = saveTrendAnalysis(tempDir, 'curbwaste', {
      sessionsCount: 4,
      sessionsSignature: 'sig-1',
      analysis: { trend: 'up', phase_breakdown: [] }
    });

    assert.equal(saved.companyId, 'curbwaste');
    assert.equal(loadTrendAnalysis(tempDir, 'curbwaste').analysis.trend, 'up');
    assert.equal(renameTrendAnalysis(tempDir, 'curbwaste', 'curbwaste-renamed'), true);
    assert.equal(loadTrendAnalysis(tempDir, 'curbwaste'), null);
    assert.equal(loadTrendAnalysis(tempDir, 'curbwaste-renamed').analysis.trend, 'up');
    assert.equal(deleteTrendAnalysis(tempDir, 'curbwaste-renamed'), true);
    assert.equal(loadTrendAnalysis(tempDir, 'curbwaste-renamed'), null);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('main process reuses persisted trend analysis when the signature matches', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

  assert.match(mainSource, /loadTrendAnalysis\(app\.getPath\('userData'\), companyId\)/);
  assert.match(mainSource, /isTrendAnalysisComplete\(persistedAnalysis\.analysis, sortedSessions\.length\)/);
  assert.match(mainSource, /return persistedAnalysis\.analysis;/);
});
