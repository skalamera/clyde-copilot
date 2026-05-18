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
    'setAudioDevices'
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
});
