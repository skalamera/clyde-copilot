import { findSubscriptionByUserId, requireSupabaseUser, sendJson, readJson } from './_billing.js';

export const config = {
  api: {
    bodyParser: false, // Stream raw multipart body directly for transcribe
  },
};

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

    // Determine proxy routing type (query param or fallback)
    const urlObj = new URL(request.url, `http://${request.headers.host}`);
    const type = urlObj.searchParams.get('type') || 'chat';

    // -----------------------------------------------------------------
    // ROUTE A: Transcription Proxy
    // -----------------------------------------------------------------
    if (type === 'transcribe') {
      // Read raw binary body stream
      const chunks = [];
      for await (const chunk of request) {
        chunks.push(chunk);
      }
      const rawBody = Buffer.concat(chunks);

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        sendJson(response, 500, { error: 'Clyde server-managed OpenAI API key is not configured.' });
        return;
      }

      const oaiRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': request.headers['content-type']
        },
        body: rawBody
      });

      const data = await oaiRes.json();
      response.statusCode = oaiRes.status;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(data));
      return;
    }

    // -----------------------------------------------------------------
    // ROUTE B: Chat Proxy (Gemini 2.5 Flash)
    // -----------------------------------------------------------------
    const body = await readJson(request);
    const { contents, systemInstruction } = body;

    if (!contents || !Array.isArray(contents)) {
      sendJson(response, 400, { error: 'Valid chat contents are required.' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      sendJson(response, 500, { error: 'Clyde server-managed API key is not configured.' });
      return;
    }

    const geminiPayload = { contents };
    if (systemInstruction) {
      geminiPayload.systemInstruction = typeof systemInstruction === 'string'
        ? { parts: [{ text: systemInstruction }] }
        : systemInstruction;
    }

    const geminiRes = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload)
    });

    const geminiData = await geminiRes.json();
    sendJson(response, geminiRes.status, geminiData);

  } catch (error) {
    console.error('API Proxy failed:', error);
    sendJson(response, 500, { error: error.message || 'Internal server error' });
  }
}
