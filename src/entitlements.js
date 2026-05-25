const FREE_FEATURES = [
  'live_capture',
  'local_transcription',
  'standard_assistant',
  'basic_sessions',
  'basic_calendar',
  'active_context_files',
  'local_knowledge'
];

const PRO_FEATURES = [
  ...FREE_FEATURES,
  'pro_realtime_agent',
  'knowledge_rag',
  'pinecone_sync',
  'trend_analysis',
  'mock_interviews',
  'google_sync',
  'agent_chat',
  'agent_actions',
  'liveavatar_mock_interviews'
];

const FEATURE_SETS = {
  free: FREE_FEATURES,
  pro: PRO_FEATURES
};

const PRO_ONLY_FEATURES = new Set(PRO_FEATURES.filter((feature) => !FREE_FEATURES.includes(feature)));

function normalizeTier(value) {
  return value === 'pro' ? 'pro' : 'free';
}

function buildEntitlements(input = {}) {
  const tier = normalizeTier(input.tier || input.userTier);
  const status = input.status || (tier === 'pro' ? 'active' : 'free');
  const featureSet = new Set(FEATURE_SETS[tier]);

  if (Array.isArray(input.features)) {
    for (const feature of input.features) {
      if (typeof feature === 'string' && feature.trim()) {
        featureSet.add(feature.trim());
      }
    }
  }

  if (tier !== 'pro') {
    for (const feature of PRO_ONLY_FEATURES) {
      featureSet.delete(feature);
    }
  }

  return {
    userId: input.userId || '',
    tier,
    userTier: tier,
    plan: input.plan || (tier === 'pro' ? 'clyde_pro_agent' : 'clyde_assistant'),
    status,
    pro: tier === 'pro' && status === 'active',
    features: [...featureSet].sort(),
    expiresAt: input.expiresAt || null,
    checkedAt: input.checkedAt || new Date().toISOString()
  };
}

function canUseFeature(entitlements, feature) {
  if (!feature) {
    return true;
  }

  const normalized = buildEntitlements(entitlements || {});
  return normalized.features.includes(feature);
}

function requireFeature(entitlements, feature) {
  if (canUseFeature(entitlements, feature)) {
    return;
  }

  const error = new Error('This feature requires Clyde Pro.');
  error.code = 'CLYDE_PRO_REQUIRED';
  error.feature = feature;
  throw error;
}

function entitlementsFromSettings(settings = {}) {
  return buildEntitlements({
    userId: settings.userId || '',
    tier: settings.userTier || settings.tier || 'free',
    status: settings.subscriptionStatus || (settings.userTier === 'pro' ? 'active' : 'free'),
    plan: settings.subscriptionPlan || '',
    features: settings.entitlementFeatures || [],
    expiresAt: settings.entitlementsExpiresAt || null,
    checkedAt: settings.entitlementsCheckedAt || null
  });
}

function applyEntitlementsToSettings(settings = {}, entitlements = entitlementsFromSettings(settings)) {
  const normalized = buildEntitlements(entitlements);
  return {
    ...settings,
    userTier: normalized.tier,
    subscriptionStatus: normalized.status,
    subscriptionPlan: normalized.plan,
    entitlementFeatures: normalized.features,
    entitlementsExpiresAt: normalized.expiresAt,
    entitlementsCheckedAt: normalized.checkedAt,
    proAgentEnabled: normalized.pro ? Boolean(settings.proAgentEnabled) : false,
    ragEnabled: normalized.pro ? Boolean(settings.ragEnabled) : false
  };
}

module.exports = {
  FREE_FEATURES,
  PRO_FEATURES,
  FEATURE_SETS,
  normalizeTier,
  buildEntitlements,
  canUseFeature,
  requireFeature,
  entitlementsFromSettings,
  applyEntitlementsToSettings
};
