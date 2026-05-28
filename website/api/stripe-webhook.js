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
  if (!resolvedUserId && customerId) {
    const customer = await stripe.customers.retrieve(customerId);
    resolvedUserId = customer?.metadata?.userId || '';
    resolvedEmail = normalizeEmail(resolvedEmail || customer?.email || customer?.metadata?.pendingProSignupEmail);
  }

  if (!resolvedUserId && resolvedEmail) {
    const existingUsers = await listSupabaseUsersByEmail(resolvedEmail);
    const user = existingUsers[0] || await inviteSupabaseUserByEmail(resolvedEmail);
    resolvedUserId = user.id;
    if (customerId) {
      await stripe.customers.update(customerId, {
        metadata: { userId: resolvedUserId, plan: 'clyde_pro_agent' }
      });
    }
    await stripe.subscriptions.update(subscription.id, {
      metadata: { userId: resolvedUserId, plan: 'clyde_pro_agent' }
    });
  }

  if (!resolvedUserId) {
    return;
  }

  await upsertSubscriptionRecord({
    user_id: resolvedUserId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    status: subscription.status,
    plan: 'clyde_pro_agent',
    current_period_end: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString()
  });
}
