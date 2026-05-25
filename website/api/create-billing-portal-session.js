import { findSubscriptionByUserId, getAppUrl, getStripe, readJson, requireUserId, sendJson } from './_billing.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const body = await readJson(req);
    const userId = requireUserId(req, body);
    const record = await findSubscriptionByUserId(userId);

    if (!record?.stripe_customer_id) {
      sendJson(res, 404, { error: 'No Stripe customer found for this user.' });
      return;
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: record.stripe_customer_id,
      return_url: `${getAppUrl(req)}/account`
    });

    sendJson(res, 200, { url: session.url });
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message });
  }
}
