import Stripe from 'stripe';

const PRO_FEATURES = [
  'live_capture',
  'local_transcription',
  'standard_assistant',
  'basic_sessions',
  'basic_calendar',
  'active_context_files',
  'local_knowledge',
  'pro_realtime_agent',
  'knowledge_rag',
  'pinecone_sync',
  'trend_analysis',
  'mock_interviews',
  'google_sync',
  'agent_chat',
  'agent_actions',
  'liveavatar_mock_interviews'
];

const FREE_FEATURES = [
  'live_capture',
  'local_transcription',
  'standard_assistant',
  'basic_sessions',
  'basic_calendar',
  'active_context_files',
  'local_knowledge'
];

export function getStripe() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }
  return new Stripe(secret, { apiVersion: '2025-11-17.clover' });
}

export function getAppUrl(req) {
  const configured = process.env.CLYDE_APP_URL || process.env.VITE_PUBLIC_APP_URL;
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  return `${proto}://${host}`;
}

export function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

export function readJson(req) {
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

export function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function requireUserId(req, body = {}) {
  const userId = String(body.userId || req.headers['x-clyde-user-id'] || '').trim();
  if (!userId) {
    const error = new Error('Missing userId.');
    error.statusCode = 401;
    throw error;
  }
  return userId;
}

export function freeEntitlements(userId = '') {
  return {
    userId,
    tier: 'free',
    userTier: 'free',
    plan: 'clyde_assistant',
    status: 'free',
    pro: false,
    features: FREE_FEATURES,
    expiresAt: null,
    checkedAt: new Date().toISOString()
  };
}

export function proEntitlements(userId, subscription = {}) {
  return {
    userId,
    tier: 'pro',
    userTier: 'pro',
    plan: 'clyde_pro_agent',
    status: subscription.status || 'active',
    pro: subscription.status ? ['active', 'trialing'].includes(subscription.status) : true,
    features: PRO_FEATURES,
    expiresAt: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    checkedAt: new Date().toISOString()
  };
}

export async function upsertSubscriptionRecord(record) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return { skipped: true };
  }

  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/subscriptions`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates'
    },
    body: JSON.stringify(record)
  });

  if (!response.ok) {
    throw new Error(`Supabase subscription upsert failed: ${await response.text()}`);
  }

  return { ok: true };
}

export async function findSubscriptionByUserId(userId) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return null;
  }

  const endpoint = new URL(`${url.replace(/\/$/, '')}/rest/v1/subscriptions`);
  endpoint.searchParams.set('user_id', `eq.${userId}`);
  endpoint.searchParams.set('select', '*');
  endpoint.searchParams.set('limit', '1');

  const response = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase subscription lookup failed: ${await response.text()}`);
  }

  const rows = await response.json();
  return rows[0] || null;
}
