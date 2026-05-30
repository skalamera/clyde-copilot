const crypto = require('node:crypto');
const http = require('node:http');
const axios = require('axios');

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

function createGoogleClient(options = {}) {
  const axiosClient = options.axiosClient || axios;
  const openExternal = options.openExternal || (() => Promise.resolve());
  const now = typeof options.now === 'function' ? options.now : () => Date.now();

  async function connect({ clientId, clientSecret, tokenEndpoint, timeoutMs = 120000 } = {}) {
    const cleanClientId = clean(clientId);
    const cleanClientSecret = clean(clientSecret);
    if (!cleanClientId) {
      throw new Error('Google OAuth client ID is required.');
    }

    const verifier = base64Url(crypto.randomBytes(32));
    const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest());
    const state = base64Url(crypto.randomBytes(18));
    const { server, redirectUri, waitForCode } = await createLoopbackServer({ state, timeoutMs });

    try {
      const url = new URL(GOOGLE_AUTH_URL);
      url.searchParams.set('client_id', cleanClientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', GOOGLE_SCOPES.join(' '));
      url.searchParams.set('access_type', 'offline');
      url.searchParams.set('prompt', 'consent');
      url.searchParams.set('code_challenge', challenge);
      url.searchParams.set('code_challenge_method', 'S256');
      url.searchParams.set('state', state);

      await openExternal(String(url));
      const code = await waitForCode;
      let tokenResponse;
      try {
        tokenResponse = await exchangeToken({
          clientId: cleanClientId,
          clientSecret: cleanClientSecret,
          code,
          codeVerifier: verifier,
          grantType: 'authorization_code',
          redirectUri,
          tokenEndpoint
        });
      } catch (error) {
        throw new Error(`Google OAuth token exchange failed: ${describeGoogleError(error)}`);
      }

      const tokens = normalizeTokenResponse(tokenResponse.data, now());
      let profile;
      try {
        profile = await getProfile(tokens.access_token);
      } catch (error) {
        throw new Error(`Google profile lookup failed: ${describeGoogleError(error)}`);
      }
      return { tokens, profile };
    } finally {
      server.close();
    }
  }

  async function refreshAccessToken({ clientId, clientSecret, refreshToken, tokenEndpoint } = {}) {
    const cleanClientId = clean(clientId);
    const cleanClientSecret = clean(clientSecret);
    const cleanRefreshToken = clean(refreshToken);
    if (!cleanClientId || !cleanRefreshToken) {
      throw new Error('Google OAuth client ID and refresh token are required.');
    }

    let response;
    try {
      response = await exchangeToken({
        clientId: cleanClientId,
        clientSecret: cleanClientSecret,
        refreshToken: cleanRefreshToken,
        grantType: 'refresh_token',
        tokenEndpoint
      });
    } catch (error) {
      throw new Error(`Google OAuth token refresh failed: ${describeGoogleError(error)}`);
    }

    return normalizeTokenResponse({ ...response.data, refresh_token: cleanRefreshToken }, now());
  }

  async function getProfile(accessToken) {
    const response = await axiosClient.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: authHeaders(accessToken)
    });
    return {
      email: clean(response.data?.email),
      name: clean(response.data?.name)
    };
  }

  async function exchangeToken({
    clientId,
    clientSecret,
    code,
    codeVerifier,
    refreshToken,
    grantType,
    redirectUri,
    tokenEndpoint
  } = {}) {
    const cleanTokenEndpoint = clean(tokenEndpoint);
    if (cleanTokenEndpoint) {
      return axiosClient.post(cleanTokenEndpoint, {
        clientId,
        code,
        codeVerifier,
        refreshToken,
        grantType,
        redirectUri
      }, {
        headers: { 'content-type': 'application/json' }
      });
    }

    return axiosClient.post(GOOGLE_TOKEN_URL, oauthParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      code_verifier: codeVerifier,
      refresh_token: refreshToken,
      grant_type: grantType,
      redirect_uri: redirectUri
    }).toString(), {
      headers: { 'content-type': 'application/x-www-form-urlencoded' }
    });
  }

  async function listGmailMessages({ accessToken, query = '', maxResults = 10 } = {}) {
    const response = await axiosClient.get('https://gmail.googleapis.com/gmail/v1/users/me/messages', {
      headers: authHeaders(accessToken),
      params: { q: query, maxResults }
    });
    const refs = Array.isArray(response.data?.messages) ? response.data.messages : [];
    const messages = [];
    for (const ref of refs) {
      const detail = await axiosClient.get(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(ref.id)}`, {
        headers: authHeaders(accessToken),
        params: { format: 'full' }
      });
      messages.push(normalizeGmailMessage(detail.data));
    }
    return messages;
  }

  async function listCalendarEvents({ accessToken, orderBy = 'startTime', timeMin = new Date().toISOString(), maxResults = 25 } = {}) {
    const response = await axiosClient.get('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      headers: authHeaders(accessToken),
      params: {
        singleEvents: true,
        orderBy,
        timeMin,
        maxResults
      }
    });
    return (Array.isArray(response.data?.items) ? response.data.items : []).map(normalizeCalendarEvent);
  }

  return {
    connect,
    getProfile,
    listCalendarEvents,
    listGmailMessages,
    refreshAccessToken
  };
}

function createLoopbackServer({ state, timeoutMs }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer = null;
    let resolveCode;
    let rejectCode;
    const waitForCode = new Promise((res, rej) => {
      resolveCode = res;
      rejectCode = rej;
    });

    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname !== '/oauth2callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      if (url.searchParams.get('state') !== state) {
        res.writeHead(400);
        res.end('Invalid OAuth state. You can close this tab.');
        rejectCode(new Error('Google OAuth state did not match.'));
        return;
      }
      const code = clean(url.searchParams.get('code'));
      if (!code) {
        res.writeHead(400);
        res.end('Google OAuth did not return a code. You can close this tab.');
        rejectCode(new Error('Google OAuth did not return a code.'));
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html><body><h1>Clyde received the Google authorization.</h1><p>Return to Clyde to finish connecting.</p></body></html>');
      resolveCode(code);
    });

    server.on('error', (error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(error);
      } else {
        rejectCode(error);
      }
    });

    server.listen(0, '127.0.0.1', () => {
      settled = true;
      const address = server.address();
      timer = setTimeout(() => {
        rejectCode(new Error('Google OAuth timed out.'));
        server.close();
      }, timeoutMs);
      waitForCode.finally(() => clearTimeout(timer)).catch(() => {});
      resolve({
        server,
        redirectUri: `http://127.0.0.1:${address.port}/oauth2callback`,
        waitForCode
      });
    });
  });
}

function normalizeTokenResponse(data = {}, issuedAtMs = Date.now()) {
  const expiresIn = Number(data.expires_in || 0);
  return {
    access_token: clean(data.access_token),
    refresh_token: clean(data.refresh_token),
    token_type: clean(data.token_type || 'Bearer'),
    scope: clean(data.scope),
    expires_at: expiresIn ? new Date(issuedAtMs + expiresIn * 1000).toISOString() : ''
  };
}

function normalizeGmailMessage(message = {}) {
  const headers = Array.isArray(message.payload?.headers) ? message.payload.headers : [];
  const header = (name) => clean(headers.find((item) => clean(item.name).toLowerCase() === name)?.value);
  const body = extractGmailBody(message.payload);

  return {
    id: clean(message.id),
    threadId: clean(message.threadId),
    subject: header('subject'),
    from: header('from'),
    date: header('date'),
    snippet: clean(message.snippet),
    body: clean(body),
    internalDate: clean(message.internalDate)
  };
}

function extractGmailBody(payload = {}) {
  const textParts = [];
  const htmlParts = [];

  function visit(part = {}) {
    if (part.body?.data) {
      const decoded = decodeGmailBody(part.body.data);
      if (part.mimeType === 'text/plain') {
        textParts.push(decoded);
      } else if (part.mimeType === 'text/html') {
        htmlParts.push(decoded.replace(/<[^>]+>/g, ' '));
      }
    }
    for (const child of Array.isArray(part.parts) ? part.parts : []) {
      visit(child);
    }
  }

  visit(payload);
  return clean((textParts.length ? textParts : htmlParts).join('\n').replace(/\s+/g, ' '));
}

function decodeGmailBody(value) {
  try {
    return Buffer.from(clean(value).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  } catch (_error) {
    return '';
  }
}

function normalizeCalendarEvent(event = {}) {
  return {
    id: clean(event.id),
    htmlLink: clean(event.htmlLink),
    hangoutLink: clean(event.hangoutLink),
    title: clean(event.summary || event.title || 'Google Calendar event'),
    description: clean(event.description),
    location: clean(event.location),
    start: clean(event.start?.dateTime || event.start?.date),
    end: clean(event.end?.dateTime || event.end?.date),
    attendees: Array.isArray(event.attendees) ? event.attendees.map((item) => clean(item.email || item.displayName)).filter(Boolean) : []
  };
}

function authHeaders(accessToken) {
  return { Authorization: `Bearer ${accessToken}` };
}

function oauthParams(params = {}) {
  const cleanParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const cleanValue = clean(value);
    if (cleanValue) {
      cleanParams.set(key, cleanValue);
    }
  }
  return cleanParams;
}

function describeGoogleError(error) {
  const status = error?.response?.status;
  const data = error?.response?.data;
  const pieces = [];
  if (status) {
    pieces.push(`HTTP ${status}`);
  }
  if (data && typeof data === 'object') {
    if (data.error) {
      if (typeof data.error === 'object') {
        pieces.push(clean(data.error.message || JSON.stringify(data.error)));
      } else {
        pieces.push(clean(data.error));
      }
    }
    if (data.error_description) {
      pieces.push(clean(data.error_description));
    }
    if (data.message) {
      pieces.push(clean(data.message));
    }
  } else if (typeof data === 'string' && data.trim()) {
    pieces.push(data.trim());
  }
  if (!pieces.length && error?.message) {
    pieces.push(error.message);
  }
  return pieces.filter(Boolean).join(': ') || 'Unknown Google API error';
}

function base64Url(buffer) {
  return Buffer.from(buffer).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function clean(value) {
  return String(value || '').trim();
}

module.exports = {
  GOOGLE_SCOPES,
  createGoogleClient,
  describeGoogleError,
  extractGmailBody,
  normalizeCalendarEvent,
  normalizeGmailMessage,
  oauthParams
};
