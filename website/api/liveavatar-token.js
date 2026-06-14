import { findSubscriptionByUserId, readJson, requireSupabaseUser } from './_billing.js';

const LIVEAVATAR_API_BASE = 'https://api.liveavatar.com';
const SANDBOX_AVATAR_ID = 'dd73ea75-1218-4ef3-92ce-606d5f7fbc0a';
const SANDBOX_RATE_LIMIT_PER_HOUR = 3;
const SANDBOX_WINDOW_MS = 60 * 60 * 1000;
const sandboxBuckets = new Map();

function checkSandboxRateLimit(ip) {
  const now = Date.now();
  let bucket = sandboxBuckets.get(ip);
  if (!bucket || now - bucket.windowStart >= SANDBOX_WINDOW_MS) {
    bucket = { windowStart: now, count: 0 };
    sandboxBuckets.set(ip, bucket);
  }
  bucket.count += 1;
  if (sandboxBuckets.size > 2000) {
    for (const [k, v] of sandboxBuckets) {
      if (now - v.windowStart >= SANDBOX_WINDOW_MS) sandboxBuckets.delete(k);
    }
  }
  return bucket.count <= SANDBOX_RATE_LIMIT_PER_HOUR;
}

function clientIp(request) {
  const fwd = String(request.headers['x-forwarded-for'] || '');
  return fwd.split(',')[0].trim() || request.socket?.remoteAddress || 'unknown';
}

function isActiveSubscription(subscription) {
  return ['active', 'trialing'].includes(String(subscription?.status || '').toLowerCase());
}

function clampText(value, limit) {
  return String(value || '').slice(0, limit);
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.LIVEAVATAR_API_KEY;
  if (!apiKey) {
    response.status(500).json({ error: 'LIVEAVATAR_API_KEY is not configured.' });
    return;
  }

  try {
    const body = await readJson(request);
    const hasAuth = String(request.headers.authorization || '').toLowerCase().startsWith('bearer ');

    // Unauthenticated sandbox demo: rate-limit per IP so the paid LiveAvatar
    // key cannot be drained by scripted requests.
    if (!hasAuth && !checkSandboxRateLimit(clientIp(request))) {
      response.setHeader('Retry-After', '3600');
      response.status(429).json({ error: 'Sandbox demo limit reached. Please try again later or sign in with Clyde Pro.' });
      return;
    }

    let contextPayload = {
      name: `Clyde website sandbox - ${new Date().toISOString()}`,
      opening_text: 'Hi, I am Clyde. Let us run a quick mock interview practice round.',
      prompt: [
        'You are Clyde, a concise mock interview practice avatar for software and operations interviews.',
        'Ask one interview question at a time. Keep responses brief, supportive, and practical.',
        'This is a public website sandbox demo, so do not ask for sensitive personal information.'
      ].join('\n')
    };
    let isSandbox = true;

    if (hasAuth) {
      const user = await requireSupabaseUser(request);
      const subscription = await findSubscriptionByUserId(user.id);
      if (!isActiveSubscription(subscription)) {
        response.status(403).json({ error: 'Clyde Pro Agent is required for LiveAvatar mock interviews.' });
        return;
      }

      contextPayload = {
        name: clampText(body.contextName || `Clyde mock interview - ${user.id} - ${new Date().toISOString()}`, 120),
        opening_text: clampText(body.openingText || "Hello there! I'm ready to begin the interview.", 1000),
        prompt: clampText(body.prompt || '', 30000)
      };
      isSandbox = false;

      if (!contextPayload.prompt) {
        response.status(400).json({ error: 'Missing LiveAvatar prompt.' });
        return;
      }
    }

    const contextRes = await fetch(`${LIVEAVATAR_API_BASE}/v1/contexts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey
      },
      body: JSON.stringify(contextPayload)
    });

    if (!contextRes.ok) {
      const text = await contextRes.text();
      throw new Error(`Context creation failed: ${contextRes.status} ${text}`);
    }

    const contextJson = await contextRes.json();
    const contextId = contextJson?.data?.id;
    if (!contextId) {
      throw new Error('Context creation did not return an id.');
    }

    const tokenRes = await fetch(`${LIVEAVATAR_API_BASE}/v1/sessions/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey
      },
      body: JSON.stringify({
        mode: 'FULL',
        is_sandbox: isSandbox,
        avatar_id: body.avatarId || SANDBOX_AVATAR_ID,
        avatar_persona: {
          context_id: contextId,
          language: 'en'
        }
      })
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`Session token failed: ${tokenRes.status} ${text}`);
    }

    const tokenJson = await tokenRes.json();
    const sessionToken = tokenJson?.data?.session_token;
    if (!sessionToken) {
      throw new Error('Session token response did not include a token.');
    }

    response.status(200).json({ sessionToken });
  } catch (error) {
    response.status(500).json({ error: error.message || 'Failed to start LiveAvatar sandbox.' });
  }
}
