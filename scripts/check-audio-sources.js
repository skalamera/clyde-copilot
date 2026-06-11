const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const userSecretsPath = path.join(os.homedir(), '.secrets', 'clyde-dev.env');
if (fs.existsSync(userSecretsPath)) {
  require('dotenv').config({ path: userSecretsPath });
} else {
  require('dotenv').config();
}

const { createAudioCapture } = require('../src/audioCapture');
const { calculatePcmRms } = require('../src/transcriptionClient');

const sourceText = process.env.CLYDE_AUDIO_SOURCES || `Default|${process.env.CLYDE_AUDIO_DEVICE || 'default'}|#d8bfd8`;
const sources = sourceText
  .split(';')
  .map((item) => {
    const [label, device] = item.split('|').map((part) => part && part.trim());
    return { label, device };
  })
  .filter((source) => source.label && source.device);

const totals = new Map(sources.map((source) => [source.label, { chunks: 0, rms: 0 }]));
const captures = sources.map((source) => createAudioCapture({
  env: process.env,
  logger: console,
  recordOptions: {
    device: source.device
  },
  onStatus: (status) => console.log(`${source.label}: ${status.message}`),
  processAudioChunk: (chunk) => {
    const current = totals.get(source.label);
    current.chunks += 1;
    current.rms = calculatePcmRms(chunk);
  }
}));

for (const capture of captures) {
  const result = capture.start();

  if (!result.ok) {
    console.error(result.message);
  }
}

console.log('Play YouTube, then speak. Levels print every second. Press Ctrl+C to stop.');

const interval = setInterval(() => {
  const line = sources
    .map((source) => {
      const current = totals.get(source.label);
      return `${source.label}: RMS ${Math.round(current.rms)} chunks ${current.chunks}`;
    })
    .join(' | ');

  console.log(line);
}, 1000);

function stop() {
  clearInterval(interval);

  for (const capture of captures) {
    capture.stop();
  }

  process.exit(0);
}

process.on('SIGINT', stop);
setTimeout(stop, Number(process.env.CLYDE_AUDIO_CHECK_MS || 15000));
