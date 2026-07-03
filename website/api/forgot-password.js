import { sendJson } from './_billing.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const email = String(body.email || '').trim().toLowerCase();

    if (!email) {
      sendJson(res, 400, { error: 'Email is required.' });
      return;
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendKey = process.env.RESEND_API_KEY || 're_SyCNFkdE_J3JwCGiw7pSkQ4PHjqiRLH9T';

    if (!url || !key) {
      throw new Error('Supabase configuration is missing on server.');
    }

    // 1. Generate recovery link from Supabase Admin API
    const generateLinkEndpoint = `${url.replace(/\/$/, '')}/auth/v1/admin/generate_link`;
    const redirectTo = String(body.redirectTo || process.env.CLYDE_AUTH_REDIRECT_URL || 'https://clydeai.live/auth/confirmed').trim();

    const linkResponse = await fetch(generateLinkEndpoint, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'recovery',
        email,
        options: {
          redirectTo
        }
      })
    });

    const linkPayload = await linkResponse.json().catch(() => ({}));

    if (!linkResponse.ok) {
      if (
        linkResponse.status === 404 ||
        linkPayload?.error_code === 'user_not_found' ||
        String(linkPayload?.message || '').toLowerCase().includes('not found') ||
        String(linkPayload?.msg || '').toLowerCase().includes('not found')
      ) {
        sendJson(res, 404, { error: 'An account with this email address does not exist. Please check spelling or register first.' });
        return;
      }
      throw new Error(linkPayload?.msg || linkPayload?.message || 'Failed to generate password reset link.');
    }

    const actionLink = linkPayload?.action_link;
    if (!actionLink) {
      throw new Error('No recovery action link returned from auth provider.');
    }

    // 2. Send the action link via Resend API
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Clyde Support <support@clydeai.live>',
        to: [email],
        subject: 'Reset your Clyde Password',
        html: `
          <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px 24px; border: 1px solid rgba(0,0,0,0.06); border-radius: 16px; background-color: #ffffff; color: #1e293b; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <div style="text-align: center; margin-bottom: 24px;">
              <span style="font-size: 1.5rem; font-weight: bold; background: linear-gradient(to right, #6366f1, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Clyde</span>
            </div>
            <h2 style="color: #0f172a; margin-bottom: 12px; font-size: 1.4rem; font-weight: 700; text-align: center;">Reset your Clyde password</h2>
            <p style="font-size: 0.95rem; line-height: 1.6; color: #475569; text-align: center; margin-bottom: 24px;">We received a request to reset the password for your Clyde account. Click the button below to set a new password:</p>
            <div style="margin: 28px 0; text-align: center;">
              <a href="${actionLink}" style="background: linear-gradient(to right, #6366f1, #a855f7); color: #ffffff !important; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25); font-size: 0.95rem;">Reset Password</a>
            </div>
            <p style="font-size: 0.8rem; color: #64748b; line-height: 1.5; text-align: center;">If you did not request a password reset, you can safely ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 28px 0;" />
            <p style="font-size: 0.75rem; color: #94a3b8; text-align: center; margin: 0;">Clyde — The Undetectable Agentic Interview Copilot</p>
          </div>
        `
      })
    });

    const resendPayload = await resendResponse.json().catch(() => ({}));
    if (!resendResponse.ok) {
      throw new Error(resendPayload?.message || 'Failed to send password reset email via Resend.');
    }

    sendJson(res, 200, { ok: true, message: 'Password reset link sent successfully.' });
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message });
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
    req.on('error', reject);
  });
}
