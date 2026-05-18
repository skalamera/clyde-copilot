const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');

const {
  buildWavFile,
  calculatePcmRms,
  createTranscriptionProcessor,
  describeHttpError,
  normalizeTranscriptText,
  isLikelyQuietHallucination
} = require('../src/transcriptionClient');

function createRealtimeWebSocketHarness() {
  const sockets = [];

  class FakeWebSocket extends EventEmitter {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 3;

    constructor(url, options = {}) {
      super();
      this.url = url;
      this.options = options;
      this.readyState = FakeWebSocket.CONNECTING;
      this.sent = [];
      this.closed = false;
      sockets.push(this);
    }

    send(message) {
      this.sent.push(JSON.parse(message));
    }

    close() {
      this.closed = true;
      this.readyState = FakeWebSocket.CLOSED;
      this.emit('close');
    }

    open() {
      this.readyState = FakeWebSocket.OPEN;
      this.emit('open');
    }

    receive(event) {
      this.emit('message', Buffer.from(JSON.stringify(event)));
    }
  }

  return { FakeWebSocket, sockets };
}

function createPcm16(samples, value = 1200) {
  const pcm = Buffer.alloc(samples * 2);
  for (let index = 0; index < samples; index += 1) {
    pcm.writeInt16LE(value, index * 2);
  }
  return pcm;
}

test('simulates transcript updates when no transcription API URL is configured', async () => {
  const transcripts = [];
  let postCalls = 0;
  const processor = createTranscriptionProcessor({
    settings: {
        transcriptionProvider: 'local',
        localTranscriptionUrl: ''
    },
    minSegmentBytes: 1,
    minRms: 0,
    minIntervalMs: 0,
    axiosClient: {
      post: async () => {
        postCalls += 1;
      }
    },
    sendTranscript: (transcript) => transcripts.push(transcript),
    logger: { log() {}, warn() {}, error() {} }
  });

  await processor.processAudioChunk(Buffer.from('audio'));

  assert.equal(postCalls, 0);
  assert.equal(transcripts.length, 1);
  assert.match(transcripts[0].text, /Captured audio/);
});

test('posts audio to the configured transcription API URL', async () => {
  const calls = [];
  const transcripts = [];
  const appendedFields = [];
  const appendedValues = new Map();
  let postedAudio;
  const processor = createTranscriptionProcessor({
    settings: {
        transcriptionProvider: 'local',
        localTranscriptionUrl: 'http://localhost:8000/v1/audio/transcriptions',
        llmModel: 'tiny'
    },
    minSegmentBytes: 1,
    minRms: 0,
    minIntervalMs: 0,
    axiosClient: {
      post: async (url, body, config) => {
        for (const entry of body.entries()) {
          appendedFields.push(entry[0]);
          appendedValues.set(entry[0], entry[1]);
        }

        postedAudio = Buffer.from(await Array.from(body.entries())[0][1].arrayBuffer());
        calls.push({ url, body, config });
        return {
          data: {
            text: 'hello',
            speaker: 'Speaker 1'
          }
        };
      }
    },
    sendTranscript: (transcript) => transcripts.push(transcript),
    logger: { log() {}, warn() {}, error() {} }
  });

  await processor.processAudioChunk(Buffer.from('audio'));

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://localhost:8000/v1/audio/transcriptions');
  assert.equal(calls[0].config.timeout, 10000);
  assert.deepEqual(appendedFields, ['file', 'model', 'prompt']);
  assert.match(String(appendedValues.get('prompt')), /clyde_unclear_audio/);
  assert.equal(postedAudio.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(postedAudio.subarray(8, 12).toString('ascii'), 'WAVE');
  assert.deepEqual(transcripts[0], {
    text: 'hello',
    speaker: 'Speaker 1',
    speakerColor: '#d8bfd8'
  });
});

test('filters unclear audio sentinel even when the segment is not quiet', async () => {
  const transcripts = [];
  const loudPcm = Buffer.alloc(20);
  for (let index = 0; index < loudPcm.length; index += 2) {
    loudPcm.writeInt16LE(1000, index);
  }

  const processor = createTranscriptionProcessor({
    settings: {
        transcriptionProvider: 'local',
        localTranscriptionUrl: 'http://localhost:8000/v1/audio/transcriptions',
        llmModel: 'tiny'
    },
    minSegmentBytes: 1,
    minRms: 0,
    hallucinationRms: 350,
    minIntervalMs: 0,
    axiosClient: {
      post: async () => ({
        data: {
          text: 'clyde_unclear_audio'
        }
      })
    },
    sendTranscript: (transcript) => transcripts.push(transcript),
    logger: { log() {}, warn() {}, error() {} }
  });

  const result = await processor.processAudioChunk(loudPcm);

  assert.equal(result.skipped, 'unclear-audio');
  assert.equal(result.rms, 1000);
  assert.equal(result.text, 'clyde_unclear_audio');
  assert.deepEqual(transcripts, []);
});

test('realtime provider opens OpenAI websocket and appends 24 kHz PCM audio', async () => {
  const { FakeWebSocket, sockets } = createRealtimeWebSocketHarness();
  const processor = createTranscriptionProcessor({
    settings: {
      transcriptionProvider: 'openai-realtime-whisper',
      transcriptionApiKey: 'test-key'
    },
    WebSocketImpl: FakeWebSocket,
    sampleRate: 44100,
    sourceId: 'mic',
    minRms: 0,
    sendTranscript: () => {},
    logger: { log() {}, warn() {}, error() {} }
  });

  const result = await processor.processAudioChunk(createPcm16(4410));
  assert.equal(result.skipped, 'connecting');
  assert.equal(sockets.length, 1);
  assert.equal(sockets[0].url, 'wss://api.openai.com/v1/realtime?intent=transcription');
  assert.equal(sockets[0].options.headers.Authorization, 'Bearer test-key');

  sockets[0].open();

  assert.equal(sockets[0].sent[0].type, 'session.update');
  assert.equal(sockets[0].sent[0].session.type, 'transcription');
  assert.equal(sockets[0].sent[0].session.audio.input.format.rate, 24000);
  assert.equal(sockets[0].sent[0].session.audio.input.transcription.model, 'gpt-realtime-whisper');
  assert.equal(sockets[0].sent[0].session.audio.input.transcription.language, 'en');
  assert.equal(
    Object.prototype.hasOwnProperty.call(sockets[0].sent[0].session.audio.input.transcription, 'prompt'),
    false
  );
  assert.equal(sockets[0].sent[0].session.audio.input.turn_detection, null);
  assert.equal(sockets[0].sent.length, 1);

  sockets[0].receive({ type: 'session.updated' });

  assert.equal(sockets[0].sent[1].type, 'input_audio_buffer.append');
  assert.equal(Buffer.from(sockets[0].sent[1].audio, 'base64').length, 4800);
});

test('realtime provider manually commits buffered speech after trailing silence', async () => {
  const { FakeWebSocket, sockets } = createRealtimeWebSocketHarness();
  const processor = createTranscriptionProcessor({
    settings: {
      transcriptionProvider: 'openai-realtime-whisper',
      transcriptionApiKey: 'test-key'
    },
    WebSocketImpl: FakeWebSocket,
    sampleRate: 24000,
    sourceId: 'mic',
    minRms: 100,
    sendTranscript: () => {},
    logger: { log() {}, warn() {}, error() {} }
  });

  await processor.processAudioChunk(createPcm16(4800, 1200));
  sockets[0].open();
  sockets[0].receive({ type: 'session.updated' });

  for (let index = 0; index < 4; index += 1) {
    await processor.processAudioChunk(createPcm16(4800, 1));
  }

  assert.equal(
    sockets[0].sent.some((event) => event.type === 'input_audio_buffer.commit'),
    true
  );
});

test('realtime provider streams partial deltas and final transcripts by item id', async () => {
  const { FakeWebSocket, sockets } = createRealtimeWebSocketHarness();
  const transcripts = [];
  const processor = createTranscriptionProcessor({
    settings: {
      transcriptionProvider: 'openai-realtime-whisper',
      transcriptionApiKey: 'test-key'
    },
    WebSocketImpl: FakeWebSocket,
    sampleRate: 44100,
    sourceId: 'mic',
    speaker: 'You',
    speakerColor: '#8fff5f',
    minRms: 0,
    sendTranscript: (transcript) => transcripts.push(transcript),
    logger: { log() {}, warn() {}, error() {} }
  });

  await processor.processAudioChunk(createPcm16(4410));
  sockets[0].open();
  sockets[0].receive({
    type: 'conversation.item.input_audio_transcription.delta',
    item_id: 'item_003',
    delta: 'Hel'
  });
  sockets[0].receive({
    type: 'conversation.item.input_audio_transcription.delta',
    item_id: 'item_003',
    delta: 'lo'
  });
  sockets[0].receive({
    type: 'conversation.item.input_audio_transcription.completed',
    item_id: 'item_003',
    transcript: 'Hello.'
  });

  assert.deepEqual(transcripts, [
    {
      text: 'Hel',
      speaker: 'You',
      speakerColor: '#8fff5f',
      partial: true,
      itemId: 'mic:item_003',
      provider: 'openai-realtime-whisper'
    },
    {
      text: 'Hello',
      speaker: 'You',
      speakerColor: '#8fff5f',
      partial: true,
      itemId: 'mic:item_003',
      provider: 'openai-realtime-whisper'
    },
    {
      text: 'Hello.',
      speaker: 'You',
      speakerColor: '#8fff5f',
      partial: false,
      itemId: 'mic:item_003',
      provider: 'openai-realtime-whisper'
    }
  ]);
});

test('realtime provider filters unclear final transcript and closes websocket', async () => {
  const { FakeWebSocket, sockets } = createRealtimeWebSocketHarness();
  const transcripts = [];
  const processor = createTranscriptionProcessor({
    settings: {
      transcriptionProvider: 'openai-realtime-whisper',
      transcriptionApiKey: 'test-key'
    },
    WebSocketImpl: FakeWebSocket,
    sampleRate: 44100,
    sourceId: 'system',
    minRms: 0,
    hallucinationRms: 350,
    sendTranscript: (transcript) => transcripts.push(transcript),
    logger: { log() {}, warn() {}, error() {} }
  });

  await processor.processAudioChunk(createPcm16(4410, 1400));
  sockets[0].open();
  sockets[0].receive({
    type: 'conversation.item.input_audio_transcription.completed',
    item_id: 'item_004',
    transcript: 'clyde_unclear_audio'
  });
  processor.close();

  assert.deepEqual(transcripts, []);
  assert.equal(sockets[0].closed, true);
});

test('realtime provider does not filter loud speech after trailing quiet audio', async () => {
  const { FakeWebSocket, sockets } = createRealtimeWebSocketHarness();
  const transcripts = [];
  const processor = createTranscriptionProcessor({
    settings: {
      transcriptionProvider: 'openai-realtime-whisper',
      transcriptionApiKey: 'test-key'
    },
    WebSocketImpl: FakeWebSocket,
    sampleRate: 44100,
    sourceId: 'mic',
    minRms: 0,
    hallucinationRms: 350,
    sendTranscript: (transcript) => transcripts.push(transcript),
    logger: { log() {}, warn() {}, error() {} }
  });

  await processor.processAudioChunk(createPcm16(4410, 1200));
  sockets[0].open();
  await processor.processAudioChunk(createPcm16(4410, 1));
  sockets[0].receive({
    type: 'conversation.item.input_audio_transcription.completed',
    item_id: 'item_005',
    transcript: 'Thank you.'
  });

  assert.equal(transcripts.length, 1);
  assert.equal(transcripts[0].text, 'Thank you.');
});

test('corrects obvious first-person transcript fragments before sending turns', async () => {
  const transcripts = [];
  const processor = createTranscriptionProcessor({
    settings: {
        transcriptionProvider: 'local',
        localTranscriptionUrl: 'http://localhost:8000/v1/audio/transcriptions',
        llmModel: 'tiny'
    },
    minSegmentBytes: 1,
    minRms: 0,
    minIntervalMs: 0,
    axiosClient: {
      post: async () => ({
        data: {
          text: 'The most proud of Judana AI. This AI-powered customer support analytics suite was built specifically for Freshdesk.',
          speaker: 'You'
        }
      })
    },
    sendTranscript: (transcript) => transcripts.push(transcript),
    logger: { log() {}, warn() {}, error() {} }
  });

  await processor.processAudioChunk(Buffer.from('audio'));

  assert.equal(
    transcripts[0].text,
    "I'm most proud of Judana AI. This AI-powered customer support analytics suite was built specifically for Freshdesk."
  );
});

test('normalizes common most-proud fragments without changing valid sentences', () => {
  assert.equal(normalizeTranscriptText('Most proud of the support analytics suite.'), "I'm most proud of the support analytics suite.");
  assert.equal(normalizeTranscriptText("I'm most proud of the support analytics suite."), "I'm most proud of the support analytics suite.");
  assert.equal(
    normalizeTranscriptText('The most proud of the support analytics suite.', { speaker: 'System Audio' }),
    'The most proud of the support analytics suite.'
  );
  assert.equal(normalizeTranscriptText('The dashboard is ready.'), 'The dashboard is ready.');
});

test('formats Axios network and HTTP errors with useful details', () => {
  assert.equal(
    describeHttpError({
      code: 'ECONNREFUSED',
      config: { url: 'http://localhost:5000/stream' }
    }),
    'ECONNREFUSED calling http://localhost:5000/stream'
  );

  assert.equal(
    describeHttpError({
      response: { status: 404, statusText: 'Not Found' },
      config: { url: 'http://localhost:5000/stream' }
    }),
    'HTTP 404 Not Found from http://localhost:5000/stream'
  );
});

test('drops chunks while a request is already in flight', async () => {
  let resolvePost;
  let postCalls = 0;
  const inFlightPost = new Promise((resolve) => resolvePost = resolve);
  const processor = createTranscriptionProcessor({
    settings: {
        transcriptionProvider: 'local',
        localTranscriptionUrl: 'http://localhost:8000/v1/audio/transcriptions',
        llmModel: 'tiny'
    },
    minSegmentBytes: 1,
    minRms: 0,
    minIntervalMs: 0,
    axiosClient: {
      post: () => {
        postCalls += 1;
        return inFlightPost;
      }
    },
    sendTranscript: () => {},
    logger: { log() {}, warn() {}, error() {} }
  });

  const first = processor.processAudioChunk(Buffer.from('one'));
  await processor.processAudioChunk(Buffer.from('two'));
  resolvePost({ data: { text: 'done' } });
  await first;

  assert.equal(postCalls, 1);
});

test('builds a valid WAV wrapper around PCM audio', () => {
  const pcm = Buffer.from([1, 2, 3, 4]);
  const wav = buildWavFile(pcm, {
    sampleRate: 16000,
    channels: 1,
    bitsPerSample: 16
  });

  assert.equal(wav.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(wav.readUInt32LE(4), 40);
  assert.equal(wav.subarray(8, 12).toString('ascii'), 'WAVE');
  assert.equal(wav.readUInt32LE(24), 16000);
  assert.equal(wav.readUInt32LE(40), 4);
  assert.deepEqual(wav.subarray(44), pcm);
});

test('skips quiet PCM segments before calling the transcription API', async () => {
  let postCalls = 0;
  const skips = [];
  const processor = createTranscriptionProcessor({
    settings: {
        transcriptionProvider: 'local',
        localTranscriptionUrl: 'http://localhost:8000/v1/audio/transcriptions',
        llmModel: 'tiny'
    },
    minSegmentBytes: 1,
    minRms: 50,
    minIntervalMs: 0,
    axiosClient: {
      post: async () => {
        postCalls += 1;
      }
    },
    logger: { log() {}, warn() {}, error() {} }
  });

  const result = await processor.processAudioChunk(Buffer.from([0, 0, 1, 0]));

  assert.equal(result.skipped, 'quiet');
  assert.equal(postCalls, 0);
});

test('calculates PCM RMS for signed 16-bit samples', () => {
  const pcm = Buffer.alloc(4);
  pcm.writeInt16LE(300, 0);
  pcm.writeInt16LE(-300, 2);

  assert.equal(calculatePcmRms(pcm), 300);
});

test('detects common quiet Whisper hallucinations', () => {
  assert.equal(isLikelyQuietHallucination('Thank you.', 20, 350), true);
  assert.equal(isLikelyQuietHallucination('Can you hear me?', 20, 350), false);
  assert.equal(isLikelyQuietHallucination('Thank you.', 500, 350), false);
});
