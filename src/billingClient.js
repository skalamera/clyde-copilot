const axios = require('axios');
const { buildEntitlements } = require('./entitlements');

function normalizeHttpError(error, fallbackMessage) {
  const message = error?.response?.data?.error || error?.message || fallbackMessage;
  const clean = new Error(message);
  clean.status = error?.response?.status;
  clean.code = error?.code;
  return clean;
}

async function fetchEntitlements({ accessToken = '', userId, endpoint, axiosClient = axios } = {}) {
  const cleanUserId = String(userId || '').trim();
  const cleanEndpoint = String(endpoint || process.env.CLYDE_ENTITLEMENTS_URL || '').trim();
  const cleanAccessToken = String(accessToken || '').trim();

  if (!cleanUserId || !cleanAccessToken) {
    return buildEntitlements({ tier: 'free', userId: '' });
  }
  if (!cleanEndpoint) {
    return buildEntitlements({ tier: 'free', userId: cleanUserId });
  }

  let response;
  try {
    response = await axiosClient.get(cleanEndpoint, {
      headers: { Authorization: `Bearer ${cleanAccessToken}` },
      timeout: 15000
    });
  } catch (error) {
    throw normalizeHttpError(error, 'Entitlements could not be refreshed.');
  }

  return buildEntitlements({
    ...(response.data || {}),
    userId: cleanUserId
  });
}

async function createCheckoutSession({ accessToken, endpoint, axiosClient = axios } = {}) {
  const cleanAccessToken = String(accessToken || '').trim();
  const cleanEndpoint = String(endpoint || '').trim();
  if (!cleanAccessToken) {
    throw new Error('Sign in before upgrading to Clyde Pro.');
  }
  if (!cleanEndpoint) {
    throw new Error('Checkout endpoint is not configured.');
  }
  let response;
  try {
    response = await axiosClient.post(cleanEndpoint, {}, {
      headers: { Authorization: `Bearer ${cleanAccessToken}` },
      timeout: 15000
    });
  } catch (error) {
    throw normalizeHttpError(error, 'Checkout session could not be created.');
  }
  return response.data || {};
}

async function createBillingPortalSession({ accessToken, endpoint, axiosClient = axios } = {}) {
  const cleanAccessToken = String(accessToken || '').trim();
  const cleanEndpoint = String(endpoint || '').trim();
  if (!cleanAccessToken) {
    throw new Error('Sign in before managing billing.');
  }
  if (!cleanEndpoint) {
    throw new Error('Billing portal endpoint is not configured.');
  }
  let response;
  try {
    response = await axiosClient.post(cleanEndpoint, {}, {
      headers: { Authorization: `Bearer ${cleanAccessToken}` },
      timeout: 15000
    });
  } catch (error) {
    throw normalizeHttpError(error, 'Billing portal session could not be created.');
  }
  return response.data || {};
}

async function createProSignupCheckout({ email, forceCheckout, creditsAmount, endpoint, axiosClient = axios } = {}) {
  const cleanEndpoint = String(endpoint || '').trim();
  if (!cleanEndpoint) {
    throw new Error('Pro signup endpoint is not configured.');
  }
  let response;
  try {
    const body = { email };
    if (forceCheckout !== undefined) {
      body.forceCheckout = Boolean(forceCheckout);
    }
    if (creditsAmount !== undefined) {
      body.creditsAmount = Number(creditsAmount);
    }
    response = await axiosClient.post(cleanEndpoint, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });
  } catch (error) {
    throw normalizeHttpError(error, 'Pro checkout could not be created.');
  }
  return response.data || {};
}

module.exports = {
  createBillingPortalSession,
  createCheckoutSession,
  createProSignupCheckout,
  fetchEntitlements,
  normalizeHttpError
};
