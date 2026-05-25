const axios = require('axios');
const { buildEntitlements } = require('./entitlements');

async function fetchEntitlements({ userId, endpoint, axiosClient = axios } = {}) {
  const cleanUserId = String(userId || '').trim();
  const cleanEndpoint = String(endpoint || process.env.CLYDE_ENTITLEMENTS_URL || '').trim();

  if (!cleanUserId) {
    return buildEntitlements({ tier: 'free', userId: '' });
  }
  if (!cleanEndpoint) {
    return buildEntitlements({ tier: 'free', userId: cleanUserId });
  }

  const response = await axiosClient.get(cleanEndpoint, {
    params: { userId: cleanUserId },
    headers: { 'X-Clyde-User-Id': cleanUserId },
    timeout: 15000
  });

  return buildEntitlements({
    ...(response.data || {}),
    userId: cleanUserId
  });
}

module.exports = {
  fetchEntitlements
};
