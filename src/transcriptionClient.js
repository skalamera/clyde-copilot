const DEFAULT_INTERVAL_MS = 1500;
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_SAMPLE_RATE = 44100;
const DEFAULT_CHANNELS = 1;
const DEFAULT_BITS_PER_SAMPLE = 16;
const DEFAULT_SEGMENT_SECONDS = 8; // Increased from 5 to 8 to capture much longer sentences
const DEFAULT_MIN_RMS = 100;
const DEFAULT_HALLUCINATION_RMS = 350;
const OPENAI_REALTIME_WHISPER_PROVIDER = 'openai-realtime-whisper';
const OPENAI_REALTIME_WHISPER_MODEL = 'gpt-realtime-whisper';
const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime?intent=transcription';
const OPENAI_REALTIME_SAMPLE_RATE = 24000;
const OPENAI_REALTIME_PENDING_AUDIO_MS = 5000;
const OPENAI_REALTIME_MIN_COMMIT_AUDIO_MS = 120;
const OPENAI_REALTIME_SILENCE_COMMIT_MS = 600;
const OPENAI_REALTIME_MAX_COMMIT_AUDIO_MS = 2500;
const UNCLEAR_AUDIO_SENTINEL = 'clyde_unclear_audio';
const UNCLEAR_AUDIO_PROMPT = [
  'Transcribe as natural spoken English.',
  'Correct obvious speech-recognition fragments only when the intended wording is clear.',
  'For example, "The most proud of X" should be "I\'m most proud of X".',
  `If speech is unclear or cannot be confidently transcribed, return exactly: ${UNCLEAR_AUDIO_SENTINEL}.`
].join(' ');
const COMMON_QUIET_HALLUCINATIONS = new Set([
  'thank you',
  'thanks for watching',
  'you'
]);
const FIRST_PERSON_CORRECTION_SPEAKERS = new Set([
  'candidate',
  'me',
  'mic',
  'microphone',
  'user',
  'you'
]);

function createTranscriptionProcessor(options = {}) {
  const settings = options.settings || {};
  const provider = settings.transcriptionProvider || 'local';

  if (provider === OPENAI_REALTIME_WHISPER_PROVIDER) {
    return createRealtimeTranscriptionProcessor(options);
  }

  const apiKey = settings.transcriptionApiKey || '';
  let apiUrl = settings.localTranscriptionUrl;
  let model = settings.transcriptionModel || process.env.TRANSCRIPTION_MODEL || 'Systran/faster-distil-whisper-large-v3';

  if (provider === 'openai') {
      apiUrl = 'https://api.openai.com/v1/audio/transcriptions';
      model = 'whisper-1';
  } else if (provider === 'clyde-cloud-whisper') {
      const baseUrl = process.env.CLYDE_API_BASE_URL || 'https://clydeai.live/api';
      apiUrl = `${baseUrl.replace(/\/$/, '')}/proxy?type=transcribe`;
      model = 'whisper-1';
  }

  const axiosClient = options.axiosClient;
  const logger = options.logger || console;
  const sendTranscript = options.sendTranscript || (() => {});
  const sendStatus = options.sendStatus || (() => {});
  const minIntervalMs = options.minIntervalMs ?? DEFAULT_INTERVAL_MS;
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const sampleRate = options.sampleRate || DEFAULT_SAMPLE_RATE;
  const channels = options.channels || DEFAULT_CHANNELS;
  const bitsPerSample = options.bitsPerSample || DEFAULT_BITS_PER_SAMPLE;
  const segmentSeconds = options.segmentSeconds ?? DEFAULT_SEGMENT_SECONDS;
  const minRms = options.minRms ?? DEFAULT_MIN_RMS;
  const hallucinationRms = options.hallucinationRms ?? DEFAULT_HALLUCINATION_RMS;
  const diagnostics = options.diagnostics || false;
  const speaker = options.speaker || 'Transcription API';
  const speakerColor = options.speakerColor || '#d8bfd8';
  const bytesPerSample = bitsPerSample / 8;
  const minSegmentBytes = options.minSegmentBytes || Math.floor(sampleRate * channels * bytesPerSample * segmentSeconds);

  let lastProcessedAt = 0;
  let inFlight = false;
  let lastErrorMessage = '';
  let bufferedChunks = [];
  let bufferedBytes = 0;

  async function processAudioChunk(chunk) {
    bufferedChunks.push(chunk);
    bufferedBytes += chunk.length;

    if (bufferedBytes < minSegmentBytes) {
      if (diagnostics) {
        sendStatus({
          state: 'capturing',
          message: 'Buffering audio.'
        });
      }

      return { ok: true, skipped: 'buffering', bufferedBytes };
    }

    const now = Date.now();

    if (now - lastProcessedAt < minIntervalMs) {
      return { ok: true, skipped: 'rate-limited' };
    }

    if (inFlight) {
      return { ok: true, skipped: 'in-flight' };
    }

    lastProcessedAt = now;
    const pcmAudio = Buffer.concat(bufferedChunks, bufferedBytes);
    bufferedChunks = [];
    bufferedBytes = 0;

    const rms = calculatePcmRms(pcmAudio, bitsPerSample);

    if (rms < minRms) {
      if (diagnostics) {
        sendStatus({
          state: 'capturing',
          message: `Audio too quiet to transcribe. RMS ${Math.round(rms)} is below ${minRms}.`
        });
      }

      return { ok: true, skipped: 'quiet', rms };
    }

    if (diagnostics) {
      sendStatus({
        state: 'capturing',
        message: `Sending audio to transcription API. RMS ${Math.round(rms)}.`
      });
    }

    const wavAudio = buildWavFile(pcmAudio, {
      sampleRate,
      channels,
      bitsPerSample
    });

    if (!apiUrl) {
      sendStatus({
        state: 'warning',
        message: 'No transcription endpoint configured; skipping audio transcription.'
      });
      return { ok: true, skipped: 'missing-transcription-endpoint' };
    }

    inFlight = true;

    try {
      const formData = new FormData();
      const audioBlob = new Blob([wavAudio], { type: 'audio/wav' });
      formData.append('file', audioBlob, 'chunk.wav');
      formData.append('model', model);
      formData.append('prompt', UNCLEAR_AUDIO_PROMPT);

      const headers = {};
      if (provider === 'openai') {
          headers['Authorization'] = `Bearer ${apiKey}`;
      } else if (provider === 'clyde-cloud-whisper') {
          const accessToken = await getFreshAccessToken();
          headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await axiosClient.post(apiUrl, formData, { headers, timeout });
      const transcript = normalizeTranscript(response && response.data, wavAudio, {
        speaker,
        speakerColor
      });

      const filteredTranscript = classifyFilteredTranscript(transcript.text, rms, hallucinationRms);
      if (filteredTranscript) {
        if (diagnostics) {
          sendStatus({
            state: 'capturing',
            message: `${speaker}: Ignored ${filteredTranscript.reason}. RMS ${Math.round(rms)}.`
          });
        }

        return { ok: true, skipped: filteredTranscript.skipped, rms, text: transcript.text };
      }

      sendTranscript(transcript);
      sendStatus({ state: 'capturing', message: 'Transcription received.' });
      lastErrorMessage = '';

      return { ok: true };
    } catch (error) {
      const message = describeHttpError(error);

      if (message !== lastErrorMessage) {
        lastErrorMessage = message;
        logger.error('Transcription API failed:', message);
        sendStatus({ state: 'warning', message });
      }

      return { ok: false, message, error };
    } finally {
      inFlight = false;
    }
  }

  return {
    processAudioChunk,
    close: () => {}
  };
}

function createRealtimeTranscriptionProcessor(options = {}) {
  const settings = options.settings || {};
  const apiKey = settings.transcriptionApiKey || '';
  const logger = options.logger || console;
  const sendTranscript = options.sendTranscript || (() => {});
  const sendStatus = options.sendStatus || (() => {});
  const sampleRate = options.sampleRate || DEFAULT_SAMPLE_RATE;
  const bitsPerSample = options.bitsPerSample || DEFAULT_BITS_PER_SAMPLE;
  const minRms = options.minRms ?? DEFAULT_MIN_RMS;
  const hallucinationRms = options.hallucinationRms ?? DEFAULT_HALLUCINATION_RMS;
  const diagnostics = options.diagnostics || false;
  const speaker = options.speaker || 'Transcription API';
  const speakerColor = options.speakerColor || '#d8bfd8';
  const sourceId = options.sourceId || normalizeFilterText(speaker) || 'source';
  const WebSocketImpl = options.WebSocketImpl || loadWebSocketImpl();
  const openReadyState = WebSocketImpl.OPEN ?? 1;
  const closeReadyState = WebSocketImpl.CLOSED ?? 3;

  let socket = null;
  let socketReady = false;
  let socketClosedByClient = false;
  let lastErrorMessage = '';
  let pendingAudio = [];
  let pendingAudioMs = 0;
  let latestRms = 0;
  let currentTurnMaxRms = 0;
  let lastCommittedTurnMaxRms = 0;
  let uncommittedAudioMs = 0;
  let uncommittedSpeechMs = 0;
  let trailingSilenceMs = 0;
  let hasUncommittedSpeech = false;
  let appendedAudioSinceCommitMs = 0;
  const partials = new Map();

  function processAudioChunk(chunk) {
    if (!apiKey) {
      const message = 'OpenAI API key is required for realtime transcription.';
      sendStatus({ state: 'warning', message });
      return Promise.resolve({ ok: false, message });
    }

    if (!chunk || !chunk.length) {
      return Promise.resolve({ ok: true, skipped: 'empty' });
    }

    const rms = calculatePcmRms(chunk, bitsPerSample);
    latestRms = rms;
    currentTurnMaxRms = Math.max(currentTurnMaxRms, rms);

    if (rms < minRms && diagnostics) {
      sendStatus({
        state: 'capturing',
        message: `Streaming quiet audio to realtime transcription. RMS ${Math.round(rms)}.`
      });
    }

    const pcm24 = resamplePcm16Mono(chunk, sampleRate, OPENAI_REALTIME_SAMPLE_RATE);
    const audioDurationMs = getPcm16DurationMs(pcm24, OPENAI_REALTIME_SAMPLE_RATE);

    enqueueAudio(pcm24, audioDurationMs);
    trackManualCommitState(rms, audioDurationMs);
    ensureSocket();

    if (socketReady) {
      flushPendingAudio();
      maybeCommitPendingAudio();
      return Promise.resolve({ ok: true });
    }

    return Promise.resolve({ ok: true, skipped: 'connecting' });
  }

  function ensureSocket() {
    if (socket && socket.readyState !== closeReadyState) {
      return;
    }

    socketClosedByClient = false;
    socketReady = false;
    socket = new WebSocketImpl(OPENAI_REALTIME_URL, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    attachSocketEvent(socket, 'open', () => {
      lastErrorMessage = '';
      sendSessionUpdate();
    });

    attachSocketEvent(socket, 'message', handleSocketMessage);

    attachSocketEvent(socket, 'error', (error) => {
      const message = error && error.message
        ? error.message
        : 'OpenAI realtime transcription websocket failed.';

      if (message !== lastErrorMessage) {
        lastErrorMessage = message;
        logger.error('OpenAI realtime transcription failed:', message);
        sendStatus({ state: 'warning', message });
      }
    });

    attachSocketEvent(socket, 'close', () => {
      socketReady = false;
      socket = null;

      if (!socketClosedByClient && diagnostics) {
        sendStatus({ state: 'warning', message: 'OpenAI realtime transcription disconnected.' });
      }
    });
  }

  function sendSessionUpdate() {
    sendSocketEvent({
      type: 'session.update',
      session: {
        type: 'transcription',
        audio: {
          input: {
            format: {
              type: 'audio/pcm',
              rate: OPENAI_REALTIME_SAMPLE_RATE
            },
            transcription: {
              model: OPENAI_REALTIME_WHISPER_MODEL,
              language: 'en'
            },
            turn_detection: null
          }
        }
      }
    });
  }

  function canCommitPendingAudio() {
    return socketReady
      && socket
      && socket.readyState === openReadyState
      && hasUncommittedSpeech
      && uncommittedSpeechMs >= OPENAI_REALTIME_MIN_COMMIT_AUDIO_MS
      && appendedAudioSinceCommitMs >= 100
      && pendingAudio.length === 0;
  }

  function shouldCommitPendingAudio(force = false) {
    return force
      || trailingSilenceMs >= OPENAI_REALTIME_SILENCE_COMMIT_MS
      || uncommittedAudioMs >= OPENAI_REALTIME_MAX_COMMIT_AUDIO_MS;
  }

  function sendCommitEvent() {
    const sent = sendSocketEvent({ type: 'input_audio_buffer.commit' });

    if (sent) {
      lastCommittedTurnMaxRms = Math.max(lastCommittedTurnMaxRms, currentTurnMaxRms, latestRms);
      resetManualCommitState();
    }

    return sent;
  }

  function maybeCommitPendingAudio(force = false) {
    if (!canCommitPendingAudio() || !shouldCommitPendingAudio(force)) {
      return false;
    }

    return sendCommitEvent();
  }

  function resetManualCommitState() {
    uncommittedAudioMs = 0;
    uncommittedSpeechMs = 0;
    trailingSilenceMs = 0;
    hasUncommittedSpeech = false;
    appendedAudioSinceCommitMs = 0;
    currentTurnMaxRms = 0;
  }

  function enqueueAudio(pcmAudio, durationMs = getPcm16DurationMs(pcmAudio, OPENAI_REALTIME_SAMPLE_RATE)) {
    pendingAudio.push(pcmAudio);
    pendingAudioMs += durationMs;

    while (pendingAudio.length > 1 && pendingAudioMs > OPENAI_REALTIME_PENDING_AUDIO_MS) {
      const dropped = pendingAudio.shift();
      pendingAudioMs -= getPcm16DurationMs(dropped, OPENAI_REALTIME_SAMPLE_RATE);
    }
  }

  function flushPendingAudio() {
    if (!socketReady || !socket || socket.readyState !== openReadyState) {
      return;
    }

    for (const pcmAudio of pendingAudio) {
      const sent = sendSocketEvent({
        type: 'input_audio_buffer.append',
        audio: pcmAudio.toString('base64')
      });

      if (sent) {
        appendedAudioSinceCommitMs += getPcm16DurationMs(pcmAudio, OPENAI_REALTIME_SAMPLE_RATE);
      }
    }

    pendingAudio = [];
    pendingAudioMs = 0;
  }

  function trackManualCommitState(rms, audioDurationMs) {
    if (!audioDurationMs) {
      return;
    }

    uncommittedAudioMs += audioDurationMs;

    if (rms >= minRms) {
      hasUncommittedSpeech = true;
      uncommittedSpeechMs += audioDurationMs;
      trailingSilenceMs = 0;
      return;
    }

    if (hasUncommittedSpeech) {
      trailingSilenceMs += audioDurationMs;
    }
  }

  function sendSocketEvent(event) {
    if (!socket || socket.readyState !== openReadyState) {
      return false;
    }

    socket.send(JSON.stringify(event));
    return true;
  }

  function handleSocketMessage(message) {
    const event = parseRealtimeEvent(message);

    if (!event || !event.type) {
      return;
    }

    if (event.type === 'conversation.item.input_audio_transcription.delta') {
      handleTranscriptDelta(event);
      return;
    }

    if (event.type === 'session.updated') {
      handleSessionUpdated();
      return;
    }

    if (event.type === 'conversation.item.input_audio_transcription.completed') {
      handleTranscriptCompleted(event);
      return;
    }

    if (event.type === 'error') {
      const messageText = event.error?.message || 'OpenAI realtime transcription returned an error.';
      logger.error('OpenAI realtime transcription error:', messageText);
      sendStatus({ state: 'warning', message: messageText });
    }
  }

  function handleSessionUpdated() {
    socketReady = true;
    lastErrorMessage = '';
    flushPendingAudio();
    maybeCommitPendingAudio();
    sendStatus({ state: 'capturing', message: 'OpenAI realtime transcription connected.' });
  }

  function handleTranscriptDelta(event) {
    const itemId = getCompositeRealtimeItemId(sourceId, event.item_id || event.itemId || 'unknown');
    const nextText = `${partials.get(itemId) || ''}${event.delta || ''}`;
    const text = nextText.trim();

    partials.set(itemId, nextText);

    if (!text || isPotentialUnclearAudioSentinel(text)) {
      return;
    }

    sendTranscript({
      text,
      speaker,
      speakerColor,
      partial: true,
      itemId,
      provider: OPENAI_REALTIME_WHISPER_PROVIDER
    });
  }

  function handleTranscriptCompleted(event) {
    const itemId = getCompositeRealtimeItemId(sourceId, event.item_id || event.itemId || 'unknown');
    const rawText = event.transcript || partials.get(itemId) || '';
    const text = normalizeTranscriptText(rawText, { speaker });
    const itemRms = lastCommittedTurnMaxRms || currentTurnMaxRms || latestRms;

    partials.delete(itemId);
    lastCommittedTurnMaxRms = 0;
    currentTurnMaxRms = 0;

    if (!text) {
      return;
    }

    const filteredTranscript = classifyFilteredTranscript(text, itemRms, hallucinationRms);
    if (filteredTranscript) {
      if (diagnostics) {
        sendStatus({
          state: 'capturing',
          message: `${speaker}: Ignored ${filteredTranscript.reason}. RMS ${Math.round(itemRms)}.`
        });
      }

      return;
    }

    sendTranscript({
      text,
      speaker,
      speakerColor,
      partial: false,
      itemId,
      provider: OPENAI_REALTIME_WHISPER_PROVIDER
    });
  }

  function close() {
    if (socketReady) {
      flushPendingAudio();
      maybeCommitPendingAudio(true);
    }

    pendingAudio = [];
    pendingAudioMs = 0;
    resetManualCommitState();
    partials.clear();
    socketClosedByClient = true;

    if (socket && socket.readyState !== closeReadyState && typeof socket.close === 'function') {
      socket.close();
    }

    socket = null;
    socketReady = false;
  }

  return {
    processAudioChunk,
    close
  };
}

function isLikelyQuietHallucination(text, rms, hallucinationRms = DEFAULT_HALLUCINATION_RMS) {
  const normalized = normalizeFilterText(text);

  return rms < hallucinationRms && COMMON_QUIET_HALLUCINATIONS.has(normalized);
}

function classifyFilteredTranscript(text, rms, hallucinationRms = DEFAULT_HALLUCINATION_RMS) {
  const normalized = normalizeFilterText(text);

  if (normalized === UNCLEAR_AUDIO_SENTINEL) {
    return { skipped: 'unclear-audio', reason: 'unclear audio sentinel' };
  }

  if (rms < hallucinationRms && COMMON_QUIET_HALLUCINATIONS.has(normalized)) {
    return { skipped: 'hallucination', reason: 'likely silence hallucination' };
  }

  return null;
}

function normalizeFilterText(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

function calculatePcmRms(pcmAudio, bitsPerSample = DEFAULT_BITS_PER_SAMPLE) {
  if (!pcmAudio.length || bitsPerSample !== 16) {
    return 0;
  }

  let sumSquares = 0;
  let samples = 0;

  for (let index = 0; index + 1 < pcmAudio.length; index += 2) {
    const sample = pcmAudio.readInt16LE(index);
    sumSquares += sample * sample;
    samples += 1;
  }

  return samples ? Math.sqrt(sumSquares / samples) : 0;
}

function buildWavFile(pcmAudio, options = {}) {
  const sampleRate = options.sampleRate || DEFAULT_SAMPLE_RATE;
  const channels = options.channels || DEFAULT_CHANNELS;
  const bitsPerSample = options.bitsPerSample || DEFAULT_BITS_PER_SAMPLE;
  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmAudio.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmAudio.length, 40);

  return Buffer.concat([header, pcmAudio], header.length + pcmAudio.length);
}

function normalizeTranscript(data, chunk, defaults = {}) {
  if (data && typeof data === 'object' && data.text) {
    const speaker = data.speaker || defaults.speaker || 'Transcription API';
    return {
      text: normalizeTranscriptText(data.text, { speaker }),
      speaker,
      speakerColor: data.speakerColor || defaults.speakerColor || '#d8bfd8'
    };
  }

  return createSimulatedTranscript(chunk, defaults);
}

function normalizeTranscriptText(text, options = {}) {
  let normalized = String(text || '').trim().replace(/\s+/g, ' ');

  if (!normalized || !shouldApplyFirstPersonTranscriptCorrections(options.speaker)) {
    return normalized;
  }

  normalized = normalized.replace(/^the most proud of\b/i, "I'm most proud of");
  normalized = normalized.replace(/^most proud of\b/i, "I'm most proud of");
  normalized = normalized.replace(/^i most proud of\b/i, "I'm most proud of");

  return normalized;
}

function shouldApplyFirstPersonTranscriptCorrections(speaker = '') {
  if (!speaker) {
    return true;
  }

  const normalized = normalizeFilterText(speaker);
  return FIRST_PERSON_CORRECTION_SPEAKERS.has(normalized);
}

function createSimulatedTranscript(chunk, defaults = {}) {
  return {
    text: `Captured audio chunk (${chunk.length} bytes). Configure LM_STUDIO_API_URL to use a transcription endpoint.`,
    speaker: defaults.speaker || 'Audio Capture',
    speakerColor: defaults.speakerColor || '#d8bfd8'
  };
}

function describeHttpError(error) {
  const url = error && error.config && error.config.url
    ? ` calling ${error.config.url}`
    : '';

  if (error && error.response) {
    const statusText = error.response.statusText
      ? ` ${error.response.statusText}`
      : '';
    const responseDetails = formatResponseDetails(error.response.data);

    return `HTTP ${error.response.status}${statusText} from ${error.config && error.config.url ? error.config.url : 'transcription API'}${responseDetails}`;
  }

  if (error && error.code) {
    return `${error.code}${url}`;
  }

  if (error && error.message) {
    return `${error.message}${url}`;
  }

  return `Unknown transcription API error${url}`;
}

function formatResponseDetails(data) {
  if (!data) {
    return '';
  }

  const details = typeof data === 'string'
    ? data
    : JSON.stringify(data);
  const trimmed = details.length > 300
    ? `${details.slice(0, 300)}...`
    : details;

  return `: ${trimmed}`;
}

function loadWebSocketImpl() {
  try {
    return require('ws');
  } catch (error) {
    throw new Error('The ws package is required for OpenAI realtime transcription.');
  }
}

function attachSocketEvent(socket, eventName, handler) {
  if (socket && typeof socket.on === 'function') {
    socket.on(eventName, handler);
    return;
  }

  if (socket && typeof socket.addEventListener === 'function') {
    socket.addEventListener(eventName, (event) => {
      handler(event && Object.prototype.hasOwnProperty.call(event, 'data') ? event.data : event);
    });
  }
}

function parseRealtimeEvent(message) {
  try {
    const raw = Buffer.isBuffer(message)
      ? message.toString('utf8')
      : typeof message === 'string'
        ? message
        : message && Object.prototype.hasOwnProperty.call(message, 'data')
          ? message.data
          : message;
    const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw || '');
    return text ? JSON.parse(text) : null;
  } catch (error) {
    return null;
  }
}

function getCompositeRealtimeItemId(sourceId, itemId) {
  return `${sourceId || 'source'}:${itemId || 'unknown'}`;
}

function isPotentialUnclearAudioSentinel(text) {
  const normalized = normalizeFilterText(text);
  const sentinel = normalizeFilterText(UNCLEAR_AUDIO_SENTINEL);

  return Boolean(normalized) && sentinel.startsWith(normalized);
}

function getPcm16DurationMs(pcmAudio, sampleRate) {
  return pcmAudio && pcmAudio.length
    ? Math.round((pcmAudio.length / 2) / sampleRate * 1000)
    : 0;
}

function resamplePcm16Mono(pcmAudio, fromSampleRate = DEFAULT_SAMPLE_RATE, toSampleRate = OPENAI_REALTIME_SAMPLE_RATE) {
  if (!pcmAudio || !pcmAudio.length || fromSampleRate === toSampleRate) {
    return Buffer.from(pcmAudio || []);
  }

  const inputSamples = Math.floor(pcmAudio.length / 2);
  const outputSamples = Math.max(1, Math.floor(inputSamples * toSampleRate / fromSampleRate));
  const output = Buffer.alloc(outputSamples * 2);

  for (let outputIndex = 0; outputIndex < outputSamples; outputIndex += 1) {
    const sourcePosition = outputIndex * fromSampleRate / toSampleRate;
    const leftIndex = Math.floor(sourcePosition);
    const rightIndex = Math.min(inputSamples - 1, leftIndex + 1);
    const fraction = sourcePosition - leftIndex;
    const left = pcmAudio.readInt16LE(leftIndex * 2);
    const right = pcmAudio.readInt16LE(rightIndex * 2);
    const sample = Math.round(left + (right - left) * fraction);
    output.writeInt16LE(Math.max(-32768, Math.min(32767, sample)), outputIndex * 2);
  }

  return output;
}

async function getFreshAccessToken() {
  let Store;
  try {
    Store = require('electron-store').default || require('electron-store');
  } catch (e) {
    return '';
  }
  const store = new Store();
  const userId = store.get('userId', '');
  const accessToken = store.get('authAccessToken', '');
  const refreshToken = store.get('authRefreshToken', '');
  const expiresAt = Number(store.get('authExpiresAt', 0));

  if (!userId || !accessToken) {
    return '';
  }

  // If still valid (with 2 minutes buffer), return it!
  if (expiresAt && (expiresAt - Date.now() > 120000)) {
    return accessToken;
  }

  if (!refreshToken) {
    return '';
  }

  try {
    const { refreshSession } = require('./authClient');
    const refreshed = await refreshSession({ refreshToken });
    if (refreshed && refreshed.accessToken) {
      store.set({
        userId: refreshed.userId || '',
        authEmail: refreshed.email || '',
        authAccessToken: refreshed.accessToken || '',
        authRefreshToken: refreshed.refreshToken || '',
        authExpiresAt: refreshed.expiresAt || null
      });
      return refreshed.accessToken;
    }
  } catch (e) {
    console.error('Failed to refresh Supabase session token in transcription client:', e);
  }

  return accessToken;
}

module.exports = {
  buildWavFile,
  calculatePcmRms,
  createTranscriptionProcessor,
  describeHttpError,
  classifyFilteredTranscript,
  resamplePcm16Mono,
  normalizeTranscriptText,
  isLikelyQuietHallucination
};
