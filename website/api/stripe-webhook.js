import { activatePaidCheckoutSession, getStripe, inviteSupabaseUserByEmail, listSupabaseUsersByEmail, normalizeEmail, readRawBody, sendJson, upsertSubscriptionRecord } from './_billing.js';

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const stripe = getStripe();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured.');
    }

    const signature = req.headers['stripe-signature'];
    const rawBody = await readRawBody(req);
    const event = stripe.webhooks.constructEvent(rawBody, signature, secret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.id) {
        await activatePaidCheckoutSession(session.id);
      }
    }

    if (
      event.type === 'customer.subscription.created'
      || event.type === 'customer.subscription.updated'
      || event.type === 'customer.subscription.deleted'
    ) {
      const subscription = event.data.object;
      await saveSubscription(subscription.customer, subscription, {
        userId: subscription.metadata?.userId,
        email: subscription.metadata?.pendingProSignupEmail
      });
    }

    sendJson(res, 200, { received: true });
  } catch (error) {
    console.error('Stripe webhook failed:', error);
    sendJson(res, 400, { error: error.message });
  }
}

async function saveSubscription(customerId, subscription, context = {}) {
  let resolvedUserId = context.userId || subscription.metadata?.userId || '';
  let resolvedEmail = normalizeEmail(context.email || subscription.metadata?.pendingProSignupEmail || '');
  const stripe = getStripe();

  // If no user ID but we have customer metadata or subscription metadata
  if (!resolvedUserId && customerId) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      resolvedUserId = customer?.metadata?.userId || '';
      resolvedEmail = normalizeEmail(resolvedEmail || customer?.email || customer?.metadata?.pendingProSignupEmail);
    } catch (e) {
      console.error('[stripe-webhook] Retrieve customer metadata failed:', e.message);
    }
  }

  // Fallback 1: Match by email if we don't have a user ID but have an email
  if (!resolvedUserId && resolvedEmail) {
    try {
      const existingUsers = await listSupabaseUsersByEmail(resolvedEmail);
      if (existingUsers.length > 0) {
        resolvedUserId = existingUsers[0].id;
      } else {
        // Only invite them if this is a checkout event (handled elsewhere), do NOT invite on arbitrary subscription sync
        console.log('[stripe-webhook] Email not registered in Supabase. Skipping saveSubscription.');
        return;
      }
    } catch (e) {
      console.error('[stripe-webhook] Supabase email lookup failed:', e.message);
    }
  }

  // Fallback 2: If we still don't have a user ID, perform a database search on the subscriptions table by stripe_customer_id
  if (!resolvedUserId && customerId) {
    try {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (url && key) {
        const endpoint = new URL(`${url.replace(/\/$/, '')}/rest/v1/subscriptions`);
        endpoint.searchParams.set('stripe_customer_id', `eq.${customerId}`);
        endpoint.searchParams.set('select', 'user_id');
        endpoint.searchParams.set('limit', '1');

        const response = await fetch(endpoint, {
          headers: { apikey: key, Authorization: `Bearer ${key}` }
        });
        if (response.ok) {
          const rows = await response.json();
          if (rows[0]?.user_id) {
            resolvedUserId = rows[0].user_id;
            console.log(`[stripe-webhook] Found user_id by mapping stripe_customer_id fallback: ${resolvedUserId}`);
          }
        }
      }
    } catch (e) {
      console.error('[stripe-webhook] Supabase stripe_customer_id lookup failed:', e.message);
    }
  }

  if (!resolvedUserId) {
    console.warn('[stripe-webhook] No resolved user ID found. Webhook cannot update subscription row.');
    return;
  }

  // Make sure metadata is synced back to Stripe so future webhooks can resolve immediately
  try {
    if (customerId) {
      await stripe.customers.update(customerId, {
        metadata: { userId: resolvedUserId, plan: 'clyde_pro_agent' }
      });
    }
    await stripe.subscriptions.update(subscription.id, {
      metadata: { userId: resolvedUserId, plan: 'clyde_pro_agent' }
    });
  } catch (err) {
    // Ignore metadata write locks
  }

  // Retrieve existing record to retain credits balance
  let existingCredits = 0;
  try {
    const record = await findSubscriptionByUserId(resolvedUserId);
    if (record && typeof record.credits === 'number') {
      existingCredits = record.credits;
    }
  } catch (_) {}

  await upsertSubscriptionRecord({
    user_id: resolvedUserId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    status: subscription.status,
    plan: 'clyde_pro_agent',
    credits: existingCredits,
    current_period_end: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString()
  });
}
