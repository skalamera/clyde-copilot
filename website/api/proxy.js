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
    // ROUTE B: Chat Proxy (Gemini 2.5 Flash / OpenAI GPT Fallback)
    // -----------------------------------------------------------------
    const body = await readJson(request);
    const { contents, systemInstruction, model, jsonSchema } = body;

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

      const validGptModels = new Set(['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo']);
      const targetModel = validGptModels.has(inputModel) ? inputModel : 'gpt-4o-mini';

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
        temperature: 0.2
      };

      if (jsonSchema && jsonSchema.schema) {
        oaiPayload.response_format = {
          type: 'json_schema',
          json_schema: {
            name: jsonSchema.name || 'json_response',
            schema: jsonSchema.schema,
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
      console.log("OpenAI Proxy status:", oaiRes.status, "Raw response:", oaiRawText);

      let oaiData;
      try {
        oaiData = JSON.parse(oaiRawText);
      } catch (e) {
        console.error("OpenAI JSON parse failed. Raw response:", oaiRawText);
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

    const validGeminiModels = new Set(['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash', 'gemini-1.5-pro']);
    const targetModel = validGeminiModels.has(inputModel) ? inputModel : 'gemini-2.5-flash';
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent`;

    const geminiPayload = { contents };
    if (systemInstruction) {
      geminiPayload.systemInstruction = typeof systemInstruction === 'string'
        ? { parts: [{ text: systemInstruction }] }
        : systemInstruction;
    }

    const generationConfig = {
      temperature: 0.2,
      responseMimeType: 'application/json'
    };
    if (jsonSchema && jsonSchema.schema) {
      generationConfig.responseSchema = jsonSchema.schema;
    }
    geminiPayload.generationConfig = generationConfig;

    const geminiRes = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload)
    });

    const geminiRawText = await geminiRes.text();
    console.log("Gemini Proxy status:", geminiRes.status, "Raw response:", geminiRawText);

    let geminiData;
    try {
      geminiData = JSON.parse(geminiRawText);
    } catch (e) {
      console.error("Gemini JSON parse failed. Raw response:", geminiRawText);
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
