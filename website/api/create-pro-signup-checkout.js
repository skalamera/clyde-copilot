import { getAppUrl, getProPriceId, getStripe, listSupabaseUsersByEmail, normalizeEmail, sendJson } from './_billing.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const email = normalizeEmail(body.email);

    if (!email) {
      sendJson(res, 400, { error: 'Email is required.' });
      return;
    }
    const price = getProPriceId(body.billingPeriod);

    const existing = await listSupabaseUsersByEmail(email);
    if (existing.length > 0) {
      sendJson(res, 409, { error: 'An account already exists for this email. Sign in to manage Pro.' });
      return;
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
      message: 'Checkout opened. After payment, Clyde sends an account invite email so you can set your password and sign in.'
    });
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message });
  }
}

function readJsonBody(req) {
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
