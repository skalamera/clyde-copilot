const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const AUDIO_ENGINE_SAMPLE_RATE = 48000;
const AUDIO_ENGINE_EXECUTABLE = process.platform === 'win32'
  ? 'clyde-audio-engine.exe'
  : 'clyde-audio-engine';

const AUDIO_ENGINE_SOURCES = {
  you: {
    id: 'you',
    label: 'You',
    color: '#8fff5f',
    sampleRate: AUDIO_ENGINE_SAMPLE_RATE
  },
  others: {
    id: 'others',
    label: 'System Audio',
    color: '#89c2ff',
    sampleRate: AUDIO_ENGINE_SAMPLE_RATE
  }
};

function resolveAudioEnginePath(options = {}) {
  const resourcesPath = options.resourcesPath || process.resourcesPath;
  const appPath = options.appPath || path.join(__dirname, '..');
  const pathExists = options.pathExists || fs.existsSync;
  const candidates = [
    resourcesPath ? path.join(resourcesPath, AUDIO_ENGINE_EXECUTABLE) : '',
    path.join(appPath, 'native', 'audio-engine', 'target', 'release', AUDIO_ENGINE_EXECUTABLE),
    path.join(appPath, 'native', 'audio-engine', 'target', 'debug', AUDIO_ENGINE_EXECUTABLE)
  ].filter(Boolean);

  return candidates.find((candidate) => pathExists(candidate)) || candidates[0] || '';
}

function createAudioEngineSidecar(options = {}) {
  const enginePath = options.enginePath || resolveAudioEnginePath(options);
  const spawnImpl = options.spawn || spawn;
  const logger = options.logger || console;
  const onEvent = options.onEvent || (() => {});
  const onAudioChunk = options.onAudioChunk || (() => {});
  const onLevel = options.onLevel || (() => {});
  const onStatus = options.onStatus || (() => {});
  const onError = options.onError || (() => {});

  let child = null;
  let stdoutBuffer = '';
  let closing = false;
  let pendingDeviceRequests = [];

  function start() {
    if (child) {
      return { ok: true, pid: child.pid };
    }

    if (!enginePath) {
      const message = 'Rust audio engine path could not be resolved.';
      onStatus({ state: 'error', message });
      return { ok: false, message };
    }

    try {
      closing = false;
      child = spawnImpl(enginePath, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });
    } catch (error) {
      const message = `Rust audio engine failed to launch: ${error.message}`;
      onStatus({ state: 'error', message });
      onError(error);
      return { ok: false, message, error };
    }

    if (child.stdout && typeof child.stdout.on === 'function') {
      child.stdout.on('data', handleStdoutData);
    }

    if (child.stderr && typeof child.stderr.on === 'function') {
      child.stderr.on('data', (data) => {
        const message = String(data || '').trim();
        if (message) {
          logger.warn(`Rust audio engine: ${message}`);
        }
      });
    }

    child.on('error', (error) => {
      const message = `Rust audio engine failed: ${error.message}`;
      onStatus({ state: 'error', message });
      rejectPendingDeviceRequests(error);
      onError(error);
    });

    child.on('close', (code) => {
      const wasClosing = closing;
      child = null;
      stdoutBuffer = '';
      rejectPendingDeviceRequests(new Error(`Rust audio engine exited with code ${code}.`));
      onStatus({
        state: wasClosing ? 'idle' : 'error',
        message: wasClosing ? 'Rust audio engine stopped.' : `Rust audio engine exited with code ${code}.`
      });
    });

    return { ok: true, pid: child.pid };
  }

  function sendCommand(command) {
    const started = start();
    if (!started.ok) {
      return started;
    }

    if (!child || !child.stdin || child.stdin.destroyed) {
      return { ok: false, message: 'Rust audio engine stdin is unavailable.' };
    }

    child.stdin.write(`${JSON.stringify(command)}\n`);
    return { ok: true };
  }

  function listDevices(options = {}) {
    const timeoutMs = Number(options.timeoutMs || 3000);

    return new Promise((resolve, reject) => {
      let request;
      const timeout = setTimeout(() => {
        pendingDeviceRequests = pendingDeviceRequests.filter((item) => item !== request);
        reject(new Error('Rust audio engine device list timed out.'));
      }, timeoutMs);

      request = {
        resolve: (devices) => {
          clearTimeout(timeout);
          resolve(devices);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      };
      pendingDeviceRequests.push(request);

      const result = sendCommand({ type: 'list_devices' });
      if (!result.ok) {
        clearTimeout(timeout);
        pendingDeviceRequests = pendingDeviceRequests.filter((item) => item !== request);
        reject(new Error(result.message));
      }
    });
  }

  function startCapture(devices = {}) {
    return sendCommand({
      type: 'start_capture',
      microphoneDeviceId: devices.microphoneDeviceId || '',
      systemAudioDeviceId: devices.systemAudioDeviceId || ''
    });
  }

  function pause() {
    return sendCommand({ type: 'pause' });
  }

  function resume() {
    return sendCommand({ type: 'resume' });
  }

  function stop() {
    return sendCommand({ type: 'stop' });
  }

  function shutdown() {
    if (!child) {
      return { ok: true };
    }

    closing = true;
    const processToClose = child;
    sendCommand({ type: 'shutdown' });

    if (processToClose.stdin && typeof processToClose.stdin.end === 'function') {
      processToClose.stdin.end();
    }

    const killTimer = setTimeout(() => {
      if (child === processToClose && typeof processToClose.kill === 'function') {
        processToClose.kill();
      }
    }, 1000);
    if (typeof killTimer.unref === 'function') {
      killTimer.unref();
    }

    return { ok: true };
  }

  function isRunning() {
    return Boolean(child);
  }

  function handleStdoutData(data) {
    stdoutBuffer += String(data || '');
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() || '';

    for (const line of lines) {
      handleLine(line);
    }
  }

  function handleLine(line) {
    const text = String(line || '').trim();
    if (!text) {
      return;
    }

    let event;
    try {
      event = JSON.parse(text);
    } catch (error) {
      logger.warn(`Rust audio engine emitted invalid JSON: ${text}`);
      return;
    }

    onEvent(event);

    if (event.type === 'device_list') {
      resolvePendingDeviceRequests(normalizeAudioDeviceList(event));
      return;
    }

    if (event.type === 'audio_chunk') {
      const chunk = Buffer.from(event.pcmBase64 || '', 'base64');
      if (!chunk.length) {
        return;
      }

      const sampleRate = Number(event.sampleRate) || AUDIO_ENGINE_SAMPLE_RATE;
      onAudioChunk({
        ...event,
        source: getSourceForAudioEngineEvent({ ...event, sampleRate }),
        chunk,
        sampleRate,
        channels: Number(event.channels) || 1,
        rms: Number(event.rms) || 0
      });
      return;
    }

    if (event.type === 'level') {
      onLevel({
        ...event,
        source: getSourceForAudioEngineEvent(event),
        rms: Number(event.rms) || 0,
        peak: Number(event.peak) || 0
      });
      return;
    }

    if (event.type === 'status') {
      onStatus({
        state: event.state || 'capturing',
        message: event.message || 'Rust audio engine status update.'
      });
      return;
    }

    if (event.type === 'error') {
      const error = new Error(event.message || 'Rust audio engine error.');
      onStatus({ state: 'error', message: error.message });
      onError(error);
    }
  }

  function resolvePendingDeviceRequests(devices) {
    const requests = pendingDeviceRequests;
    pendingDeviceRequests = [];
    for (const request of requests) {
      request.resolve(devices);
    }
  }

  function rejectPendingDeviceRequests(error) {
    const requests = pendingDeviceRequests;
    pendingDeviceRequests = [];
    for (const request of requests) {
      request.reject(error);
    }
  }

  return {
    start,
    listDevices,
    startCapture,
    pause,
    resume,
    stop,
    shutdown,
    close: shutdown,
    isRunning,
    sendCommand
  };
}

function normalizeAudioDeviceList(event = {}) {
  return {
    type: 'device_list',
    defaultMicrophoneId: event.defaultMicrophoneId || event.default_microphone_id || '',
    defaultSystemAudioId: event.defaultSystemAudioId || event.default_system_audio_id || '',
    microphones: Array.isArray(event.microphones) ? event.microphones : [],
    systemOutputs: Array.isArray(event.systemOutputs)
      ? event.systemOutputs
      : Array.isArray(event.system_outputs)
        ? event.system_outputs
        : []
  };
}

function getSourceForAudioEngineEvent(event = {}) {
  const sourceId = String(event.sourceId || event.source_id || '').trim();
  const base = AUDIO_ENGINE_SOURCES[sourceId] || {
    id: sourceId || 'audio-engine',
    label: sourceId || 'Audio Engine',
    color: '#d8bfd8',
    sampleRate: AUDIO_ENGINE_SAMPLE_RATE
  };

  return {
    ...base,
    sampleRate: Number(event.sampleRate) || base.sampleRate || AUDIO_ENGINE_SAMPLE_RATE
  };
}

module.exports = {
  AUDIO_ENGINE_EXECUTABLE,
  AUDIO_ENGINE_SAMPLE_RATE,
  createAudioEngineSidecar,
  getSourceForAudioEngineEvent,
  normalizeAudioDeviceList,
  resolveAudioEnginePath
};
