const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('preload exposes mode-aware session APIs', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'preload.js'), 'utf8');

  for (const api of [
    'getSessions',
    'saveSession',
    'deleteSession',
    'deleteSessionEntity',
    'updateSessionEntity',
    'getOutcomeCalibrationSummary',
    'generateTrendAnalysis',
    'setActiveSessionContext',
    'validateServices',
    'minimizeAppWindow',
    'maximizeAppWindow',
    'hideApp',
    'resizeActiveCaptureWindow',
    'getAppWindowBounds',
    'moveAppWindow',
    'togglePauseCapture',
    'getActiveCaptureWindowBounds',
    'moveActiveCaptureWindow',
    'listAudioDevices',
    'setAudioDevices',
    'onSessionDataChanged',
    'getTierStatus',
    'listKnowledge',
    'ingestKnowledgeFile',
    'deleteKnowledgeItem',
    'setPinnedKnowledge',
    'getPinnedKnowledge',
    'openKnowledgeFileDialog'
    ,'openEntityFileDialog'
    ,'listEntityFiles'
    ,'removeEntityFile'
    ,'startAgentChat'
    ,'sendAgentChatMessage'
    ,'confirmAgentAction'
    ,'listAgentSources'
    ,'loadFloatingAgentPrefs'
    ,'saveFloatingAgentPrefs'
    ,'listCalendarEvents'
    ,'saveCalendarEvent'
    ,'deleteCalendarEvent'
    ,'importCalendarEvents'
    ,'connectGoogleSync'
    ,'disconnectGoogleSync'
    ,'getGoogleSyncStatus'
    ,'scanGoogleSync'
    ,'listSyncProposals'
    ,'approveSyncProposal'
    ,'dismissSyncProposal'
    ,'listSyncAuditLog'
  ]) {
    assert.match(source, new RegExp(`${api}:`));
  }

  assert.match(source, /requestSuggestion:\s*\(payload\)\s*=>\s*ipcRenderer\.invoke\('request-suggestion', payload\)/);
  assert.match(source, /getOutcomeCalibrationSummary:\s*\(entity\)\s*=>\s*ipcRenderer\.invoke\('get-outcome-calibration-summary', entity\)/);
  assert.match(source, /generateTrendAnalysis:\s*\(companyId,\s*options\)\s*=>\s*ipcRenderer\.invoke\('generate-trend-analysis', companyId, options\)/);
  assert.match(source, /hideApp:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('hide-app'\)/);
  assert.match(source, /minimizeAppWindow:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('minimize-app-window'\)/);
  assert.match(source, /maximizeAppWindow:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('maximize-app-window'\)/);
  assert.match(source, /getAppWindowBounds:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('get-app-window-bounds'\)/);
  assert.match(source, /moveAppWindow:\s*\(bounds\)\s*=>\s*ipcRenderer\.invoke\('move-app-window', bounds\)/);
  assert.match(source, /resizeActiveCaptureWindow:\s*\(bounds\)\s*=>\s*ipcRenderer\.invoke\('resize-active-capture-window', bounds\)/);
  assert.match(source, /togglePauseCapture:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('toggle-pause-capture'\)/);
  assert.match(source, /getActiveCaptureWindowBounds:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('get-active-capture-window-bounds'\)/);
  assert.match(source, /moveActiveCaptureWindow:\s*\(bounds\)\s*=>\s*ipcRenderer\.invoke\('move-active-capture-window', bounds\)/);
  assert.match(source, /listAudioDevices:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('list-audio-devices'\)/);
  assert.match(source, /setAudioDevices:\s*\(devices\)\s*=>\s*ipcRenderer\.invoke\('set-audio-devices', devices\)/);
  assert.match(source, /getTierStatus:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('get-tier-status'\)/);
  assert.match(source, /listKnowledge:\s*\(filters\)\s*=>\s*ipcRenderer\.invoke\('list-knowledge', filters\)/);
  assert.match(source, /ingestKnowledgeFile:\s*\(filePath\)\s*=>\s*ipcRenderer\.invoke\('ingest-knowledge-file', filePath\)/);
  assert.match(source, /openKnowledgeFileDialog:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('open-knowledge-file-dialog'\)/);
  assert.match(source, /openEntityFileDialog:\s*\(context\)\s*=>\s*ipcRenderer\.invoke\('open-entity-file-dialog', context\)/);
  assert.match(source, /connectGoogleSync:\s*\(payload\)\s*=>\s*ipcRenderer\.invoke\('connect-google-sync', payload\)/);
  assert.match(source, /sendAgentChatMessage:\s*\(payload\)\s*=>\s*ipcRenderer\.invoke\('send-agent-chat-message', payload\)/);
  assert.match(source, /confirmAgentAction:\s*\(payload\)\s*=>\s*ipcRenderer\.invoke\('confirm-agent-action', payload\)/);
  assert.match(source, /listCalendarEvents:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('list-calendar-events'\)/);
  assert.match(source, /onSessionDataChanged:\s*\(callback\)\s*=>\s*\{/);
  assert.match(source, /ipcRenderer\.on\('session-data-changed', callback\)/);
  assert.match(source, /ipcRenderer\.off\('session-data-changed', callback\)/);
});
