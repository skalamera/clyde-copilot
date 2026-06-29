import { listSupabaseUsersByEmail, normalizeEmail, sendJson } from './_billing.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');
    const redirectTo = String(body.redirectTo || process.env.CLYDE_AUTH_REDIRECT_URL || 'https://clydeai.live/auth/confirmed').trim();

    if (!email || !password) {
      sendJson(res, 400, { error: 'Email and password are required.' });
      return;
    }

    const existing = await listSupabaseUsersByEmail(email);
    if (existing.length > 0) {
      sendJson(res, 400, { error: 'An account with this email already exists. Please sign in instead.' });
      return;
    }

    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error('Supabase signup is not configured.');
    }

    const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password,
        options: {
          email_redirect_to: redirectTo
        }
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      sendJson(res, response.status, { error: payload?.msg || payload?.message || payload?.error || 'Account creation failed.' });
      return;
    }

    // 2. Dispatch a beautiful Welcome Email via Resend API
    const resendKey = process.env.RESEND_API_KEY || 're_SyCNFkdE_J3JwCGiw7pSkQ4PHjqiRLH9T';
    
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Clyde Team <welcome@clydeai.live>',
          to: [email],
          subject: 'Welcome to Clyde - Let\'s Launch Your Career Cockpit 🚀',
          html: `
            <style>
              @font-face {
                font-family: 'Mokoto';
                src: url('https://clydeai.live/Mokoto.ttf') format('truetype');
              }
            </style>
            <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; background-color: #0b0f19; color: #f8fafc; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5); box-sizing: border-box;">
              <div style="text-align: center; margin-bottom: 28px;">
                <span style="font-family: 'Mokoto', system-ui, sans-serif; font-size: 2.2rem; font-weight: 800; color: #22c55e; letter-spacing: 2px;">CLYDE</span>
              </div>
              
              <h1 style="color: #ffffff; margin-bottom: 16px; font-size: 1.5rem; font-weight: 800; text-align: center;">Welcome to the Future of Job Searching, ${email.split('@')[0]}!</h1>
              <p style="font-size: 0.95rem; line-height: 1.6; color: #94a3b8; text-align: center; margin-bottom: 28px;">
                You have successfully created your Clyde account. By combining the power of the <strong>Clyde Desktop App</strong> and our high-performance <strong>Clyde-Go Chrome Extension</strong>, you now have an elite, fully integrated AI career cockpit.
              </p>

              <hr style="border: none; border-top: 1px solid rgba(255, 255, 255, 0.08); margin: 24px 0;" />

              <h3 style="color: #38bdf8; font-size: 1.1rem; font-weight: 700; margin-bottom: 12px;">🎮 Get Started in 3 Steps:</h3>
              <ol style="padding-left: 20px; color: #cbd5e1; font-size: 0.9rem; line-height: 1.6; margin-bottom: 24px;">
                <li style="margin-bottom: 8px;"><strong>Upload & Standardize Your Resume:</strong> Open Settings inside the Clyde-Go extension to run our <strong>Master Resume Onboarding Wizard</strong>. This compiles your background into a high-fidelity JSON profile.</li>
                <li style="margin-bottom: 8px;"><strong>Pair Extension with Desktop:</strong> Copy your pairing code from Clyde Desktop Settings and paste it into Clyde-Go to automatically sync clips and documents in real-time.</li>
                <li style="margin-bottom: 8px;"><strong>Autofill & Tailor:</strong> Clip any job description on LinkedIn, Indeed, or Greenhouse. Then, click <strong>AI Apply</strong> to let Clyde autofill standard or complex form fields automatically!</li>
              </ol>

              <h3 style="color: #38bdf8; font-size: 1.1rem; font-weight: 700; margin-bottom: 12px;">📊 Your Subscription & Benefits Breakdown</h3>
              <p style="font-size: 0.9rem; color: #94a3b8; margin-bottom: 14px;">Since email confirmations are bypassed, your account is active immediately. Here is a breakdown of what features are unlocked for your current tier:</p>

              <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 16px; margin-bottom: 24px; box-sizing: border-box;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
                  <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #a855f7; margin-right: 12px;">🎁 Clyde Pro / Credits Plan</span>
                  <span style="font-size: 11px; background: rgba(74, 222, 128, 0.1); border: 1px solid rgba(74, 222, 128, 0.2); color: #4ade80; font-weight: 700; padding: 2px 8px; border-radius: 10px; margin-left: 12px; flex-shrink: 0;">PREMIUM</span>
                </div>
                <ul style="padding-left: 20px; color: #4ade80; font-size: 0.85rem; line-height: 1.5; margin: 0; list-style-type: '✓ ';">
                  <li style="margin-bottom: 6px;"><strong>AI Auto-Apply form filler</strong> (unlocked)</li>
                  <li style="margin-bottom: 6px;"><strong>Hyper-tailored PDF Resumes & Cover Letters</strong></li>
                  <li style="margin-bottom: 6px;"><strong>STAR method behavior Interview Prep stories</strong></li>
                  <li style="margin-bottom: 6px;"><strong>Advanced LinkedIn recruiter outreach pitches</strong></li>
                </ul>
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
                  <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-right: 12px;">⚪ Clyde Assistant (Your Current Free Tier)</span>
                  <span style="font-size: 11px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: #cbd5e1; font-weight: 700; padding: 2px 8px; border-radius: 10px; margin-left: 12px; flex-shrink: 0;">FREE</span>
                </div>
                <ul style="padding-left: 20px; color: #cbd5e1; font-size: 0.85rem; line-height: 1.5; margin: 0; list-style-type: '✓ ';">
                  <li style="margin-bottom: 6px;">Store and manage up to 50 clipped JDs</li>
                  <li style="margin-bottom: 6px;">Free manual desktop-to-extension pairing</li>
                  <li style="margin-bottom: 6px; color: #f87171; list-style-type: '✕ ';">AI Auto-Apply form filler (locked)</li>
                  <li style="margin-bottom: 6px; color: #f87171; list-style-type: '✕ ';">Tailored Document PDF compiles (locked)</li>
                </ul>
              </div>

              <h3 style="color: #38bdf8; font-size: 1.1rem; font-weight: 700; margin-bottom: 12px;">🪙 Understanding Clyde Credits</h3>
              <p style="font-size: 0.9rem; line-height: 1.6; color: #cbd5e1; margin-bottom: 24px;">
                Clyde operates on a clean, pay-as-you-go <strong>Credit System</strong>. Premium AI features (like tailoring documents or preparing interview answers) consume <strong>1 credit</strong> per generation.
                <br><br>
                You can purchase pay-as-you-go credit packs (credits never expire!) or unlock <strong>unlimited premium generations</strong> immediately by subscribing to <strong>Clyde Pro</strong> for just $29.99/month.
              </p>

              <div style="text-align: center; margin: 28px 0;">
                <a href="https://clydeai.live/pricing" style="background: linear-gradient(to right, #6366f1, #a855f7); color: #ffffff !important; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; display: inline-block; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.35); font-size: 0.95rem;">Upgrade to Clyde Pro or Buy Credits</a>
              </div>

              <hr style="border: none; border-top: 1px solid rgba(255, 255, 255, 0.08); margin: 24px 0;" />
              
              <p style="font-size: 0.82rem; color: #94a3b8; text-align: center; line-height: 1.5;">
                Need additional assistance or have questions about settings? Visit our <a href="https://clydeai.live/support" style="color: #38bdf8; text-decoration: underline;">Clyde Support Page</a>.
              </p>
              
              <p style="font-size: 0.75rem; color: #475569; text-align: center; margin-top: 24px; margin-bottom: 0;">
                Clyde — The Undetectable Agentic Interview Copilot
              </p>
            </div>
          `
        })
      });
      console.log(`[signup-email] Successfully dispatched welcome email to ${email}`);
    } catch (emailErr) {
      console.error('[signup-email] Failed to dispatch welcome email:', emailErr.message);
    }

    sendJson(res, 200, payload);
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
