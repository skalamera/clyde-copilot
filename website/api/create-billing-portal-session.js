import { findSubscriptionByUserId, getAppUrl, getStripe, requireSupabaseUser, sendJson } from './_billing.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
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
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message });
  }
}
