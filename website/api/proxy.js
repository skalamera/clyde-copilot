import crypto from 'node:crypto';
import { findSubscriptionByUserId, requireSupabaseUser, sendJson, readJson, upsertSubscriptionRecord } from './_billing.js';

export const config = {
  api: {
    bodyParser: false, // Stream raw multipart body directly for transcribe
  },
};

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent';
const GEMINI_EMBED_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_LICENSE_RE = /^clyde_lic_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{16,})$/i;
const SIGNED_LICENSE_V2_RE = /^clyde_lic_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(\d+)\.([A-Za-z0-9_-]{16,})$/i;

function isActiveSubscription(subscription) {
  const isPro = ['active', 'trialing'].includes(String(subscription?.status || '').toLowerCase());
  const hasCredits = subscription && typeof subscription.credits === 'number' && subscription.credits > 0;
  return isPro || hasCredits;
}

/**
 * Verifies a signed license token.
 * Supports V2 tokens of form `clyde_lic_<userId>.<expiryEpoch>.<hmac>` and
 * legacy V1 tokens of form `clyde_lic_<userId>.<hmac>`.
 * Returns { id, expiry } on success, null on failure.
 */
async function verifySignedLicenseToken(token) {
  const secret = process.env.CLYDE_LICENSE_SIGNING_SECRET;
  if (!secret) {
    return null;
  }

  // 1. Try V2 Format Check (with expiry and tokenVersion)
  const v2Match = SIGNED_LICENSE_V2_RE.exec(token);
  if (v2Match) {
    const userId = v2Match[1].toLowerCase();
    const expiry = Number(v2Match[2]);
    const provided = v2Match[3];

    // Check expiration
    if (Date.now() > expiry) {
      return null;
    }

    // Load subscription to get current token_version
    let tokenVersion = 1;
    try {
      const subscription = await findSubscriptionByUserId(userId);
      if (subscription && typeof subscription.token_version === 'number') {
        tokenVersion = subscription.token_version;
      }
    } catch (e) {
      console.error('[verifySignedLicenseToken] Failed to lookup subscription for tokenVersion:', e.message);
    }

    // Verify signature
    const message = `${userId}.${expiry}.${tokenVersion}`;
    const expected = crypto.createHmac('sha256', secret).update(message).digest('base64url');
    const providedBuf = Buffer.from(provided);
    const expectedBuf = Buffer.from(expected);
    if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
      return null;
    }

    return { id: userId, expiry };
  }

  // 2. Fallback to legacy V1 format (grace period)
  const legacyMatch = SIGNED_LICENSE_RE.exec(token);
  if (legacyMatch) {
    const userId = legacyMatch[1].toLowerCase();
    const provided = legacyMatch[2];

    const expected = crypto.createHmac('sha256', secret).update(userId).digest('base64url');
    const providedBuf = Buffer.from(provided);
    const expectedBuf = Buffer.from(expected);
    if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
      return null;
    }

    return { id: userId };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Per-user sliding-window rate limiting (in-memory, per serverless instance).
// This is a best-effort abuse brake on the server-managed API keys, not a
// billing-grade quota system. Tune via env without redeploying code paths.
// ---------------------------------------------------------------------------
const RATE_LIMITS_PER_MINUTE = {
  chat: Number(process.env.CLYDE_PROXY_CHAT_RPM || 60),
  embed: Number(process.env.CLYDE_PROXY_EMBED_RPM || 120),
  transcribe: Number(process.env.CLYDE_PROXY_TRANSCRIBE_RPM || 120)
};
const RATE_WINDOW_MS = 60_000;
const rateBuckets = new Map();

function checkRateLimit(userId, type) {
  const limit = RATE_LIMITS_PER_MINUTE[type] || RATE_LIMITS_PER_MINUTE.chat;
  const now = Date.now();
  const key = `${userId}:${type}`;
  let bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.windowStart >= RATE_WINDOW_MS) {
    bucket = { windowStart: now, count: 0 };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  // Opportunistic cleanup so the map cannot grow without bound.
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets) {
      if (now - v.windowStart >= RATE_WINDOW_MS) {
        rateBuckets.delete(k);
      }
    }
  }
  return bucket.count <= limit;
}

// Exported for tests.
export { verifySignedLicenseToken, checkRateLimit };

function makeSchemaStrictForOpenAI(schema) {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }
  const copy = { ...schema };
  if (copy.type === 'object') {
    copy.additionalProperties = false;
    if (copy.properties) {
      // In OpenAI strict schemas, all defined properties must be listed in required array!
      copy.required = Object.keys(copy.properties);
    } else {
      delete copy.required;
    }
  } else {
    // If it is not an object type, it cannot have a required array in strict mode
    delete copy.required;
  }
  if (copy.properties) {
    const nextProps = {};
    for (const [key, value] of Object.entries(copy.properties)) {
      nextProps[key] = makeSchemaStrictForOpenAI(value);
    }
    copy.properties = nextProps;
  }
  if (copy.anyOf && Array.isArray(copy.anyOf)) {
    copy.anyOf = copy.anyOf.map(makeSchemaStrictForOpenAI);
  }
  if (copy.allOf && Array.isArray(copy.allOf)) {
    copy.allOf = copy.allOf.map(makeSchemaStrictForOpenAI);
  }
  if (copy.items) {
    copy.items = makeSchemaStrictForOpenAI(copy.items);
  }
  return copy;
}

function cleanSchemaForGemini(schema) {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  // Handle standard JSON schema optional/nullable standard structure of format:
  // anyOf: [ { type: 'null' }, { type: 'object', properties: ... } ]
  // by mapping it to a single nullable object.
  if (schema.anyOf && Array.isArray(schema.anyOf)) {
    const nonNullSchema = schema.anyOf.find(s => s && s.type !== 'null');
    const hasNull = schema.anyOf.some(s => s && s.type === 'null');
    if (nonNullSchema) {
      const cleaned = cleanSchemaForGemini(nonNullSchema);
      if (hasNull) {
        cleaned.nullable = true;
      }
      return cleaned;
    }
  }

  const copy = {};
  const allowedKeys = new Set(['type', 'format', 'description', 'nullable', 'enum', 'properties', 'required', 'items']);
  
  for (const [key, value] of Object.entries(schema)) {
    if (allowedKeys.has(key)) {
      copy[key] = value;
    }
  }

  if (copy.type) {
    copy.type = String(copy.type).toUpperCase();
  }

  if (copy.type === 'OBJECT' && (!copy.properties || Object.keys(copy.properties).length === 0)) {
    // Google Gemini API rejects OBJECT types that do not have properties defined.
    // Return an empty/unconstrained schema to allow any free-form dictionary.
    return {};
  }

  if (copy.properties) {
    const nextProps = {};
    for (const [key, value] of Object.entries(copy.properties)) {
      nextProps[key] = cleanSchemaForGemini(value);
    }
    copy.properties = nextProps;
  }

  if (copy.items) {
    copy.items = cleanSchemaForGemini(copy.items);
  }

  return copy;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendJson(response, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    // 1. Authenticate user. Accepted credentials, in order of preference:
    //    a) Signed license token (clyde_lic_<uuid>.<hmac>, minted by /api/license-token)
    //    b) Supabase session JWT
    //    c) LEGACY: bare user UUID — only when CLYDE_ALLOW_UUID_LICENSE=true.
    //       Bare UUIDs are guessable/leakable and grant use of server-managed
    //       API keys, so this path is disabled by default.
    let user = null;
    const authHeader = String(request.headers.authorization || '');
    const authToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';

    if (!authToken) {
      sendJson(response, 401, { error: 'Authentication token required.' });
      return;
    }

    const signedUser = await verifySignedLicenseToken(authToken);
    if (signedUser) {
      user = signedUser;
    } else if (UUID_RE.test(authToken)) {
      if (process.env.CLYDE_ALLOW_UUID_LICENSE === 'true') {
        console.warn('Proxy auth: legacy bare-UUID license token accepted (CLYDE_ALLOW_UUID_LICENSE=true). Migrate to signed license tokens.');
        user = { id: authToken.toLowerCase() };
      } else {
        sendJson(response, 401, {
          error: 'Bare user IDs are no longer accepted as license tokens. Generate a license token from your Clyde account (Settings > Account) and use that instead.'
        });
        return;
      }
    } else {
      try {
        user = await requireSupabaseUser(request);
      } catch (authError) {
        sendJson(response, 401, { error: 'Invalid authentication or license token.' });
        return;
      }
    }

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

    // 2b. If they are a credit-based user, deduct 1 credit
    const isPro = ['active', 'trialing'].includes(String(subscription?.status || '').toLowerCase());
    if (!isPro) {
      const currentCredits = subscription && typeof subscription.credits === 'number' ? subscription.credits : 0;
      if (currentCredits < 1) {
        sendJson(response, 402, { error: 'Insufficient credits. Please purchase more credits or subscribe to Clyde Pro.' });
        return;
      }
      const newCredits = currentCredits - 1;
      await upsertSubscriptionRecord({
        ...subscription,
        user_id: user.id,
        credits: newCredits,
        updated_at: new Date().toISOString()
      });
      console.log(`[Proxy] Deducted 1 credit for user ${user.id}. Remaining: ${newCredits}`);
    }

    // Determine proxy routing type (query param or fallback)
    const urlObj = new URL(request.url, `http://${request.headers.host}`);
    const type = urlObj.searchParams.get('type') || 'chat';

    // 3. Rate limit per user per route type
    if (!checkRateLimit(user.id, type)) {
      response.setHeader('Retry-After', '60');
      sendJson(response, 429, { error: 'Rate limit exceeded for Clyde-managed cloud API. Please slow down and retry shortly.' });
      return;
    }

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

      const oaiRawText = await oaiRes.text();
      console.log("OpenAI Proxy status:", oaiRes.status, "bytes:", oaiRawText.length);

      let oaiData;
      try {
        oaiData = JSON.parse(oaiRawText);
      } catch (e) {
        console.error("OpenAI JSON parse failed. Raw response (truncated):", oaiRawText.slice(0, 300));
        sendJson(response, 500, {
          error: `OpenAI response JSON parse failed. Status: ${oaiRes.status}. Raw text: ${oaiRawText.slice(0, 300)}`
        });
        return;
      }

      if (!oaiRes.ok) {
        sendJson(response, oaiRes.status, oaiData);
        return;
      }

      sendJson(response, 200, oaiData);
      return;
    }

    // -----------------------------------------------------------------
    // ROUTE B: Embedding Proxy (RAG Fallback)
    // -----------------------------------------------------------------
    if (type === 'embed') {
      const body = await readJson(request);
      const { text } = body;
      if (!text) {
        sendJson(response, 400, { error: 'Text is required for embedding generation.' });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        sendJson(response, 500, { error: 'Clyde server-managed Gemini API key is not configured.' });
        return;
      }

      const embedPayload = {
        content: {
          parts: [{ text }]
        }
      };

      const embedRes = await fetch(GEMINI_EMBED_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(embedPayload)
      });

      const embedData = await embedRes.json();
      if (!embedRes.ok) {
        sendJson(response, embedRes.status, embedData);
        return;
      }

      const values = embedData?.embedding?.values || [];
      sendJson(response, 200, { embedding: values });
      return;
    }

    // -----------------------------------------------------------------
    // ROUTE C: Chat Proxy (Gemini 2.5 Flash / OpenAI GPT Fallback)
    // -----------------------------------------------------------------
    const body = await readJson(request);
    const { contents, systemInstruction, model, jsonSchema, maxTokens, temperature } = body;

    if (!contents || !Array.isArray(contents)) {
      sendJson(response, 400, { error: 'Valid chat contents are required.' });
      return;
    }

    const inputModel = String(model || '').toLowerCase().trim();

    // 1. OpenAI GPT Model Routing Path
    if (inputModel.startsWith('gpt-')) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        sendJson(response, 500, { error: 'Clyde server-managed OpenAI API key is not configured.' });
        return;
      }

      const validGptModels = new Set(['gpt-4o']);
      const targetModel = 'gpt-4o';

      const openaiMessages = [];
      if (systemInstruction) {
        const sysText = typeof systemInstruction === 'string'
          ? systemInstruction
          : (systemInstruction.parts?.[0]?.text || '');
        if (sysText) {
          openaiMessages.push({ role: 'system', content: sysText + "\n\nIMPORTANT: You must output the response in raw JSON format matching the schema." });
        }
      } else {
        openaiMessages.push({ role: 'system', content: "IMPORTANT: You must output the response in raw JSON format matching the schema." });
      }

      for (const item of contents) {
        const role = item.role === 'model' || item.role === 'assistant' ? 'assistant' : 'user';
        const content = Array.isArray(item.parts)
          ? item.parts.map(p => p.text || '').join('')
          : String(item.parts || '');
        openaiMessages.push({ role, content });
      }

      const oaiPayload = {
        model: targetModel,
        messages: openaiMessages,
        temperature: typeof temperature === 'number' ? temperature : 0.2
      };

      if (maxTokens) {
        oaiPayload.max_completion_tokens = Number(maxTokens);
      }

      if (jsonSchema && jsonSchema.schema) {
        const strictSchema = makeSchemaStrictForOpenAI(jsonSchema.schema);
        oaiPayload.response_format = {
          type: 'json_schema',
          json_schema: {
            name: jsonSchema.name || 'json_response',
            schema: strictSchema,
            strict: true
          }
        };
      } else {
        oaiPayload.response_format = { type: 'json_object' };
      }

      const oaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(oaiPayload)
      });

      const oaiRawText = await oaiRes.text();
      console.log("OpenAI Proxy status:", oaiRes.status, "bytes:", oaiRawText.length);

      let oaiData;
      try {
        oaiData = JSON.parse(oaiRawText);
      } catch (e) {
        console.error("OpenAI JSON parse failed. Raw response (truncated):", oaiRawText.slice(0, 300));
        sendJson(response, 500, {
          error: `OpenAI response JSON parse failed. Status: ${oaiRes.status}. Raw text: ${oaiRawText.slice(0, 300)}`
        });
        return;
      }

      if (!oaiRes.ok) {
        sendJson(response, oaiRes.status, oaiData);
        return;
      }

      const contentText = oaiData?.choices?.[0]?.message?.content || '';
      
      const geminiCompatibleResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: contentText }]
            }
          }
        ]
      };

      sendJson(response, 200, geminiCompatibleResponse);
      return;
    }

    // 2. Google Gemini Model Routing Path
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      sendJson(response, 500, { error: 'Clyde server-managed API key is not configured.' });
      return;
    }

    const validGeminiModels = new Set(['gemini-3.5-flash']);
    const targetModel = 'gemini-3.5-flash';
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent`;

    const geminiPayload = { contents };
    if (systemInstruction) {
      geminiPayload.systemInstruction = typeof systemInstruction === 'string'
        ? { parts: [{ text: systemInstruction }] }
        : systemInstruction;
    }

    const generationConfig = {
      temperature: typeof temperature === 'number' ? temperature : 0.2,
      responseMimeType: 'application/json'
    };
    if (maxTokens) {
      generationConfig.maxOutputTokens = Number(maxTokens);
    }
    const incomingSchema = (jsonSchema && jsonSchema.schema) || body.generationConfig?.responseSchema || jsonSchema;
    if (incomingSchema) {
      generationConfig.responseSchema = cleanSchemaForGemini(incomingSchema);
    }
    geminiPayload.generationConfig = generationConfig;

    const geminiRes = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(geminiPayload)
    });

    const geminiRawText = await geminiRes.text();
    console.log("Gemini Proxy status:", geminiRes.status, "bytes:", geminiRawText.length);
    console.log("Gemini Proxy raw response:", geminiRawText);

    let geminiData;
    try {
      geminiData = JSON.parse(geminiRawText);
    } catch (e) {
      console.error("Gemini JSON parse failed. Raw response (truncated):", geminiRawText.slice(0, 300));
      sendJson(response, 500, {
        error: `Gemini response JSON parse failed. Status: ${geminiRes.status}. Raw text: ${geminiRawText.slice(0, 300)}`
      });
      return;
    }

    sendJson(response, geminiRes.status, geminiData);

  } catch (error) {
    console.error('API Proxy failed:', error);
    sendJson(response, 500, { error: error.message || 'Internal server error' });
  }
}
