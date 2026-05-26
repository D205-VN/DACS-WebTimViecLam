const https = require('https');

function sendEmailResend({ from, to, subject, html }) {
  return new Promise((resolve, reject) => {
    const payload = {
      from: from || (process.env.EMAIL_FROM || process.env.SMTP_EMAIL),
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
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const json = JSON.parse(body);
            resolve(json);
          } catch (err) {
            resolve({ raw: body });
          }
        } else {
          const err = new Error(`Resend API error: ${res.statusCode} ${body}`);
          err.statusCode = res.statusCode;
          reject(err);
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(data);
    req.end();
  });
}

module.exports = { sendEmailResend };
