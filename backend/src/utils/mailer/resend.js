const https = require('https');

function sendEmailResend({ from, to, subject, html }) {
  return new Promise((resolve, reject) => {
    let resolvedFrom = from || process.env.EMAIL_FROM || process.env.SMTP_EMAIL || 'onboarding@resend.dev';

    // If EMAIL_FROM is defined and different from the resolvedFrom's email,
    // let's ensure we use EMAIL_FROM for the sending address if resolvedFrom contains a gmail or unverified address
    if (process.env.EMAIL_FROM) {
      const emailRegex = /<([^>]+)>/;
      const match = resolvedFrom.match(emailRegex);
      if (match) {
        const email = match[1].trim();
        // If the email is Gmail (which can never be verified on Resend) or matches SMTP_EMAIL, replace it
        if (email.endsWith('@gmail.com') || email === process.env.SMTP_EMAIL) {
          resolvedFrom = resolvedFrom.replace(emailRegex, `<${process.env.EMAIL_FROM}>`);
        }
      } else {
        const email = resolvedFrom.trim();
        if (email.endsWith('@gmail.com') || email === process.env.SMTP_EMAIL) {
          resolvedFrom = process.env.EMAIL_FROM;
        }
      }
    }

    const payload = {
      from: resolvedFrom,
      to: Array.isArray(to) ? to : [to],
      subject: subject || '',
      html: html || '',
    };

    const data = JSON.stringify(payload);

    const options = {
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch (e) { /* ignore parse errors */ }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed || { raw: body });
          return;
        }

        // Friendly handling for unverified sending domain (common when using gmail.com)
        if (res.statusCode === 403 && parsed && parsed.message && /domain is not verified/i.test(parsed.message)) {
          const friendly = new Error(
            `Resend domain verification error: ${parsed.message}. ` +
            'Please add and verify your sending domain at https://resend.com/domains and set EMAIL_FROM to the verified address. ' +
            'Also move RESEND_API_KEY into your production secrets (Render environment variables) and remove it from the repository.'
          );
          friendly.code = 'RESEND_DOMAIN_NOT_VERIFIED';
          friendly.statusCode = res.statusCode;
          friendly.response = parsed;
          reject(friendly);
          return;
        }

        const err = new Error(`Resend API error: ${res.statusCode} ${body}`);
        err.statusCode = res.statusCode;
        err.response = parsed || body;
        reject(err);
      });
    });

    req.on('error', (err) => reject(err));
    req.write(data);
    req.end();
  });
}

module.exports = { sendEmailResend };
