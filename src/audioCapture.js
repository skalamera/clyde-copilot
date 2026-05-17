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
  const recorderName = String(
    (options.recordOptions && options.recordOptions.recorder) ||
    env.CLYDE_AUDIO_RECORDER ||
    DEFAULT_RECORD_OPTIONS.recorder
  ).toLowerCase();

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

    const recorderResolution = resolveRecorderExecutable({
      recorder: recorderName,
      env,
      pathExists,
      platform
    });

    if (!recorderResolution.ok) {
      logger.warn(recorderResolution.message);
      setStatus('error', recorderResolution.message, { code: recorderResolution.code });
      return { ok: false, message: recorderResolution.message };
    }

    if (path.isAbsolute(recorderResolution.path)) {
      ensureDirectoryOnPath(env, path.dirname(recorderResolution.path), platform);
    }

    try {
      lastRecorderStderr = '';
      const recorder = options.record || getDefaultRecorder({
        platform,
        recorder: recorderName,
        command: recorderResolution.path,
        spawn: spawnProcess
      });
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
        nextRecording.process.on('close', (code) => {
          if (isStreaming && code) {
            handleAudioError(new Error(`Audio recorder exited with code ${code}.`));
          }
        });
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
      setStatus('ready', `${recorderResolution.label} ready at ${recorderResolution.path} using input "${recordOptions.device || 'default'}"`, {
        recorder: recorderName,
        recorderPath: recorderResolution.path,
        soxPath: recorderName === 'sox' ? recorderResolution.path : undefined,
        ffmpegPath: recorderName === 'ffmpeg' ? recorderResolution.path : undefined,
        audioDevice: recordOptions.device || 'default'
      });

      return { ok: true, recorder: recorderName, recorderPath: recorderResolution.path };
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

  function pause() {
    isStreaming = false;
    setStatus('paused', 'Audio capture paused.');

    return { ok: true };
  }

  function resume() {
    const result = initialize();

    if (!result.ok) {
      return result;
    }

    isStreaming = true;
    setStatus('capturing', 'Audio capture resumed.');

    return { ok: true };
  }

  return {
    initialize,
    start,
    pause,
    resume,
    stop,
    getStatus: () => lastStatus,
    isStreaming: () => isStreaming
  };
}

function getDefaultRecorder(options = {}) {
  const platform = options.platform || process.platform;
  const recorder = options.recorder || DEFAULT_RECORD_OPTIONS.recorder;
  const command = options.command;
  const spawnProcess = options.spawn || spawn;

  if (platform === 'win32') {
    if (recorder === 'ffmpeg') {
      return createWindowsFfmpegRecorder({ command, spawn: spawnProcess });
    }

    if (recorder === 'native') {
      return createNativeAudioRecorder();
    }

    return createWindowsSoxRecorder({ command, spawn: spawnProcess });
  }

  return record;
}

function createNativeAudioRecorder(options = {}) {
  const importNativeAudio = options.importNativeAudio || (() => import('native-audio-node'));

  return {
    record: (options = {}) => {
      const stream = new (require('node:events').EventEmitter)();
      const processEvents = new (require('node:events').EventEmitter)();
      const sampleRate = Number(options.sampleRate || DEFAULT_RECORD_OPTIONS.sampleRate);
      const channels = Number(options.channels || DEFAULT_RECORD_OPTIONS.channels);
      const chunkDurationMs = Number(options.chunkDurationMs || 200);
      const device = String(options.device || 'system');
      let recorder = null;
      let stopped = false;
      let metadata = null;

      importNativeAudio()
        .then((nativeAudio) => {
          if (stopped) {
            return null;
          }

          const recorderOptions = {
            sampleRate,
            chunkDurationMs,
            stereo: channels > 1,
            emitSilence: true
          };

          if (isSystemAudioDevice(device)) {
            recorder = new nativeAudio.SystemAudioRecorder(recorderOptions);
          } else {
            recorder = new nativeAudio.MicrophoneRecorder({
              ...recorderOptions,
              deviceId: resolveNativeInputDeviceId(nativeAudio, device)
            });
          }

          recorder.on('metadata', (nextMetadata) => {
            metadata = nextMetadata;
          });
          recorder.on('data', (chunk) => {
            if (chunk && Buffer.isBuffer(chunk.data)) {
              stream.emit('data', normalizeNativePcmChunk(chunk.data, metadata));
            }
          });
          recorder.on('error', (error) => processEvents.emit('error', error));
          recorder.on('stop', () => processEvents.emit('close', 0));

          return recorder.start();
        })
        .catch((error) => processEvents.emit('error', error));

      return {
        process: processEvents,
        stream: () => stream,
        stop: () => {
          stopped = true;

          if (recorder && typeof recorder.stop === 'function') {
            Promise.resolve(recorder.stop()).catch((error) => processEvents.emit('error', error));
          }
        }
      };
    }
  };
}

function normalizeNativePcmChunk(chunk, metadata) {
  if (metadata && metadata.isFloat && metadata.bitsPerChannel === 32) {
    return convertFloat32PcmToInt16(chunk);
  }

  return chunk;
}

function convertFloat32PcmToInt16(chunk) {
  const output = Buffer.alloc(Math.floor(chunk.length / 4) * 2);

  for (let inputOffset = 0, outputOffset = 0; inputOffset + 3 < chunk.length; inputOffset += 4, outputOffset += 2) {
    const value = Math.max(-1, Math.min(1, chunk.readFloatLE(inputOffset)));
    const sample = value < 0
      ? Math.round(value * 32768)
      : Math.round(value * 32767);

    output.writeInt16LE(sample, outputOffset);
  }

  return output;
}

function isSystemAudioDevice(device) {
  return ['system', 'system audio', 'system-audio', 'loopback', 'default-output']
    .includes(String(device || '').trim().toLowerCase());
}

function resolveNativeInputDeviceId(nativeAudio, device) {
  if (!device || !nativeAudio || typeof nativeAudio.listAudioDevices !== 'function') {
    return device;
  }

  const devices = nativeAudio.listAudioDevices();
  const target = String(device).trim().toLowerCase();
  const match = devices.find((item) => (
    item.isInput &&
    (
      String(item.id || '').trim().toLowerCase() === target ||
      String(item.name || '').trim().toLowerCase() === target
    )
  ));

  return match ? match.id : device;
}

function createWindowsFfmpegRecorder(options = {}) {
  const command = options.command || 'ffmpeg';
  const spawnProcess = options.spawn || spawn;

  return {
    record: (options = {}) => {
      const device = options.device || 'default';
      const channels = String(options.channels || DEFAULT_RECORD_OPTIONS.channels);
      const sampleRate = String(options.sampleRate || DEFAULT_RECORD_OPTIONS.sampleRate);
      const bits = Number(options.sampleSizeInBits || 16);
      const codec = bits === 32 ? 'pcm_s32le' : 'pcm_s16le';
      const format = bits === 32 ? 's32le' : 's16le';
      const args = [
        '-hide_banner',
        '-loglevel', 'warning',
        '-f', 'dshow',
        '-i', `audio=${device}`,
        '-f', format,
        '-acodec', codec,
        '-ac', channels,
        '-ar', sampleRate,
        '-'
      ];

      const childProcess = spawnProcess(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
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

function resolveRecorderExecutable(options = {}) {
  const recorder = options.recorder || DEFAULT_RECORD_OPTIONS.recorder;

  if (recorder === 'ffmpeg') {
    return resolveFfmpegExecutable(options);
  }

  if (recorder === 'native') {
    return { ok: true, path: 'native-audio-node', source: 'node-module', label: 'Native audio' };
  }

  if (recorder === 'sox') {
    const sox = resolveSoxExecutable(options);

    return sox.ok
      ? { ...sox, label: 'SoX' }
      : { ...sox, code: 'SOX_NOT_FOUND' };
  }

  return {
    ok: false,
    code: 'RECORDER_NOT_SUPPORTED',
    message: `Audio recorder "${recorder}" is not supported. Use "sox" or "ffmpeg".`
  };
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

function resolveFfmpegExecutable(options = {}) {
  const env = options.env || process.env;
  const platform = options.platform || process.platform;
  const pathExists = options.pathExists || fs.existsSync;
  const explicitPath = stripQuotes(env.FFMPEG_PATH || env.CLYDE_FFMPEG_PATH || '');
  const invalidExplicitPath = explicitPath && !pathExists(explicitPath);

  if (explicitPath && !invalidExplicitPath) {
    return { ok: true, path: explicitPath, source: 'FFMPEG_PATH', label: 'ffmpeg' };
  }

  const fromPath = findExecutableOnPath('ffmpeg', env, platform, pathExists);

  if (fromPath) {
    return { ok: true, path: fromPath, source: 'PATH', label: 'ffmpeg' };
  }

  const fromPackage = findFfmpegStaticInstall(pathExists);

  if (fromPackage) {
    return { ok: true, path: fromPackage, source: 'ffmpeg-static', label: 'ffmpeg' };
  }

  const explicitHint = invalidExplicitPath
    ? ` FFMPEG_PATH points to ${explicitPath}, but that file was not found.`
    : '';

  return {
    ok: false,
    code: 'FFMPEG_NOT_FOUND',
    message: `ffmpeg was not found.${explicitHint} Install ffmpeg, set FFMPEG_PATH to ffmpeg.exe, or install the ffmpeg-static package.`
  };
}

function findFfmpegStaticInstall(pathExists) {
  try {
    const ffmpegPath = require('ffmpeg-static');
    return ffmpegPath && pathExists(ffmpegPath) ? ffmpegPath : null;
  } catch (_error) {
    return null;
  }
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
  createNativeAudioRecorder,
  createWindowsFfmpegRecorder,
  createWindowsSoxRecorder,
  convertFloat32PcmToInt16,
  ensureDirectoryOnPath,
  resolveFfmpegExecutable,
  resolveSoxExecutable
};
