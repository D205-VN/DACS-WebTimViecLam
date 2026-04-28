const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

function isEmailConfigured() {
  return Boolean(process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD);
}

function formatInterviewDateTime(interviewAt) {
  const date = new Date(interviewAt);
  if (Number.isNaN(date.getTime())) return 'Thời gian phỏng vấn đã được cập nhật';

  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

async function sendInterviewReminderEmail(to, {
  candidateName = '',
  jobTitle = '',
  companyName = '',
  interviewAt = '',
  interviewMode = '',
  interviewLink = '',
  companyAddress = '',
} = {}) {
  if (!isEmailConfigured()) {
    throw new Error('SMTP_EMAIL hoặc SMTP_PASSWORD chưa được cấu hình');
  }

  const isOnline = interviewMode === 'online';
  const formattedTime = formatInterviewDateTime(interviewAt);
  const locationLabel = isOnline ? 'Link phỏng vấn online' : 'Địa điểm phỏng vấn';
  const locationValue = isOnline
    ? (interviewLink || 'Nhà tuyển dụng sẽ cập nhật link phỏng vấn trong hệ thống.')
    : (companyAddress || 'Vui lòng kiểm tra địa chỉ công ty trong trang việc đã ứng tuyển.');
  const safeCandidateName = escapeHtml(candidateName || 'bạn');
  const safeJobTitle = escapeHtml(jobTitle || 'ứng tuyển');
  const safeCompanyName = escapeHtml(companyName || '');
  const safeFormattedTime = escapeHtml(formattedTime);
  const safeLocationValue = escapeHtml(locationValue);
  const safeInterviewLink = escapeHtml(interviewLink || '');
  const subjectJobTitle = String(jobTitle || '').replace(/[\r\n]+/g, ' ').trim();

  const mailOptions = {
    from: `"AptertekWork.vn" <${process.env.SMTP_EMAIL}>`,
    to,
    subject: `[AptertekWork.vn] Nhắc lịch phỏng vấn ${subjectJobTitle ? `- ${subjectJobTitle}` : ''}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #1e3a5f, #0f2744); padding: 28px 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 800;">
            <span style="color: #ffffff;">Aptertek</span><span style="color: #34d399;">Work</span><span style="color: #93c5fd;">.vn</span>
          </h1>
          <p style="margin: 8px 0 0; color: #bfdbfe; font-size: 14px;">Nhắc lịch phỏng vấn</p>
        </div>

        <div style="padding: 30px 24px;">
          <h2 style="margin: 0 0 12px; font-size: 20px; color: #1f2937;">Bạn có lịch phỏng vấn vào ngày mai</h2>
          <p style="margin: 0 0 20px; color: #4b5563; font-size: 14px; line-height: 1.7;">
            Xin chào ${safeCandidateName}, đây là email nhắc lịch phỏng vấn cho vị trí <strong>${safeJobTitle}</strong>${companyName ? ` tại <strong>${safeCompanyName}</strong>` : ''}.
          </p>

          <div style="border: 1px solid #dbeafe; border-radius: 14px; background: #eff6ff; padding: 18px; margin-bottom: 18px;">
            <p style="margin: 0 0 8px; color: #1d4ed8; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;">Thời gian</p>
            <p style="margin: 0; color: #111827; font-size: 17px; font-weight: 700;">${safeFormattedTime}</p>
          </div>

          <div style="border: 1px solid #e5e7eb; border-radius: 14px; background: #f9fafb; padding: 18px;">
            <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;">${locationLabel}</p>
            ${
              isOnline && interviewLink
                ? `<a href="${safeInterviewLink}" style="color: #1d4ed8; font-size: 14px; font-weight: 700; word-break: break-word;">${safeInterviewLink}</a>`
                : `<p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6;">${safeLocationValue}</p>`
            }
          </div>

          <p style="margin: 20px 0 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
            Vui lòng chuẩn bị CV, thông tin cá nhân và tham gia đúng giờ. Bạn có thể xem lại chi tiết trong mục Việc đã ứng tuyển.
          </p>
        </div>

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

function formatJobAlertCriteria(alert = {}) {
  const parts = [];
  if (alert.keyword) parts.push(`Từ khóa: ${alert.keyword}`);
  if (alert.location) parts.push(`Vị trí: ${alert.location}`);
  if (alert.salary_range) parts.push(`Lương: ${alert.salary_range}`);
  if (alert.source_job_title) parts.push(`Tương tự: ${alert.source_job_title}`);
  return parts.join(' • ') || 'Việc làm phù hợp với hồ sơ của bạn';
}

function buildFrontendJobUrl(jobId) {
  const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
  return `${baseUrl}/seeker/jobs/${jobId}?source=job_alert`;
}

async function sendJobAlertDigestEmail(to, {
  candidateName = '',
  alert = {},
  jobs = [],
} = {}) {
  if (!isEmailConfigured()) {
    throw new Error('SMTP_EMAIL hoặc SMTP_PASSWORD chưa được cấu hình');
  }

  const safeCandidateName = escapeHtml(candidateName || 'bạn');
  const safeCriteria = escapeHtml(formatJobAlertCriteria(alert));
  const safeJobRows = jobs.slice(0, 8).map((job) => {
    const jobUrl = buildFrontendJobUrl(job.id);
    const reasons = Array.isArray(job.match_reasons) ? job.match_reasons.slice(0, 2).join(', ') : '';

    return `
      <tr>
        <td style="padding: 14px 0; border-bottom: 1px solid #e5e7eb;">
          <a href="${escapeHtml(jobUrl)}" style="font-size: 15px; font-weight: 700; color: #1d4ed8; text-decoration: none;">
            ${escapeHtml(job.title || 'Tin tuyển dụng')}
          </a>
          <p style="margin: 5px 0 0; color: #374151; font-size: 13px;">
            ${escapeHtml(job.company_name || 'Đang cập nhật')} • ${escapeHtml(job.location || 'Chưa rõ địa điểm')}
          </p>
          <p style="margin: 5px 0 0; color: #059669; font-size: 13px; font-weight: 700;">
            ${escapeHtml(job.salary || 'Thỏa thuận')}
          </p>
          ${reasons ? `<p style="margin: 5px 0 0; color: #6b7280; font-size: 12px;">${escapeHtml(reasons)}</p>` : ''}
        </td>
        <td style="padding: 14px 0; border-bottom: 1px solid #e5e7eb; text-align: right; vertical-align: top;">
          <span style="display: inline-block; background: #ecfdf5; color: #047857; border-radius: 999px; padding: 5px 9px; font-size: 12px; font-weight: 700;">
            ${Number(job.match_score || 0)}%
          </span>
        </td>
      </tr>
    `;
  }).join('');

  const mailOptions = {
    from: `"AptertekWork.vn" <${process.env.SMTP_EMAIL}>`,
    to,
    subject: `[AptertekWork.vn] Job alert tuần này: ${jobs.length} việc phù hợp`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #1e3a5f, #0f2744); padding: 28px 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 800;">
            <span style="color: #ffffff;">Aptertek</span><span style="color: #34d399;">Work</span><span style="color: #93c5fd;">.vn</span>
          </h1>
          <p style="margin: 8px 0 0; color: #bfdbfe; font-size: 14px;">Job alerts cá nhân hóa</p>
        </div>

        <div style="padding: 28px 24px;">
          <h2 style="margin: 0 0 10px; font-size: 20px; color: #1f2937;">Việc phù hợp mới cho ${safeCandidateName}</h2>
          <p style="margin: 0 0 18px; color: #4b5563; font-size: 14px; line-height: 1.7;">
            Chúng tôi tìm thấy các tin phù hợp với alert của bạn: <strong>${safeCriteria}</strong>.
          </p>

          <table style="width: 100%; border-collapse: collapse;">
            <tbody>${safeJobRows}</tbody>
          </table>

          <p style="margin: 20px 0 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
            Điểm phù hợp được tính từ tiêu chí alert, CV chính và lịch sử ứng tuyển của bạn.
          </p>
        </div>

        <div style="background: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #9ca3af; font-size: 11px;">
            © 2026 AptertekWork.vn — Email được gửi tự động, vui lòng không trả lời.
          </p>
        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}

module.exports = {
  isEmailConfigured,
  sendOTPEmail,
  sendPasswordResetOTPEmail,
  sendInterviewReminderEmail,
  sendJobAlertDigestEmail,
};
