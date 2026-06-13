import { sendJson, readJson } from './_billing.js';

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const body = await readJson(req);
    const { name, email, type, subject, description } = body;

    if (!email || !subject || !description) {
      sendJson(res, 400, { error: 'Email, subject, and description are required.' });
      return;
    }

    const ticketId = `CLY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    console.log(`🎟️ New Support Ticket [${ticketId}]: [${type || 'General'}] "${subject}" from ${name || 'Anonymous'} <${email}>`);

    const escapedName = escapeHtml(name || 'Anonymous');
    const escapedEmail = escapeHtml(email);
    const escapedType = escapeHtml(type || 'General');
    const escapedSubject = escapeHtml(subject);
    const escapedDescription = escapeHtml(description);

    // Prepare Gmail RFC 2822 payload
    const mailSubject = `[Clyde Support Ticket ${ticketId}] ${type || 'General'}: ${subject}`;
    const dateStr = new Date().toUTCString();

    const htmlTemplate = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Clyde Support Ticket</title>
</head>
<body style="margin: 0; padding: 0; background-color: #030609; color: #f5fbff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #030609; padding: 40px 20px;">
    <tr>
      <td align="center">
        <!-- Card Container -->
        <table width="100%" style="max-width: 600px; background-color: #071018; border: 1px solid rgba(79, 231, 255, 0.16); border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);" border="0" cellspacing="0" cellpadding="0">
          <!-- Header Accent Gradient Line -->
          <tr>
            <td height="4" style="background: linear-gradient(90deg, #4fe7ff, #9b8cff); font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>
          <!-- Header -->
          <tr>
            <td style="padding: 30px 40px 20px; border-bottom: 1px solid rgba(154, 202, 255, 0.08);">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                      <span style="color: #4fe7ff;">Clyde</span> Support Center
                    </h1>
                  </td>
                  <td align="right">
                    <span style="background-color: rgba(79, 231, 255, 0.1); border: 1px solid rgba(79, 231, 255, 0.3); color: #4fe7ff; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 99px; font-family: monospace;">
                      ${ticketId}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content Body -->
          <tr>
            <td style="padding: 30px 40px;">
              <!-- Metadata Table -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td width="35%" style="padding: 8px 0; font-size: 13px; font-weight: 600; color: #8aa2b3; text-transform: uppercase; letter-spacing: 0.5px;">Type</td>
                  <td width="65%" style="padding: 8px 0; font-size: 14px; color: #f5fbff; font-weight: 700;">
                    ${escapedType}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; font-weight: 600; color: #8aa2b3; text-transform: uppercase; letter-spacing: 0.5px;">Reporter</td>
                  <td style="padding: 8px 0; font-size: 14px; color: #f5fbff; font-weight: 600;">
                    ${escapedName}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; font-weight: 600; color: #8aa2b3; text-transform: uppercase; letter-spacing: 0.5px;">Email</td>
                  <td style="padding: 8px 0; font-size: 14px;">
                    <a href="mailto:${escapedEmail}" style="color: #4fe7ff; text-decoration: none; font-weight: 600;">${escapedEmail}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; font-weight: 600; color: #8aa2b3; text-transform: uppercase; letter-spacing: 0.5px;">Subject</td>
                  <td style="padding: 8px 0; font-size: 14px; color: #f5fbff; font-weight: 600;">
                    ${escapedSubject}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; font-weight: 600; color: #8aa2b3; text-transform: uppercase; letter-spacing: 0.5px;">Submitted</td>
                  <td style="padding: 8px 0; font-size: 13px; color: #8aa2b3;">
                    ${dateStr}
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <div style="border-top: 1px solid rgba(154, 202, 255, 0.08); margin-bottom: 24px;"></div>

              <!-- Message Description Header -->
              <h3 style="margin: 0 0 12px; font-size: 13px; font-weight: 600; color: #8aa2b3; text-transform: uppercase; letter-spacing: 0.5px;">Ticket Description</h3>
              
              <!-- Description Content Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #030609; border: 1px solid rgba(154, 202, 255, 0.08); border-radius: 8px;">
                <tr>
                  <td style="padding: 20px; font-size: 14px; line-height: 1.6; color: #d8e6ef;">
                    <div style="white-space: pre-wrap; font-family: inherit;">${escapedDescription}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer info -->
          <tr>
            <td style="padding: 20px 40px 30px; background-color: rgba(1, 8, 14, 0.4); border-top: 1px solid rgba(154, 202, 255, 0.08); text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #597184; line-height: 1.5;">
                This ticket was submitted via the Clyde Marketing Site Support form.<br>
                To respond to the user, simply reply directly to this email.
              </p>
            </td>
          </tr>
        </table>
        <!-- Corporate Footer -->
        <table width="100%" style="max-width: 600px; margin-top: 20px; text-align: center;" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td>
              <p style="margin: 0; font-size: 11px; color: #597184;">
                Clyde AI &copy; 2026. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Construct raw MIME email
    const rawEmail = [
      `From: skalamera@gmail.com`,
      `To: skalamera@gmail.com`,
      `Reply-To: ${email}`,
      `Subject: =?utf-8?B?${Buffer.from(mailSubject).toString('base64')}?=`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: 8bit`,
      ``,
      htmlTemplate
    ].join('\r\n');

    // Base64url encode the MIME message
    const base64UrlEmail = Buffer.from(rawEmail)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const googleRefreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const clientId = process.env.CLYDE_GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.CLYDE_GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET;

    let emailSent = false;

    if (googleRefreshToken && clientId && clientSecret) {
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

        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          const accessToken = tokenData.access_token;

          if (accessToken) {
            // 2. Send Email via Gmail API
            const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ raw: base64UrlEmail })
            });

            if (gmailRes.ok) {
              console.log(`📧 Ticket ${ticketId} successfully sent to skalamera@gmail.com via Gmail API.`);
              emailSent = true;
            } else {
              console.error('❌ Gmail API failed to send email:', await gmailRes.text());
            }
          }
        } else {
          console.error('❌ Failed to refresh Google Token:', await tokenRes.text());
        }
      } catch (err) {
        console.error('❌ Failed to send support email via Google API:', err);
      }
    }

    sendJson(res, 200, {
      success: true,
      message: emailSent
        ? `Ticket ${ticketId} submitted successfully! We have sent a copy of this ticket to our team.`
        : `Ticket ${ticketId} logged successfully! (Development fallback log recorded in server logs).`
    });
  } catch (error) {
    console.error('Error logging support ticket:', error);
    sendJson(res, 500, { error: 'Failed to process support request.' });
  }
}

