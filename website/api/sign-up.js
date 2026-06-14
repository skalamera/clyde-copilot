import { listSupabaseUsersByEmail, normalizeEmail, sendJson } from './_billing.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');
    const redirectTo = String(body.redirectTo || process.env.CLYDE_AUTH_REDIRECT_URL || 'https://clydeai.live/auth/confirmed').trim();

    if (!email || !password) {
      sendJson(res, 400, { error: 'Email and password are required.' });
      return;
    }

    const existing = await listSupabaseUsersByEmail(email);
    if (existing.length > 0) {
      sendJson(res, 400, { error: 'An account with this email already exists. Please sign in instead.' });
      return;
    }

    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error('Supabase signup is not configured.');
    }

    const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password,
        options: {
          email_redirect_to: redirectTo
        }
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      sendJson(res, response.status, { error: payload?.msg || payload?.message || payload?.error || 'Account creation failed.' });
      return;
    }

    sendJson(res, 200, payload);
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message });
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
