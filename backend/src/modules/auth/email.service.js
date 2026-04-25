const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

/**
 * Gửi email chứa mã OTP xác thực
 * @param {string} to - Email người nhận
 * @param {string} otp - Mã OTP 6 số
 */
async function sendOTPEmail(to, otp) {
  const mailOptions = {
    from: `"AptertekWork.vn" <${process.env.SMTP_EMAIL}>`,
    to,
    subject: `[AptertekWork.vn] Mã xác thực tài khoản: ${otp}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e3a5f, #0f2744); padding: 32px 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 800;">
            <span style="color: #ffffff;">Aptertek</span><span style="color: #34d399;">Work</span><span style="color: #93c5fd;">.vn</span>
          </h1>
          <p style="margin: 8px 0 0; color: #93c5fd; font-size: 14px;">Nền tảng tuyển dụng hàng đầu Việt Nam</p>
        </div>

        <!-- Body -->
        <div style="padding: 32px 24px;">
          <h2 style="margin: 0 0 8px; font-size: 20px; color: #1f2937;">Xác thực tài khoản</h2>
          <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
            Cảm ơn bạn đã đăng ký tài khoản tại AptertekWork.vn. Vui lòng sử dụng mã OTP bên dưới để xác thực email của bạn:
          </p>

          <!-- OTP Code -->
          <div style="text-align: center; margin: 24px 0;">
            <div style="display: inline-block; background: linear-gradient(135deg, #f0f9ff, #e0f2fe); border: 2px dashed #3b82f6; border-radius: 12px; padding: 16px 32px;">
              <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1e40af;">${otp}</span>
            </div>
          </div>

          <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; text-align: center;">
            ⏱️ Mã có hiệu lực trong <strong>5 phút</strong>
          </p>
          <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
            Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.
          </p>
        </div>

        <!-- Footer -->
        <div style="background: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #9ca3af; font-size: 11px;">
            © 2025 AptertekWork.vn — Email được gửi tự động, vui lòng không trả lời.
          </p>
        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}

/**
 * Gửi email chứa mã OTP để đặt lại mật khẩu
 * @param {string} to - Email người nhận
 * @param {string} otp - Mã OTP 6 số
 */
async function sendPasswordResetOTPEmail(to, otp) {
  const mailOptions = {
    from: `"AptertekWork.vn" <${process.env.SMTP_EMAIL}>`,
    to,
    subject: `[AptertekWork.vn] Mã xác thực đặt lại mật khẩu: ${otp}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e3a5f, #0f2744); padding: 32px 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 800;">
            <span style="color: #ffffff;">Aptertek</span><span style="color: #34d399;">Work</span><span style="color: #93c5fd;">.vn</span>
          </h1>
          <p style="margin: 8px 0 0; color: #93c5fd; font-size: 14px;">Nền tảng tuyển dụng hàng đầu Việt Nam</p>
        </div>

        <!-- Body -->
        <div style="padding: 32px 24px;">
          <h2 style="margin: 0 0 8px; font-size: 20px; color: #1f2937;">Đặt lại mật khẩu</h2>
          <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px; line-height: 1.6;">
            Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Vui lòng sử dụng mã OTP bên dưới:
          </p>

          <!-- OTP Code -->
          <div style="text-align: center; margin: 24px 0;">
            <div style="display: inline-block; background: linear-gradient(135deg, #fff7ed, #ffedd5); border: 2px dashed #f97316; border-radius: 12px; padding: 16px 32px;">
              <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #c2410c;">${otp}</span>
            </div>
          </div>

          <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; text-align: center;">
            ⏱️ Mã có hiệu lực trong <strong>5 phút</strong>
          </p>
          <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
            Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
          </p>
        </div>

        <!-- Footer -->
        <div style="background: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #9ca3af; font-size: 11px;">
            © 2025 AptertekWork.vn — Email được gửi tự động, vui lòng không trả lời.
          </p>
        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}

module.exports = { sendOTPEmail, sendPasswordResetOTPEmail };
