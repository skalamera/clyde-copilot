const fs = require('node:fs');
const path = require('node:path');

// Read the actual local config database file directly
const configPath = path.join(process.env.USERPROFILE, 'AppData', 'Roaming', 'Clyde', 'config.json');
let config = {};
try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {}

// Inject mock store directly into Node's require cache!
const mockStoreInstance = {
    get: (key, defaultValue) => {
        if (key === 'userId') return config.userId || '';
        if (key === 'authEmail') return config.authEmail || '';
        if (key === 'authAccessToken') return config.authAccessToken || '';
        if (key === 'authRefreshToken') return config.authRefreshToken || '';
        if (key === 'authExpiresAt') return config.authExpiresAt || null;
        return defaultValue;
    },
    set: () => {}
};

const storePath = require.resolve('electron-store');
require.cache[storePath] = {
    id: storePath,
    filename: storePath,
    loaded: true,
    exports: class {
        constructor() {
            return mockStoreInstance;
        }
    }
};

const { createAgentChat } = require('../src/agentChat');

(async () => {
    const settings = {
        userId: config.userId || '',
        authEmail: config.authEmail || '',
        authAccessToken: config.authAccessToken || '',
        authRefreshToken: config.authRefreshToken || '',
        authExpiresAt: config.authExpiresAt || null,
        userTier: config.userTier || 'pro',
        subscriptionStatus: config.subscriptionStatus || 'active',
        subscriptionPlan: config.subscriptionPlan || 'clyde_pro_agent',
        entitlementFeatures: config.entitlementFeatures || ['pro_realtime_agent', 'knowledge_rag', 'trend_analysis'],
        llmProvider: 'clyde-cloud',
        llmModel: 'gemini-3.5-flash',
        ragEnabled: false
    };

    console.log("Active settings email:", settings.authEmail);

    const agentChat = createAgentChat({ settings });

    try {
        const result = await agentChat.sendMessage({
            message: "what's my next interview?",
            sessionId: "test-diag-session",
            messages: []
        });
        console.log("RESULT OK:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("DIAGNOSTIC CRASHED:", e);
        if (e.response && e.response.data) {
            console.error("SERVER DETAILS:", JSON.stringify(e.response.data, null, 2));
        }
    }
})();
