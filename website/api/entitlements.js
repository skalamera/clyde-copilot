import { findSubscriptionByUserId, freeEntitlements, proEntitlements, reconcileSubscriptionByEmail, requireSupabaseUser, sendJson } from './_billing.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const user = await requireSupabaseUser(req);
    const userId = user.id;

    let record = await findSubscriptionByUserId(userId);
    if (!record || !['active', 'trialing'].includes(String(record.status || '').toLowerCase())) {
      record = await reconcileSubscriptionByEmail(user);
    }
    if (!record || !['active', 'trialing'].includes(record.status)) {
      sendJson(res, 200, freeEntitlements(userId));
      return;
    }

    sendJson(res, 200, proEntitlements(userId, {
      status: record.status,
      current_period_end: record.current_period_end
        ? Math.floor(new Date(record.current_period_end).getTime() / 1000)
        : null
    }));
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message });
  }
}
