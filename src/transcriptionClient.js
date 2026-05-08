const DEFAULT_INTERVAL_MS = 1500;
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_SAMPLE_RATE = 44100;
const DEFAULT_CHANNELS = 1;
const DEFAULT_BITS_PER_SAMPLE = 16;
const DEFAULT_SEGMENT_SECONDS = 8; // Increased from 5 to 8 to capture much longer sentences
const DEFAULT_MIN_RMS = 100;
const DEFAULT_HALLUCINATION_RMS = 350;
const COMMON_QUIET_HALLUCINATIONS = new Set([
  'thank you',
  'thank you.',
  'thanks for watching',
  'thanks for watching.',
  'you'
]);

function createTranscriptionProcessor(options = {}) {
  const apiUrl = (options.apiUrl || '').trim();
  const axiosClient = options.axiosClient;
  const logger = options.logger || console;
  const sendTranscript = options.sendTranscript || (() => {});
  const sendStatus = options.sendStatus || (() => {});
  const minIntervalMs = options.minIntervalMs ?? DEFAULT_INTERVAL_MS;
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const model = options.model || 'Systran/faster-distil-whisper-large-v3';
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
      sendTranscript(createSimulatedTranscript(wavAudio));
      return { ok: true, simulated: true };
    }

    inFlight = true;

    try {
      const formData = new FormData();
      const audioBlob = new Blob([wavAudio], { type: 'audio/wav' });
      formData.append('file', audioBlob, 'chunk.wav');
      formData.append('model', model);

      const response = await axiosClient.post(apiUrl, formData, { timeout });
      const transcript = normalizeTranscript(response && response.data, wavAudio, {
        speaker,
        speakerColor
      });

      if (isLikelyQuietHallucination(transcript.text, rms, hallucinationRms)) {
        if (diagnostics) {
          sendStatus({
            state: 'capturing',
            message: `${speaker}: Ignored likely silence hallucination. RMS ${Math.round(rms)}.`
          });
        }

        return { ok: true, skipped: 'hallucination', rms, text: transcript.text };
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
    processAudioChunk
  };
}

function isLikelyQuietHallucination(text, rms, hallucinationRms = DEFAULT_HALLUCINATION_RMS) {
  const normalized = String(text || '').trim().toLowerCase();

  return rms < hallucinationRms && COMMON_QUIET_HALLUCINATIONS.has(normalized);
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
    return {
      text: data.text,
      speaker: data.speaker || defaults.speaker || 'Transcription API',
      speakerColor: data.speakerColor || defaults.speakerColor || '#d8bfd8'
    };
  }

  return createSimulatedTranscript(chunk, defaults);
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

module.exports = {
  buildWavFile,
  calculatePcmRms,
  createTranscriptionProcessor,
  describeHttpError,
  isLikelyQuietHallucination
};
