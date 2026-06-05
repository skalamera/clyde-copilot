const axios = require('axios');

function resolveAuthConfig(config = {}) {
  const url = String(config.url || process.env.CLYDE_SUPABASE_URL || 'https://ijcoheaovypykliffqwh.supabase.co').replace(/\/$/, '');
  const apiKey = String(config.apiKey || process.env.CLYDE_SUPABASE_ANON_KEY || process.env.CLYDE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbG...8by8').trim();
  if (!url) {
    throw new Error('CLYDE_SUPABASE_URL is not configured.');
  }
  if (!apiKey) {
    throw new Error('CLYDE_SUPABASE_ANON_KEY is not configured.');
  }
  return { url, apiKey };
}

function normalizeSession(payload = {}) {
  const user = payload.user || {};
  return {
    userId: user.id || '',
    email: user.email || '',
    accessToken: payload.access_token || '',
    refreshToken: payload.refresh_token || '',
    expiresAt: payload.expires_at ? Number(payload.expires_at) * 1000 : Date.now() + Number(payload.expires_in || 3600) * 1000
  };
}

async function signUp({ email, password, redirectTo, axiosClient = axios, config } = {}) {
  const signUpEndpoint = String(config?.signUpEndpoint || process.env.CLYDE_SIGN_UP_URL || '').trim();
  if (signUpEndpoint) {
    const response = await axiosClient.post(signUpEndpoint, {
      email,
      password,
      redirectTo: redirectTo || process.env.CLYDE_AUTH_REDIRECT_URL || 'https://clydeai.live/auth/confirmed'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    return normalizeSession(response.data || {});
  }

  const { url, apiKey } = resolveAuthConfig(config);
  const emailRedirectTo = String(redirectTo || process.env.CLYDE_AUTH_REDIRECT_URL || 'https://clydeai.live/auth/confirmed').trim();
  const response = await axiosClient.post(`${url}/auth/v1/signup`, {
    email,
    password,
    options: {
      email_redirect_to: emailRedirectTo
    }
  }, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    timeout: 15000
  });
  return normalizeSession(response.data || {});
}

async function signIn({ email, password, axiosClient = axios, config } = {}) {
  const { url, apiKey } = resolveAuthConfig(config);
  const response = await axiosClient.post(`${url}/auth/v1/token?grant_type=password`, {
    email,
    password
  }, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    timeout: 15000
  });
  return normalizeSession(response.data || {});
}

async function refreshSession({ refreshToken, axiosClient = axios, config } = {}) {
  const { url, apiKey } = resolveAuthConfig(config);
  if (!refreshToken) {
    throw new Error('No refresh token is available.');
  }
  const response = await axiosClient.post(`${url}/auth/v1/token?grant_type=refresh_token`, {
    refresh_token: refreshToken
  }, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    timeout: 15000
  });
  return normalizeSession(response.data || {});
}

module.exports = {
  normalizeSession,
  refreshSession,
  signIn,
  signUp
};
