const assert = require('node:assert/strict');
const test = require('node:test');

const { createProSignupCheckout, fetchEntitlements } = require('../src/billingClient');

test('fetchEntitlements returns free when no user is signed in', async () => {
  const entitlements = await fetchEntitlements({
    userId: '',
    endpoint: 'https://example.test/api/entitlements',
    axiosClient: {
      get() {
        throw new Error('should not call network');
      }
    }
  });

  assert.equal(entitlements.tier, 'free');
  assert.equal(entitlements.userId, '');
});

test('createProSignupCheckout sends only email to the checkout endpoint', async () => {
  let request = null;
  const result = await createProSignupCheckout({
    email: 'user@example.com',
    password: 'should-not-be-sent',
    endpoint: 'https://example.test/api/create-pro-signup-checkout',
    axiosClient: {
      async post(url, body, options) {
        request = { url, body, options };
        return { data: { url: 'https://checkout.stripe.test/session' } };
      }
    }
  });

  assert.equal(request.url, 'https://example.test/api/create-pro-signup-checkout');
  assert.deepEqual(request.body, { email: 'user@example.com' });
  assert.equal(request.options.headers['Content-Type'], 'application/json');
  assert.equal(result.url, 'https://checkout.stripe.test/session');
});

test('fetchEntitlements requests the entitlement endpoint for signed-in users', async () => {
  let request = null;
  const entitlements = await fetchEntitlements({
    userId: 'user-1',
    accessToken: 'token-1',
    endpoint: 'https://example.test/api/entitlements',
    axiosClient: {
      async get(url, options) {
        request = { url, options };
        return { data: { tier: 'pro', status: 'active' } };
      }
    }
  });

  assert.equal(request.url, 'https://example.test/api/entitlements');
  assert.equal(request.options.headers.Authorization, 'Bearer token-1');
  assert.equal(entitlements.tier, 'pro');
  assert.equal(entitlements.pro, true);
});
