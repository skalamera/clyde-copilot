const LIVEAVATAR_API_BASE = 'https://api.liveavatar.com';
const SANDBOX_AVATAR_ID = 'dd73ea75-1218-4ef3-92ce-606d5f7fbc0a';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.LIVEAVATAR_API_KEY;
  if (!apiKey) {
    response.status(500).json({ error: 'LIVEAVATAR_API_KEY is not configured.' });
    return;
  }

  try {
    const contextRes = await fetch(`${LIVEAVATAR_API_BASE}/v1/contexts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey
      },
      body: JSON.stringify({
        name: `Clyde website sandbox - ${new Date().toISOString()}`,
        opening_text: 'Hi, I am Clyde. Let us run a quick mock interview practice round.',
        prompt: [
          'You are Clyde, a concise mock interview practice avatar for software and operations interviews.',
          'Ask one interview question at a time. Keep responses brief, supportive, and practical.',
          'This is a public website sandbox demo, so do not ask for sensitive personal information.'
        ].join('\n')
      })
    });

    if (!contextRes.ok) {
      const text = await contextRes.text();
      throw new Error(`Context creation failed: ${contextRes.status} ${text}`);
    }

    const contextJson = await contextRes.json();
    const contextId = contextJson?.data?.id;
    if (!contextId) {
      throw new Error('Context creation did not return an id.');
    }

    const tokenRes = await fetch(`${LIVEAVATAR_API_BASE}/v1/sessions/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey
      },
      body: JSON.stringify({
        mode: 'FULL',
        is_sandbox: true,
        avatar_id: SANDBOX_AVATAR_ID,
        avatar_persona: {
          context_id: contextId,
          language: 'en'
        }
      })
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`Session token failed: ${tokenRes.status} ${text}`);
    }

    const tokenJson = await tokenRes.json();
    const sessionToken = tokenJson?.data?.session_token;
    if (!sessionToken) {
      throw new Error('Session token response did not include a token.');
    }

    response.status(200).json({ sessionToken });
  } catch (error) {
    response.status(500).json({ error: error.message || 'Failed to start LiveAvatar sandbox.' });
  }
}
