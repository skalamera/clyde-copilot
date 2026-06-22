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
  upsertSubscriptionRecord,
  inviteSupabaseUserByEmail
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
      case 'create-byok-checkout':
        return await handleCreateByokCheckout(req, res);
      case 'create-credits-checkout':
        return await handleCreateCreditsCheckout(req, res);
      case 'delete-account':
        return await handleDeleteAccount(req, res);
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
    const backupRecord = record;
    record = await reconcileSubscriptionByEmail(user);
    if (!record) {
      record = backupRecord;
    }
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
  const body = await readJson(req).catch(() => ({}));
  const deductAmount = Math.max(1, Number(body.amount || 1));

  const record = await findSubscriptionByUserId(userId);
  const currentCredits = record && typeof record.credits === 'number' ? record.credits : 0;
  if (currentCredits < deductAmount) {
    sendJson(res, 402, { error: `Insufficient background credits (${currentCredits} available, ${deductAmount} required). Please purchase more credits or subscribe to Clyde Pro.` });
    return;
  }

  const newCredits = currentCredits - deductAmount;
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
    if (!body.forceCheckout) {
      const existing = await listSupabaseUsersByEmail(email);
      if (existing.length > 0) {
        sendJson(res, 400, { error: 'This email is already registered. Please sign in to Clyde and purchase credits from your account Settings.' });
        return;
      }
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

  const creditsAmount = Number(body.creditsAmount) || 50;
  const price = getCreditsPriceId(creditsAmount);
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
      amount: String(creditsAmount)
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

async function handleDeleteAccount(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  const body = await readJson(req);
  const email = String(body.email || '').trim().toLowerCase();
  const userId = String(body.userId || '').trim();

  if (!email) {
    sendJson(res, 400, { error: 'Email is required.' });
    return;
  }

  const resendKey = process.env.RESEND_API_KEY || 're_SyCNFkdE_J3JwCGiw7pSkQ4PHjqiRLH9T';

  // Send the deletion notification to Stephen's email
  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Clyde Security <security@clydeai.live>',
      to: ['skalamera@gmail.com'],
      subject: `⚠️ Clyde Account Deletion Request - ${email}`,
      html: `
        <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px 24px; border: 1px solid rgba(220,38,38,0.2); border-radius: 16px; background-color: #fef2f2; color: #1e293b; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 1.5rem; font-weight: bold; color: #dc2626;">Clyde Security Portal</span>
          </div>
          <h2 style="color: #991b1b; margin-bottom: 12px; font-size: 1.4rem; font-weight: 700; text-align: center;">Account Deletion Request</h2>
          <p style="font-size: 0.95rem; line-height: 1.6; color: #7f1d1d; text-align: center; margin-bottom: 24px;">A user has initiated an official request to delete their Clyde account and all associated personal data.</p>
          
          <div style="background-color: #ffffff; border: 1px solid rgba(0,0,0,0.06); border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <div style="margin-bottom: 8px;"><strong>Email address:</strong> <span style="font-family: monospace;">${email}</span></div>
            <div><strong>User ID:</strong> <span style="font-family: monospace;">${userId || 'Not Provided / Offline'}</span></div>
          </div>

          <p style="font-size: 0.8rem; color: #991b1b; line-height: 1.5; text-align: center; font-weight: bold;">Action Required: Please purge this user's data from the Supabase auth/public databases and any associated Pinecone or storage buckets within 24 hours.</p>
          <hr style="border: none; border-top: 1px solid rgba(220,38,38,0.1); margin: 28px 0;" />
          <p style="font-size: 0.75rem; color: #b91c1c; text-align: center; margin: 0;">Clyde Security Audit Pipeline.</p>
        </div>
      `
    })
  });

  const resendPayload = await resendResponse.json().catch(() => ({}));
  if (!resendResponse.ok) {
    throw new Error(resendPayload?.message || 'Failed to dispatch account deletion email via Resend.');
  }

  sendJson(res, 200, { ok: true, message: 'Account deletion request processed successfully.' });
}

async function handleCreateByokCheckout(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  const body = await readJson(req);
  let userId = '';
  let email = '';
  let customerId = '';

  // Try to authenticate user if auth header is present
  const authHeader = String(req.headers.authorization || '');
  const hasAuth = authHeader.toLowerCase().startsWith('bearer ');

  if (hasAuth) {
    try {
      const user = await requireSupabaseUser(req);
      userId = user.id;
      const record = await findSubscriptionByUserId(userId);
      customerId = record?.stripe_customer_id || '';
      email = user.email || '';
    } catch (authError) {
      sendJson(res, 401, { error: 'Invalid authentication token.' });
      return;
    }
  } else {
    // Guest flow
    email = normalizeEmail(body.email);
    if (!email) {
      sendJson(res, 400, { error: 'Email is required for BYOK guest checkout.' });
      return;
    }
    
    // Check if user already exists
    if (!body.forceCheckout) {
      const existing = await listSupabaseUsersByEmail(email);
      if (existing.length > 0) {
        sendJson(res, 400, { error: 'This email is already registered. Please sign in to upgrade.' });
        return;
      }
    }
  }

  const stripe = getStripe();
  if (!customerId && email) {
    try {
      const customers = await stripe.customers.list({ email, limit: 1 });
      customerId = customers.data?.[0]?.id || '';
    } catch (_) {}
  }

  const price = process.env.STRIPE_CLYDE_BYOK_LIFETIME_PRICE_ID || 'price_clyde_byok_lifetime_mock';
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
      type: 'byok_purchase'
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
    message: userId ? undefined : 'Checkout opened. After payment, Clyde will generate and email your unique Local BYOK License Key.'
  });
}
