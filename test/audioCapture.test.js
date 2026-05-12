const { EventEmitter } = require('node:events');
const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createAudioCapture,
  createNativeAudioRecorder,
  createWindowsFfmpegRecorder,
  createWindowsSoxRecorder,
  convertFloat32PcmToInt16,
  ensureDirectoryOnPath
} = require('../src/audioCapture');

test('does not start the recorder when SoX cannot be resolved', () => {
  let recordCalls = 0;
  const statuses = [];

  const capture = createAudioCapture({
    env: { Path: 'C:\\Windows\\System32', SOX_PATH: 'C:\\missing\\sox.exe' },
    pathExists: () => false,
    record: {
      record: () => {
        recordCalls += 1;
      }
    },
    processAudioChunk: () => {},
    onStatus: (status) => statuses.push(status),
    logger: { log() {}, warn() {}, error() {} },
    platform: 'win32'
  });

  const result = capture.initialize();

  assert.equal(result.ok, false);
  assert.equal(recordCalls, 0);
  assert.match(statuses.at(-1).message, /SoX/);
});

test('uses the recorder stream and handles child process errors', () => {
  const stream = new EventEmitter();
  const childProcess = new EventEmitter();
  const chunks = [];
  const statuses = [];
  let stopped = false;

  const capture = createAudioCapture({
    env: { Path: 'C:\\Tools' },
    pathExists: (candidate) => candidate === 'C:\\Tools\\sox.exe',
    record: {
      record: () => ({
        process: childProcess,
        stream: () => stream,
        stop: () => {
          stopped = true;
        }
      })
    },
    processAudioChunk: (chunk) => chunks.push(chunk),
    onStatus: (status) => statuses.push(status),
    logger: { log() {}, warn() {}, error() {} },
    platform: 'win32'
  });

  assert.doesNotThrow(() => capture.initialize());

  stream.emit('data', Buffer.from('ignored'));
  assert.equal(chunks.length, 0);

  capture.start();
  stream.emit('data', Buffer.from('audio'));
  assert.equal(chunks[0].toString(), 'audio');

  const error = Object.assign(new Error('spawn sox ENOENT'), { code: 'ENOENT' });
  assert.doesNotThrow(() => childProcess.emit('error', error));
  assert.equal(statuses.at(-1).state, 'error');
  assert.match(statuses.at(-1).message, /spawn sox ENOENT/);

  capture.stop();
  assert.equal(stopped, true);
});

test('includes SoX stderr in stream error status', () => {
  const stream = new EventEmitter();
  const childProcess = new EventEmitter();
  childProcess.stderr = new EventEmitter();

  const statuses = [];
  const capture = createAudioCapture({
    env: { Path: 'C:\\Tools' },
    pathExists: (candidate) => candidate === 'C:\\Tools\\sox.exe',
    record: {
      record: () => ({
        process: childProcess,
        stream: () => stream,
        stop: () => {}
      })
    },
    processAudioChunk: () => {},
    onStatus: (status) => statuses.push(status),
    logger: { log() {}, warn() {}, error() {} },
    platform: 'win32'
  });

  capture.start();
  childProcess.stderr.emit('data', Buffer.from('sox FAIL sox: Sorry, there is no default audio device configured'));
  stream.emit('error', 'sox has exited with error code 1.');

  assert.match(statuses.at(-1).message, /no default audio device configured/);
});

test('reports recorder process exits with stderr details', () => {
  const stream = new EventEmitter();
  const childProcess = new EventEmitter();
  childProcess.stderr = new EventEmitter();
  const statuses = [];

  const capture = createAudioCapture({
    env: { Path: 'C:\\Tools' },
    pathExists: (candidate) => candidate === 'C:\\Tools\\sox.exe',
    record: {
      record: () => ({
        process: childProcess,
        stream: () => stream,
        stop: () => {}
      })
    },
    processAudioChunk: () => {},
    onStatus: (status) => statuses.push(status),
    logger: { log() {}, warn() {}, error() {} },
    platform: 'win32'
  });

  capture.start();
  childProcess.stderr.emit('data', Buffer.from('Could not find audio device'));
  childProcess.emit('close', 1);

  assert.equal(statuses.at(-1).state, 'error');
  assert.match(statuses.at(-1).message, /Could not find audio device/);
});

test('uses ffmpeg on Windows without requiring SoX when selected', () => {
  const stream = new EventEmitter();
  const childProcess = new EventEmitter();
  childProcess.stdout = stream;
  childProcess.stderr = new EventEmitter();
  const statuses = [];
  let spawned;

  const capture = createAudioCapture({
    env: {
      Path: 'C:\\Tools',
      CLYDE_AUDIO_RECORDER: 'ffmpeg'
    },
    pathExists: (candidate) => candidate === 'C:\\Tools\\ffmpeg.exe',
    spawn: (command, args, options) => {
      spawned = { command, args, options };
      return {
        stdout: stream,
        stderr: childProcess.stderr,
        kill: () => {},
        on: childProcess.on.bind(childProcess)
      };
    },
    recordOptions: {
      device: 'Voicemeeter Out B2'
    },
    processAudioChunk: () => {},
    onStatus: (status) => statuses.push(status),
    logger: { log() {}, warn() {}, error() {} },
    platform: 'win32'
  });

  const result = capture.initialize();

  assert.equal(result.ok, true);
  assert.equal(spawned.command, 'C:\\Tools\\ffmpeg.exe');
  assert.match(statuses.at(-1).message, /ffmpeg/i);
  assert.equal(statuses.at(-1).audioDevice, 'Voicemeeter Out B2');
});

test('uses native system audio recorder without requiring external executables', async () => {
  const nativeEvents = new EventEmitter();
  let startCalls = 0;
  let recorderOptions;

  class FakeSystemAudioRecorder extends EventEmitter {
    constructor(options) {
      super();
      recorderOptions = options;
    }

    async start() {
      startCalls += 1;
      nativeEvents.emit('started');
    }

    async stop() {}
  }

  const capture = createAudioCapture({
    env: {
      CLYDE_AUDIO_RECORDER: 'native'
    },
    pathExists: () => false,
    recordOptions: {
      device: 'system'
    },
    record: createNativeAudioRecorder({
      importNativeAudio: async () => ({
        SystemAudioRecorder: FakeSystemAudioRecorder
      })
    }),
    processAudioChunk: () => {},
    onStatus: () => {},
    logger: { log() {}, warn() {}, error() {} },
    platform: 'win32'
  });

  const result = capture.start();
  await new Promise((resolve) => nativeEvents.once('started', resolve));

  assert.equal(result.ok, true);
  assert.equal(startCalls, 1);
  assert.equal(recorderOptions.sampleRate, 44100);
  assert.equal(recorderOptions.stereo, false);
});

test('converts native float PCM chunks to signed 16-bit PCM', async () => {
  const nativeEvents = new EventEmitter();
  const chunks = [];

  class FakeMicrophoneRecorder extends EventEmitter {
    async start() {
      this.emit('metadata', {
        sampleRate: 44100,
        channelsPerFrame: 1,
        bitsPerChannel: 32,
        isFloat: true,
        encoding: 'pcm_f32le'
      });

      const floatChunk = Buffer.alloc(12);
      floatChunk.writeFloatLE(-1, 0);
      floatChunk.writeFloatLE(0, 4);
      floatChunk.writeFloatLE(1, 8);
      this.emit('data', { data: floatChunk });
      nativeEvents.emit('data');
    }

    async stop() {}
  }

  const recorder = createNativeAudioRecorder({
    importNativeAudio: async () => ({
      MicrophoneRecorder: FakeMicrophoneRecorder,
      listAudioDevices: () => []
    })
  }).record({ device: 'Microphone Array (AMD Audio Device)' });

  recorder.stream().on('data', (chunk) => chunks.push(chunk));
  await new Promise((resolve) => nativeEvents.once('data', resolve));

  assert.deepEqual(Array.from(chunks[0]), Array.from(convertFloat32PcmToInt16(Buffer.from([
    0, 0, 128, 191,
    0, 0, 0, 0,
    0, 0, 128, 63
  ]))));
  assert.equal(chunks[0].readInt16LE(0), -32768);
  assert.equal(chunks[0].readInt16LE(2), 0);
  assert.equal(chunks[0].readInt16LE(4), 32767);
});

test('adds a discovered SoX directory to both Windows path env keys', () => {
  const env = { Path: 'C:\\Windows\\System32' };

  ensureDirectoryOnPath(env, 'C:\\Tools\\SoX', 'win32');

  assert.equal(env.Path.startsWith('C:\\Tools\\SoX;'), true);
  assert.equal(env.PATH.startsWith('C:\\Tools\\SoX;'), true);
});

test('windows recorder uses the waveaudio driver and selected input device', () => {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  let spawned;
  let killed = false;
  const recorder = createWindowsSoxRecorder({
    command: 'C:\\Tools\\SoX\\sox.exe',
    spawn: (command, args, options) => {
      spawned = { command, args, options };

      return {
        stdout,
        stderr,
        kill: () => {
          killed = true;
        },
        on: () => {}
      };
    }
  });

  const recording = recorder.record({
    sampleRate: 44100,
    channels: 1,
    audioType: 'raw',
    sampleSizeInBits: 16,
    device: 'CABLE Output'
  });

  assert.equal(spawned.command, 'C:\\Tools\\SoX\\sox.exe');
  assert.deepEqual(spawned.args.slice(0, 3), ['-t', 'waveaudio', 'CABLE Output']);
  assert.equal(spawned.args.includes('--default-device'), false);
  assert.equal(spawned.args.includes('raw'), true);
  assert.equal(recording.stream(), stdout);

  recording.stop();

  assert.equal(killed, true);
});

test('windows ffmpeg recorder uses DirectShow and outputs raw PCM', () => {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  let spawned;
  let killed = false;
  const recorder = createWindowsFfmpegRecorder({
    command: 'C:\\Tools\\ffmpeg.exe',
    spawn: (command, args, options) => {
      spawned = { command, args, options };

      return {
        stdout,
        stderr,
        kill: () => {
          killed = true;
        },
        on: () => {}
      };
    }
  });

  const recording = recorder.record({
    sampleRate: 44100,
    channels: 1,
    sampleSizeInBits: 16,
    device: 'Voicemeeter Out B2'
  });

  assert.equal(spawned.command, 'C:\\Tools\\ffmpeg.exe');
  assert.deepEqual(spawned.args.slice(0, 4), ['-hide_banner', '-loglevel', 'warning', '-f']);
  assert.deepEqual(spawned.args.slice(4, 7), ['dshow', '-i', 'audio=Voicemeeter Out B2']);
  assert.deepEqual(spawned.args.slice(-9), ['-f', 's16le', '-acodec', 'pcm_s16le', '-ac', '1', '-ar', '44100', '-']);
  assert.equal(spawned.args.at(-1), '-');
  assert.equal(recording.stream(), stdout);

  recording.stop();

  assert.equal(killed, true);
});
