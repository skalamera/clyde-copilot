const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const record = require('node-record-lpcm16');

const DEFAULT_RECORD_OPTIONS = {
  sampleRate: 44100,
  sampleSizeInBits: 16,
  channels: 1,
  audioType: 'raw',
  recorder: 'sox'
};

function createAudioCapture(options = {}) {
  const env = options.env || process.env;
  const logger = options.logger || console;
  const onStatus = options.onStatus || (() => {});
  const processAudioChunk = options.processAudioChunk || (() => {});
  const platform = options.platform || process.platform;
  const pathExists = options.pathExists || fs.existsSync;
  const spawnProcess = options.spawn || spawn;
  const recordOptions = {
    ...DEFAULT_RECORD_OPTIONS,
    ...(options.recordOptions || {})
  };

  if (env.CLYDE_AUDIO_DEVICE && !recordOptions.device) {
    recordOptions.device = env.CLYDE_AUDIO_DEVICE;
  }

  if (platform === 'win32' && !recordOptions.device) {
    recordOptions.device = options.defaultAudioDevice || 'default';
  }

  let recording = null;
  let isStreaming = false;
  let lastStatus = { state: 'idle', message: 'Audio capture is idle.' };
  let lastRecorderStderr = '';

  function setStatus(state, message, details = {}) {
    lastStatus = { state, message, ...details };
    onStatus(lastStatus);
    return lastStatus;
  }

  function handleAudioError(error) {
    isStreaming = false;
    const message = formatAudioError(error, lastRecorderStderr);

    logger.error('Audio capture failed:', error);
    setStatus('error', message, { code: error && error.code });

    return { ok: false, message, error };
  }

  function initialize() {
    if (recording) {
      return { ok: true, status: lastStatus };
    }

    const sox = resolveSoxExecutable({ env, pathExists, platform });

    if (!sox.ok) {
      logger.warn(sox.message);
      setStatus('error', sox.message, { code: 'SOX_NOT_FOUND' });
      return { ok: false, message: sox.message };
    }

    ensureDirectoryOnPath(env, path.dirname(sox.path), platform);

    try {
      lastRecorderStderr = '';
      const recorder = options.record || getDefaultRecorder(platform, sox.path, spawnProcess);
      const nextRecording = recorder.record(recordOptions);
      const stream = getRecordingStream(nextRecording);

      stream.on('data', (chunk) => {
        if (isStreaming) {
          processAudioChunk(chunk);
        }
      });

      stream.on('error', handleAudioError);

      if (nextRecording.process && typeof nextRecording.process.on === 'function') {
        nextRecording.process.on('error', handleAudioError);
      }

      if (
        nextRecording.process &&
        nextRecording.process.stderr &&
        typeof nextRecording.process.stderr.on === 'function'
      ) {
        nextRecording.process.stderr.on('data', (chunk) => {
          lastRecorderStderr = String(chunk).trim();
        });
      }

      recording = nextRecording;
      setStatus('ready', `SoX ready at ${sox.path} using input "${recordOptions.device || 'default'}"`, {
        soxPath: sox.path,
        audioDevice: recordOptions.device || 'default'
      });

      return { ok: true, soxPath: sox.path };
    } catch (error) {
      recording = null;
      return handleAudioError(error);
    }
  }

  function start() {
    const result = initialize();

    if (!result.ok) {
      return result;
    }

    isStreaming = true;
    setStatus('capturing', 'Capturing audio.');

    return { ok: true };
  }

  function stop() {
    isStreaming = false;

    if (recording && typeof recording.stop === 'function') {
      try {
        recording.stop();
      } catch (error) {
        logger.warn('Audio recorder stop failed:', error);
      }
    }

    recording = null;
    setStatus('idle', 'Audio capture stopped.');

    return { ok: true };
  }

  return {
    initialize,
    start,
    stop,
    getStatus: () => lastStatus,
    isStreaming: () => isStreaming
  };
}

function getDefaultRecorder(platform, soxPath, spawnProcess) {
  if (platform === 'win32') {
    return createWindowsSoxRecorder({
      command: soxPath,
      spawn: spawnProcess
    });
  }

  return record;
}

function createWindowsSoxRecorder(options = {}) {
  const command = options.command || 'sox';
  const spawnProcess = options.spawn || spawn;

  return {
    record: (options = {}) => {
      const device = options.device || 'default';
      let args = [
        '-t', 'waveaudio',
        device,
        '--no-show-progress',
        '--rate', String(options.sampleRate || DEFAULT_RECORD_OPTIONS.sampleRate),
        '--channels', String(options.channels || DEFAULT_RECORD_OPTIONS.channels),
        '--encoding', 'signed-integer',
        '--bits', String(options.sampleSizeInBits || 16),
        '--type', options.audioType || DEFAULT_RECORD_OPTIONS.audioType,
        '-'
      ];

      if (options.endOnSilence) {
        args = args.concat([
          'silence', '1', '0.1', options.thresholdStart || `${options.threshold || 0.5}%`,
          '1', options.silence || '1.0', options.thresholdEnd || `${options.threshold || 0.5}%`
        ]);
      }

      const childProcess = spawnProcess(command, args, {
        stdio: 'pipe',
        windowsHide: true
      });

      return {
        process: childProcess,
        stream: () => childProcess.stdout,
        stop: () => {
          if (childProcess && typeof childProcess.kill === 'function') {
            childProcess.kill();
          }
        }
      };
    }
  };
}

function getRecordingStream(recording) {
  if (recording && typeof recording.stream === 'function') {
    return recording.stream();
  }

  if (recording && typeof recording.on === 'function') {
    return recording;
  }

  throw new Error('Recorder did not return a readable stream.');
}

function formatAudioError(error, stderrOutput = '') {
  const message = typeof error === 'string'
    ? error
    : (error && error.message) || String(error);
  const stderr = String(stderrOutput || '').trim();
  const baseMessage = stderr && !message.includes(stderr)
    ? `${message}\n${stderr}`
    : message;

  if (error && error.code === 'ENOENT') {
    return `${baseMessage}. SoX could not be started. Set SOX_PATH or restart the terminal after changing Windows Path.`;
  }

  return baseMessage;
}

function resolveSoxExecutable(options = {}) {
  const env = options.env || process.env;
  const platform = options.platform || process.platform;
  const pathExists = options.pathExists || fs.existsSync;
  const explicitPath = stripQuotes(env.SOX_PATH || '');
  const invalidExplicitPath = explicitPath && !pathExists(explicitPath);

  if (explicitPath && !invalidExplicitPath) {
    return { ok: true, path: explicitPath, source: 'SOX_PATH' };
  }

  const fromPath = findExecutableOnPath('sox', env, platform, pathExists);

  if (fromPath) {
    return { ok: true, path: fromPath, source: 'PATH' };
  }

  const knownInstall = findKnownSoxInstall(env, platform, pathExists, options.fsModule || fs);

  if (knownInstall) {
    return { ok: true, path: knownInstall, source: 'known-install' };
  }

  const explicitHint = invalidExplicitPath
    ? ` SOX_PATH points to ${explicitPath}, but that file was not found.`
    : '';

  return {
    ok: false,
    message: `SoX was not found.${explicitHint} Set SOX_PATH to the full sox.exe path or add the SoX folder to Windows Path, then restart the terminal.`
  };
}

function findExecutableOnPath(command, env, platform, pathExists) {
  const pathLib = platform === 'win32' ? path.win32 : path.posix;
  const entries = getPathEntries(env, platform);
  const names = getExecutableNames(command, env, platform);

  for (const entry of entries) {
    for (const name of names) {
      const candidate = pathLib.join(entry, name);

      if (pathExists(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function getExecutableNames(command, env, platform) {
  if (platform !== 'win32' || path.win32.extname(command)) {
    return [command];
  }

  const extensions = (env.PATHEXT || '.EXE;.CMD;.BAT;.COM')
    .split(';')
    .filter(Boolean);

  return extensions.map((extension) => `${command}${extension.toLowerCase()}`);
}

function getPathEntries(env, platform) {
  const delimiter = platform === 'win32' ? ';' : ':';
  const value = env.Path || env.PATH || '';

  return value
    .split(delimiter)
    .map((entry) => stripQuotes(entry.trim()))
    .filter(Boolean);
}

function ensureDirectoryOnPath(env, directory, platform = process.platform) {
  if (!directory) {
    return;
  }

  const delimiter = platform === 'win32' ? ';' : ':';
  const current = env.Path || env.PATH || '';
  const entries = current
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const compare = platform === 'win32'
    ? (value) => value.toLowerCase()
    : (value) => value;
  const hasDirectory = entries.some((entry) => compare(stripQuotes(entry)) === compare(directory));
  const next = hasDirectory ? entries : [directory, ...entries];
  const nextValue = next.join(delimiter);

  env.Path = nextValue;
  env.PATH = nextValue;
}

function findKnownSoxInstall(env, platform, pathExists, fsModule) {
  if (platform !== 'win32') {
    return null;
  }

  const candidates = [
    ...getWingetSoxCandidates(env, fsModule),
    env['ProgramFiles(x86)'] && path.win32.join(env['ProgramFiles(x86)'], 'sox-14-4-2', 'sox.exe'),
    env.ProgramFiles && path.win32.join(env.ProgramFiles, 'sox-14-4-2', 'sox.exe'),
    env.ProgramFiles && path.win32.join(env.ProgramFiles, 'SoX', 'sox.exe')
  ].filter(Boolean);

  return candidates.find((candidate) => pathExists(candidate)) || null;
}

function getWingetSoxCandidates(env, fsModule) {
  const localAppData = env.LOCALAPPDATA || env.LocalAppData;

  if (!localAppData) {
    return [];
  }

  const packagesRoot = path.win32.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
  const packageDirs = listDirectories(packagesRoot, fsModule)
    .filter((name) => name.startsWith('ChrisBagwell.SoX_'));
  const candidates = [];

  for (const packageDir of packageDirs) {
    const packagePath = path.win32.join(packagesRoot, packageDir);
    const versionDirs = listDirectories(packagePath, fsModule)
      .filter((name) => name.startsWith('sox-'));

    for (const versionDir of versionDirs) {
      candidates.push(path.win32.join(packagePath, versionDir, 'sox.exe'));
    }
  }

  return candidates;
}

function listDirectories(directory, fsModule) {
  try {
    return fsModule
      .readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch (_error) {
    return [];
  }
}

function stripQuotes(value) {
  return value.replace(/^"|"$/g, '');
}

module.exports = {
  createAudioCapture,
  createWindowsSoxRecorder,
  ensureDirectoryOnPath,
  resolveSoxExecutable
};
