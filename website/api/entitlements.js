import { findSubscriptionByUserId, freeEntitlements, proEntitlements, sendJson } from './_billing.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const userId = String(req.query?.userId || req.headers['x-clyde-user-id'] || '').trim();
    if (!userId) {
      sendJson(res, 401, { error: 'Missing userId.' });
      return;
    }

    const record = await findSubscriptionByUserId(userId);
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
    sendJson(res, 500, { error: error.message });
  }
}
