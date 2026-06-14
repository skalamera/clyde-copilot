const { app, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const axios = require('axios');

app.setPath('userData', 'C:\\Users\\skala\\AppData\\Roaming\\clyde');

app.whenReady().then(async () => {
    console.log("Electron ready. Reading config...");
    const configPath = path.join(app.getPath('userData'), 'config.json');
    let config = {};
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
        console.error("Failed to read config:", e.message);
        app.quit();
        return;
    }

    function decryptSecret(text) {
        if (!text) return '';
        if (!text.startsWith('encrypted:')) return text;
        try {
            if (safeStorage && safeStorage.isEncryptionAvailable()) {
                const encryptedStr = text.slice('encrypted:'.length);
                const buf = Buffer.from(encryptedStr, 'base64');
                return safeStorage.decryptString(buf);
            }
        } catch (e) {
            console.error('Decryption failed:', e.message);
        }
        return '';
    }

    const decryptedAccessToken = decryptSecret(config.authAccessToken);
    console.log("Decrypted Access Token (truncated):", decryptedAccessToken.slice(0, 30) + "...");

    const messageText = "when's my next interview?";
    const systemPrompt = "You are Clyde, an agentic interview assistant. Current Date & Time: Sun Jun 14 2026 06:43:17 GMT-0400 (Eastern Daylight Time)\n\nAnswer from the provided sources when possible. Keep answers concise and cite sources by id when used.";
    
    const payload = {
        contents: [
            {
                role: 'user',
                parts: [{ text: messageText }]
            }
        ],
        model: 'gemini-3.5-flash',
        jsonSchema: {
            name: 'agent_chat_response',
            schema: {
              type: 'object',
              properties: {
                message: {
                  type: 'object',
                  properties: {
                    content: { type: 'string' },
                    citations: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          sourceId: { type: 'string' },
                          label: { type: 'string' }
                        },
                        required: ['sourceId', 'label'],
                        additionalProperties: false
                      }
                    }
                  },
                  required: ['content', 'citations'],
                  additionalProperties: false
                },
                pendingAction: {
                  anyOf: [
                    { type: 'null' },
                    {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        label: { type: 'string' },
                        summary: { type: 'string' },
                        actionType: { type: 'string' },
                        payload: { type: 'object', additionalProperties: true }
                      },
                      required: ['label', 'summary', 'actionType', 'payload'],
                      additionalProperties: false
                    }
                  ]
                }
              },
              required: ['message', 'pendingAction'],
              additionalProperties: false
            }
        },
        maxTokens: 1200,
        temperature: 0.2,
        systemInstruction: systemPrompt
    };

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${decryptedAccessToken}`
    };

    const url = 'https://clydeai.live/api/proxy?type=chat';
    try {
        console.log("Sending POST request to:", url);
        const response = await axios.post(url, payload, { headers, timeout: 120000 });
        console.log("RESPONSE STATUS:", response.status);
        console.log("RESPONSE DATA:", JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.error("REQUEST FAILED:");
        if (err.response) {
            console.error("STATUS:", err.response.status);
            console.error("DATA:", JSON.stringify(err.response.data, null, 2));
        } else {
            console.error(err);
        }
    }
    app.quit();
});
