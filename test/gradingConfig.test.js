const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.join(__dirname, '..');

function sourceBetween(source, startMarker, endMarker) {
  const afterStart = source.split(startMarker)[1] || '';
  return endMarker ? afterStart.split(endMarker)[0] : afterStart;
}

test('interview grading leaves enough response budget for written evaluation', () => {
  const mainSource = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const gradingBlock = sourceBetween(
    mainSource,
    'async function processSessionGradingInBackground',
    'async function processSessionConfidenceInBackground'
  );
  const maxTokensMatch = gradingBlock.match(/maxTokens:\s*(\d+)/);

  assert.ok(maxTokensMatch, 'grading maxTokens is configured');
  assert.equal(Number(maxTokensMatch[1]), 3000);
  assert.match(gradingBlock, /transcript_rating/);
  assert.match(gradingBlock, /minimum:\s*0/);
  assert.match(gradingBlock, /maximum:\s*5/);
  assert.match(gradingBlock, /transcriptRating:\s*normalizeTranscriptRating/);
  assert.equal(gradingBlock.includes("grade: gradeData.grade"), false);
  assert.match(mainSource, /Write a detailed evaluation in exactly 4 short professional sections/);
  assert.match(mainSource, /Use concrete details from the transcript/);
  assert.match(mainSource, /Do not write a generic one-paragraph summary/);
  assert.match(mainSource, /Address the user directly as "you"/);
  assert.match(mainSource, /Do not call the user "the candidate"/);
  assert.match(mainSource, /reasoning: directAddressFeedback/);
});

test('interview saves clean transcript text before grading', () => {
  const mainSource = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');

  assert.match(mainSource, /processTranscriptCleanupInBackground/);
  assert.match(mainSource, /normalizeCleanedTranscriptResponse/);
  assert.match(mainSource, /name: 'transcript_cleanup'/);
  assert.match(mainSource, /record\.grading\.status === 'pending' && hasTranscript/);
});

test('trend analysis generation no longer requests per-interview confidence scores', () => {
  const mainSource = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const trendBlock = sourceBetween(mainSource, "ipcMain.handle('generate-trend-analysis'");

  assert.equal(trendBlock.includes('confidence_scores'), false);
  assert.equal(trendBlock.includes('confidence score (0-100) for EACH phase'), false);
  assert.match(trendBlock, /forceRegenerate/);
  assert.match(trendBlock, /!forceRegenerate\s*&&\s*persistedAnalysis/);
  assert.match(trendBlock, /phase-by-phase observation/);
  assert.match(trendBlock, /pre_call_prep/);
  assert.match(trendBlock, /cumulative_phase_summary/);
  assert.match(trendBlock, /probable_focus/);
  assert.match(trendBlock, /interviewer_question_patterns/);
  assert.match(trendBlock, /questions_to_ask/);
  assert.match(trendBlock, /exactly 3 detailed bullets/i);
  assert.match(trendBlock, /patterns\/themes/i);
  assert.match(trendBlock, /Address the user directly as "you"/);
  assert.match(trendBlock, /Do not call the user "the candidate"/);
  assert.match(trendBlock, /baseline interview performance from one saved interview session/);
  assert.match(trendBlock, /Return exactly 1 phase breakdown entry/);
  assert.match(trendBlock, /required:\s*\['trend', 'executive_summary', 'key_strengths', 'areas_for_improvement', 'phase_breakdown', 'pre_call_prep'\]/);
});

test('interview saves and deletes invalidate trend analysis and recompute overall confidence', () => {
  const mainSource = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const saveBlock = mainSource.split("ipcMain.handle('save-session'")[1].split("async function processInterviewCleanupAndGradingInBackground")[0];
  const deleteBlock = mainSource.split("ipcMain.handle('delete-session'")[1].split("ipcMain.handle('delete-session-entity'")[0];

  assert.match(saveBlock, /deleteTrendAnalysis\(app\.getPath\('userData'\), record\.entity\.id\)/);
  assert.match(saveBlock, /processSessionConfidenceInBackground\(record\.entity, loadSettings\(\)\)/);
  assert.match(deleteBlock, /deleteTrendAnalysis\(app\.getPath\('userData'\), nextPayload\.entityId\)/);
  assert.match(deleteBlock, /processSessionConfidenceInBackground\(remaining\[0\]\.entity, loadSettings\(\)\)/);
  assert.match(deleteBlock, /sessionManager\.updateEntityConfidence\(nextPayload\.entityId, 0, 'neutral'\)/);
});

test('confidence changes notify the renderer to reload session data', () => {
  const mainSource = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const saveBlock = mainSource.split("ipcMain.handle('save-session'")[1].split("async function processInterviewCleanupAndGradingInBackground")[0];
  const deleteBlock = mainSource.split("ipcMain.handle('delete-session'")[1].split("ipcMain.handle('delete-session-entity'")[0];
  const confidenceBlock = sourceBetween(
    mainSource,
    'async function processSessionConfidenceInBackground',
    "ipcMain.handle('delete-session'"
  );

  assert.match(mainSource, /function sendSessionDataChanged/);
  assert.match(mainSource, /mainWindow\.webContents\.send\('session-data-changed', change\)/);
  assert.match(saveBlock, /sendSessionDataChanged\(\{\s*mode: 'interview',\s*entityId: record\.entity\.id,\s*reason: 'session-saved'\s*\}\)/);
  assert.match(deleteBlock, /sendSessionDataChanged\(\{\s*mode: 'interview',\s*entityId: nextPayload\.entityId,\s*reason: 'session-deleted'\s*\}\)/);
  assert.match(deleteBlock, /sendSessionDataChanged\(\{\s*mode: 'interview',\s*entityId: nextPayload\.entityId,\s*reason: 'confidence-reset'\s*\}\)/);
  assert.match(confidenceBlock, /sendSessionDataChanged\(\{\s*mode: 'interview',\s*entityId: entity\.id,\s*reason: 'confidence-updated'\s*\}\)/);
});

test('interview entity lists refresh deterministic confidence before returning', () => {
  const mainSource = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const refreshBlock = sourceBetween(
    mainSource,
    'function refreshInterviewEntityConfidences',
    "ipcMain.handle('get-outcome-calibration-summary'"
  );
  const entitiesBlock = sourceBetween(
    mainSource,
    "ipcMain.handle('get-session-entities'",
    "ipcMain.handle('get-outcome-calibration-summary'"
  );

  assert.match(refreshBlock, /calculateEntityConfidence\(sessions, entity\)/);
  assert.match(refreshBlock, /sessionManager\.updateEntityConfidence\(entity\.id, confidence\.confidence_score, confidence\.trend\)/);
  assert.match(entitiesBlock, /refreshInterviewEntityConfidences\(\)/);
});

test('confidence recompute uses deterministic session ratings', () => {
  const mainSource = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const confidenceBlock = sourceBetween(
    mainSource,
    'async function processSessionConfidenceInBackground',
    "ipcMain.handle('delete-session'"
  );

  assert.match(mainSource, /calculateEntityConfidence/);
  assert.match(confidenceBlock, /const confidence = calculateEntityConfidence\(allSessions, entity\)/);
  assert.match(confidenceBlock, /sessionManager\.updateEntityConfidence\(entity\.id, confidence\.confidence_score, confidence\.trend\)/);
  assert.equal(confidenceBlock.includes("name: 'confidence'"), false);
  assert.equal(confidenceBlock.includes('combinedSessionEvidence'), false);
  assert.equal(confidenceBlock.includes('generateChat'), false);
});

test('interview grading and trend prompts use outcome calibration examples', () => {
  const mainSource = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const gradingBlock = sourceBetween(
    mainSource,
    'async function processSessionGradingInBackground',
    'async function processSessionConfidenceInBackground'
  );
  const confidenceBlock = sourceBetween(
    mainSource,
    'async function processSessionConfidenceInBackground',
    "ipcMain.handle('delete-session'"
  );
  const trendBlock = sourceBetween(mainSource, "ipcMain.handle('generate-trend-analysis'");
  const updateBlock = sourceBetween(mainSource, "ipcMain.handle('update-session-entity'");

  assert.match(mainSource, /buildOutcomeCalibrationExamples/);
  assert.match(mainSource, /formatOutcomeCalibrationExamples/);
  assert.match(mainSource, /summarizeOutcomeCalibrationExamples/);
  assert.match(mainSource, /ipcMain\.handle\('get-outcome-calibration-summary'/);
  assert.match(gradingBlock, /Real outcome calibration examples/);
  assert.match(trendBlock, /Real outcome calibration examples/);
  assert.equal(confidenceBlock.includes('Real outcome calibration examples'), false);
  assert.match(updateBlock, /patch\.outcome !== undefined\s*\|\|\s*patch\.role !== undefined\s*\|\|\s*patch\.name !== undefined/);
  assert.match(updateBlock, /processSessionConfidenceInBackground\(nextEntity, loadSettings\(\)\)/);
});
