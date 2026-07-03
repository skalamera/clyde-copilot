const assert = require('node:assert/strict');
const test = require('node:test');

const { normalizeSession, refreshSession, signIn, signUp } = require('../src/authClient');

const config = {
  url: 'https://example.supabase.co',
  apiKey: 'anon-key'
};

test('normalizeSession maps Supabase auth payload', () => {
  const session = normalizeSession({
    access_token: 'access',
    refresh_token: 'refresh',
    expires_at: 123,
    user: { id: 'user-1', email: 'user@example.com' }
  });

  assert.equal(session.userId, 'user-1');
  assert.equal(session.email, 'user@example.com');
  assert.equal(session.accessToken, 'access');
  assert.equal(session.refreshToken, 'refresh');
  assert.equal(session.expiresAt, 123000);
});

test('signIn calls Supabase password token endpoint', async () => {
  let request = null;
  const session = await signIn({
    email: 'user@example.com',
    password: 'password',
    config,
    axiosClient: {
      async post(url, body, options) {
        request = { url, body, options };
        return {
          data: {
            access_token: 'access',
            refresh_token: 'refresh',
            user: { id: 'user-1', email: 'user@example.com' }
          }
        };
      }
    }
  });

  assert.equal(request.url, 'https://example.supabase.co/auth/v1/token?grant_type=password');
  assert.equal(request.body.email, 'user@example.com');
  assert.equal(request.options.headers.apikey, 'anon-key');
  assert.equal(session.userId, 'user-1');
});

test('signUp calls Supabase signup endpoint', async () => {
  let request = null;
  await signUp({
    email: 'new@example.com',
    password: 'password',
    config,
    axiosClient: {
      async post(url, body, options) {
        request = { url, body, options };
        return { data: { user: { id: 'user-2', email: 'new@example.com' } } };
      }
    }
  });

  assert.equal(request.url, 'https://example.supabase.co/auth/v1/signup');
  assert.equal(request.body.email, 'new@example.com');
  assert.equal(request.body.options.email_redirect_to, 'https://clydeai.live/auth/confirmed');
});

test('signUp uses app signup endpoint when configured', async () => {
  let request = null;
  await signUp({
    email: 'new@example.com',
    password: 'password',
    redirectTo: 'https://clydeai.live/auth/confirmed',
    config: { signUpEndpoint: 'https://clydeai.live/api/sign-up' },
    axiosClient: {
      async post(url, body, options) {
        request = { url, body, options };
        return { data: { user: { id: 'user-2', email: 'new@example.com' } } };
      }
    }
  });

  assert.equal(request.url, 'https://clydeai.live/api/sign-up');
  assert.equal(request.body.email, 'new@example.com');
  assert.equal(request.body.redirectTo, 'https://clydeai.live/auth/confirmed');
});

test('refreshSession calls Supabase refresh endpoint', async () => {
  let request = null;
  await refreshSession({
    refreshToken: 'refresh',
    config,
    axiosClient: {
      async post(url, body) {
        request = { url, body };
        return { data: { access_token: 'next', user: { id: 'user-1' } } };
      }
    }
  });

  assert.equal(request.url, 'https://example.supabase.co/auth/v1/token?grant_type=refresh_token');
  assert.equal(request.body.refresh_token, 'refresh');
});
