import { sendJson } from './_billing.js';
import { verifySignedLicenseToken, checkRateLimit } from './proxy.js';
import { requireSupabaseUser } from './_billing.js';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Allowed redirect URIs: desktop loopback PKCE flows + the Clyde website.
function isAllowedRedirectUri(value) {
  if (!value) return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  // Desktop app loopback server (any port)
  if (url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost')) {
    return true;
  }
  // Website-hosted flows
  if (url.protocol === 'https:' && (url.hostname === 'clydeai.live' || url.hostname === 'www.clydeai.live')) {
    return true;
  }
  return false;
}

async function authenticateRequest(req) {
  const authHeader = String(req.headers.authorization || '');
  const authToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  if (!authToken) return null;

  // a) Signed license token (clyde_lic_...)
  const signedUser = await verifySignedLicenseToken(authToken);
  if (signedUser) return signedUser;

  // b) Supabase session JWT
  try {
    return await requireSupabaseUser(req);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    // 1. Require authentication (signed license token or Supabase JWT) so this
    //    endpoint cannot be used as an open token-exchange proxy riding on
    //    Clyde's Google OAuth client identity.
    const user = await authenticateRequest(req);
    if (!user || !user.id) {
      sendJson(res, 401, { error: 'Authentication required. Sign in to Clyde before connecting Google.' });
      return;
    }

    // 2. Rate limit per user.
    if (!checkRateLimit(user.id, 'google-oauth')) {
      res.setHeader('Retry-After', '60');
      sendJson(res, 429, { error: 'Too many Google OAuth requests. Please retry shortly.' });
      return;
    }

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
      const redirectUri = clean(body.redirectUri);
      // 3. Restrict redirect URIs to known Clyde surfaces.
      if (!isAllowedRedirectUri(redirectUri)) {
        sendJson(res, 400, { error: 'Redirect URI is not allowed.' });
        return;
      }
      params.set('code', clean(body.code));
      params.set('code_verifier', clean(body.codeVerifier));
      params.set('redirect_uri', redirectUri);
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
    console.error('Google OAuth token proxy failed:', error.message);
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
