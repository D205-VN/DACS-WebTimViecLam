const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pool = require('../../infrastructure/database/postgres');
const { ensureCvSchema, ensurePrimaryCvForUser } = require('../../models/cv/cv.model');
const { resolveCurrentLocationPayload } = require('../../core/utils/currentLocation');
const { generateTextWithLmStudio } = require('../../infrastructure/ai/lmstudio.service');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function getProviderName(value = '') {
  return String(value || '').trim().toLowerCase();
}

function isLmStudioProvider(provider = '') {
  return ['lmstudio', 'lm-studio', 'local', 'local-ai'].includes(getProviderName(provider));
}

function isOpenAiCompatibleCvProvider(provider = '') {
  return [
    'aptcv',
    'openai-compatible',
    'openai-compatible-local',
    'lmstudio',
    'lm-studio',
    'local',
    'local-ai',
  ].includes(getProviderName(provider));
}

function isCustomCvGenerationProvider(provider = '') {
  return ['custom', 'custom-api', 'kaggle'].includes(getProviderName(provider));
}

function getCvGenerationProvider() {
  return getProviderName(process.env.CV_GENERATION_PROVIDER || '');
}

function getCvReviewProvider() {
  return getProviderName(process.env.CV_REVIEW_PROVIDER || process.env.AI_PROVIDER || '');
}

function getCvGenerationLmStudioOptions() {
  return {
    baseUrl: process.env.CV_GENERATION_BASE_URL,
    model: process.env.CV_GENERATION_MODEL,
    timeoutMs: process.env.CV_GENERATION_TIMEOUT_MS,
    maxTokens: process.env.CV_GENERATION_MAX_TOKENS,
    temperature: process.env.CV_GENERATION_TEMPERATURE,
  };
}

function getCvReviewLmStudioOptions() {
  return {
    baseUrl: process.env.CV_REVIEW_BASE_URL,
    model: process.env.CV_REVIEW_MODEL,
    timeoutMs: process.env.CV_REVIEW_TIMEOUT_MS,
    maxTokens: process.env.CV_REVIEW_MAX_TOKENS,
    temperature: process.env.CV_REVIEW_TEMPERATURE,
  };
}

function detectImageMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'image/jpeg';
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) return 'image/png';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function getCvLanguage(value) {
  const normalized = String(value || process.env.CV_OUTPUT_LANGUAGE || 'en').trim().toLowerCase();
  return ['en', 'english', 'tiếng anh', 'tieng anh'].includes(normalized) ? 'en' : 'vi';
}

function getCvCopy(language = 'vi') {
  if (getCvLanguage(language) === 'en') {
    return {
      badge: 'Application Profile',
      nameFallback: 'Candidate Name',
      portraitAlt: 'Portrait',
      headerFallback: 'Update contact information and target position',
      areaPrefix: 'Location',
      emailPrefix: 'Email',
      phonePrefix: 'Phone',
      objectiveTitle: 'Career Objective',
      experienceTitle: 'Work Experience',
      educationTitle: 'Education',
      skillsTitle: 'Skills',
      certificationsTitle: 'Certifications',
      hobbiesTitle: 'Interests',
      objectiveFallback: (role) => role
        ? `Seeking a ${role} position where I can keep improving my skills, contribute practical value, and grow with a professional team.`
        : 'Seeking an opportunity in a professional environment where I can continue learning, contribute practical value, and build a long-term career.',
      educationFallback: 'Add your education background, major, academic timeline, and relevant achievements.',
      experienceFallback: 'Add your work experience, projects, responsibilities, tools, and measurable outcomes.',
      skillsFallback: 'Add technical skills, tools, domain knowledge, and soft skills related to the target role.',
      certificationsFallback: 'Not updated',
      hobbiesFallback: 'Not updated',
    };
  }

  return {
    badge: 'Hồ sơ ứng tuyển',
    nameFallback: 'Tên Ứng Viên',
    portraitAlt: 'Ảnh chân dung',
    headerFallback: 'Cập nhật thông tin liên hệ và vị trí ứng tuyển',
    areaPrefix: 'Khu vực',
    emailPrefix: 'Email',
    phonePrefix: 'SĐT',
    objectiveTitle: 'Mục Tiêu Nghề Nghiệp',
    experienceTitle: 'Kinh Nghiệm Làm Việc',
    educationTitle: 'Học Vấn',
    skillsTitle: 'Kỹ Năng',
    certificationsTitle: 'Chứng Chỉ',
    hobbiesTitle: 'Sở Thích',
    objectiveFallback: (role) => role
      ? `Ứng tuyển vị trí ${role} với định hướng phát triển lâu dài, chủ động học hỏi và tạo giá trị thực tế cho doanh nghiệp.`
      : 'Mong muốn phát triển sự nghiệp trong môi trường chuyên nghiệp, chủ động học hỏi và đóng góp giá trị lâu dài.',
    educationFallback: 'Bổ sung thông tin học vấn nổi bật, chuyên ngành và thành tích học tập tiêu biểu.',
    experienceFallback: 'Bổ sung kinh nghiệm làm việc, dự án, vai trò và kết quả nổi bật.',
    skillsFallback: 'Bổ sung các kỹ năng chuyên môn, công cụ và năng lực mềm liên quan tới vị trí ứng tuyển.',
    certificationsFallback: 'Chưa cập nhật',
    hobbiesFallback: 'Chưa cập nhật',
  };
}

function mergePortraitIntoHtml(html, portraitDataUrl, fullName) {
  if (!portraitDataUrl || !html) return html;

  if (html.includes('__PORTRAIT__')) {
    return html.replace(/__PORTRAIT__/g, portraitDataUrl);
  }

  const portraitBlock = `
    <div style="display: flex; justify-content: center; margin-bottom: 18px;">
      <img src="${portraitDataUrl}" alt="${fullName || 'Ảnh chân dung'}" style="width: 108px; height: 108px; object-fit: cover; border-radius: 18px; border: 3px solid #dbe7f3;" />
    </div>
  `;

  return `${portraitBlock}${html}`;
}

function cleanModelHtml(text = '') {
  const cleaned = cleanModelText(text);

  const htmlMatch = cleaned.match(/<(?:!doctype|html|body|main|section|article|div)[\s\S]*>/i);
  return (htmlMatch ? htmlMatch[0] : cleaned).trim();
}

function cleanModelText(text = '') {
  return String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```html\n?/gi, '')
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();
}

function formatSafeHtmlText(value) {
  return String(value || '')
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br/>');
}

function splitCvLines(value = '') {
  return String(value || '')
    .replace(/\r/g, '')
    .split(/\n+/)
    .map((line) => line.replace(/^\s*[-•*]\s*/, '').trim())
    .filter(Boolean);
}

function renderCvParagraph(value = '') {
  const lines = splitCvLines(value);
  const text = lines.length ? lines.join('\n') : String(value || '').trim();
  return `<p style="margin: 0; color: #111111; font-size: 13px; line-height: 1.6;">${formatSafeHtmlText(text)}</p>`;
}

function renderCvBullets(value = '') {
  const lines = splitCvLines(value);
  if (!lines.length) return '';

  return `
    <ul style="margin: 0; padding-left: 18px; color: #111111; font-size: 13px; line-height: 1.55;">
      ${lines.map((line) => `<li style="margin: 0 0 7px 0;">${formatSafeHtmlText(line)}</li>`).join('')}
    </ul>
  `;
}

function renderCvTags(value = '') {
  const tags = String(value || '')
    .split(/[,;\n]+/)
    .map((item) => item.replace(/^\s*[-•*]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 28);

  return renderCvParagraph(tags.length ? tags.join(', ') : value);
}

function renderCvSection(title, bodyHtml) {
  return `
    <section style="margin: 0 0 22px 0;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
        <div style="height: 1px; width: 22px; border-top: 1px solid #111111;"></div>
        <h2 style="margin: 0; color: #111111; font-size: 14px; line-height: 1.2; font-weight: 800; text-transform: uppercase; letter-spacing: 0;">${formatSafeHtmlText(title)}</h2>
      </div>
      ${bodyHtml}
    </section>
  `;
}

function renderClassicSection(title, bodyHtml) {
  return `
    <section style="margin: 0 0 24px 0;">
      <h2 style="font-family: Georgia, 'Times New Roman', serif; margin: 0 0 10px 0; padding-bottom: 4px; border-bottom: 1.4px solid #111111; color: #111111; font-size: 24px; line-height: 1.1; font-weight: 700;">
        ${formatSafeHtmlText(title)}
      </h2>
      ${bodyHtml}
    </section>
  `;
}

function renderClassicBullets(value = '') {
  const lines = splitCvLines(value);
  if (!lines.length) return '';

  return `
    <ul style="margin: 7px 0 0 0; padding-left: 18px; color: #111111; font-size: 14px; line-height: 1.36; list-style-position: outside;">
      ${lines.map((line) => `<li style="margin: 0 0 5px 0; padding-left: 2px;">${formatSafeHtmlText(line)}</li>`).join('')}
    </ul>
  `;
}

function renderClassicInfoLine(label, value) {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) return '';

  return `
    <p style="margin: 0 0 5px 0; color: #111111; font-size: 14px; line-height: 1.3;">
      <strong>${formatSafeHtmlText(label)}:</strong> ${formatSafeHtmlText(normalizedValue)}
    </p>
  `;
}

function renderClassicEntry({
  title = '',
  subtitle = '',
  rightTop = '',
  rightBottom = '',
  body = '',
  fallbackTitle = 'Work Title',
} = {}) {
  const normalizedTitle = title || fallbackTitle;

  return `
    <div style="margin: 0 0 20px 0;">
      <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 16px;">
        <p style="flex: 1; min-width: 0; margin: 0; color: #111111; font-size: 15px; line-height: 1.25; font-weight: 700; overflow-wrap: anywhere;">
          ${formatSafeHtmlText(normalizedTitle)}
        </p>
        ${rightTop ? `<p style="flex-shrink: 0; margin: 0; color: #111111; font-size: 14px; line-height: 1.25; text-align: right; white-space: nowrap;">${formatSafeHtmlText(rightTop)}</p>` : ''}
      </div>
      ${(subtitle || rightBottom) ? `
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-top: 1px;">
          <p style="flex: 1; min-width: 0; margin: 0; color: #111111; font-size: 14px; line-height: 1.25; font-style: italic; overflow-wrap: anywhere;">
            ${formatSafeHtmlText(subtitle)}
          </p>
          ${rightBottom ? `<p style="flex-shrink: 0; margin: 0; color: #111111; font-size: 14px; line-height: 1.25; text-align: right; white-space: nowrap;">${formatSafeHtmlText(rightBottom)}</p>` : ''}
        </div>
      ` : ''}
      ${body || ''}
    </div>
  `;
}

function normalizeCvTemplateText(value = '') {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeCvTemplateText(item)).filter(Boolean).join('\n');
  }

  if (value && typeof value === 'object') {
    return Object.values(value).map((item) => normalizeCvTemplateText(item)).filter(Boolean).join('\n');
  }

  return String(value || '').trim();
}

function normalizeInlineCvList(value = '') {
  return splitCvLines(normalizeCvTemplateText(value))
    .flatMap((line) => line.split(/[,;]+/))
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, items) => items.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index)
    .join(', ');
}

function parseEducationDetails(value = '') {
  const lines = splitCvLines(value)
    .filter((line) => !/^\[(?:add school name|degree\/major|add dates|điền tên trường|bằng cấp\/chuyên ngành|điền thời gian)\]$/i.test(line));
  const firstLine = lines[0] || '';
  const yearMatch = firstLine.match(/^((?:19|20)\d{2})\s*(?:-|–|—|to|đến)\s*((?:19|20)\d{2}|present|hiện tại|nay)\s*:?\s*(.+)$/i);

  if (yearMatch) {
    return {
      years: `${yearMatch[1]} - ${yearMatch[2]}`,
      school: yearMatch[3].trim(),
      details: lines.slice(1).join('\n'),
    };
  }

  const splitYearMatch = firstLine.match(/^((?:19|20)\d{2})$/);
  const secondLineMatch = (lines[1] || '').match(/^((?:19|20)\d{2}|present|hiện tại|nay)\s*:?\s*(.+)$/i);
  if (splitYearMatch && secondLineMatch) {
    const acronymLine = lines[2] && /^[A-Z0-9 .&-]{2,24}$/.test(lines[2]) ? lines[2] : '';
    const school = [secondLineMatch[2].trim(), acronymLine].filter(Boolean).join(' - ');
    return {
      years: `${splitYearMatch[1]} - ${secondLineMatch[1]}`,
      school,
      details: lines.slice(acronymLine ? 3 : 2).join('\n'),
    };
  }

  return {
    years: '',
    school: '',
    details: lines.join('\n'),
  };
}

function buildLocalCvHtml({
  fullName = '',
  email = '',
  phone = '',
  githubUrl = '',
  role = '',
  objective = '',
  education = '',
  experience = '',
  skills = '',
  certifications = '',
  hobbies = '',
  portraitDataUrl = '',
  currentLocation = '',
  cvLanguage = '',
} = {}) {
  const copy = getCvCopy(cvLanguage);
  const language = getCvLanguage(cvLanguage);
  const safeFullName = normalizeCvTemplateText(fullName || copy.nameFallback);
  const safeEmail = normalizeCvTemplateText(email);
  const safePhone = normalizeCvTemplateText(phone);
  const safeGithubUrl = normalizeCvTemplateText(githubUrl);
  const safeRole = normalizeCvTemplateText(role);
  const safeLocation = normalizeCvTemplateText(currentLocation);
  const resolvedObjective =
    normalizeCvTemplateText(objective) ||
    copy.objectiveFallback(role);
  const resolvedEducation = normalizeCvTemplateText(education) || copy.educationFallback;
  const resolvedExperience = normalizeCvTemplateText(experience) || copy.experienceFallback;
  const resolvedSkills = normalizeInlineCvList(skills) || copy.skillsFallback;
  const resolvedCertifications = normalizeInlineCvList(certifications) || copy.certificationsFallback;
  const resolvedHobbies = normalizeInlineCvList(hobbies) || copy.hobbiesFallback;
  const headerMeta = [
    safeEmail || 'Email Address',
    safeGithubUrl || 'LinkedIn Url / Portfolio / GitHub Url',
    safePhone,
    safeLocation,
  ]
    .filter(Boolean)
    .join(' • ');
  const workSubtitle = language === 'en' ? 'Professional experience and relevant projects' : 'Kinh nghiệm và dự án liên quan';
  const educationTitle = language === 'en' ? '[add school name]' : '[điền tên trường]';
  const educationSubtitle = language === 'en' ? '[degree/major]' : '[bằng cấp/chuyên ngành]';
  const datePlaceholder = language === 'en' ? '[add dates]' : '[điền thời gian]';
  const sectionTitles = language === 'en'
    ? {
      experience: 'Work Experience',
      education: 'Education',
      honors: 'Honors and Awards',
      additional: 'Additional Information',
      skills: 'Technologies',
      certifications: 'Certifications',
      interests: 'Interests',
      location: 'Location',
    }
    : {
      experience: 'Kinh Nghiệm Làm Việc',
      education: 'Học Vấn',
      honors: 'Chứng Chỉ Và Giải Thưởng',
      additional: 'Thông Tin Bổ Sung',
      skills: 'Kỹ Năng',
      certifications: 'Chứng Chỉ',
      interests: 'Sở Thích',
      location: 'Khu Vực',
    };
  const educationDetails = parseEducationDetails(resolvedEducation);
  const educationHeading = educationDetails.school || educationTitle;
  const shouldShowHonors = resolvedCertifications
    && !/^(not updated|none|không có|chưa cập nhật)$/i.test(resolvedCertifications);

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; width: 794px; max-width: 100%; min-height: 1122px; margin: 0 auto; padding: 34px 48px 42px 48px; box-sizing: border-box; color: #111111; background: #ffffff; line-height: 1.35; overflow-wrap: break-word;">
      <header style="text-align: center; margin: 0 0 28px 0;">
        <h1 style="font-family: Georgia, 'Times New Roman', serif; margin: 0; color: #111111; font-size: 32px; line-height: 1.05; font-weight: 700; text-transform: uppercase; letter-spacing: 0;">
          ${formatSafeHtmlText(safeFullName)}
        </h1>
        <p style="margin: 7px 0 0 0; color: #111111; font-size: 14px; line-height: 1.25;">
          ${formatSafeHtmlText(headerMeta)}
        </p>
      </header>

      ${renderClassicSection(sectionTitles.experience, `
        ${renderClassicEntry({
          title: safeRole || 'Work Title',
          subtitle: workSubtitle,
          rightTop: safeLocation || 'City, Country',
          rightBottom: datePlaceholder,
          body: renderClassicBullets(resolvedExperience),
          fallbackTitle: 'Work Title',
        })}
      `)}

      ${renderClassicSection(sectionTitles.education, `
        ${renderClassicEntry({
          title: educationHeading,
          subtitle: educationDetails.school ? '' : educationSubtitle,
          rightTop: safeLocation || 'City, Country',
          rightBottom: educationDetails.years || datePlaceholder,
          body: renderClassicBullets(educationDetails.details) || (!educationDetails.school ? `<p style="margin: 7px 0 0 0; color: #111111; font-size: 14px; line-height: 1.34;">${formatSafeHtmlText(copy.educationFallback)}</p>` : ''),
          fallbackTitle: educationTitle,
        })}
      `)}

      ${shouldShowHonors ? renderClassicSection(sectionTitles.honors, `
        ${renderClassicEntry({
          title: resolvedCertifications,
          subtitle: language === 'en' ? 'Certification / award' : 'Chứng chỉ / giải thưởng',
          rightTop: '',
          rightBottom: '',
          body: '',
          fallbackTitle: sectionTitles.honors,
        })}
      `) : ''}

      ${renderClassicSection(sectionTitles.additional, `
        ${renderClassicInfoLine(language === 'en' ? 'Summary' : 'Tóm Tắt', resolvedObjective)}
        ${renderClassicInfoLine(language === 'en' ? 'Target Role' : 'Vị Trí Ứng Tuyển', safeRole)}
        ${renderClassicInfoLine(sectionTitles.skills, resolvedSkills)}
        ${!shouldShowHonors ? renderClassicInfoLine(sectionTitles.certifications, resolvedCertifications) : ''}
        ${renderClassicInfoLine(sectionTitles.interests, resolvedHobbies)}
        ${safeLocation ? renderClassicInfoLine(sectionTitles.location, safeLocation) : ''}
      `)}
    </div>
  `.trim();
}

function buildGeneratePrompt({
  fullName = '',
  email = '',
  phone = '',
  githubUrl = '',
  role = '',
  objective = '',
  education = '',
  experience = '',
  skills = '',
  certifications = '',
  hobbies = '',
  portraitDataUrl = '',
  currentLocation = '',
  cvLanguage = '',
} = {}) {
  if (getCvLanguage(cvLanguage) === 'en') {
    return `You are a professional CV writer. Create a complete CV in English as clean HTML with inline CSS only. Do not use classes or external CSS.

Candidate information:
- Full name: ${fullName || 'Not provided'}
- Email: ${email || 'Not provided'}
- Phone: ${phone || 'Not provided'}
- GitHub: ${githubUrl || 'Not provided'}
- Target role: ${role || 'Not provided'}
- Current location: ${currentLocation || 'Not provided'}
- Portrait: ${portraitDataUrl ? 'Provided. In the HTML, display it near the header using img src="__PORTRAIT__".' : 'Not provided'}
- Career objective: ${objective || 'Not provided'}
- Education: ${education || 'Not provided'}
- Work experience: ${experience || 'Not provided'}
- Skills: ${skills || 'Not provided'}
- Certifications: ${certifications || 'None'}
- Interests: ${hobbies || 'None'}

Formatting requirements:
1. Use pure HTML with inline CSS because it will be rendered directly and exported to PDF.
2. Design a modern, professional CV that reads well on A4.
3. Header must clearly show full name, target role, and contact details.
4. Main sections: Career Objective, Work Experience, Education, Skills, Certifications, Interests.
5. Use a strict black-and-white ATS style. Do not use colored highlights, badges, chips, shaded spans, or accent blocks.
6. Translate Vietnamese descriptive content to English, but keep proper nouns such as school names, company names, locations, and certificates in their original wording.
7. If information is missing, write short natural placeholders using [add real information].
8. If a portrait exists, place it in the header with a clean professional size.
9. Do not insert placeholder images from external sources.
10. Return only HTML. Do not add markdown or explanations.`;
  }

  return `Bạn là chuyên gia viết CV chuyên nghiệp tại Việt Nam. Hãy tạo một CV hoàn chỉnh bằng tiếng Việt dưới dạng HTML đẹp mắt với inline CSS (không dùng class, không dùng external CSS).

Thông tin ứng viên:
- Họ tên: ${fullName || 'Chưa cung cấp'}
- Email: ${email || 'Chưa cung cấp'}
- Điện thoại: ${phone || 'Chưa cung cấp'}
- GitHub: ${githubUrl || 'Chưa cung cấp'}
- Vị trí ứng tuyển: ${role || 'Chưa cung cấp'}
- Vị trí hiện tại: ${currentLocation || 'Chưa cung cấp'}
- Ảnh chân dung: ${portraitDataUrl ? 'Đã cung cấp. Trong HTML hãy hiển thị ảnh ở phần đầu CV bằng thẻ img với src="__PORTRAIT__".' : 'Chưa cung cấp'}
- Mục tiêu nghề nghiệp: ${objective || 'Chưa cung cấp'}
- Học vấn: ${education || 'Chưa cung cấp'}
- Kinh nghiệm làm việc: ${experience || 'Chưa cung cấp'}
- Kỹ năng: ${skills || 'Chưa cung cấp'}
- Chứng chỉ: ${certifications || 'Không có'}
- Sở thích: ${hobbies || 'Không có'}

Yêu cầu format CV:
1. Dùng HTML thuần với inline CSS vì sẽ render trực tiếp và xuất PDF.
2. Thiết kế hiện đại, chuyên nghiệp, đọc tốt trên khổ A4, có thể 1 cột hoặc 2 cột nếu hợp lý.
3. Header phải có họ tên nổi bật, vị trí ứng tuyển và thông tin liên hệ rõ ràng.
4. Các section chính: Mục tiêu, Kinh nghiệm, Học vấn, Kỹ năng, Chứng chỉ, Sở thích.
5. Dùng phong cách ATS đen trắng. Không dùng highlight màu, badge, chip, span tô nền hoặc khối màu nhấn.
6. Nếu thông tin nào còn thiếu thì viết gợi ý mẫu ngắn, tự nhiên và phù hợp vị trí ứng tuyển.
7. Nếu có ảnh chân dung thì đặt ảnh ở header, kích thước gọn, chuyên nghiệp.
8. TUYỆT ĐỐI KHÔNG chèn bất kỳ ảnh placeholder nào từ các nguồn bên ngoài (như via.placeholder.com).
9. Chỉ trả về HTML, không thêm markdown hay giải thích.`;
}

function buildLmStudioCvContentPrompt({
  fullName = '',
  email = '',
  phone = '',
  githubUrl = '',
  role = '',
  objective = '',
  education = '',
  experience = '',
  skills = '',
  certifications = '',
  hobbies = '',
  currentLocation = '',
  cvLanguage = '',
} = {}) {
  if (getCvLanguage(cvLanguage) === 'en') {
    return `You are a professional CV writer. Rewrite the candidate's CV content in polished, concise English while staying truthful.

Candidate information:
- Full name: ${fullName || 'Not provided'}
- Email: ${email || 'Not provided'}
- Phone: ${phone || 'Not provided'}
- GitHub: ${githubUrl || 'Not provided'}
- Target role: ${role || 'Not provided'}
- Location: ${currentLocation || 'Not provided'}
- Existing objective: ${objective || 'Not provided'}
- Existing education: ${education || 'Not provided'}
- Existing experience: ${experience || 'Not provided'}
- Existing skills: ${skills || 'Not provided'}
- Existing certifications: ${certifications || 'None'}
- Existing interests: ${hobbies || 'None'}

Requirements:
1. Return ONLY valid JSON. Do not return markdown, HTML, or explanations.
2. Do not invent company names, school names, certificates, dates, or specific metrics.
3. Translate Vietnamese descriptive content to English, but keep proper nouns such as school names, company names, locations, and certificates in their original wording.
4. If information is missing, use placeholders like [add real information].
5. Write natural English suitable for the target role.
6. Schema:
{
  "objective": "2-3 sentence career objective",
  "experience": "- bullet points for experience/projects",
  "education": "education details or placeholders to complete",
  "skills": "comma-separated skills",
  "certifications": "certifications or Not updated",
  "hobbies": "interests or Not updated"
}`;
  }

  return `Bạn là chuyên gia viết CV tiếng Việt. Hãy viết lại nội dung CV cho chuyên nghiệp, ngắn gọn và đúng sự thật.

Thông tin ứng viên:
- Họ tên: ${fullName || 'Chưa cung cấp'}
- Email: ${email || 'Chưa cung cấp'}
- Điện thoại: ${phone || 'Chưa cung cấp'}
- GitHub: ${githubUrl || 'Chưa cung cấp'}
- Vị trí ứng tuyển: ${role || 'Chưa cung cấp'}
- Khu vực: ${currentLocation || 'Chưa cung cấp'}
- Mục tiêu hiện có: ${objective || 'Chưa cung cấp'}
- Học vấn hiện có: ${education || 'Chưa cung cấp'}
- Kinh nghiệm hiện có: ${experience || 'Chưa cung cấp'}
- Kỹ năng hiện có: ${skills || 'Chưa cung cấp'}
- Chứng chỉ hiện có: ${certifications || 'Không có'}
- Sở thích hiện có: ${hobbies || 'Không có'}

Yêu cầu:
1. Trả về CHỈ một JSON hợp lệ, không markdown, không HTML, không giải thích.
2. Không bịa tên công ty, trường học, chứng chỉ hoặc số liệu cụ thể.
3. Nếu thiếu thông tin, viết khung gợi ý có dạng [điền thông tin thật].
4. Nội dung dùng tiếng Việt, tự nhiên, phù hợp vị trí ứng tuyển.
5. Schema:
{
  "objective": "2-3 câu mục tiêu nghề nghiệp",
  "experience": "- gạch đầu dòng kinh nghiệm/dự án",
  "education": "thông tin học vấn hoặc khung cần bổ sung",
  "skills": "danh sách kỹ năng, phân tách bằng dấu phẩy",
  "certifications": "chứng chỉ hoặc Chưa cập nhật",
  "hobbies": "sở thích hoặc Chưa cập nhật"
}`;
}

function buildImportHtmlPrompt({
  fullName = '',
  email = '',
  phone = '',
  role = '',
  objective = '',
  education = '',
  experience = '',
  skills = '',
  certifications = '',
  hobbies = '',
  rawText = '',
  layoutStyle = '',
  primaryColor = '',
  sectionOrder = '',
} = {}) {
  return `Bạn đang tái dựng một CV từ ảnh scan. Hãy đọc cả nội dung và bố cục trong ảnh để tạo lại một CV HTML gần giống CV gốc về tinh thần thiết kế, thứ tự nội dung và điểm nhấn thị giác, nhưng phải sạch sẽ, cân chỉnh chuẩn và dễ in PDF.

Thông tin ứng viên trích xuất từ ảnh:
- Họ tên: ${fullName || 'Chưa cung cấp'}
- Email: ${email || 'Chưa cung cấp'}
- Điện thoại: ${phone || 'Chưa cung cấp'}
- Vị trí ứng tuyển: ${role || 'Chưa cung cấp'}
- Mục tiêu nghề nghiệp: ${objective || 'Chưa cung cấp'}
- Học vấn: ${education || 'Chưa cung cấp'}
- Kinh nghiệm làm việc: ${experience || 'Chưa cung cấp'}
- Kỹ năng: ${skills || 'Chưa cung cấp'}
- Chứng chỉ: ${certifications || 'Không có'}
- Sở thích: ${hobbies || 'Không có'}

Gợi ý bố cục đã nhận diện:
- Phong cách bố cục: ${layoutStyle || 'Không xác định rõ'}
- Màu nhấn chính: bỏ qua, CV đầu ra dùng đen trắng
- Thứ tự section nổi bật: ${sectionOrder || 'Tên, liên hệ, mục tiêu, kinh nghiệm, học vấn, kỹ năng'}

Text thô tham khảo thêm:
${rawText || '(không có)'}

Yêu cầu dựng HTML:
1. Chỉ dùng HTML thuần với inline CSS, không dùng class và không dùng external CSS.
2. Cố gắng giữ tinh thần bố cục của CV trong ảnh: nếu ảnh thiên về 2 cột thì có thể dựng 2 cột; nếu ảnh 1 cột thì giữ 1 cột.
3. Tối ưu để hiển thị đẹp trên khổ A4, khoảng rộng tối đa 800px.
4. Làm sạch lỗi OCR, viết lại câu chữ cho mượt nhưng không tự bịa quá xa dữ liệu gốc.
5. Header phải rõ họ tên, vị trí ứng tuyển, thông tin liên hệ.
6. TUYỆT ĐỐI KHÔNG chèn bất kỳ ảnh placeholder nào từ các nguồn bên ngoài (như via.placeholder.com hay ui-avatars) vào mã HTML. Bỏ qua hoàn toàn việc hiển thị ảnh chân dung nếu có trong ảnh gốc.
7. Chỉ trả về HTML hoàn chỉnh, không markdown, không giải thích.`;
}

function stripHtmlContent(value = '') {
  return String(value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|section|article|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractJsonObject(text = '') {
  const cleaned = cleanModelText(text);
  const match = cleaned.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : cleaned);
}

function addLmStudioModelHints(prompt = '', model = '') {
  const modelId = String(model || process.env.LMSTUDIO_MODEL || '').toLowerCase();
  return modelId.includes('qwen3') ? `${prompt}\n/no_think` : prompt;
}

function normalizeCvContentField(value, fallback = '', maxLength = 2500) {
  const normalizedValue = Array.isArray(value)
    ? value.map((item) => (typeof item === 'object' && item !== null ? Object.values(item).join(' ') : item)).join('\n')
    : (typeof value === 'object' && value !== null ? Object.values(value).join('\n') : value);

  const cleaned = stripHtmlContent(cleanModelText(normalizedValue))
    .replace(/\*\*/g, '')
    .replace(/^\s*["']|["']\s*$/g, '')
    .trim();

  return (cleaned || fallback || '').slice(0, maxLength).trim();
}

function hasEducationYearRange(value = '') {
  return /(?:19|20)\d{2}\s*(?:-|–|—|to|đến)\s*((?:19|20)\d{2}|present|hiện tại|nay)/i.test(String(value || ''));
}

function shouldKeepOriginalEducation(modelEducation = '', fallbackEducation = '') {
  if (!hasEducationYearRange(fallbackEducation)) return false;
  if (!modelEducation.trim()) return true;
  if (!hasEducationYearRange(modelEducation)) return true;
  return false;
}

function sanitizeLmStudioCvContent(rawContent = {}, fallbackPayload = {}) {
  const safeContent = rawContent && typeof rawContent === 'object' ? rawContent : {};
  const education = normalizeCvContentField(safeContent.education, fallbackPayload.education, 1600);

  return {
    objective: normalizeCvContentField(safeContent.objective, fallbackPayload.objective, 1200),
    experience: normalizeCvContentField(safeContent.experience, fallbackPayload.experience, 2500),
    education: shouldKeepOriginalEducation(education, fallbackPayload.education)
      ? String(fallbackPayload.education || '').trim()
      : education,
    skills: normalizeCvContentField(safeContent.skills, fallbackPayload.skills, 1200),
    certifications: normalizeCvContentField(safeContent.certifications, fallbackPayload.certifications, 1000),
    hobbies: normalizeCvContentField(safeContent.hobbies, fallbackPayload.hobbies, 800),
  };
}

function buildTemplateCvFromModelText(text = '', payload = {}) {
  try {
    const parsed = extractJsonObject(text);
    const content = sanitizeLmStudioCvContent(parsed, payload);
    return buildLocalCvHtml({ ...payload, ...content });
  } catch {
    const cleanedHtml = cleanModelHtml(text);
    const extractedPayload = /<\w+[\s\S]*>/i.test(cleanedHtml)
      ? extractCvPayloadFromHtml(cleanedHtml, {
        targetRole: payload.role,
        cvLanguage: payload.cvLanguage,
      })
      : {};

    return buildLocalCvHtml({
      ...payload,
      ...extractedPayload,
      role: payload.role || extractedPayload.role,
      cvLanguage: payload.cvLanguage,
    });
  }
}

function getPlainCvLines(htmlContent = '') {
  return stripHtmlContent(htmlContent)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function findLineIndex(lines = [], patterns = []) {
  return lines.findIndex((line) => patterns.some((pattern) => pattern.test(line)));
}

function getLinesBetween(lines = [], startIndex = -1, endIndex = -1) {
  if (startIndex < 0) return [];
  const end = endIndex > startIndex ? endIndex : lines.length;
  return lines.slice(startIndex + 1, end).map((line) => line.trim()).filter(Boolean);
}

function getLabeledLineValue(lines = [], labels = []) {
  for (const line of lines) {
    for (const label of labels) {
      const match = line.match(label);
      if (match?.[1]) return match[1].trim();
    }
  }
  return '';
}

function extractEmail(value = '') {
  const match = String(value || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : '';
}

function extractPhone(value = '') {
  const withoutEmails = String(value || '').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ' ');
  const match = withoutEmails.match(/(?:\+?\d[\d\s().-]{7,}\d)/);
  return match ? match[0].trim() : '';
}

function extractGithubUrl(value = '') {
  const match = String(value || '').match(/https?:\/\/(?:www\.)?github\.com\/[^\s<>"')]+|github\.com\/[^\s<>"')]+/i);
  return match ? match[0].trim() : '';
}

function removeKnownContactParts(value = '', { email = '', phone = '' } = {}) {
  return String(value || '')
    .replace(email, '')
    .replace(phone, '')
    .replace(extractGithubUrl(value), '')
    .replace(/Email Address|LinkedIn Url|Portfolio\s*\/\s*GitHub Url/gi, '')
    .replace(/[•|]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function isSectionHeading(line = '') {
  return /^(work experience|education|additional information|career objective|skills|certifications|interests|kinh nghiệm|học vấn|thông tin|mục tiêu|kỹ năng|chứng chỉ|sở thích)$/i.test(String(line || '').trim());
}

function normalizeCvLinesForField(lines = [], exclusions = []) {
  const normalizedExclusions = exclusions.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean);
  const seen = new Set();

  return lines
    .map((line) => line.replace(/^\s*[-•*]\s*/, '').trim())
    .filter(Boolean)
    .filter((line) => !normalizedExclusions.includes(line.toLowerCase()))
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join('\n');
}

function extractCvPayloadFromHtml(htmlContent = '', { targetRole = '', cvLanguage = '' } = {}) {
  const lines = getPlainCvLines(htmlContent);
  const allText = lines.join('\n');
  const email = extractEmail(allText);
  const phone = extractPhone(allText);
  const githubUrl = extractGithubUrl(allText);
  const contactLine = lines.find((line) => line.includes(email) || /[•|]/.test(line)) || '';
  const labeledLocation = getLabeledLineValue(lines, [/^Location:\s*(.+)$/i, /^Khu vực:\s*(.+)$/i, /^Vị trí:\s*(.+)$/i]);
  const currentLocation = labeledLocation || removeKnownContactParts(contactLine, { email, phone });

  const workIndex = findLineIndex(lines, [/^Work Experience$/i, /^Kinh Nghiệm/i]);
  const educationIndex = findLineIndex(lines, [/^Education$/i, /^Học Vấn/i]);
  const additionalIndex = findLineIndex(lines, [/^Additional Information$/i, /^Thông Tin/i]);
  const workLines = getLinesBetween(lines, workIndex, educationIndex);
  const educationLines = getLinesBetween(lines, educationIndex, additionalIndex);
  const additionalLines = getLinesBetween(lines, additionalIndex, lines.length);

  const nameCandidates = lines.filter((line) => (
    line &&
    !/^Application Profile$/i.test(line) &&
    !/^Hồ sơ ứng tuyển$/i.test(line) &&
    !line.includes('@') &&
    !/[•|]/.test(line) &&
    !isSectionHeading(line) &&
    !/^Role:/i.test(line) &&
    !/^Skills:/i.test(line) &&
    !/^Certifications:/i.test(line) &&
    !/^Interests:/i.test(line)
  ));
  const nameLine = nameCandidates.find((line) => line.split(/\s+/).length >= 2) || nameCandidates[0] || '';

  const roleFromAdditional = getLabeledLineValue(additionalLines, [/^Role:\s*(.+)$/i, /^Vai trò:\s*(.+)$/i]);
  const roleFromWork = workLines.find((line) => (
    line &&
    line !== currentLocation &&
    !/^to\s|^seeking\s|^ứng tuyển\s|^mong muốn\s/i.test(line)
  )) || '';
  const role = targetRole || roleFromAdditional || roleFromWork;

  const objectiveLine = workLines.find((line) => (
    line !== roleFromWork &&
    line !== currentLocation &&
    (/^to\s/i.test(line) || /^seeking\s/i.test(line) || /objective|mục tiêu|mong muốn|leverage|contribute|grow/i.test(line))
  )) || '';

  const experienceLines = workLines.filter((line) => (
    line !== roleFromWork &&
    line !== objectiveLine &&
    line !== currentLocation
  ));

  const skills = getLabeledLineValue(additionalLines, [/^Skills:\s*(.+)$/i, /^Kỹ Năng:\s*(.+)$/i]);
  const certifications = getLabeledLineValue(additionalLines, [/^Certifications:\s*(.+)$/i, /^Chứng Chỉ:\s*(.+)$/i]);
  const hobbies = getLabeledLineValue(additionalLines, [/^Interests:\s*(.+)$/i, /^Sở Thích:\s*(.+)$/i]);

  return {
    fullName: nameLine,
    email,
    phone,
    githubUrl,
    role,
    objective: objectiveLine,
    experience: normalizeCvLinesForField(experienceLines, [currentLocation]),
    education: normalizeCvLinesForField(educationLines, [currentLocation]),
    skills,
    certifications,
    hobbies,
    currentLocation,
    cvLanguage: getCvLanguage(cvLanguage),
  };
}

function normalizeSuggestionText(value = '', maxLength = 260) {
  return stripHtmlContent(value)
    .replace(/^Ví dụ:\s*/i, '')
    .replace(/^Example:\s*/i, '')
    .replace(/^[-•*]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
    .trim();
}

function getSuggestionSearchText(item = {}) {
  return [
    item.section,
    item.location,
    item.current_text,
    item.issue,
    item.why_it_matters,
    item.suggestion,
    item.rewrite,
    item.example,
  ].map((part) => String(part || '')).join(' ').toLowerCase();
}

function getPrimarySkills(skills = '') {
  return String(skills || '')
    .split(/[,;\n]+/)
    .map((skill) => skill.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function appendUniqueCvLine(value = '', line = '') {
  const cleanedLine = normalizeSuggestionText(line);
  if (!cleanedLine) return value;

  const existingValue = /^(not updated|chưa cập nhật|chưa cung cấp|none)$/i.test(String(value || '').trim())
    ? ''
    : value;
  const existingLines = splitCvLines(existingValue);
  const exists = existingLines.some((item) => item.toLowerCase() === cleanedLine.toLowerCase());
  return exists ? existingValue : [...existingLines, cleanedLine].map((item) => `- ${item}`).join('\n');
}

function mergeSkillList(currentSkills = '', suggestedSkills = []) {
  const items = String(currentSkills || '')
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  for (const skill of suggestedSkills) {
    const cleaned = normalizeSuggestionText(skill, 60);
    if (cleaned && !items.some((item) => item.toLowerCase() === cleaned.toLowerCase())) {
      items.push(cleaned);
    }
  }

  return items.join(', ');
}

function buildPlaceholderExperienceBullet(payload = {}, item = {}) {
  const role = payload.role || 'target role';
  const skills = getPrimarySkills(payload.skills);
  const skillText = skills.length ? skills.join(', ') : '[relevant tools/skills]';
  const searchText = getSuggestionSearchText(item);

  if (/metric|number|số liệu|kết quả|achievement|impact|measurable/.test(searchText)) {
    return `Improved [process/result] for ${role} work by [add real metric] using ${skillText}.`;
  }

  if (/project|dự án|experience|kinh nghiệm|work/.test(searchText)) {
    return `Completed [project/task] using ${skillText}, delivering [add real outcome] for [team/user/business].`;
  }

  return `Applied ${skillText} in ${role} work to support [specific task] and achieve [measurable result].`;
}

function buildLocalRevisedCvHtml({ htmlContent = '', targetRole = '', suggestions = [], cvLanguage = '' } = {}) {
  const payload = extractCvPayloadFromHtml(htmlContent, { targetRole, cvLanguage });
  const revised = { ...payload, role: targetRole || payload.role };
  const selectedSuggestions = suggestions.length ? suggestions : [{ section: 'CV', suggestion: 'Improve the CV content with clearer role alignment and measurable impact.' }];

  selectedSuggestions.forEach((item) => {
    const searchText = getSuggestionSearchText(item);
    const rewriteText = normalizeSuggestionText(item.rewrite || '');
    const exampleText = normalizeSuggestionText(rewriteText || item.example || '');
    const suggestionText = normalizeSuggestionText(item.suggestion || '');

    if (/email|mail|phone|số điện thoại|sdt|sđt|liên hệ|contact/.test(searchText)) {
      const contactText = [rewriteText, exampleText, suggestionText].filter(Boolean).join(' ');
      const suggestedEmail = extractEmail(contactText);
      const suggestedPhone = extractPhone(contactText);
      if (/email|mail/i.test(searchText)) revised.email = suggestedEmail || revised.email || 'email.tenban@example.com';
      if (/phone|số điện thoại|sdt|sđt/i.test(searchText)) revised.phone = suggestedPhone || revised.phone || '09xx xxx xxx';
      return;
    }

    if (/objective|summary|mục tiêu|định hướng|profile/.test(searchText)) {
      revised.objective = exampleText || suggestionText || revised.objective || `Seeking a ${revised.role || 'target'} position where I can apply my skills, contribute measurable value, and keep developing professionally.`;
      return;
    }

    if (/education|học vấn|school|university|degree/.test(searchText)) {
      revised.education = appendUniqueCvLine(revised.education, exampleText || '[add school name] - [degree/major], [start year] - [end year]');
      return;
    }

    if (/skill|kỹ năng|technology|technologies|tool/.test(searchText)) {
      const inferredSkills = (exampleText || suggestionText)
        .split(/[,;/]|(?:\sand\s)|(?:\svà\s)/i)
        .map((itemText) => normalizeSuggestionText(itemText, 50))
        .filter((itemText) => itemText && !/\[|add real|bổ sung|liệt kê|kỹ năng|skills?/i.test(itemText))
        .slice(0, 5);
      revised.skills = mergeSkillList(revised.skills, inferredSkills.length ? inferredSkills : ['[add relevant skill]']);
      return;
    }

    if (/certification|certificate|chứng chỉ/.test(searchText)) {
      revised.certifications = appendUniqueCvLine(revised.certifications, exampleText || '[add certification name]');
      return;
    }

    if (/interest|hobby|sở thích/.test(searchText)) {
      revised.hobbies = appendUniqueCvLine(revised.hobbies, exampleText || '[add relevant interests]');
      return;
    }

    revised.experience = appendUniqueCvLine(
      revised.experience,
      exampleText || buildPlaceholderExperienceBullet(revised, item)
    );
  });

  return buildLocalCvHtml(revised);
}

function normalizeHtmlForComparison(html = '') {
  return stripHtmlContent(html).replace(/\s+/g, ' ').trim().toLowerCase();
}

function isMeaningfullyDifferentHtml(nextHtml = '', previousHtml = '') {
  return normalizeHtmlForComparison(nextHtml) !== normalizeHtmlForComparison(previousHtml);
}

async function generateCvWithLmStudio(payload, lmStudioOptions = {}, { fallbackOnError = true } = {}) {
  const fallbackHtml = buildLocalCvHtml(payload);

  try {
    const text = await generateTextWithLmStudio(addLmStudioModelHints(
      buildLmStudioCvContentPrompt(payload),
      lmStudioOptions.model
    ), {
      systemPrompt: 'You are a professional CV writer. Return only valid JSON, no HTML, no markdown, no explanations.',
      temperature: 0.25,
      maxTokens: 1200,
      ...lmStudioOptions,
    });
    const parsed = extractJsonObject(text);
    const content = sanitizeLmStudioCvContent(parsed, payload);
    return buildLocalCvHtml({ ...payload, ...content });
  } catch (err) {
    if (!fallbackOnError) {
      console.error('LM Studio CV content error:', err.message);
      throw err;
    }
    console.error('LM Studio CV content error, using local CV template:', err.message);
    return fallbackHtml;
  }
}

function normalizePriority(priority) {
  const normalized = String(priority || '').toLowerCase();
  return ['high', 'medium', 'low'].includes(normalized) ? normalized : 'medium';
}

function buildCvReviewPrompt({ plainText = '', targetRole = '', cvLanguage = '' } = {}) {
  if (getCvLanguage(cvLanguage) === 'en') {
    return `You are a recruiting expert and professional CV editor. Analyze the CV below and point out exact places to improve.

Target role: ${targetRole || 'Not provided'}

CV content:
${plainText || '(empty)'}

Requirements:
1. Return ONLY valid JSON. Do not return markdown or explanations outside JSON.
2. Create 4-8 suggestions, sorted by impact on interview shortlisting.
3. Every suggestion must name the edit location. If editing an existing line, quote a short excerpt in "current_text". If the CV is missing that item, set "current_text" to "".
4. "rewrite" must be an English sentence or bullet that can be directly replaced or added to the CV. Use placeholders like [add real metric] when evidence is missing.
5. Focus on concrete issues: missing contact information, generic wording, missing metrics, skills not aligned with the target role, layout/length, weak evidence of impact.
6. Do not invent new jobs, companies, schools, dates, certificates, or exact metrics.
7. JSON schema:
{
  "score": number,
  "summary": string,
  "strengths": string[],
  "suggestions": [
    {
      "section": string,
      "location": string,
      "current_text": string,
      "priority": "high" | "medium" | "low",
      "issue": string,
      "why_it_matters": string,
      "suggestion": string,
      "rewrite": string,
      "example": string
    }
  ]
}`;
  }

  return `Bạn là chuyên gia tuyển dụng và chỉnh sửa CV tại Việt Nam. Hãy phân tích CV bên dưới và chỉ ra chính xác các chỗ cần sửa.

Vị trí mục tiêu: ${targetRole || 'Chưa cung cấp'}

Nội dung CV:
${plainText || '(trống)'}

Yêu cầu:
1. Trả về CHỈ một JSON hợp lệ, không markdown, không giải thích ngoài JSON.
2. Tạo 4-8 gợi ý, sắp xếp theo mức độ ảnh hưởng đến khả năng được gọi phỏng vấn.
3. Mỗi gợi ý phải chỉ rõ vị trí cần sửa. Nếu sửa một dòng đang có, hãy trích ngắn dòng đó trong "current_text". Nếu CV đang thiếu phần đó, để "current_text" là "".
4. "rewrite" phải là câu/gạch đầu dòng có thể thay trực tiếp hoặc thêm vào CV. Dùng placeholder [điền ...] khi thiếu dữ liệu thật.
5. Tập trung vào lỗi cụ thể: thông tin liên hệ thiếu, câu chữ chung chung, thiếu số liệu, thiếu kỹ năng liên quan vị trí, bố cục/độ dài, kinh nghiệm chưa chứng minh tác động.
6. Không bịa kinh nghiệm mới, công ty, trường học, ngày tháng, chứng chỉ hoặc số liệu cụ thể.
7. Schema JSON:
{
  "score": number,
  "summary": string,
  "strengths": string[],
  "suggestions": [
    {
      "section": string,
      "location": string,
      "current_text": string,
      "priority": "high" | "medium" | "low",
      "issue": string,
      "why_it_matters": string,
      "suggestion": string,
      "rewrite": string,
      "example": string
    }
  ]
}`;
}

function buildCvRevisionPrompt({ htmlContent = '', targetRole = '', suggestions = [] } = {}) {
  const suggestionText = suggestions
    .map((item, index) => {
      const section = item?.section ? `Phần: ${item.section}` : 'Phần: CV';
      const location = item?.location ? `Vị trí sửa: ${item.location}` : '';
      const currentText = item?.current_text ? `Đoạn hiện tại: ${item.current_text}` : '';
      const issue = item?.issue ? `Vấn đề: ${item.issue}` : '';
      const why = item?.why_it_matters ? `Lý do: ${item.why_it_matters}` : '';
      const suggestion = item?.suggestion ? `Cách sửa: ${item.suggestion}` : '';
      const rewrite = item?.rewrite ? `Nội dung nên dùng: ${item.rewrite}` : '';
      const example = item?.example ? `Ví dụ tham khảo: ${item.example}` : '';
      return `${index + 1}. ${[section, location, currentText, issue, why, suggestion, rewrite, example].filter(Boolean).join(' | ')}`;
    })
    .join('\n');

  return `Bạn là chuyên gia chỉnh sửa CV HTML tiếng Việt. Hãy cập nhật CV HTML bên dưới theo đúng các gợi ý được chọn.

Vị trí mục tiêu: ${targetRole || 'Chưa cung cấp'}

Gợi ý cần áp dụng:
${suggestionText || 'Tối ưu câu chữ và bổ sung điểm còn thiếu nếu phù hợp.'}

CV HTML hiện tại:
${htmlContent || '(trống)'}

Yêu cầu:
1. Trả về CHỈ HTML hoàn chỉnh, không markdown, không giải thích.
2. Giữ lại thông tin thật đã có, không bịa tên công ty, trường học, số liệu hoặc chứng chỉ.
3. Nếu cần số liệu thật mà CV chưa có, dùng khung [điền số liệu thật] để ứng viên tự cập nhật.
4. Giữ thiết kế inline CSS hiện có càng nhiều càng tốt, chỉ chỉnh nội dung/bố cục cần thiết.
5. Không thêm section ghi chú, review, "Thông tin cần cập nhật", "Suggestions", hoặc khối cảnh báo vào cuối CV.
6. Không chèn script, iframe, external CSS hoặc ảnh placeholder từ bên ngoài.`;
}

function buildCvRevisionContentPrompt({ currentContent = {}, targetRole = '', suggestions = [], cvLanguage = '' } = {}) {
  const suggestionText = suggestions
    .map((item, index) => {
      const section = item?.section ? `Section: ${item.section}` : 'Section: CV';
      const location = item?.location ? `Edit location: ${item.location}` : '';
      const currentText = item?.current_text ? `Current text: ${item.current_text}` : '';
      const issue = item?.issue ? `Issue: ${item.issue}` : '';
      const why = item?.why_it_matters ? `Why it matters: ${item.why_it_matters}` : '';
      const suggestion = item?.suggestion ? `Fix: ${item.suggestion}` : '';
      const rewrite = item?.rewrite ? `Suggested rewrite: ${item.rewrite}` : '';
      const example = item?.example ? `Example: ${item.example}` : '';
      return `${index + 1}. ${[section, location, currentText, issue, why, suggestion, rewrite, example].filter(Boolean).join(' | ')}`;
    })
    .join('\n');

  if (getCvLanguage(cvLanguage) === 'en') {
    return `You are a professional CV editor. Apply the selected review suggestions to the CV content below.

Target role: ${targetRole || currentContent.role || 'Not provided'}

Current CV content JSON:
${JSON.stringify(currentContent, null, 2)}

Selected suggestions:
${suggestionText || 'Improve clarity, role alignment, and measurable impact where possible.'}

Requirements:
1. Return ONLY valid JSON. No markdown, no HTML, no explanation.
2. Keep the candidate's real information. Do not invent company names, school names, dates, certificates, or exact metrics.
3. Translate Vietnamese descriptive content to English, but keep proper nouns such as school names, company names, locations, and certificates in their original wording.
4. If a suggestion needs missing evidence, use placeholders like [add real metric], [add project name], [add school name].
5. Make the selected suggestion visible in the returned content.
6. Use concise, natural English suitable for an ATS-friendly resume.
7. Schema:
{
  "objective": "career objective or summary",
  "experience": "- bullet points for work/projects",
  "education": "education details or placeholders",
  "skills": "comma-separated skills",
  "certifications": "certifications or Not updated",
  "hobbies": "interests or Not updated"
}`;
  }

  return `Bạn là chuyên gia chỉnh sửa CV. Hãy áp dụng các gợi ý đã chọn vào nội dung CV bên dưới.

Vị trí mục tiêu: ${targetRole || currentContent.role || 'Chưa cung cấp'}

Nội dung CV hiện tại dạng JSON:
${JSON.stringify(currentContent, null, 2)}

Gợi ý cần áp dụng:
${suggestionText || 'Tối ưu độ rõ ràng, mức độ khớp vị trí và kết quả đo lường nếu phù hợp.'}

Yêu cầu:
1. Trả về CHỈ một JSON hợp lệ. Không markdown, không HTML, không giải thích.
2. Giữ thông tin thật của ứng viên. Không bịa tên công ty, trường học, ngày tháng, chứng chỉ hoặc số liệu cụ thể.
3. Nếu thiếu dữ liệu thật, dùng placeholder như [điền số liệu thật], [điền tên dự án], [điền tên trường].
4. Gợi ý được chọn phải tạo ra thay đổi nhìn thấy được trong nội dung trả về.
5. Viết ngắn gọn, chuyên nghiệp.
6. Schema:
{
  "objective": "mục tiêu/tóm tắt nghề nghiệp",
  "experience": "- các gạch đầu dòng kinh nghiệm/dự án",
  "education": "học vấn hoặc placeholder cần bổ sung",
  "skills": "kỹ năng phân tách bằng dấu phẩy",
  "certifications": "chứng chỉ hoặc Chưa cập nhật",
  "hobbies": "sở thích hoặc Chưa cập nhật"
}`;
}

function buildLocalCvReview({ plainText = '', targetRole = '', cvLanguage = '' } = {}) {
  const text = String(plainText || '').trim();
  const lower = text.toLowerCase();
  const words = text.match(/[a-zA-ZÀ-ỹ0-9]+/g) || [];
  const suggestions = [];
  const strengths = [];
  const isEnglish = getCvLanguage(cvLanguage) === 'en';

  const addSuggestion = (section, priority, issue, suggestion, example = '', details = {}) => {
    const rewrite = String(details.rewrite || example || '').trim();
    suggestions.push({
      section,
      location: String(details.location || section || 'CV').trim(),
      current_text: String(details.current_text || '').trim(),
      priority,
      issue,
      why_it_matters: String(details.why_it_matters || '').trim(),
      suggestion,
      rewrite,
      example: String(example || rewrite).trim(),
    });
  };

  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) {
    strengths.push(isEnglish ? 'The CV already includes an email address.' : 'Thông tin email đã xuất hiện trong CV.');
  } else {
    addSuggestion(
      isEnglish ? 'Contact Information' : 'Thông tin liên hệ',
      'high',
      isEnglish ? 'The CV does not include a clear email address.' : 'CV chưa có email hoặc email không rõ ràng.',
      isEnglish ? 'Add a professional email address in the header so recruiters can contact the candidate quickly.' : 'Bổ sung email chuyên nghiệp ở phần đầu CV để nhà tuyển dụng liên hệ nhanh.',
      'email.tenban@example.com',
      {
        location: isEnglish ? 'Header / contact line' : 'Header / dòng thông tin liên hệ',
        why_it_matters: isEnglish ? 'Email is the primary contact channel after recruiters shortlist a CV.' : 'Email là kênh liên hệ chính sau khi nhà tuyển dụng lọc CV.',
        rewrite: 'Email: email.tenban@example.com',
      }
    );
  }

  if (/(?:\+?84|0)(?:\d[\s.-]?){8,10}\d/.test(text)) {
    strengths.push(isEnglish ? 'The CV already includes a phone number.' : 'CV đã có số điện thoại liên hệ.');
  } else {
    addSuggestion(
      isEnglish ? 'Contact Information' : 'Thông tin liên hệ',
      'high',
      isEnglish ? 'The CV does not include an easy-to-find phone number.' : 'CV chưa có số điện thoại dễ nhận diện.',
      isEnglish ? 'Add a phone number in the header, near the email or location.' : 'Thêm số điện thoại ở header, cùng dòng với email hoặc địa chỉ.',
      '09xx xxx xxx',
      {
        location: isEnglish ? 'Header / contact line' : 'Header / dòng thông tin liên hệ',
        why_it_matters: isEnglish ? 'A missing phone number can slow down interview scheduling.' : 'Thiếu số điện thoại làm nhà tuyển dụng khó liên hệ nhanh khi cần phỏng vấn.',
        rewrite: 'Phone: 09xx xxx xxx',
      }
    );
  }

  if (targetRole && lower.includes(targetRole.toLowerCase())) {
    strengths.push(isEnglish ? 'The CV is already aligned with the target role.' : 'CV đã bám theo vị trí ứng tuyển mục tiêu.');
  } else if (targetRole) {
    addSuggestion(
      isEnglish ? 'Target Role Alignment' : 'Định hướng ứng tuyển',
      'medium',
      isEnglish ? 'The CV does not clearly state the target role.' : 'CV chưa nêu rõ vị trí mục tiêu.',
      isEnglish ? 'Add the target role to the header or summary so the CV reads as tailored.' : 'Đưa vị trí ứng tuyển vào header hoặc phần tóm tắt để CV khớp hơn với tin tuyển dụng.',
      isEnglish ? `Target role: ${targetRole}` : `Ứng tuyển vị trí ${targetRole}`,
      {
        location: isEnglish ? 'Header or opening summary' : 'Header hoặc phần tóm tắt đầu CV',
        why_it_matters: isEnglish ? 'A clear target role improves keyword match and makes the application feel intentional.' : 'Vị trí mục tiêu giúp CV khớp từ khóa và tạo cảm giác ứng tuyển có chủ đích.',
        rewrite: isEnglish ? `Target role: ${targetRole}` : `Ứng tuyển vị trí ${targetRole}`,
      }
    );
  }

  if (!/mục tiêu|objective|summary|tóm tắt|giới thiệu/.test(lower)) {
    addSuggestion(
      isEnglish ? 'Professional Summary' : 'Mục tiêu nghề nghiệp',
      'medium',
      isEnglish ? 'The CV is missing a professional summary or career objective.' : 'Thiếu phần tóm tắt hoặc mục tiêu nghề nghiệp.',
      isEnglish ? 'Add 2-3 concise sentences summarizing core strengths, direction, and value offered.' : 'Thêm 2-3 câu tóm tắt năng lực chính, định hướng và giá trị có thể đóng góp.',
      isEnglish ? 'Experienced in [core skill], seeking to contribute to [work goal] in a [company type] environment.' : 'Có kinh nghiệm về [kỹ năng], mong muốn đóng góp vào [mục tiêu công việc] tại [loại doanh nghiệp].',
      {
        location: isEnglish ? 'Right after the header, before work experience' : 'Ngay sau header, trước phần kinh nghiệm',
        why_it_matters: isEnglish ? 'A summary helps recruiters quickly see the candidate’s main fit.' : 'Phần tóm tắt giúp nhà tuyển dụng hiểu nhanh bạn phù hợp vì điểm mạnh nào.',
        rewrite: isEnglish ? 'Experienced in [core skill], seeking to contribute to [work goal] in a [company type] environment.' : 'Có kinh nghiệm về [kỹ năng chính], mong muốn đóng góp vào [mục tiêu công việc] tại [loại doanh nghiệp].',
      }
    );
  }

  if (/kinh nghiệm|experience|dự án|project/.test(lower)) {
    strengths.push(isEnglish ? 'The CV already includes experience or project content.' : 'CV đã có phần kinh nghiệm hoặc dự án.');
  } else {
    addSuggestion(
      isEnglish ? 'Experience / Projects' : 'Kinh nghiệm/Dự án',
      'high',
      isEnglish ? 'The CV does not include work experience or standout projects.' : 'CV chưa có phần kinh nghiệm làm việc hoặc dự án nổi bật.',
      isEnglish ? 'Add experience using role, responsibility, tools/technology, and outcome.' : 'Bổ sung kinh nghiệm theo cấu trúc vai trò, nhiệm vụ, công nghệ/công cụ và kết quả đạt được.',
      isEnglish ? '- [Role] at [Company/Project]: performed [task] using [tool/skill], achieving [measurable outcome].' : '- [Vai trò] tại [Công ty/Dự án]: thực hiện [nhiệm vụ], đạt [kết quả đo được].',
      {
        location: isEnglish ? 'Work Experience or Projects section' : 'Phần Kinh nghiệm làm việc hoặc Dự án',
        why_it_matters: isEnglish ? 'Experience and projects are the main evidence recruiters use to assess practical ability.' : 'Kinh nghiệm/dự án là bằng chứng chính để đánh giá năng lực thực tế.',
        rewrite: isEnglish ? '- [Role] at [Company/Project]: performed [task] using [tool/skill], achieving [measurable outcome].' : '- [Vai trò] tại [Công ty/Dự án]: thực hiện [nhiệm vụ] bằng [công cụ/kỹ năng], đạt [kết quả đo được].',
      }
    );
  }

  if (!/\d+/.test(text)) {
    addSuggestion(
      isEnglish ? 'Work Impact' : 'Kết quả công việc',
      'medium',
      isEnglish ? 'The CV lacks metrics that prove results.' : 'CV thiếu số liệu chứng minh kết quả.',
      isEnglish ? 'Add real metrics about scale, time, efficiency, users, revenue, or improvement.' : 'Thêm số liệu thật về quy mô, thời gian, hiệu suất, số người dùng, doanh thu hoặc mức cải thiện.',
      isEnglish ? 'Optimized [process/feature], improving [metric] from [x] to [y] within [timeframe].' : 'Tối ưu quy trình xử lý hồ sơ, giảm thời gian nhập liệu từ [x] phút xuống [y] phút.',
      {
        location: isEnglish ? 'Bullets inside Work Experience / Projects' : 'Các gạch đầu dòng trong phần Kinh nghiệm/Dự án',
        why_it_matters: isEnglish ? 'Metrics make achievements more credible and help the CV stand out from generic descriptions.' : 'Số liệu làm thành tích đáng tin hơn và giúp CV nổi bật khi so với mô tả chung chung.',
        rewrite: isEnglish ? 'Optimized [process/feature], improving [metric] from [x] to [y] within [timeframe].' : 'Tối ưu [quy trình/tính năng], cải thiện [chỉ số] từ [x] lên [y] trong [thời gian].',
      }
    );
  }

  if (/kỹ năng|skills|công cụ|tools|technology|technologies/.test(lower)) {
    strengths.push(isEnglish ? 'The CV already includes skills or tools.' : 'CV đã có nhóm kỹ năng/công cụ.');
  } else {
    addSuggestion(
      isEnglish ? 'Skills' : 'Kỹ năng',
      'high',
      isEnglish ? 'The CV is missing skills relevant to the target role.' : 'Thiếu nhóm kỹ năng liên quan đến vị trí ứng tuyển.',
      isEnglish ? 'List technical skills, tools, domain skills, and role-relevant soft skills.' : 'Liệt kê kỹ năng chuyên môn, công cụ và kỹ năng mềm sát với mô tả công việc.',
      isEnglish ? 'Skills: [tool 1], [tool 2], [technical skill], communication, teamwork.' : 'Kỹ năng: [công cụ 1], [công cụ 2], [kỹ năng chuyên môn], giao tiếp, làm việc nhóm.',
      {
        location: isEnglish ? 'Skills section' : 'Phần Kỹ năng',
        why_it_matters: isEnglish ? 'Skills are important keywords for recruiters and screening systems.' : 'Kỹ năng là nhóm từ khóa quan trọng để nhà tuyển dụng và hệ thống lọc CV nhận diện mức độ phù hợp.',
        rewrite: isEnglish ? 'Skills: [tool 1], [tool 2], [technical skill], communication, teamwork.' : 'Kỹ năng: [công cụ 1], [công cụ 2], [kỹ năng chuyên môn], giao tiếp, làm việc nhóm.',
      }
    );
  }

  if (!/học vấn|education|đại học|cao đẳng|trường/.test(lower)) {
    addSuggestion(
      isEnglish ? 'Education' : 'Học vấn',
      'low',
      isEnglish ? 'The education section is unclear or missing.' : 'Phần học vấn chưa rõ hoặc chưa có.',
      isEnglish ? 'Add school, major, dates, and relevant achievements if available.' : 'Bổ sung trường, chuyên ngành, thời gian học và thành tích liên quan nếu có.',
      isEnglish ? '[School name] - [Degree/Major], [start year] - [end year]' : '[Tên trường] - [Chuyên ngành], [năm bắt đầu] - [năm kết thúc]',
      {
        location: isEnglish ? 'Education section' : 'Phần Học vấn',
        why_it_matters: isEnglish ? 'Education completes the candidate profile, especially for early-career applicants.' : 'Học vấn giúp hoàn thiện hồ sơ nền tảng, đặc biệt với ứng viên ít kinh nghiệm.',
        rewrite: isEnglish ? '[School name] - [Degree/Major], [start year] - [end year]. Relevant achievement: [if any].' : '[Tên trường] - [Chuyên ngành], [năm bắt đầu] - [năm kết thúc]. Thành tích liên quan: [nếu có].',
      }
    );
  }

  if (words.length < 120) {
    addSuggestion(
      isEnglish ? 'Completeness' : 'Độ đầy đủ',
      'high',
      isEnglish ? 'The CV is quite short, making it hard to demonstrate ability.' : 'CV đang khá ngắn, khó thể hiện năng lực.',
      isEnglish ? 'Expand experience, projects, skills, and achievements so recruiters have enough evidence to evaluate.' : 'Mở rộng phần kinh nghiệm, dự án, kỹ năng và thành tích để nhà tuyển dụng có đủ dữ liệu đánh giá.',
      isEnglish ? 'Each experience should include 2-4 bullets describing responsibilities, tools, scope, and outcomes.' : 'Mỗi kinh nghiệm nên có 2-4 gạch đầu dòng mô tả việc đã làm và kết quả.',
      {
        location: isEnglish ? 'Whole CV, especially Experience / Projects and Skills' : 'Toàn bộ CV, ưu tiên Kinh nghiệm/Dự án và Kỹ năng',
        why_it_matters: isEnglish ? 'A very short CV often lacks enough evidence to pass initial screening.' : 'CV quá ngắn thường không đủ bằng chứng để vượt qua vòng lọc đầu.',
        rewrite: isEnglish ? 'Each experience should include 2-4 bullets: key responsibility, tools used, work scope, and outcome.' : 'Mỗi kinh nghiệm nên có 2-4 gạch đầu dòng: nhiệm vụ chính, công cụ dùng, phạm vi công việc và kết quả.',
      }
    );
  } else if (words.length > 900) {
    addSuggestion(
      isEnglish ? 'Length' : 'Độ dài',
      'medium',
      isEnglish ? 'The CV may be too long.' : 'CV có thể đang quá dài.',
      isEnglish ? 'Trim less relevant details and prioritize 1-2 pages of role-aligned information.' : 'Rút gọn nội dung ít liên quan, ưu tiên 1-2 trang với thông tin sát vị trí ứng tuyển.',
      isEnglish ? 'Keep the most recent and highest-impact experiences.' : 'Giữ các kinh nghiệm gần nhất và có tác động rõ nhất.',
      {
        location: isEnglish ? 'Long descriptions or less relevant experiences' : 'Các đoạn mô tả dài hoặc kinh nghiệm ít liên quan',
        why_it_matters: isEnglish ? 'A long CV makes it harder for recruiters to scan the strongest fit quickly.' : 'CV dài làm nhà tuyển dụng khó quét nhanh điểm phù hợp nhất.',
        rewrite: isEnglish ? 'Keep the most recent, highest-impact experiences; reduce each point to one outcome-focused bullet.' : 'Giữ các kinh nghiệm gần nhất, có tác động rõ nhất; rút mỗi ý về 1 gạch đầu dòng có kết quả.',
      }
    );
  } else {
    strengths.push(isEnglish ? 'The CV length is reasonable for quick scanning.' : 'Độ dài CV đang ở mức có thể đọc nhanh.');
  }

  if (!suggestions.length) {
    addSuggestion(
      isEnglish ? 'Final Optimization' : 'Tối ưu cuối',
      'low',
      isEnglish ? 'The CV has a solid base structure but can be tailored further.' : 'CV đã có cấu trúc cơ bản tốt nhưng vẫn có thể cá nhân hóa thêm.',
      isEnglish ? 'Match each skill and achievement against the job description before applying.' : 'So khớp từng kỹ năng và thành tích với mô tả công việc trước khi nộp.',
      isEnglish ? 'Adjust the summary to mention the exact target role and 2-3 key job requirements.' : 'Điều chỉnh phần tóm tắt để nhắc đúng tên vị trí và 2-3 yêu cầu chính của tin tuyển dụng.',
      {
        location: isEnglish ? 'Professional summary and experience bullets' : 'Mục tiêu nghề nghiệp và các gạch đầu dòng kinh nghiệm',
        why_it_matters: isEnglish ? 'Tailoring each application makes the CV feel more relevant to the employer.' : 'Cá nhân hóa theo từng vị trí làm CV trông sát nhu cầu tuyển dụng hơn.',
        rewrite: isEnglish ? 'Adjust the summary to mention the exact target role and 2-3 key job requirements.' : 'Điều chỉnh phần tóm tắt để nhắc đúng tên vị trí và 2-3 yêu cầu chính của tin tuyển dụng.',
      }
    );
  }

  const penalty = suggestions.reduce((total, item) => {
    if (item.priority === 'high') return total + 15;
    if (item.priority === 'medium') return total + 9;
    return total + 5;
  }, 0);

  return {
    score: Math.max(45, Math.min(95, 100 - penalty)),
    summary: suggestions.some((item) => item.priority === 'high')
      ? (isEnglish ? 'The CV needs several important additions before it is ready for applications.' : 'CV cần bổ sung một số thông tin quan trọng trước khi dùng để ứng tuyển.')
      : (isEnglish ? 'The CV has a reasonable foundation and should be refined to improve role fit.' : 'CV đã có nền tảng ổn, nên tinh chỉnh thêm để tăng mức độ phù hợp với vị trí.'),
    strengths: [...new Set(strengths)].slice(0, 5),
    suggestions: suggestions.slice(0, 8),
  };
}

function sanitizeCvReview(rawReview, fallbackReview) {
  const suggestions = Array.isArray(rawReview?.suggestions)
    ? rawReview.suggestions
        .map((item) => {
          const section = String(item?.section || 'CV').trim();
          const rewrite = String(item?.rewrite || item?.replacement || item?.example || '').trim();
          return {
            section,
            location: String(item?.location || item?.where || item?.anchor || section || 'CV').trim(),
            current_text: String(item?.current_text || item?.currentText || item?.before || '').trim(),
            priority: normalizePriority(item?.priority),
            issue: String(item?.issue || '').trim(),
            why_it_matters: String(item?.why_it_matters || item?.whyItMatters || item?.why || '').trim(),
            suggestion: String(item?.suggestion || item?.fix || '').trim(),
            rewrite,
            example: String(item?.example || rewrite).trim(),
          };
        })
        .filter((item) => item.issue && item.suggestion)
        .slice(0, 10)
    : [];

  const strengths = Array.isArray(rawReview?.strengths)
    ? rawReview.strengths.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 5)
    : fallbackReview.strengths;

  const score = Number(rawReview?.score);

  return {
    score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : fallbackReview.score,
    summary: String(rawReview?.summary || fallbackReview.summary || '').trim(),
    strengths,
    suggestions: suggestions.length ? suggestions : fallbackReview.suggestions,
  };
}

async function generateCvReview({ htmlContent = '', plainText = '', targetRole = '', cvLanguage = '' } = {}) {
  const text = (plainText || stripHtmlContent(htmlContent)).slice(0, 12000);
  const fallbackReview = buildLocalCvReview({ plainText: text, targetRole, cvLanguage });
  const reviewProvider = getCvReviewProvider();

  if (reviewProvider && isOpenAiCompatibleCvProvider(reviewProvider)) {
    try {
      const lmStudioOptions = getCvReviewLmStudioOptions();
      const resultText = await generateTextWithLmStudio(addLmStudioModelHints(
        buildCvReviewPrompt({ plainText: text, targetRole, cvLanguage }),
        lmStudioOptions.model
      ), {
        systemPrompt: 'You are a recruiting expert. Return only valid JSON matching the requested schema, no markdown, no explanations.',
        temperature: 0.2,
        maxTokens: 2600,
        ...lmStudioOptions,
      });
      const parsed = extractJsonObject(resultText);
      return sanitizeCvReview(parsed, fallbackReview);
    } catch (err) {
      console.error('CV review OpenAI-compatible error, using local fallback:', err.message);
      return fallbackReview;
    }
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
      const result = await model.generateContent(buildCvReviewPrompt({ plainText: text, targetRole, cvLanguage }));
      const parsed = extractJsonObject(result.response.text());
      return sanitizeCvReview(parsed, fallbackReview);
    } catch (err) {
      console.error('CV review AI error, using local fallback:', err.message);
      return fallbackReview;
    }
  }

  return fallbackReview;
}

function removeLocalRevisionPatch(htmlContent = '') {
  return String(htmlContent || '')
    .replace(
      /<div\s+style="[^"]*#fbbf24[^"]*"[^>]*>\s*<h2[\s\S]*?>\s*Thông tin cần cập nhật\s*<\/h2>[\s\S]*?<\/div>\s*(?=<\/div>\s*$)/gi,
      ''
    )
    .replace(
      /<div\s+style="[^"]*#fbbf24[^"]*"[^>]*>[\s\S]*?Thông tin cần cập nhật[\s\S]*?<\/div>\s*(?=<\/div>\s*$)/gi,
      ''
    )
    .trim();
}

function isUsableRevisedCvHtml(html = '') {
  const text = String(html || '');
  return /<\w+[\s\S]*>/i.test(text)
    && !/Thông tin cần cập nhật|Suggestions?|Suggested changes?|Information to update/i.test(stripHtmlContent(text));
}

async function generateRevisedCv({ htmlContent = '', targetRole = '', suggestions = [], cvLanguage = '' } = {}) {
  const fallbackHtml = removeLocalRevisionPatch(htmlContent);
  const currentContent = extractCvPayloadFromHtml(fallbackHtml, { targetRole, cvLanguage });
  const localRevisedHtml = buildLocalRevisedCvHtml({ htmlContent: fallbackHtml, targetRole, suggestions, cvLanguage });
  const reviewProvider = getCvReviewProvider();

  if (suggestions.length && isMeaningfullyDifferentHtml(localRevisedHtml, fallbackHtml)) {
    return localRevisedHtml;
  }

  if (reviewProvider && isOpenAiCompatibleCvProvider(reviewProvider)) {
    try {
      const lmStudioOptions = getCvReviewLmStudioOptions();
      const resultText = await generateTextWithLmStudio(addLmStudioModelHints(buildCvRevisionContentPrompt({
        currentContent,
        targetRole,
        suggestions,
        cvLanguage,
      }), lmStudioOptions.model), {
        systemPrompt: 'You are a professional CV editor. Return only valid JSON matching the requested schema, no markdown, no explanations.',
        temperature: 0.2,
        maxTokens: 1600,
        ...lmStudioOptions,
      });
      const parsed = extractJsonObject(resultText);
      const content = sanitizeLmStudioCvContent(parsed, currentContent);
      const html = buildLocalCvHtml({ ...currentContent, ...content, role: targetRole || currentContent.role, cvLanguage });
      return isMeaningfullyDifferentHtml(html, fallbackHtml) ? html : localRevisedHtml;
    } catch (err) {
      console.error('CV revise OpenAI-compatible error, using local fallback:', err.message);
      return localRevisedHtml;
    }
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
      const result = await model.generateContent(buildCvRevisionContentPrompt({
        currentContent,
        targetRole,
        suggestions,
        cvLanguage,
      }));
      const parsed = extractJsonObject(result.response.text());
      const content = sanitizeLmStudioCvContent(parsed, currentContent);
      const html = buildLocalCvHtml({ ...currentContent, ...content, role: targetRole || currentContent.role, cvLanguage });
      return isMeaningfullyDifferentHtml(html, fallbackHtml) ? html : localRevisedHtml;
    } catch (err) {
      console.error('CV revise AI error, using local fallback:', err.message);
      return localRevisedHtml;
    }
  }

  return localRevisedHtml;
}

/**
 * GET /api/cv/suggestions
 * Lấy dữ liệu gợi ý từ Resume Knowledge Base
 */
exports.getSuggestions = (req, res) => {
  try {
    const kbPath = path.join(__dirname, '..', '..', 'models', 'cv', 'resume_knowledge.json');
    if (!fs.existsSync(kbPath)) {
      return res.json({ data: {} });
    }
    const data = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
    res.json({ data });
  } catch (err) {
    console.error('Error reading suggestions:', err);
    res.status(500).json({ error: 'Lỗi khi tải gợi ý' });
  }
};

/**
 * POST /api/cv/generate
 * Tạo CV bằng AI (Gemini hoặc Custom Kaggle Model)
 */
exports.generateCV = async (req, res) => {
  const { fullName, email, phone, githubUrl, role, objective, education, experience, skills, certifications, hobbies, portraitDataUrl } = req.body;
  const resolvedLocation = resolveCurrentLocationPayload(req.body);

  if (resolvedLocation.error) {
    return res.status(400).json({ error: resolvedLocation.error });
  }

  const payload = {
    fullName,
    email,
    phone,
    githubUrl,
    role,
    objective,
    education,
    experience,
    skills,
    certifications,
    hobbies,
    portraitDataUrl,
    currentLocation: resolvedLocation.location,
    cvLanguage: getCvLanguage(req.body.cvLanguage || req.body.cv_language),
  };
  const prompt = buildLmStudioCvContentPrompt(payload);
  const generationProvider = getCvGenerationProvider();

  try {
    if (generationProvider && isOpenAiCompatibleCvProvider(generationProvider)) {
      try {
        const html = await generateCvWithLmStudio(payload, getCvGenerationLmStudioOptions(), { fallbackOnError: false });
        return res.json({ cv: html, provider: generationProvider });
      } catch (generationError) {
        console.warn('OpenAI-compatible CV Generate error, falling back to Gemini/local template:', generationError.message);
      }
    }

    if (isCustomCvGenerationProvider(generationProvider) && !process.env.CUSTOM_AI_API_URL) {
      console.warn('CV_GENERATION_PROVIDER=custom nhưng chưa cấu hình CUSTOM_AI_API_URL. Falling back to Gemini/local template.');
    }

    // Nếu có CUSTOM_AI_API_URL (Kaggle/Ngrok URL) thì gọi model hiện tại ở /generate.
    if (process.env.CUSTOM_AI_API_URL && (!generationProvider || isCustomCvGenerationProvider(generationProvider))) {
      try {
        const customRes = await fetch(`${process.env.CUSTOM_AI_API_URL}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, ...payload })
        });
        
        if (customRes.ok) {
          const customData = await customRes.json();
          const rawModelText = customData.cv || customData.response || JSON.stringify(customData);
          const html = buildTemplateCvFromModelText(rawModelText, payload);
          return res.json({ cv: html, provider: generationProvider || 'custom-api' });
        }
        console.warn('Custom API failed, falling back to Gemini.');
      } catch (e) {
        console.warn('Error calling Custom API:', e.message, '. Falling back to Gemini.');
      }
    }

    // Fallback: Gemini
    if (!process.env.GEMINI_API_KEY) {
      return res.json({ cv: buildLocalCvHtml(payload), provider: 'local-template' });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
    const result = await model.generateContent(prompt);
    const html = buildTemplateCvFromModelText(result.response.text(), payload);

    res.json({ cv: html });
  } catch (err) {
    console.error('CV Generate error, falling back to local template:', err.message);

    res.json({ cv: buildLocalCvHtml(payload) });
  }
};

/**
 * POST /api/cv/save
 * Lưu CV vào database
 */
exports.saveCV = async (req, res) => {
  const { title, target_role, html_content } = req.body;
  if (!html_content) {
    return res.status(400).json({ error: 'Nội dung CV không được trống' });
  }

  const resolvedLocation = resolveCurrentLocationPayload(req.body);
  if (resolvedLocation.error) {
    return res.status(400).json({ error: resolvedLocation.error });
  }

  try {
    await ensureCvSchema();

    const primaryResult = await pool.query(
      `SELECT id
       FROM user_cvs
       WHERE user_id = $1
         AND is_primary = TRUE
       LIMIT 1`,
      [req.user.id]
    );
    const isPrimary = primaryResult.rows.length === 0;

    const result = await pool.query(
      `INSERT INTO user_cvs (user_id, title, target_role, html_content, is_primary, current_location, current_lat, current_lng) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, is_primary`,
      [
        req.user.id,
        title || 'CV chưa đặt tên',
        target_role || 'Chưa rõ',
        html_content,
        isPrimary,
        resolvedLocation.location,
        resolvedLocation.lat,
        resolvedLocation.lng,
      ]
    );
    res.status(201).json({ message: 'Lưu CV thành công!', id: result.rows[0].id, is_primary: result.rows[0].is_primary });
  } catch (err) {
    console.error('Save CV error:', err);
    res.status(500).json({ error: 'Không thể lưu CV' });
  }
};

/**
 * GET /api/cv/my-cvs
 * Lấy danh sách CV của user
 */
exports.getMyCVs = async (req, res) => {
  try {
    await ensureCvSchema();
    await ensurePrimaryCvForUser(req.user.id);

    const result = await pool.query(
      `SELECT id, title, target_role, html_content, created_at, is_primary, current_location
       FROM user_cvs
       WHERE user_id = $1
       ORDER BY is_primary DESC, created_at DESC, id DESC`,
      [req.user.id]
    );
    res.json({ cvs: result.rows });
  } catch (err) {
    console.error('Get my CVs error:', err);
    res.status(500).json({ error: 'Không thể lấy danh sách CV' });
  }
};

exports.setPrimaryCV = async (req, res) => {
  const { id } = req.params;

  try {
    await ensureCvSchema();

    await pool.query('BEGIN');

    const ownershipResult = await pool.query(
      `SELECT id
       FROM user_cvs
       WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (!ownershipResult.rows.length) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Không tìm thấy CV để đặt làm hồ sơ chính' });
    }

    await pool.query(
      `UPDATE user_cvs
       SET is_primary = FALSE
       WHERE user_id = $1`,
      [req.user.id]
    );

    const result = await pool.query(
      `UPDATE user_cvs
       SET is_primary = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING id, is_primary`,
      [id, req.user.id]
    );

    await pool.query('COMMIT');

    res.json({ message: 'Đã chọn CV chính để nộp hồ sơ', data: result.rows[0] });
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('Set primary CV error:', err);
    res.status(500).json({ error: 'Không thể cập nhật CV chính' });
  }
};

/**
 * POST /api/cv/import-image
 * Upload ảnh CV -> AI trích xuất -> trả HTML CV
 */
exports.importFromImage = async (req, res) => {
  let extracted = null;

  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'Vui lòng chọn ảnh để import' });
    }

    const detectedMimeType = detectImageMime(req.file.buffer);
    if (!detectedMimeType) {
      return res.status(400).json({ error: 'File upload không phải ảnh PNG, JPG hoặc WEBP hợp lệ' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Chưa cấu hình GEMINI_API_KEY để import ảnh' });
    }

    const mimeType = detectedMimeType;
    const base64 = req.file.buffer.toString('base64');

    const extractPrompt = `Bạn là hệ thống trích xuất thông tin CV từ ảnh scan (tiếng Việt).
Hãy đọc nội dung trong ảnh CV và trả về CHỈ 1 JSON hợp lệ (không markdown, không giải thích) theo schema:
{
  "fullName": string,
  "email": string,
  "phone": string,
  "role": string,
  "objective": string,
  "education": string,
  "experience": string,
  "skills": string,
  "certifications": string,
  "hobbies": string,
  "rawText": string,
  "layoutStyle": string,
  "primaryColor": string,
  "sectionOrder": string
}
Nếu không chắc trường nào, để chuỗi rỗng.
"rawText" là toàn bộ text đọc được (nếu có).
"layoutStyle" mô tả ngắn bố cục tổng thể như "1 cột tối giản", "2 cột trái đậm phải sáng", ...
"primaryColor" là màu nhấn nổi bật nếu nhận diện được.
"sectionOrder" mô tả ngắn thứ tự các section chính trong CV.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    const extractResult = await model.generateContent([
      { text: extractPrompt },
      { inlineData: { data: base64, mimeType } },
    ]);

    let extractedText = extractResult.response.text().trim();
    extractedText = extractedText.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();

    try {
      extracted = JSON.parse(extractedText);
    } catch (e) {
      extracted = { rawText: extractedText };
    }

    const {
      fullName = '',
      email = '',
      phone = '',
      role = '',
      objective = '',
      education = '',
      experience = '',
      skills = '',
      certifications = '',
      hobbies = '',
    } = extracted || {};

    return res.json({
      extracted,
      cv: buildLocalCvHtml({
        fullName,
        email,
        phone,
        role,
        objective,
        education,
        experience,
        skills,
        certifications,
        hobbies,
        cvLanguage: 'en',
      }),
    });
  } catch (err) {
    console.error('Import CV from image error:', err);
    if (extracted) {
      return res.json({
        extracted,
        cv: buildLocalCvHtml(extracted),
      });
    }

    return res.status(500).json({ error: 'Không thể import CV từ ảnh' });
  }
};

exports.reviewCVContent = async (req, res) => {
  const htmlContent = req.body?.html_content || req.body?.cv || '';
  const plainText = req.body?.text || '';
  const targetRole = req.body?.target_role || req.body?.role || '';
  const cvLanguage = getCvLanguage(req.body?.cvLanguage || req.body?.cv_language);

  if (!htmlContent && !plainText) {
    return res.status(400).json({ error: 'Nội dung CV không được trống' });
  }

  try {
    const review = await generateCvReview({ htmlContent, plainText, targetRole, cvLanguage });
    res.json({ data: review });
  } catch (err) {
    console.error('Review CV content error:', err);
    res.status(500).json({ error: 'Không thể phân tích CV' });
  }
};

exports.reviewSavedCV = async (req, res) => {
  const { id } = req.params;
  const cvLanguage = getCvLanguage(req.body?.cvLanguage || req.body?.cv_language);

  try {
    await ensureCvSchema();

    const result = await pool.query(
      `SELECT id, title, target_role, html_content
       FROM user_cvs
       WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Không tìm thấy CV hoặc không có quyền xem' });
    }

    const cv = result.rows[0];
    const review = await generateCvReview({
      htmlContent: cv.html_content,
      targetRole: cv.target_role || '',
      cvLanguage,
    });

    res.json({
      data: review,
      cv: {
        id: cv.id,
        title: cv.title,
        target_role: cv.target_role,
      },
    });
  } catch (err) {
    console.error('Review saved CV error:', err);
    res.status(500).json({ error: 'Không thể phân tích CV' });
  }
};

exports.reviseCVContent = async (req, res) => {
  const htmlContent = req.body?.html_content || req.body?.cv || '';
  const targetRole = req.body?.target_role || req.body?.role || '';
  const suggestions = Array.isArray(req.body?.suggestions) ? req.body.suggestions : [];
  const cvLanguage = getCvLanguage(req.body?.cvLanguage || req.body?.cv_language);

  if (!htmlContent) {
    return res.status(400).json({ error: 'Nội dung CV không được trống' });
  }

  try {
    const cv = await generateRevisedCv({ htmlContent, targetRole, suggestions, cvLanguage });
    res.json({ cv });
  } catch (err) {
    console.error('Revise CV content error:', err);
    res.status(500).json({ error: 'Không thể sửa CV theo gợi ý' });
  }
};

exports.reviseSavedCV = async (req, res) => {
  const { id } = req.params;
  const suggestions = Array.isArray(req.body?.suggestions) ? req.body.suggestions : [];

  try {
    await ensureCvSchema();

    const existingResult = await pool.query(
      `SELECT id, title, target_role, html_content
       FROM user_cvs
       WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (!existingResult.rows.length) {
      return res.status(404).json({ error: 'Không tìm thấy CV hoặc không có quyền sửa' });
    }

    const currentCv = existingResult.rows[0];
    const revisedHtml = await generateRevisedCv({
      htmlContent: currentCv.html_content,
      targetRole: currentCv.target_role || '',
      suggestions,
      cvLanguage: getCvLanguage(req.body?.cvLanguage || req.body?.cv_language),
    });

    const updateResult = await pool.query(
      `UPDATE user_cvs
       SET html_content = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, title, target_role, html_content, created_at, is_primary`,
      [revisedHtml, id, req.user.id]
    );

    res.json({ message: 'Đã sửa CV theo gợi ý', data: updateResult.rows[0] });
  } catch (err) {
    console.error('Revise saved CV error:', err);
    res.status(500).json({ error: 'Không thể sửa CV theo gợi ý' });
  }
};

/**
 * DELETE /api/cv/:id
 * Xóa một CV
 */
exports.deleteCV = async (req, res) => {
  const { id } = req.params;
  try {
    await ensureCvSchema();

    await pool.query('BEGIN');

    const existingResult = await pool.query(
      `SELECT id, is_primary
       FROM user_cvs
       WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (existingResult.rowCount === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Không tìm thấy CV hoặc không có quyền xóa' });
    }

    const result = await pool.query(
      'DELETE FROM user_cvs WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (existingResult.rows[0].is_primary) {
      const latestResult = await pool.query(
        `SELECT id
         FROM user_cvs
         WHERE user_id = $1
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
        [req.user.id]
      );

      const nextPrimaryId = latestResult.rows[0]?.id;
      if (nextPrimaryId) {
        await pool.query(
          `UPDATE user_cvs
           SET is_primary = TRUE
           WHERE id = $1 AND user_id = $2`,
          [nextPrimaryId, req.user.id]
        );
      }
    }

    await pool.query('COMMIT');

    res.json({ message: 'Đã xóa CV thành công' });
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('Delete CV error:', err);
    res.status(500).json({ error: 'Không thể xóa CV' });
  }
};
