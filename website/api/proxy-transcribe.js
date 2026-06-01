import { findSubscriptionByUserId, requireSupabaseUser, sendJson } from './_billing.js';

export const config = {
  api: {
    bodyParser: false, // Stream raw multipart body directly
  },
};

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
    // 1. Authenticate user
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

    // 3. Read raw binary body stream
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks);

    // 4. Verify Server API Key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      sendJson(response, 500, { error: 'Clyde server-managed OpenAI API key is not configured.' });
      return;
    }

    // 5. Forward stream directly to OpenAI Whisper API
    const oaiRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': request.headers['content-type'] // Preserve boundary header
      },
      body: rawBody
    });

    const data = await oaiRes.json();
    response.statusCode = oaiRes.status;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(data));

  } catch (error) {
    console.error('Proxy transcribe failed:', error);
    sendJson(response, 500, { error: error.message || 'Internal server error' });
  }
}
