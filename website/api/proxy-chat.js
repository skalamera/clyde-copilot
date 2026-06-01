import { findSubscriptionByUserId, requireSupabaseUser, sendJson, readJson } from './_billing.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

function isActiveSubscription(subscription) {
  return ['active', 'trialing'].includes(String(subscription?.status || '').toLowerCase());
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendJson(response, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    // 1. Authenticate user via Supabase
    const user = await requireSupabaseUser(request);
    if (!user || !user.id) {
      sendJson(response, 401, { error: 'Authentication token required.' });
      return;
    }

    // 2. Validate Pro Subscription status
    const subscription = await findSubscriptionByUserId(user.id);
    if (!isActiveSubscription(subscription)) {
      sendJson(response, 403, { error: 'Clyde Pro subscription is required to use Clyde-managed cloud API endpoints.' });
      return;
    }

    // 3. Parse incoming request body
    const body = await readJson(request);
    const { contents, systemInstruction } = body;

    if (!contents || !Array.isArray(contents)) {
      sendJson(response, 400, { error: 'Valid chat contents are required.' });
      return;
    }

    // 4. Verify Server API Key
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      sendJson(response, 500, { error: 'Clyde server-managed API key is not configured.' });
      return;
    }

    // 5. Package and Proxy request to Gemini API
    const geminiPayload = { contents };
    if (systemInstruction) {
      geminiPayload.systemInstruction = systemInstruction;
    }

    const geminiRes = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload)
    });

    const geminiData = await geminiRes.json();

    // 6. Return response to desktop app
    sendJson(response, geminiRes.status, geminiData);

  } catch (error) {
    console.error('API Proxy Chat failed:', error);
    sendJson(response, 500, { error: error.message || 'Internal server error' });
  }
}
