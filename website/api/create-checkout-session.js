import { getAppUrl, getStripe, readJson, requireUserId, sendJson } from './_billing.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const body = await readJson(req);
    const userId = requireUserId(req, body);
    const email = String(body.email || '').trim();
    const appUrl = getAppUrl(req);
    const stripe = getStripe();
    const price = process.env.STRIPE_CLYDE_PRO_PRICE_ID;

    if (!price) {
      throw new Error('STRIPE_CLYDE_PRO_PRICE_ID is not configured.');
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing`,
      customer_email: email || undefined,
      client_reference_id: userId,
      metadata: { userId },
      subscription_data: {
        metadata: { userId, plan: 'clyde_pro_agent' }
      },
      allow_promotion_codes: true
    });

    sendJson(res, 200, { url: session.url, id: session.id });
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message });
  }
}
