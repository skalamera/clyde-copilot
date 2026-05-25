const assert = require('node:assert/strict');
const test = require('node:test');

const { fetchEntitlements } = require('../src/billingClient');

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

test('fetchEntitlements requests the entitlement endpoint for signed-in users', async () => {
  let request = null;
  const entitlements = await fetchEntitlements({
    userId: 'user-1',
    endpoint: 'https://example.test/api/entitlements',
    axiosClient: {
      async get(url, options) {
        request = { url, options };
        return { data: { tier: 'pro', status: 'active' } };
      }
    }
  });

  assert.equal(request.url, 'https://example.test/api/entitlements');
  assert.equal(request.options.params.userId, 'user-1');
  assert.equal(request.options.headers['X-Clyde-User-Id'], 'user-1');
  assert.equal(entitlements.tier, 'pro');
  assert.equal(entitlements.pro, true);
});
