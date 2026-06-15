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
  'liveavatar_mock_interviews',
  'autonomous_background_runs'
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

/**
 * Resolves the Stripe price ID for a billing period.
 * - 'annual'  -> STRIPE_CLYDE_PRO_PRICE_ID_ANNUAL
 * - 'monthly' -> STRIPE_CLYDE_PRO_PRICE_ID_MONTHLY
 * Falls back to the legacy STRIPE_CLYDE_PRO_PRICE_ID so existing deployments
 * keep working until both period-specific prices are configured.
 */
export function getProPriceId(billingPeriod = 'monthly') {
  const period = String(billingPeriod || 'monthly').toLowerCase() === 'annual' ? 'annual' : 'monthly';
  const specific = period === 'annual'
    ? process.env.STRIPE_CLYDE_PRO_PRICE_ID_ANNUAL
    : process.env.STRIPE_CLYDE_PRO_PRICE_ID_MONTHLY;
  const price = specific || process.env.STRIPE_CLYDE_PRO_PRICE_ID;
  if (!price) {
    throw new Error(`Stripe price for the ${period} plan is not configured (STRIPE_CLYDE_PRO_PRICE_ID_${period.toUpperCase()} or STRIPE_CLYDE_PRO_PRICE_ID).`);
  }
  return price;
}

export function getCreditsPriceId(amount = 50) {
  const size = Number(amount) || 50;
  let price = '';
  if (size === 20) {
    price = process.env.STRIPE_CLYDE_CREDITS_20_PRICE_ID;
  } else if (size === 120) {
    price = process.env.STRIPE_CLYDE_CREDITS_120_PRICE_ID;
  } else {
    price = process.env.STRIPE_CLYDE_CREDITS_50_PRICE_ID || process.env.STRIPE_CLYDE_CREDITS_100_PRICE_ID;
  }

  if (!price) {
    throw new Error(`Stripe price for the ${size}-credit pack is not configured (STRIPE_CLYDE_CREDITS_${size}_PRICE_ID).`);
  }
  return price;
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

export async function requireSupabaseUser(req) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase auth is not configured.');
  }

  const header = String(req.headers.authorization || '');
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    const error = new Error('Missing auth token.');
    error.statusCode = 401;
    throw error;
  }

  const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = new Error('Invalid auth token.');
    error.statusCode = 401;
    throw error;
  }

  const user = await response.json();
  if (!user?.id) {
    const error = new Error('Invalid auth user.');
    error.statusCode = 401;
    throw error;
  }
  return user;
}

export function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function freeEntitlements(userId = '', subscription = {}) {
  const credits = subscription && typeof subscription.credits === 'number' ? subscription.credits : 0;
  const features = [...FREE_FEATURES];
  if (credits > 0) {
    features.push('mock_interviews', 'liveavatar_mock_interviews');
  }
  return {
    userId,
    tier: 'free',
    userTier: 'free',
    plan: 'clyde_assistant',
    status: 'free',
    pro: false,
    features,
    credits,
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
    credits: typeof subscription.credits === 'number' ? subscription.credits : 100,
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
    console.error('[_billing] WARNING: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing! Skipping subscription upsert.');
    return { skipped: true };
  }

  const endpoint = new URL(`${url.replace(/\/$/, '')}/rest/v1/subscriptions`);
  endpoint.searchParams.set('on_conflict', 'user_id');

  const response = await fetch(endpoint, {
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
    console.error('[_billing] WARNING: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing! Skipping subscription lookup.');
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

export async function listSupabaseUsersByEmail(email) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const target = normalizeEmail(email);
  if (!url || !key || !target) {
    if (!url || !key) {
      console.error('[_billing] WARNING: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing! Skipping users listing by email.');
    }
    return [];
  }

  const users = [];
  for (let page = 1; page <= 10; page += 1) {
    const endpoint = new URL(`${url.replace(/\/$/, '')}/auth/v1/admin/users`);
    endpoint.searchParams.set('page', String(page));
    endpoint.searchParams.set('per_page', '100');

    const response = await fetch(endpoint, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`
      }
    });

    if (!response.ok) {
      throw new Error(`Supabase user lookup failed: ${await response.text()}`);
    }

    const payload = await response.json();
    const pageUsers = Array.isArray(payload?.users) ? payload.users : Array.isArray(payload) ? payload : [];
    users.push(...pageUsers.filter((user) => normalizeEmail(user.email) === target));
    if (pageUsers.length < 100) {
      break;
    }
  }

  return users;
}

export async function inviteSupabaseUserByEmail(email, { redirectTo } = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const target = normalizeEmail(email);
  if (!url || !key || !target) {
    throw new Error('Supabase invite is not configured.');
  }

  const endpoint = new URL(`${url.replace(/\/$/, '')}/auth/v1/invite`);
  const cleanRedirectTo = String(redirectTo || process.env.CLYDE_AUTH_REDIRECT_URL || 'https://clydeai.live/auth/confirmed').trim();
  if (cleanRedirectTo) {
    endpoint.searchParams.set('redirect_to', cleanRedirectTo);
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: target,
      data: {
        plan: 'clyde_pro_agent'
      },
      redirect_to: cleanRedirectTo
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.msg || payload?.message || payload?.error || 'Supabase invite failed.');
  }

  const user = payload?.user || payload;
  if (!user?.id) {
    throw new Error('Supabase invite did not return a user ID.');
  }
  return user;
}

export async function findActiveStripeSubscriptionByEmail(email) {
  const target = normalizeEmail(email);
  if (!target) {
    return null;
  }

  const stripe = getStripe();
  const customers = await stripe.customers.list({ email: target, limit: 10 });
  for (const customer of customers.data || []) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 10
    });
    const active = (subscriptions.data || []).find((subscription) => (
      ['active', 'trialing'].includes(String(subscription.status || '').toLowerCase())
    ));
    if (active) {
      return { customer, subscription: active };
    }
  }

  return null;
}

export async function reconcileSubscriptionByEmail(user) {
  const email = normalizeEmail(user?.email);
  if (!user?.id || !email) {
    return null;
  }

  const match = await findActiveStripeSubscriptionByEmail(email);
  if (!match?.subscription || !match?.customer) {
    return null;
  }

  const record = {
    user_id: user.id,
    stripe_customer_id: match.customer.id,
    stripe_subscription_id: match.subscription.id,
    status: match.subscription.status,
    plan: 'clyde_pro_agent',
    current_period_end: match.subscription.current_period_end
      ? new Date(match.subscription.current_period_end * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString()
  };
  await upsertSubscriptionRecord(record);
  return record;
}

export async function activatePaidCheckoutSession(sessionId) {
  const cleanSessionId = String(sessionId || '').trim();
  if (!cleanSessionId) {
    throw new Error('Missing checkout session ID.');
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(cleanSessionId, {
    expand: ['subscription', 'customer']
  });

  // Idempotency check: if this session is already processed, do not activate again
  if (session.metadata?.processed === 'true') {
    console.log(`[_billing] Checkout session ${cleanSessionId} is already processed. Skipping activation.`);
    return {
      success: true,
      alreadyProcessed: true,
      email: session.customer_details?.email || session.customer_email || session.metadata?.pendingProSignupEmail || session.metadata?.pendingEmail || ''
    };
  }

  // Mark as processed in Stripe metadata first to prevent race/double runs
  await stripe.checkout.sessions.update(cleanSessionId, {
    metadata: { processed: 'true' }
  });

  // Handle one-time credits purchase
  if (session.mode === 'payment') {
    const type = session.metadata?.type || '';
    if (type === 'credits_purchase') {
      const userId = session.metadata?.userId || '';
      const pendingEmail = session.metadata?.pendingEmail || '';
      const amount = Number(session.metadata?.amount || '100');
      
      let resolvedUserId = userId;
      let invited = false;
      let email = '';

      if (!resolvedUserId && pendingEmail) {
        email = normalizeEmail(pendingEmail);
        const existingUsers = await listSupabaseUsersByEmail(email);
        let user = existingUsers[0] || null;
        if (!user) {
          user = await inviteSupabaseUserByEmail(email);
          invited = true;
        }
        resolvedUserId = user.id;
      }

      if (!resolvedUserId) {
        throw new Error('Credits purchase session is missing userId or pendingEmail in metadata.');
      }

      const record = await findSubscriptionByUserId(resolvedUserId);
      const currentCredits = record && typeof record.credits === 'number' ? record.credits : 0;
      const newCredits = currentCredits + amount;
      await upsertSubscriptionRecord({
        user_id: resolvedUserId,
        stripe_customer_id: (typeof session.customer === 'object' ? session.customer?.id : session.customer) || record?.stripe_customer_id || '',
        stripe_subscription_id: record?.stripe_subscription_id || null,
        status: record?.status || 'free',
        plan: record?.plan || 'free',
        credits: newCredits,
        current_period_end: record?.current_period_end || null,
        updated_at: new Date().toISOString()
      });
      return {
        success: true,
        type: 'credits_purchase',
        userId: resolvedUserId,
        amount,
        credits: newCredits,
        invited,
        email
      };
    }
  }

  const subscription = session.subscription;
  if (!subscription?.id) {
    throw new Error('Checkout session has no subscription.');
  }
  if (!['active', 'trialing'].includes(String(subscription.status || '').toLowerCase())) {
    throw new Error(`Subscription is ${subscription.status || 'not active'}.`);
  }

  const customer = typeof session.customer === 'object' ? session.customer : null;
  const customerId = customer?.id || session.customer || subscription.customer || '';
  const email = normalizeEmail(
    session.customer_details?.email
    || session.customer_email
    || session.metadata?.pendingProSignupEmail
    || subscription.metadata?.pendingProSignupEmail
    || customer?.email
  );
  if (!email) {
    throw new Error('Checkout session has no customer email.');
  }

  const existingUsers = await listSupabaseUsersByEmail(email);
  let user = existingUsers[0] || null;
  let invited = false;
  if (!user) {
    user = await inviteSupabaseUserByEmail(email);
    invited = true;
  }

  await upsertSubscriptionRecord({
    user_id: user.id,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    status: subscription.status,
    plan: 'clyde_pro_agent',
    current_period_end: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString()
  });

  if (customerId) {
    await stripe.customers.update(customerId, {
      metadata: { userId: user.id, plan: 'clyde_pro_agent' }
    });
  }
  await stripe.subscriptions.update(subscription.id, {
    metadata: { userId: user.id, plan: 'clyde_pro_agent' }
  });

  return {
    email,
    invited,
    userId: user.id,
    subscriptionId: subscription.id,
    status: subscription.status
  };
}
