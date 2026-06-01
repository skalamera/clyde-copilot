import fs from 'fs';
import path from 'path';
import { sendJson, readJson } from './_billing.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendJson(response, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = await readJson(request);
    const type = body.type || 'message'; // 'message' or 'lead'

    // -----------------------------------------------------------------
    // CASE 1: Save Support Lead (append to Google Sheets or return success)
    // -----------------------------------------------------------------
    if (type === 'lead') {
      const { name, email, query } = body;
      if (!email || !query) {
        sendJson(response, 400, { error: 'Email and query are required.' });
        return;
      }

      console.log(`📥 Received support lead: ${name} <${email}>: ${query}`);

      // Google Sheets integration (optional, triggered if SUPPORT_LEADS_SHEET_ID is configured)
      const sheetId = process.env.SUPPORT_LEADS_SHEET_ID;
      const googleRefreshToken = process.env.GOOGLE_REFRESH_TOKEN;
      const clientId = process.env.CLYDE_GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID;
      const clientSecret = process.env.CLYDE_GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET;

      if (sheetId && googleRefreshToken && clientId && clientSecret) {
        try {
          // 1. Refresh Google Access Token
          const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: googleRefreshToken,
              grant_type: 'refresh_token'
            })
          });
          const tokenData = await tokenRes.json();
          const accessToken = tokenData.access_token;

          if (accessToken) {
            // 2. Append row to Google Sheets
            const appendRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:append?valueInputOption=USER_ENTERED`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                values: [[
                  new Date().toISOString(),
                  name || 'Anonymous',
                  email,
                  query
                ]]
              })
            });
            const appendData = await appendRes.json();
            console.log('✅ Successfully appended lead to Google Sheets:', appendData);
          }
        } catch (sheetErr) {
          console.error('❌ Failed to write lead to Google Sheets:', sheetErr);
        }
      }

      sendJson(response, 200, { success: true, message: 'Your support request has been logged successfully.' });
      return;
    }

    // -----------------------------------------------------------------
    // CASE 2: Live Support Chat Bot (RAG with support_doc.md + Gemini)
    // -----------------------------------------------------------------
    const userMessage = String(body.message || '').trim();
    if (!userMessage) {
      sendJson(response, 400, { error: 'Message is required.' });
      return;
    }

    // 1. SMART LOCAL LOOKUP MATCH (Fast path / offline fallback)
    const msgLower = userMessage.toLowerCase();
    let localReply = "";

    if (msgLower.includes("final round") || msgLower.includes("competitor") || msgLower.includes("alternative") || msgLower.includes("why clyde") || msgLower.includes("vs")) {
      localReply = "Clyde is fully undetectable on Zoom, Teams, and Google Meet screenshares because it uses native Windows display exclusion APIs, whereas browser-based tools like Final Round are easily captured. Clyde also runs 100% offline with local models (like Qwen via LM Studio) for total data privacy, and operates under 500ms which is 10x faster than cloud-dependent alternatives.";
    } else if (msgLower.includes("detect") || msgLower.includes("screen share") || msgLower.includes("zoom") || msgLower.includes("teams") || msgLower.includes("visible")) {
      localReply = "No, Clyde is completely undetectable on screenshares and remote recording apps! It uses native OS exclusion rules that tell the graphics engine to completely skip rendering Clyde's floating window on captured feeds.";
    } else if (msgLower.includes("pricing") || msgLower.includes("price") || msgLower.includes("cost") || msgLower.includes("free") || msgLower.includes("pro")) {
      localReply = "Clyde has a Free Tier that includes cloud-transcription and basic note-taking. The Pro Tier is $29.99/month (or $240/year billed annually) and unlocks active Pinecone RAG knowledge bases, Google Sync, local model integrations, and advanced trend dashboards.";
    } else if (msgLower.includes("local") || msgLower.includes("lm studio") || msgLower.includes("qwen") || msgLower.includes("offline")) {
      localReply = "Yes! Clyde supports running completely offline using local models (like Qwen 2.5/3.6) via LM Studio on port 1234. In this configuration, no company info or conversation transcripts ever leave your local computer.";
    } else if (msgLower.includes("audio") || msgLower.includes("microphone") || msgLower.includes("capture") || msgLower.includes("voice")) {
      localReply = "Clyde uses a custom native Rust audio engine that intercepts both your system output audio (interviewer) and microphone input (you) natively, meaning no virtual audio cables or complex routing software are required.";
    }

    if (localReply) {
      sendJson(response, 200, { reply: localReply });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      // If no API key is set and no local match found, offer direct lead form.
      sendJson(response, 200, { 
        reply: "I'm currently running in offline mode because the support API key isn't configured yet. Would you like me to connect you with Stephen directly? Just type your name, email, and query, and I'll log a ticket in his sheets queue!" 
      });
      return;
    }

    // 2. Load Support Documentation
    let supportDocs = '';
    try {
      const docPath = path.join(process.cwd(), 'support_doc.md');
      if (fs.existsSync(docPath)) {
        supportDocs = fs.readFileSync(docPath, 'utf8');
      }
    } catch (err) {
      console.error('Failed to read support_doc.md:', err);
    }

    // 3. Simple keyword-match RAG retrieval
    const keywords = userMessage.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const docParagraphs = supportDocs.split(/\n##+/);
    let matchedContext = '';

    for (const para of docParagraphs) {
      const paraLower = para.toLowerCase();
      const matchCount = keywords.filter(word => paraLower.includes(word)).length;
      if (matchCount > 0) {
        matchedContext += `\nSection details:\n${para}\n`;
      }
    }

    if (!matchedContext) {
      // Fallback: supply first few sections of documentation
      matchedContext = supportDocs.slice(0, 1000);
    }

    // 4. Build Prompt for Gemini
    const systemPrompt = `
You are the official 24/7 Support AI Chatbot for Clyde (https://clydeai.live), an undetectable desktop AI assistant for remote interviews and meetings.
Use the following authoritative product documentation context to answer the user's question.

Authoritative Product Context:
${matchedContext}

Conversation Guidelines:
1. Be polite, direct, concise, and professional.
2. If the answer is documented, explain it clearly and point out how to do it.
3. If the user's query cannot be answered by the documentation, or if they ask to contact a human, reply with: "I'm sorry, I don't have that documented yet. Would you like me to connect you with Stephen? Just type your name, email, and query, and I'll log a ticket for you!"
4. Keep replies to 2-3 sentences max. Do not invent details not present in the context.
`;

    const geminiRes = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'user', parts: [{ text: `User Question: "${userMessage}"` }] }
        ]
      })
    });

    const geminiData = await geminiRes.json();
    const botReply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I encountered an issue retrieving that information. Would you like to log a support lead instead?";

    sendJson(response, 200, { reply: botReply });

  } catch (error) {
    console.error('Support chat API error:', error);
    sendJson(response, 500, { error: 'Internal server error' });
  }
}
