const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildTrendAnalysisSessionSignature,
  directAddressFeedback,
  getTranscriptRating,
  isMaterialPreCallPrepComplete,
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

test('trend analysis complete accepts one saved session', () => {
  const sessions = [
    { id: '1', phase: 'Interview #1', grading: { transcriptRating: 4 }, transcript: [{ speaker: 'Interviewer', text: 'Tell me about support operations.' }] }
  ];

  const normalized = normalizeTrendAnalysisResult({
    trend: 'sideways',
    executive_summary: 'Baseline summary',
    key_strengths: ['Clear support examples'],
    areas_for_improvement: ['Add more metrics'],
    phase_breakdown: [
      { phase: 'Interview #1', observation: 'You gave a clear baseline answer.' }
    ],
    pre_call_prep: {
      cumulative_phase_summary: ['One', 'Two', 'Three'],
      probable_focus: ['Focus one', 'Focus two', 'Focus three'],
      interviewer_question_patterns: ['Pattern one', 'Pattern two', 'Pattern three'],
      questions_to_ask: ['Question one?', 'Question two?', 'Question three?']
    }
  }, sessions);

  assert.equal(isTrendAnalysisComplete(normalized, 1), true);
});

test('material pre-call prep is complete without saved interviews', () => {
  const analysis = {
    prep_basis: 'materials',
    pre_call_prep: {
      cumulative_phase_summary: ['Role priority', 'Evaluation criteria', 'Prep insight'],
      probable_focus: ['Question one', 'Question two', 'Question three'],
      interviewer_question_patterns: ['Strength one', 'Strength two', 'Strength three'],
      questions_to_ask: ['Question one?', 'Question two?', 'Question three?'],
      gaps_and_mitigation: ['Gap one and mitigation', 'Gap two and mitigation', 'Gap three and mitigation']
    }
  };

  assert.equal(isMaterialPreCallPrepComplete(analysis), true);
  assert.equal(isTrendAnalysisComplete(analysis, 0), false);
});

test('trend analysis and pre-call prep address the user directly', () => {
  const normalized = normalizeTrendAnalysisResult({
    trend: 'sideways',
    executive_summary: 'The candidate demonstrates strong support judgment.',
    key_strengths: ['The candidate gave concrete examples.'],
    areas_for_improvement: ['His answer on automation needs more substance.'],
    phase_breakdown: [
      { phase: 'Interview #1', observation: 'The candidate was clear. He showed useful context.' }
    ],
    pre_call_prep: {
      cumulative_phase_summary: ['The candidate has strong examples.', 'He should quantify the work.', 'His next answer should be tighter.'],
      probable_focus: ['The interviewer may test whether the candidate owns outcomes.', 'He should prepare metrics.', 'His team examples need scope.'],
      interviewer_question_patterns: ['They asked how the candidate leads teams.', 'They tested his technical depth.', 'They asked whether he owns tooling.'],
      questions_to_ask: ['What should the candidate clarify?', 'Where should he go deeper?', 'How will his success be measured?']
    }
  }, [
    { id: '1', phase: 'Interview #1', grading: { transcriptRating: 4 }, transcript: [{ speaker: 'You', text: 'I led support tooling.' }] }
  ]);

  const allText = [
    normalized.executive_summary,
    ...normalized.key_strengths,
    ...normalized.areas_for_improvement,
    ...normalized.phase_breakdown.map((item) => item.observation),
    ...Object.values(normalized.pre_call_prep).flat()
  ].join(' ');

  assert.equal(allText.includes('The candidate'), false);
  assert.equal(allText.includes('the candidate'), false);
  assert.equal(/\bHe\b|\bhe\b|\bHis\b|\bhis\b/.test(allText), false);
  assert.match(allText, /You demonstrate/);
  assert.match(allText, /[Yy]our answer/);
});

test('direct address feedback rewrites common third-person candidate phrasing', () => {
  assert.equal(
    directAddressFeedback('The candidate is strong. He showed that his team can execute.'),
    'You are strong. You showed that your team can execute.'
  );
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
  assert.doesNotMatch(mainSource, /sortedSessions\.length < 2/);
  assert.match(mainSource, /sortedSessions\.length < 1/);
  assert.match(mainSource, /persistedAnalysis\.analysis/);
  assert.match(mainSource, /return persistedAnalysis\.analysis;/);
});
