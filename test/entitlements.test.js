const assert = require('node:assert/strict');
const test = require('node:test');

const {
  applyEntitlementsToSettings,
  buildEntitlements,
  canUseFeature,
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

test('requireFeature throws a typed error when the feature is not available', () => {
  assert.throws(
    () => requireFeature(buildEntitlements({ tier: 'free' }), 'agent_actions'),
    (error) => error.code === 'CLYDE_PRO_REQUIRED' && error.feature === 'agent_actions'
  );
});
