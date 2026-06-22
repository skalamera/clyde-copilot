import Stripe from 'stripe';
import crypto from 'crypto';

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

  // Handle one-time purchases (credits or BYOK lifetime)
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

    if (type === 'byok_purchase') {
      const userId = session.metadata?.userId || '';
      const pendingEmail = session.metadata?.pendingEmail || '';
      
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
      } else if (resolvedUserId) {
        email = normalizeEmail(session.customer_details?.email || session.customer_email || '');
      }

      if (!email) {
        throw new Error('BYOK purchase session is missing email context.');
      }

      const licenseKey = generateByokLicenseKey(email);
      const record = await findSubscriptionByUserId(resolvedUserId);
      
      await upsertSubscriptionRecord({
        user_id: resolvedUserId,
        stripe_customer_id: (typeof session.customer === 'object' ? session.customer?.id : session.customer) || record?.stripe_customer_id || '',
        stripe_subscription_id: null,
        status: 'active',
        plan: 'clyde_byok_lifetime',
        credits: record && typeof record.credits === 'number' ? record.credits : 0,
        current_period_end: null,
        updated_at: new Date().toISOString()
      });

      await sendByokLicenseEmail(email, licenseKey);

      return {
        success: true,
        type: 'byok_purchase',
        userId: resolvedUserId,
        email,
        invited,
        licenseKey
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

export function generateByokLicenseKey(email) {
  const normalized = String(email || '').trim().toLowerCase();
  const emailEncoded = Buffer.from(normalized).toString('base64url');

  let privateKey = process.env.BYOK_PRIVATE_KEY;
  console.log('DEBUG_KEY: raw key exists =', !!privateKey, 'length =', privateKey?.length);
  if (privateKey) {
    console.log('DEBUG_KEY: raw start =', JSON.stringify(privateKey.slice(0, 40)), 'raw end =', JSON.stringify(privateKey.slice(-40)));
  }
  if (!privateKey) {
    console.warn('[_billing] WARNING: BYOK_PRIVATE_KEY is not set. Using temporary generated fallback key.');
    const { privateKey: tempPriv } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    privateKey = tempPriv.export({ type: 'pkcs8', format: 'pem' });
  } else {
    privateKey = privateKey.trim();
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    } else if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n').trim();
    console.log('DEBUG_KEY: normalized start =', JSON.stringify(privateKey.slice(0, 40)), 'normalized end =', JSON.stringify(privateKey.slice(-40)));
    console.log('CHAR_CODES:', Array.from(privateKey.slice(0, 60)).map(c => c.charCodeAt(0)).join(','));
  }

  const sign = crypto.createSign('SHA256');
  sign.update(normalized);
  sign.end();

  const signatureBase64 = sign.sign(privateKey).toString('base64url');
  return `clyde_lic_byok_${emailEncoded}.${signatureBase64}`;
}

export async function sendByokLicenseEmail(email, licenseKey) {
  const resendKey = process.env.RESEND_API_KEY || 're_SyCNFkdE_J3JwCGiw7pSkQ4PHjqiRLH9T';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Clyde Team <welcome@clydeai.live>',
      to: [email],
      subject: 'Your Clyde Local BYOK License Key 🔑',
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; background-color: #0b0f19; color: #f8fafc; box-shadow: 0 10px 30px rgba(0,0,0,0.5); box-sizing: border-box;">
          <div style="text-align: center; margin-bottom: 28px;">
            <span style="font-size: 2.2rem; font-weight: 800; color: #38bdf8; letter-spacing: 2px;">CLYDE BYOK</span>
          </div>
          <h1 style="color: #ffffff; margin-bottom: 16px; font-size: 1.5rem; font-weight: 800; text-align: center;">Thank You for Your Lifetime BYOK Purchase!</h1>
          <p style="font-size: 0.95rem; line-height: 1.6; color: #94a3b8; text-align: center; margin-bottom: 28px;">
            Your Local BYOK License Key has been generated successfully. Enter this key in the desktop app's <strong>Settings > Account</strong> tab to unlock offline Pro features permanently.
          </p>
          <div style="background: rgba(56, 189, 248, 0.05); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 28px; box-sizing: border-box;">
            <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #38bdf8; letter-spacing: 0.05em; display: block; margin-bottom: 8px;">Your Unique License Key</span>
            <div style="font-family: monospace; font-size: 0.88rem; color: #38bdf8; word-break: break-all; background: #000; padding: 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); user-select: all;">
              ${licenseKey}
            </div>
          </div>
          <h3 style="color: #ffffff; font-size: 1.05rem; font-weight: 700; margin-bottom: 12px;">💡 How to activate:</h3>
          <ol style="padding-left: 20px; color: #cbd5e1; font-size: 0.9rem; line-height: 1.6; margin-bottom: 24px;">
            <li style="margin-bottom: 8px;">Open Clyde Desktop App</li>
            <li style="margin-bottom: 8px;">Navigate to <strong>Settings (Gear icon) > Account</strong></li>
            <li style="margin-bottom: 8px;">Paste the license key in the <strong>Local BYOK License Key</strong> field</li>
            <li style="margin-bottom: 8px;">Clyde will validate the signature offline and grant lifetime local-pro status immediately!</li>
          </ol>
          <hr style="border: none; border-top: 1px solid rgba(255, 255, 255, 0.08); margin: 24px 0;" />
          <p style="font-size: 0.75rem; color: #475569; text-align: center; margin: 0;">
            Clyde — The Undetectable Agentic Partner.
          </p>
        </div>
      `
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to send license email via Resend.');
  }
}
