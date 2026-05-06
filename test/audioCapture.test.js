const { EventEmitter } = require('node:events');
const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createAudioCapture,
  createWindowsSoxRecorder,
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
