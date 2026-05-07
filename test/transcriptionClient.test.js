const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildWavFile,
  calculatePcmRms,
  createTranscriptionProcessor,
  describeHttpError,
  isLikelyQuietHallucination
} = require('../src/transcriptionClient');

test('simulates transcript updates when no transcription API URL is configured', async () => {
  const transcripts = [];
  let postCalls = 0;
  const processor = createTranscriptionProcessor({
    apiUrl: '',
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
  let postedAudio;
  const processor = createTranscriptionProcessor({
    apiUrl: 'http://localhost:8000/v1/audio/transcriptions',
    model: 'tiny',
    minSegmentBytes: 1,
    minRms: 0,
    minIntervalMs: 0,
    axiosClient: {
      post: async (url, body, config) => {
        for (const entry of body.entries()) {
          appendedFields.push(entry[0]);
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
  assert.deepEqual(appendedFields, ['file', 'model']);
  assert.equal(postedAudio.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(postedAudio.subarray(8, 12).toString('ascii'), 'WAVE');
  assert.deepEqual(transcripts[0], {
    text: 'hello',
    speaker: 'Speaker 1',
    speakerColor: '#d8bfd8'
  });
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
  const processor = createTranscriptionProcessor({
    apiUrl: 'http://localhost:5000/stream',
    minSegmentBytes: 1,
    minRms: 0,
    minIntervalMs: 0,
    axiosClient: {
      post: async () => {
        postCalls += 1;
        await new Promise((resolve) => {
          resolvePost = resolve;
        });
        return { data: { text: 'done' } };
      }
    },
    sendTranscript: () => {},
    logger: { log() {}, warn() {}, error() {} }
  });

  const first = processor.processAudioChunk(Buffer.from('one'));
  await processor.processAudioChunk(Buffer.from('two'));
  resolvePost();
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
  const processor = createTranscriptionProcessor({
    apiUrl: 'http://localhost:8000/v1/audio/transcriptions',
    minSegmentBytes: 4,
    minRms: 100,
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
