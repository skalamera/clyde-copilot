const fs = require('node:fs');
const path = require('node:path');

function createSessionDebugTrace(options = {}) {
  const enabled = Boolean(options.enabled);
  const appPath = options.appPath || process.cwd();
  const logger = options.logger || console;

  if (!enabled) {
    return {
      enabled: false,
      filePath: '',
      write: () => {},
      close: () => {}
    };
  }

  const dir = path.join(appPath, 'logs', 'session-traces');
  fs.mkdirSync(dir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(dir, `clyde-session-trace-${stamp}.jsonl`);
  const stream = fs.createWriteStream(filePath, { flags: 'a' });
  let closed = false;

  function write(event, data = {}) {
    if (closed) {
      return;
    }

    try {
      stream.write(`${JSON.stringify({
        ts: new Date().toISOString(),
        event,
        ...sanitize(data)
      })}\n`);
    } catch (error) {
      logger.warn?.(`Session debug trace write failed: ${error.message}`);
    }
  }

  function close() {
    if (closed) {
      return;
    }
    closed = true;
    try {
      stream.end();
    } catch (_error) {}
  }

  write('trace.started', { filePath });

  return {
    enabled: true,
    filePath,
    write,
    close
  };
}

function sanitize(value) {
  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (/api.?key|token|secret|authorization|password/i.test(key)) {
      out[key] = '[redacted]';
    } else if (Buffer.isBuffer(raw)) {
      out[key] = `[buffer:${raw.length}]`;
    } else {
      out[key] = sanitize(raw);
    }
  }
  return out;
}

module.exports = {
  createSessionDebugTrace
};
