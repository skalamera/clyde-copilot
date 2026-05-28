import { sendJson } from './_billing.js';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const grantType = clean(body.grantType);
    const clientId = clean(process.env.CLYDE_GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || body.clientId);
    const clientSecret = clean(process.env.CLYDE_GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET);
    if (!clientId || !clientSecret) {
      sendJson(res, 500, { error: 'Google OAuth is not configured on the Clyde API.' });
      return;
    }
    if (!['authorization_code', 'refresh_token'].includes(grantType)) {
      sendJson(res, 400, { error: 'Unsupported Google OAuth grant type.' });
      return;
    }

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: grantType
    });
    if (grantType === 'authorization_code') {
      params.set('code', clean(body.code));
      params.set('code_verifier', clean(body.codeVerifier));
      params.set('redirect_uri', clean(body.redirectUri));
    }
    if (grantType === 'refresh_token') {
      params.set('refresh_token', clean(body.refreshToken));
    }

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    const payload = await response.json().catch(() => ({}));
    sendJson(res, response.ok ? 200 : response.status, payload);
  } catch (error) {
    console.error('Google OAuth token proxy failed:', error);
    sendJson(res, 500, { error: error.message || 'Google OAuth token proxy failed.' });
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function clean(value) {
  return String(value || '').trim();
}
