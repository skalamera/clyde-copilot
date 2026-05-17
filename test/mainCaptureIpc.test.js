const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.join(__dirname, '..');

test('main process request-suggestion forwards prompt and screenshot options', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');

  assert.match(source, /desktopCapturer/);
  assert.match(source, /async function captureDesktopScreenshot/);
  assert.match(source, /ipcMain\.handle\('request-suggestion', async \(event, payload = \{\}\)/);
  assert.match(source, /includeScreenshot/);
  assert.match(source, /getMeetingAssistant\(\)\.requestSuggestion\(\{\s*prompt:/);
  assert.match(source, /screenshot/);
  assert.match(source, /sources: payload && payload\.sources/);
});

test('main process exposes hide-app handler', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');

  assert.match(source, /ipcMain\.handle\('hide-app'/);
  assert.match(source, /mainWindow\.hide\(\)/);
  assert.match(source, /mainWindow\.minimize\(\)/);
});

test('main process requests resizing on start-audio-capture', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');

  assert.match(source, /function enterActiveCaptureWindow/);
  assert.match(source, /normalBounds = currentBounds/);
  assert.match(source, /mainWindow\.setBounds\(nextBounds\)/);
  assert.match(source, /mainWindow\.setHasShadow\(false\)/);
  assert.match(source, /ACTIVE_CAPTURE_DEFAULT_WIDTH = 460/);
  assert.match(source, /screen\.getDisplayMatching\(currentBounds\)/);
  assert.match(source, /saveActiveCaptureBounds\(mainWindow\.getBounds\(\)\)/);
});

test('main process restores window bounds on stop-audio-capture', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');

  assert.match(source, /function restoreNormalWindowBounds/);
  assert.match(source, /if \(normalBounds\)/);
  assert.match(source, /mainWindow\.setBounds\(normalBounds\)/);
  assert.match(source, /mainWindow\.setHasShadow\(true\)/);
  assert.match(source, /normalBounds = null/);
});

test('reset-session keeps active state', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');

  assert.match(source, /const state = audioCaptures \? 'capturing' : 'idle'/);
  assert.match(source, /sendAudioStatus\(\{ state, message: 'Session reset\.' \}\)/);
});

test('active capture window can shrink to rendered content height', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');

  assert.match(source, /const ACTIVE_CAPTURE_MIN_HEIGHT = 72/);
  assert.match(source, /const ACTIVE_CAPTURE_FULL_MIN_HEIGHT = 160/);
  assert.match(source, /const ACTIVE_CAPTURE_MINIMIZED_SIZE = 112/);
  assert.match(source, /const ACTIVE_CAPTURE_MINIMIZED_MARGIN = 10/);
  assert.match(source, /let activeCaptureMinimized = false/);
  assert.match(source, /function resizeActiveCaptureWindowToContent\(size = \{\}\)/);
  assert.match(source, /if \(!activeCaptureWindow \|\| !mainWindow \|\| mainWindow\.isDestroyed\(\)\)/);
  assert.match(source, /ipcMain\.handle\('resize-active-capture-window', async \(event, bounds = \{\}\)/);
  assert.match(source, /minimized\s*\?\s*ACTIVE_CAPTURE_MINIMIZED_SIZE/);
  assert.match(source, /mainWindow\.setMinimumSize\(minSize, minSize\)/);
  assert.match(source, /mainWindow\.setResizable\(!minimized\)/);
  assert.match(source, /workArea\.x \+ ACTIVE_CAPTURE_MINIMIZED_MARGIN/);
  assert.match(source, /workArea\.y \+ workArea\.height - nextHeight - ACTIVE_CAPTURE_MINIMIZED_MARGIN/);
  assert.match(source, /mainWindow\.setBounds\(nextBounds\)/);
  assert.match(source, /!activeCaptureMinimized && !suppressActiveBoundsSave/);
  assert.match(source, /ipcMain\.handle\('get-active-capture-window-bounds'/);
  assert.match(source, /ipcMain\.handle\('move-active-capture-window'/);
  assert.match(source, /activeCaptureMinimized \? ACTIVE_CAPTURE_MINIMIZED_SIZE : currentBounds\.width/);
  assert.match(source, /screen\.getDisplayNearestPoint\(targetPoint\)/);
});

test('main process toggles capture pause without stopping the session', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');

  assert.match(source, /let capturePaused = false/);
  assert.match(source, /ipcMain\.handle\('toggle-pause-capture'/);
  assert.match(source, /capturePaused = !capturePaused/);
  assert.match(source, /capture\.pause\(\)/);
  assert.match(source, /capture\.resume\(\)/);
  assert.match(source, /state: capturePaused \? 'paused' : 'capturing'/);
});
