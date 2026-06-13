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
  'liveavatar_mock_interviews',
  'autonomous_background_runs'
];

const FEATURE_SETS = {
  free: FREE_FEATURES,
  pro: PRO_FEATURES
};

const PRO_ONLY_FEATURES = new Set(PRO_FEATURES.filter((feature) => !FREE_FEATURES.includes(feature)));

function normalizeTier(value) {
  return value === 'pro' ? 'pro' : 'free';
}

// Pro entitlements must be revalidated against the server periodically.
// If the cached entitlement is older than MAX_ENTITLEMENT_AGE_MS, or the
// subscription period ended more than EXPIRY_GRACE_MS ago without a refresh,
// the local tier silently degrades to free until the next successful
// refresh-entitlements call. This stops a tampered/stale local settings file
// from granting Pro forever while tolerating offline stretches and Stripe
// renewal timing.
const MAX_ENTITLEMENT_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const EXPIRY_GRACE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days past period end

function isEntitlementStale(input = {}, now = Date.now()) {
  if (normalizeTier(input.tier || input.userTier) !== 'pro') {
    return false;
  }

  const checkedAtMs = input.checkedAt ? Date.parse(input.checkedAt) : NaN;
  if (Number.isNaN(checkedAtMs)) {
    // Pro with no verification timestamp at all: never refreshed → stale.
    return true;
  }
  if (now - checkedAtMs > MAX_ENTITLEMENT_AGE_MS) {
    return true;
  }

  const expiresAtMs = input.expiresAt ? Date.parse(input.expiresAt) : NaN;
  if (!Number.isNaN(expiresAtMs) && now - expiresAtMs > EXPIRY_GRACE_MS) {
    return true;
  }

  return false;
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
    credits: typeof input.credits === 'number' ? input.credits : 0,
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

function entitlementsFromSettings(settings = {}, now = Date.now()) {
  const input = {
    userId: settings.userId || '',
    tier: settings.userTier || settings.tier || 'free',
    status: settings.subscriptionStatus || (settings.userTier === 'pro' ? 'active' : 'free'),
    plan: settings.subscriptionPlan || '',
    credits: typeof settings.subscriptionCredits === 'number' ? settings.subscriptionCredits : 0,
    features: settings.entitlementFeatures || [],
    expiresAt: settings.entitlementsExpiresAt || null,
    checkedAt: settings.entitlementsCheckedAt || null
  };

  if (isEntitlementStale(input, now)) {
    // Stale/unverified Pro entitlement: degrade to free until the next
    // successful server refresh (refresh-entitlements IPC) re-validates it.
    return buildEntitlements({
      userId: input.userId,
      tier: 'free',
      status: 'stale',
      credits: input.credits,
      checkedAt: input.checkedAt
    });
  }

  return buildEntitlements(input);
}

function applyEntitlementsToSettings(settings = {}, entitlements = entitlementsFromSettings(settings)) {
  const normalized = buildEntitlements(entitlements);
  return {
    ...settings,
    userTier: normalized.tier,
    subscriptionStatus: normalized.status,
    subscriptionPlan: normalized.plan,
    subscriptionCredits: typeof entitlements.credits === 'number' ? entitlements.credits : 0,
    entitlementFeatures: normalized.features,
    entitlementsExpiresAt: normalized.expiresAt,
    entitlementsCheckedAt: normalized.checkedAt,
    proAgentEnabled: normalized.pro ? Boolean(settings.proAgentEnabled) : false,
    ragEnabled: normalized.pro ? Boolean(settings.ragEnabled) : false,
    googleSyncEnabled: normalized.pro ? Boolean(settings.googleSyncEnabled) : false,
    googleSyncAutoApprove: normalized.pro ? Boolean(settings.googleSyncAutoApprove) : false
  };
}

module.exports = {
  FREE_FEATURES,
  PRO_FEATURES,
  FEATURE_SETS,
  normalizeTier,
  isEntitlementStale,
  buildEntitlements,
  canUseFeature,
  requireFeature,
  entitlementsFromSettings,
  applyEntitlementsToSettings
};
