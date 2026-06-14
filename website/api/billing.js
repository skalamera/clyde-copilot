import {
  getStripe,
  getProPriceId,
  getCreditsPriceId,
  getAppUrl,
  sendJson,
  readJson,
  requireSupabaseUser,
  normalizeEmail,
  freeEntitlements,
  proEntitlements,
  findSubscriptionByUserId,
  listSupabaseUsersByEmail,
  reconcileSubscriptionByEmail,
  activatePaidCheckoutSession,
  upsertSubscriptionRecord
} from './_billing.js';

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const action = url.searchParams.get('action');

  if (!action) {
    sendJson(res, 400, { error: 'Missing action parameter.' });
    return;
  }

  try {
    switch (action) {
      case 'entitlements':
        return await handleEntitlements(req, res);
      case 'create-checkout-session':
        return await handleCreateCheckoutSession(req, res);
      case 'create-billing-portal-session':
        return await handleCreateBillingPortalSession(req, res);
      case 'create-pro-signup-checkout':
        return await handleCreateProSignupCheckout(req, res);
      case 'check-email-existence':
        return await handleCheckEmailExistence(req, res);
      case 'activate-pro-checkout':
        return await handleActivateProCheckout(req, res);
      case 'consume-credit':
        return await handleConsumeCredit(req, res);
      case 'create-credits-checkout':
        return await handleCreateCreditsCheckout(req, res);
      default:
        sendJson(res, 404, { error: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error(`Error handling action ${action}:`, error);
    sendJson(res, error.statusCode || 500, { error: error.message });
  }
}

async function handleEntitlements(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  const user = await requireSupabaseUser(req);
  const userId = user.id;

  let record = await findSubscriptionByUserId(userId);
  if (!record || !['active', 'trialing'].includes(String(record.status || '').toLowerCase())) {
    record = await reconcileSubscriptionByEmail(user);
  }
  if (!record || !['active', 'trialing'].includes(record.status)) {
    sendJson(res, 200, freeEntitlements(userId, record));
    return;
  }

  sendJson(res, 200, proEntitlements(userId, {
    status: record.status,
    credits: typeof record.credits === 'number' ? record.credits : 100,
    current_period_end: record.current_period_end
      ? Math.floor(new Date(record.current_period_end).getTime() / 1000)
      : null
  }));
}

async function handleCreateCheckoutSession(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  const body = await readJson(req);
  const user = await requireSupabaseUser(req);
  const userId = user.id;
  const email = String(body.email || user.email || '').trim();
  const appUrl = getAppUrl(req);
  const stripe = getStripe();
  const price = getProPriceId(body.billingPeriod);

  let customerId = '';
  if (email) {
    const customers = await stripe.customers.list({ email, limit: 1 });
    customerId = customers.data?.[0]?.id || '';
    if (customerId) {
      await stripe.customers.update(customerId, {
        metadata: { userId, plan: 'clyde_pro_agent' }
      });
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/pricing`,
    customer: customerId || undefined,
    customer_email: customerId ? undefined : email || undefined,
    client_reference_id: userId,
    metadata: { userId },
    subscription_data: {
      metadata: { userId, plan: 'clyde_pro_agent' }
    },
    allow_promotion_codes: true
  });

  sendJson(res, 200, { url: session.url, id: session.id });
}

async function handleCreateBillingPortalSession(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  const user = await requireSupabaseUser(req);
  const userId = user.id;
  const record = await findSubscriptionByUserId(userId);
  let customerId = record?.stripe_customer_id || '';

  const stripe = getStripe();
  if (!customerId && user.email) {
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    customerId = customers.data?.[0]?.id || '';
  }

  if (!customerId) {
    sendJson(res, 404, { error: 'No Stripe customer found for this account. Start checkout first.' });
    return;
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${getAppUrl(req)}/account`
  });

  sendJson(res, 200, { url: session.url });
}

async function handleCreateProSignupCheckout(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  const body = await readJson(req);
  const email = normalizeEmail(body.email);

  if (!email) {
    sendJson(res, 400, { error: 'Email is required.' });
    return;
  }
  const price = getProPriceId(body.billingPeriod);

  // Note: We bypass listSupabaseUsersByEmail check here IF the client sends 'forceCheckout: true' (which means we checked email existence first, verified they already exist, and are purposely routing an existing user directly to Stripe with their email context so they can upgrade!)
  if (!body.forceCheckout) {
    const existing = await listSupabaseUsersByEmail(email);
    if (existing.length > 0) {
      sendJson(res, 400, { error: 'Unable to start a new Pro signup with this email. If you have a Clyde account, sign in and upgrade from Settings; otherwise contact support.' });
      return;
    }
  }

  const stripe = getStripe();
  let customerId = '';
  const customers = await stripe.customers.list({ email, limit: 1 });
  customerId = customers.data?.[0]?.id || '';
  if (customerId) {
    await stripe.customers.update(customerId, {
      metadata: { pendingProSignupEmail: email, plan: 'clyde_pro_agent' }
    });
  }

  const appUrl = getAppUrl(req);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/pricing`,
    customer: customerId || undefined,
    customer_email: customerId ? undefined : email,
    client_reference_id: email,
    metadata: { pendingProSignupEmail: email },
    subscription_data: {
      metadata: { pendingProSignupEmail: email, plan: 'clyde_pro_agent' }
    },
    allow_promotion_codes: true
  });

  sendJson(res, 200, {
    url: session.url,
    id: session.id,
    email,
    message: 'Checkout opened.'
  });
}

async function handleCheckEmailExistence(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  const body = await readJson(req);
  const email = normalizeEmail(body.email);
  if (!email) {
    sendJson(res, 400, { error: 'Email is required.' });
    return;
  }

  const existing = await listSupabaseUsersByEmail(email);
  sendJson(res, 200, { exists: existing.length > 0 });
}

async function handleActivateProCheckout(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  const body = await readJson(req);
  const result = await activatePaidCheckoutSession(body.sessionId);
  sendJson(res, 200, result);
}

async function handleConsumeCredit(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  const user = await requireSupabaseUser(req);
  const userId = user.id;

  const record = await findSubscriptionByUserId(userId);
  const currentCredits = record && typeof record.credits === 'number' ? record.credits : 0;
  if (currentCredits <= 0) {
    sendJson(res, 402, { error: 'Insufficient background application credits. Please purchase more credits or subscribe to Clyde Pro.' });
    return;
  }

  const newCredits = currentCredits - 1;
  await upsertSubscriptionRecord({
    ...record,
    credits: newCredits,
    updated_at: new Date().toISOString()
  });

  sendJson(res, 200, { success: true, credits: newCredits });
}

async function handleCreateCreditsCheckout(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  const body = await readJson(req);
  let userId = '';
  let email = '';
  let customerId = '';
  let record = null;

  // 1. Try to authenticate user
  const authHeader = String(req.headers.authorization || '');
  const hasAuth = authHeader.toLowerCase().startsWith('bearer ');

  if (hasAuth) {
    try {
      const user = await requireSupabaseUser(req);
      userId = user.id;
      record = await findSubscriptionByUserId(userId);
      customerId = record?.stripe_customer_id || '';
      email = user.email || '';
    } catch (authError) {
      sendJson(res, 401, { error: 'Invalid authentication token.' });
      return;
    }
  } else {
    // Guest purchase flow
    email = normalizeEmail(body.email);
    if (!email) {
      sendJson(res, 400, { error: 'Email is required for guest checkout. Sign in or enter your email to proceed.' });
      return;
    }

    // Anti-enumeration: verify they don't already have an account.
    // If they do, they should sign in and buy credits from the app.
    const existing = await listSupabaseUsersByEmail(email);
    if (existing.length > 0) {
      sendJson(res, 400, { error: 'This email is already registered. Please sign in to Clyde and purchase credits from your account Settings.' });
      return;
    }
  }

  const stripe = getStripe();
  if (!customerId && email) {
    try {
      const customers = await stripe.customers.list({ email, limit: 1 });
      customerId = customers.data?.[0]?.id || '';
    } catch (_) {
      // ignore
    }
  }

  const price = getCreditsPriceId();
  const appUrl = getAppUrl(req);

  const sessionPayload = {
    mode: 'payment',
    line_items: [{ price, quantity: 1 }],
    success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: hasAuth ? `${appUrl}/account` : `${appUrl}/pricing`,
    customer: customerId || undefined,
    customer_email: customerId ? undefined : email || undefined,
    client_reference_id: userId || email,
    metadata: {
      type: 'credits_purchase',
      amount: '100'
    }
  };

  if (userId) {
    sessionPayload.metadata.userId = userId;
  } else {
    sessionPayload.metadata.pendingEmail = email;
  }

  const session = await stripe.checkout.sessions.create(sessionPayload);

  sendJson(res, 200, {
    url: session.url,
    id: session.id,
    email,
    message: userId ? undefined : 'Checkout opened. After payment, Clyde sends an account invite email so you can set your password and access your credits.'
  });
}
