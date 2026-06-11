const assert = require('node:assert/strict');
const test = require('node:test');
const http = require('node:http');

const {
  startExtensionServer,
  stopExtensionServer
} = require('../src/extensionServer');

const TEST_PORT = 45931;

function request({ method = 'GET', path = '/api/status', headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port: TEST_PORT,
      method,
      path,
      headers
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('extension server origin guard', async (t) => {
  const managers = {
    loadSettings: () => ({}),
    publicSettings: (s) => s
  };
  await startExtensionServer(managers, null, { port: TEST_PORT });

  await t.test('allows requests with no Origin header (extension SW, curl, desktop)', async () => {
    const res = await request();
    assert.equal(res.status, 200);
  });

  await t.test('allows chrome-extension:// origins and echoes them in CORS', async () => {
    const origin = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
    const res = await request({ headers: { Origin: origin } });
    assert.equal(res.status, 200);
    assert.equal(res.headers['access-control-allow-origin'], origin);
  });

  await t.test('rejects web page origins with 403', async () => {
    const res = await request({ headers: { Origin: 'https://evil.example.com' } });
    assert.equal(res.status, 403);
    assert.notEqual(res.headers['access-control-allow-origin'], 'https://evil.example.com');
  });

  await t.test('rejects localhost web origins too', async () => {
    const res = await request({ headers: { Origin: 'http://localhost:3000' } });
    assert.equal(res.status, 403);
  });

  await t.test('OPTIONS preflight from a web origin gets no CORS approval', async () => {
    const res = await request({ method: 'OPTIONS', headers: { Origin: 'https://evil.example.com' } });
    assert.notEqual(res.headers['access-control-allow-origin'], 'https://evil.example.com');
  });

  await stopExtensionServer();
});
