import crypto from 'node:crypto';
import { findSubscriptionByUserId, requireSupabaseUser, sendJson } from './_billing.js';

/**
 * POST /api/license-token
 *
 * Mints a signed license token (`clyde_lic_<userId>.<hmac>`) for the
 * authenticated Pro user. The token is what BYOK-less clients (e.g. the
 * Clyde Go extension "Pro token" field) should store and send to
 * /api/proxy instead of a bare user UUID, which is guessable/leakable.
 *
 * Auth: Supabase session JWT (Bearer). Requires an active/trialing
 * subscription. Requires CLYDE_LICENSE_SIGNING_SECRET to be configured.
 *
 * Tokens are deterministic per user (HMAC of the lowercase user id), so
 * re-requesting returns the same token. Rotating CLYDE_LICENSE_SIGNING_SECRET
 * invalidates all previously issued tokens at once.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const secret = process.env.CLYDE_LICENSE_SIGNING_SECRET;
    if (!secret) {
      sendJson(res, 500, { error: 'License token signing is not configured (CLYDE_LICENSE_SIGNING_SECRET).' });
      return;
    }

    const user = await requireSupabaseUser(req);
    const userId = String(user.id || '').toLowerCase();

    const subscription = await findSubscriptionByUserId(userId);
    const status = String(subscription?.status || '').toLowerCase();
    if (!['active', 'trialing'].includes(status)) {
      sendJson(res, 403, { error: 'An active Clyde Pro subscription is required to mint a license token.' });
      return;
    }

    // 1. Get the current token version from subscription, default to 1.
    const tokenVersion = (subscription && typeof subscription.token_version === 'number')
      ? subscription.token_version
      : 1;

    // 2. Set expiry to 60 days from now (in ms).
    const expiry = Date.now() + 60 * 24 * 60 * 60 * 1000;

    // 3. Compute signature of message: userId + "." + expiry + "." + tokenVersion
    const message = `${userId}.${expiry}.${tokenVersion}`;
    const signature = crypto.createHmac('sha256', secret).update(message).digest('base64url');

    sendJson(res, 200, {
      token: `clyde_lic_${userId}.${expiry}.${signature}`,
      userId,
      status,
      expiresAt: new Date(expiry).toISOString()
    });
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message });
  }
}
