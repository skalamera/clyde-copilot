const { EventEmitter } = require('node:events');
const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createAudioEngineSidecar,
  getSourceForAudioEngineEvent,
  resolveAudioEnginePath
} = require('../src/audioEngineSidecar');

function createFakeChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = {
    writes: [],
    destroyed: false,
    write(data) {
      this.writes.push(String(data));
      return true;
    },
    end() {
      this.destroyed = true;
    }
  };
  child.killed = false;
  child.kill = () => {
    child.killed = true;
    child.emit('close', 0);
    return true;
  };
  return child;
}

function createFakeSpawn(child) {
  const calls = [];
  const spawn = (file, args, options) => {
    calls.push({ file, args, options });
    return child;
  };
  spawn.calls = calls;
  return spawn;
}

function nullLogger() {
  return { log() {}, warn() {}, error() {} };
}

test('audio engine sidecar sends NDJSON commands and resolves device lists', async () => {
  const child = createFakeChild();
  const spawn = createFakeSpawn(child);
  const manager = createAudioEngineSidecar({
    enginePath: 'C:\\Clyde\\clyde-audio-engine.exe',
    spawn,
    logger: nullLogger()
  });

  const startResult = manager.start();
  assert.equal(startResult.ok, true);
  assert.equal(spawn.calls[0].file, 'C:\\Clyde\\clyde-audio-engine.exe');
  assert.deepEqual(spawn.calls[0].args, []);

  const listPromise = manager.listDevices({ timeoutMs: 1000 });
  assert.equal(child.stdin.writes.at(-1), '{"type":"list_devices"}\n');

  child.stdout.emit('data', Buffer.from('{"type":"device_list","defaultMicrophoneId":"mic-default","defaultSystemAudioId":"speaker-default","microphones":[{"id":"mic-default","name":"Default mic"}],"systemOutputs":[{"id":"speaker-default","name":"Default speakers"}]}\n'));
  const devices = await listPromise;

  assert.equal(devices.defaultMicrophoneId, 'mic-default');
  assert.equal(devices.defaultSystemAudioId, 'speaker-default');
  assert.equal(devices.microphones[0].name, 'Default mic');
  assert.equal(devices.systemOutputs[0].name, 'Default speakers');
});

test('audio engine sidecar routes audio and level events by source', () => {
  const child = createFakeChild();
  const audioChunks = [];
  const levels = [];
  const events = [];
  const manager = createAudioEngineSidecar({
    enginePath: 'C:\\Clyde\\clyde-audio-engine.exe',
    spawn: createFakeSpawn(child),
    logger: nullLogger(),
    onEvent: (event) => events.push(event),
    onAudioChunk: (event) => audioChunks.push(event),
    onLevel: (event) => levels.push(event)
  });

  manager.start();
  child.stdout.emit('data', Buffer.from('{"type":"ready"}\n{"type":"level","sourceId":"others","rms":120,"peak":400}\n'));
  child.stdout.emit('data', Buffer.from('{"type":"audio_chunk","sourceId":"you","sampleRate":48000,"channels":1,"pcmBase64":"AQIDBA==","rms":80}\n'));

  assert.equal(events[0].type, 'ready');
  assert.equal(levels[0].source.id, 'others');
  assert.equal(levels[0].source.label, 'System Audio');
  assert.equal(audioChunks[0].source.id, 'you');
  assert.equal(audioChunks[0].source.label, 'You');
  assert.equal(audioChunks[0].sampleRate, 48000);
  assert.equal(audioChunks[0].chunk.toString('base64'), 'AQIDBA==');
});

test('audio engine sidecar start, pause, resume, stop, and shutdown commands use selected devices', () => {
  const child = createFakeChild();
  const manager = createAudioEngineSidecar({
    enginePath: 'C:\\Clyde\\clyde-audio-engine.exe',
    spawn: createFakeSpawn(child),
    logger: nullLogger()
  });

  manager.start();
  manager.startCapture({
    microphoneDeviceId: 'mic-1',
    systemAudioDeviceId: 'speaker-1'
  });
  manager.pause();
  manager.resume();
  manager.stop();
  manager.shutdown();

  const commands = child.stdin.writes.map((line) => JSON.parse(line));
  assert.deepEqual(commands, [
    { type: 'start_capture', microphoneDeviceId: 'mic-1', systemAudioDeviceId: 'speaker-1' },
    { type: 'pause' },
    { type: 'resume' },
    { type: 'stop' },
    { type: 'shutdown' }
  ]);
  assert.equal(child.stdin.destroyed, true);
});

test('audio engine source mapping keeps You and System Audio separate', () => {
  assert.deepEqual(getSourceForAudioEngineEvent({ sourceId: 'you' }), {
    id: 'you',
    label: 'You',
    color: '#8fff5f',
    sampleRate: 48000
  });
  assert.deepEqual(getSourceForAudioEngineEvent({ sourceId: 'others' }), {
    id: 'others',
    label: 'System Audio',
    color: '#89c2ff',
    sampleRate: 48000
  });
});

test('audio engine path resolves packaged resources before development builds', () => {
  const pathExists = (candidate) => candidate.includes('resources');
  const resolved = resolveAudioEnginePath({
    resourcesPath: 'C:\\App\\resources',
    appPath: 'C:\\Repo',
    isPackaged: true,
    pathExists
  });

  assert.equal(resolved, 'C:\\App\\resources\\clyde-audio-engine.exe');
});

test('audio engine path reports development build path while running Electron dev mode', () => {
  const resolved = resolveAudioEnginePath({
    resourcesPath: 'C:\\Repo\\node_modules\\electron\\dist\\resources',
    appPath: 'C:\\Repo',
    isPackaged: false,
    pathExists: () => false
  });

  assert.equal(resolved, 'C:\\Repo\\native\\audio-engine\\target\\release\\clyde-audio-engine.exe');
});
