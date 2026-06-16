import { sendJson } from './_billing.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const userId = String(body.userId || '').trim();

    if (!email) {
      sendJson(res, 400, { error: 'Email is required.' });
      return;
    }

    const resendKey = process.env.RESEND_API_KEY || 're_SyCNFkdE_J3JwCGiw7pSkQ4PHjqiRLH9T';

    // Send the deletion notification to Stephen's email
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Clyde Security <security@clydeai.live>',
        to: ['skalamera@gmail.com'],
        subject: `⚠️ Clyde Account Deletion Request - ${email}`,
        html: `
          <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px 24px; border: 1px solid rgba(220,38,38,0.2); border-radius: 16px; background-color: #fef2f2; color: #1e293b; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <div style="text-align: center; margin-bottom: 24px;">
              <span style="font-size: 1.5rem; font-weight: bold; color: #dc2626;">Clyde Security Portal</span>
            </div>
            <h2 style="color: #991b1b; margin-bottom: 12px; font-size: 1.4rem; font-weight: 700; text-align: center;">Account Deletion Request</h2>
            <p style="font-size: 0.95rem; line-height: 1.6; color: #7f1d1d; text-align: center; margin-bottom: 24px;">A user has initiated an official request to delete their Clyde account and all associated personal data.</p>
            
            <div style="background-color: #ffffff; border: 1px solid rgba(0,0,0,0.06); border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <div style="margin-bottom: 8px;"><strong>Email address:</strong> <span style="font-family: monospace;">${email}</span></div>
              <div><strong>User ID:</strong> <span style="font-family: monospace;">${userId || 'Not Provided / Offline'}</span></div>
            </div>

            <p style="font-size: 0.8rem; color: #991b1b; line-height: 1.5; text-align: center; font-weight: bold;">Action Required: Please purge this user's data from the Supabase auth/public databases and any associated Pinecone or storage buckets within 24 hours.</p>
            <hr style="border: none; border-top: 1px solid rgba(220,38,38,0.1); margin: 28px 0;" />
            <p style="font-size: 0.75rem; color: #b91c1c; text-align: center; margin: 0;">Clyde Security Audit Pipeline.</p>
          </div>
        `
      })
    });

    const resendPayload = await resendResponse.json().catch(() => ({}));
    if (!resendResponse.ok) {
      throw new Error(resendPayload?.message || 'Failed to dispatch account deletion email via Resend.');
    }

    sendJson(res, 200, { ok: true, message: 'Account deletion request processed successfully.' });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}
