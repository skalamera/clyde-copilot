const assert = require('node:assert/strict');
const test = require('node:test');

const {
  applyEntitlementsToSettings,
  buildEntitlements,
  canUseFeature,
  entitlementsFromSettings,
  isEntitlementStale,
  requireFeature
} = require('../src/entitlements');

test('buildEntitlements defaults to free without pro-only features', () => {
  const entitlements = buildEntitlements();

  assert.equal(entitlements.tier, 'free');
  assert.equal(entitlements.pro, false);
  assert.equal(canUseFeature(entitlements, 'standard_assistant'), true);
  assert.equal(canUseFeature(entitlements, 'mock_interviews'), false);
});

test('buildEntitlements grants pro features for active pro users', () => {
  const entitlements = buildEntitlements({ tier: 'pro', status: 'active' });

  assert.equal(entitlements.tier, 'pro');
  assert.equal(entitlements.pro, true);
  assert.equal(canUseFeature(entitlements, 'pro_realtime_agent'), true);
  assert.equal(canUseFeature(entitlements, 'knowledge_rag'), true);
});

test('applyEntitlementsToSettings disables local pro switches for free users', () => {
  const settings = applyEntitlementsToSettings({
    userTier: 'free',
    proAgentEnabled: true,
    ragEnabled: true,
    googleSyncEnabled: true,
    googleSyncAutoApprove: true
  });

  assert.equal(settings.userTier, 'free');
  assert.equal(settings.proAgentEnabled, false);
  assert.equal(settings.ragEnabled, false);
  assert.equal(settings.googleSyncEnabled, false);
  assert.equal(settings.googleSyncAutoApprove, false);
});

test('local pro preferences are restored when pro entitlements are re-applied', () => {
  const signedOutLocalPreferences = {
    userTier: 'free',
    proAgentEnabled: true,
    ragEnabled: true,
    googleSyncEnabled: true,
    googleSyncAutoApprove: true
  };

  const restored = applyEntitlementsToSettings(signedOutLocalPreferences, buildEntitlements({
    tier: 'pro',
    status: 'active'
  }));

  assert.equal(restored.userTier, 'pro');
  assert.equal(restored.proAgentEnabled, true);
  assert.equal(restored.ragEnabled, true);
  assert.equal(restored.googleSyncEnabled, true);
  assert.equal(restored.googleSyncAutoApprove, true);
});

test('requireFeature throws a typed error when the feature is not available', () => {
  assert.throws(
    () => requireFeature(buildEntitlements({ tier: 'free' }), 'agent_actions'),
    (error) => error.code === 'CLYDE_PRO_REQUIRED' && error.feature === 'agent_actions'
  );
});

test('pro entitlements degrade to free when never server-verified', () => {
  const entitlements = entitlementsFromSettings({
    userId: 'u1',
    userTier: 'pro',
    subscriptionStatus: 'active'
    // no entitlementsCheckedAt — e.g. hand-edited settings file
  });

  assert.equal(entitlements.tier, 'free');
  assert.equal(entitlements.status, 'stale');
  assert.equal(canUseFeature(entitlements, 'pro_realtime_agent'), false);
});

test('pro entitlements degrade to free when the server check is older than 7 days', () => {
  const now = Date.now();
  const eightDaysAgo = new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString();
  const entitlements = entitlementsFromSettings({
    userId: 'u1',
    userTier: 'pro',
    subscriptionStatus: 'active',
    entitlementsCheckedAt: eightDaysAgo
  }, now);

  assert.equal(entitlements.tier, 'free');
  assert.equal(canUseFeature(entitlements, 'knowledge_rag'), false);
});

test('pro entitlements stay pro with a recent server check', () => {
  const now = Date.now();
  const entitlements = entitlementsFromSettings({
    userId: 'u1',
    userTier: 'pro',
    subscriptionStatus: 'active',
    entitlementsCheckedAt: new Date(now - 60 * 60 * 1000).toISOString(),
    entitlementsExpiresAt: new Date(now + 20 * 24 * 60 * 60 * 1000).toISOString()
  }, now);

  assert.equal(entitlements.tier, 'pro');
  assert.equal(canUseFeature(entitlements, 'pro_realtime_agent'), true);
});

test('pro entitlements degrade when subscription expired beyond grace period', () => {
  const now = Date.now();
  const entitlements = entitlementsFromSettings({
    userId: 'u1',
    userTier: 'pro',
    subscriptionStatus: 'active',
    entitlementsCheckedAt: new Date(now - 60 * 60 * 1000).toISOString(),
    entitlementsExpiresAt: new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString()
  }, now);

  assert.equal(entitlements.tier, 'free');
});

test('expiry within the 3-day grace period keeps pro active', () => {
  const now = Date.now();
  const entitlements = entitlementsFromSettings({
    userId: 'u1',
    userTier: 'pro',
    subscriptionStatus: 'active',
    entitlementsCheckedAt: new Date(now - 60 * 60 * 1000).toISOString(),
    entitlementsExpiresAt: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString()
  }, now);

  assert.equal(entitlements.tier, 'pro');
});

test('isEntitlementStale never flags free tier', () => {
  assert.equal(isEntitlementStale({ tier: 'free' }), false);
  assert.equal(isEntitlementStale({}), false);
});

test('buildEntitlements includes mock interviews for free tier with credits', () => {
  const entitlements = buildEntitlements({ tier: 'free', credits: 10 });

  assert.equal(entitlements.tier, 'free');
  assert.equal(canUseFeature(entitlements, 'mock_interviews'), true);
  assert.equal(canUseFeature(entitlements, 'liveavatar_mock_interviews'), true);
});
