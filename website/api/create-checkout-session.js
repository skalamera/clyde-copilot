import { getAppUrl, getProPriceId, getStripe, readJson, requireSupabaseUser, sendJson } from './_billing.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
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
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message });
  }
}
