const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pool = require('../../infrastructure/database/postgres');
const { ensureCvSchema, ensurePrimaryCvForUser } = require('./cv.model');
const { resolveCurrentLocationPayload } = require('../../core/utils/currentLocation');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
  return String(text || '')
    .replace(/```html\n?/gi, '')
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();
}

function formatHtmlText(value) {
  return String(value || '').trim().replace(/\n/g, '<br/>');
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

function buildLocalCvHtml({
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
  portraitDataUrl = '',
  currentLocation = '',
} = {}) {
  const resolvedObjective =
    objective?.trim() ||
    (role
      ? `Ứng tuyển vị trí ${role} với định hướng phát triển lâu dài, chủ động học hỏi và tạo giá trị thực tế cho doanh nghiệp.`
      : 'Mong muốn phát triển sự nghiệp trong môi trường chuyên nghiệp, chủ động học hỏi và đóng góp giá trị lâu dài.');
  const resolvedEducation = education?.trim() || 'Bổ sung thông tin học vấn nổi bật, chuyên ngành và thành tích học tập tiêu biểu.';
  const resolvedExperience = experience?.trim() || 'Bổ sung kinh nghiệm làm việc, dự án, vai trò và kết quả nổi bật.';
  const resolvedSkills = skills?.trim() || 'Bổ sung các kỹ năng chuyên môn, công cụ và năng lực mềm liên quan tới vị trí ứng tuyển.';
  const resolvedCertifications = certifications?.trim() || 'Chưa cập nhật';
  const resolvedHobbies = hobbies?.trim() || 'Chưa cập nhật';
  const headerMeta = [
    role?.trim(),
    currentLocation ? `Khu vực: ${currentLocation}` : '',
    email ? `Email: ${email}` : '',
    phone ? `SĐT: ${phone}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

  return `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #243447; line-height: 1.6; background: #ffffff;">
      <div style="display: flex; align-items: center; gap: 22px; margin-bottom: 28px; padding: 28px 32px; border-radius: 28px; background: linear-gradient(135deg, #f5f9ff 0%, #ffffff 55%, #eef4fb 100%); border: 1px solid #dbe7f3;">
        ${portraitDataUrl ? `
          <div style="flex-shrink: 0;">
            <img src="${portraitDataUrl}" alt="${fullName || 'Ảnh chân dung'}" style="width: 112px; height: 112px; object-fit: cover; border-radius: 24px; border: 3px solid #dbe7f3;" />
          </div>
        ` : ''}
        <div style="flex: 1;">
          <div style="display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; background: #1e3a5f; color: #ffffff; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">
            Hồ sơ ứng tuyển
          </div>
          <h1 style="color: #1e3a5f; margin: 16px 0 8px 0; font-size: 32px; line-height: 1.2;">${fullName || 'Tên Ứng Viên'}</h1>
          <p style="margin: 0; font-size: 14px; color: #5b6b7f;">${headerMeta || 'Cập nhật thông tin liên hệ và vị trí ứng tuyển'}</p>
        </div>
      </div>

      ${[
        { title: 'Mục Tiêu Nghề Nghiệp', value: resolvedObjective },
        { title: 'Kinh Nghiệm Làm Việc', value: resolvedExperience },
        { title: 'Học Vấn', value: resolvedEducation },
        { title: 'Kỹ Năng', value: resolvedSkills },
        { title: 'Chứng Chỉ', value: resolvedCertifications },
        { title: 'Sở Thích', value: resolvedHobbies },
      ]
        .map(
          (section) => `
            <div style="margin-bottom: 22px; border: 1px solid #e7eef7; border-radius: 22px; padding: 20px 22px; background: #ffffff;">
              <h2 style="color: #1e3a5f; font-size: 17px; margin: 0 0 12px 0; letter-spacing: 0.04em; text-transform: uppercase;">${section.title}</h2>
              <p style="margin: 0; white-space: pre-wrap; color: #37465a;">${formatHtmlText(section.value)}</p>
            </div>
          `
        )
        .join('')}
    </div>
  `.trim();
}

function buildGeneratePrompt({
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
  portraitDataUrl = '',
  currentLocation = '',
} = {}) {
  return `Bạn là chuyên gia viết CV chuyên nghiệp tại Việt Nam. Hãy tạo một CV hoàn chỉnh bằng tiếng Việt dưới dạng HTML đẹp mắt với inline CSS (không dùng class, không dùng external CSS).

Thông tin ứng viên:
- Họ tên: ${fullName || 'Chưa cung cấp'}
- Email: ${email || 'Chưa cung cấp'}
- Điện thoại: ${phone || 'Chưa cung cấp'}
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
5. Dùng màu xanh navy (#1e3a5f) làm accent color chính.
6. Nếu thông tin nào còn thiếu thì viết gợi ý mẫu ngắn, tự nhiên và phù hợp vị trí ứng tuyển.
7. Nếu có ảnh chân dung thì đặt ảnh ở header, kích thước gọn, chuyên nghiệp.
8. TUYỆT ĐỐI KHÔNG chèn bất kỳ ảnh placeholder nào từ các nguồn bên ngoài (như via.placeholder.com).
9. Chỉ trả về HTML, không thêm markdown hay giải thích.`;
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
- Màu nhấn chính: ${primaryColor || '#1e3a5f'}
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
  const cleaned = cleanModelHtml(text);
  const match = cleaned.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : cleaned);
}

function normalizePriority(priority) {
  const normalized = String(priority || '').toLowerCase();
  return ['high', 'medium', 'low'].includes(normalized) ? normalized : 'medium';
}

function buildCvReviewPrompt({ plainText = '', targetRole = '' } = {}) {
  return `Bạn là chuyên gia tuyển dụng và chỉnh sửa CV tại Việt Nam. Hãy phân tích CV bên dưới và chỉ ra các chỗ cần sửa.

Vị trí mục tiêu: ${targetRole || 'Chưa cung cấp'}

Nội dung CV:
${plainText || '(trống)'}

Yêu cầu:
1. Trả về CHỈ một JSON hợp lệ, không markdown, không giải thích ngoài JSON.
2. Tập trung vào chỗ cần sửa thật cụ thể: thiếu thông tin, câu chữ chung chung, thiếu số liệu, thiếu kỹ năng liên quan, bố cục/độ dài.
3. Không bịa kinh nghiệm mới cho ứng viên. Nếu cần ví dụ, viết ví dụ dạng khung để ứng viên tự điền số liệu thật.
4. Schema JSON:
{
  "score": number,
  "summary": string,
  "strengths": string[],
  "suggestions": [
    {
      "section": string,
      "priority": "high" | "medium" | "low",
      "issue": string,
      "suggestion": string,
      "example": string
    }
  ]
}`;
}

function buildCvRevisionPrompt({ htmlContent = '', targetRole = '', suggestions = [] } = {}) {
  const suggestionText = suggestions
    .map((item, index) => {
      const section = item?.section ? `Phần: ${item.section}` : 'Phần: CV';
      const issue = item?.issue ? `Vấn đề: ${item.issue}` : '';
      const suggestion = item?.suggestion ? `Cách sửa: ${item.suggestion}` : '';
      const example = item?.example ? `Ví dụ tham khảo: ${item.example}` : '';
      return `${index + 1}. ${[section, issue, suggestion, example].filter(Boolean).join(' | ')}`;
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
5. Không chèn script, iframe, external CSS hoặc ảnh placeholder từ bên ngoài.`;
}

function buildLocalCvReview({ plainText = '', targetRole = '' } = {}) {
  const text = String(plainText || '').trim();
  const lower = text.toLowerCase();
  const words = text.match(/[a-zA-ZÀ-ỹ0-9]+/g) || [];
  const suggestions = [];
  const strengths = [];

  const addSuggestion = (section, priority, issue, suggestion, example = '') => {
    suggestions.push({ section, priority, issue, suggestion, example });
  };

  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) {
    strengths.push('Thông tin email đã xuất hiện trong CV.');
  } else {
    addSuggestion(
      'Thông tin liên hệ',
      'high',
      'CV chưa có email hoặc email không rõ ràng.',
      'Bổ sung email chuyên nghiệp ở phần đầu CV để nhà tuyển dụng liên hệ nhanh.',
      'email.tenban@example.com'
    );
  }

  if (/(?:\+?84|0)(?:\d[\s.-]?){8,10}\d/.test(text)) {
    strengths.push('CV đã có số điện thoại liên hệ.');
  } else {
    addSuggestion(
      'Thông tin liên hệ',
      'high',
      'CV chưa có số điện thoại dễ nhận diện.',
      'Thêm số điện thoại ở header, cùng dòng với email hoặc địa chỉ.',
      '09xx xxx xxx'
    );
  }

  if (targetRole && lower.includes(targetRole.toLowerCase())) {
    strengths.push('CV đã bám theo vị trí ứng tuyển mục tiêu.');
  } else if (targetRole) {
    addSuggestion(
      'Định hướng ứng tuyển',
      'medium',
      'CV chưa nêu rõ vị trí mục tiêu.',
      'Đưa vị trí ứng tuyển vào header hoặc phần tóm tắt để CV khớp hơn với tin tuyển dụng.',
      `Ứng tuyển vị trí ${targetRole}`
    );
  }

  if (!/mục tiêu|objective|summary|tóm tắt|giới thiệu/.test(lower)) {
    addSuggestion(
      'Mục tiêu nghề nghiệp',
      'medium',
      'Thiếu phần tóm tắt hoặc mục tiêu nghề nghiệp.',
      'Thêm 2-3 câu tóm tắt năng lực chính, định hướng và giá trị có thể đóng góp.',
      'Có kinh nghiệm về [kỹ năng], mong muốn đóng góp vào [mục tiêu công việc] tại [loại doanh nghiệp].'
    );
  }

  if (/kinh nghiệm|experience|dự án|project/.test(lower)) {
    strengths.push('CV đã có phần kinh nghiệm hoặc dự án.');
  } else {
    addSuggestion(
      'Kinh nghiệm/Dự án',
      'high',
      'CV chưa có phần kinh nghiệm làm việc hoặc dự án nổi bật.',
      'Bổ sung kinh nghiệm theo cấu trúc vai trò, nhiệm vụ, công nghệ/công cụ và kết quả đạt được.',
      '- [Vai trò] tại [Công ty/Dự án]: thực hiện [nhiệm vụ], đạt [kết quả đo được].'
    );
  }

  if (!/\d+/.test(text)) {
    addSuggestion(
      'Kết quả công việc',
      'medium',
      'CV thiếu số liệu chứng minh kết quả.',
      'Thêm số liệu thật về quy mô, thời gian, hiệu suất, số người dùng, doanh thu hoặc mức cải thiện.',
      'Tối ưu quy trình xử lý hồ sơ, giảm thời gian nhập liệu từ [x] phút xuống [y] phút.'
    );
  }

  if (/kỹ năng|skills|công cụ|tools|technology|technologies/.test(lower)) {
    strengths.push('CV đã có nhóm kỹ năng/công cụ.');
  } else {
    addSuggestion(
      'Kỹ năng',
      'high',
      'Thiếu nhóm kỹ năng liên quan đến vị trí ứng tuyển.',
      'Liệt kê kỹ năng chuyên môn, công cụ và kỹ năng mềm sát với mô tả công việc.',
      'Kỹ năng: [công cụ 1], [công cụ 2], [kỹ năng chuyên môn], giao tiếp, làm việc nhóm.'
    );
  }

  if (!/học vấn|education|đại học|cao đẳng|trường/.test(lower)) {
    addSuggestion(
      'Học vấn',
      'low',
      'Phần học vấn chưa rõ hoặc chưa có.',
      'Bổ sung trường, chuyên ngành, thời gian học và thành tích liên quan nếu có.',
      '[Tên trường] - [Chuyên ngành], [năm bắt đầu] - [năm kết thúc]'
    );
  }

  if (words.length < 120) {
    addSuggestion(
      'Độ đầy đủ',
      'high',
      'CV đang khá ngắn, khó thể hiện năng lực.',
      'Mở rộng phần kinh nghiệm, dự án, kỹ năng và thành tích để nhà tuyển dụng có đủ dữ liệu đánh giá.',
      'Mỗi kinh nghiệm nên có 2-4 gạch đầu dòng mô tả việc đã làm và kết quả.'
    );
  } else if (words.length > 900) {
    addSuggestion(
      'Độ dài',
      'medium',
      'CV có thể đang quá dài.',
      'Rút gọn nội dung ít liên quan, ưu tiên 1-2 trang với thông tin sát vị trí ứng tuyển.',
      'Giữ các kinh nghiệm gần nhất và có tác động rõ nhất.'
    );
  } else {
    strengths.push('Độ dài CV đang ở mức có thể đọc nhanh.');
  }

  if (!suggestions.length) {
    addSuggestion(
      'Tối ưu cuối',
      'low',
      'CV đã có cấu trúc cơ bản tốt nhưng vẫn có thể cá nhân hóa thêm.',
      'So khớp từng kỹ năng và thành tích với mô tả công việc trước khi nộp.',
      'Điều chỉnh phần tóm tắt để nhắc đúng tên vị trí và 2-3 yêu cầu chính của tin tuyển dụng.'
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
      ? 'CV cần bổ sung một số thông tin quan trọng trước khi dùng để ứng tuyển.'
      : 'CV đã có nền tảng ổn, nên tinh chỉnh thêm để tăng mức độ phù hợp với vị trí.',
    strengths: [...new Set(strengths)].slice(0, 5),
    suggestions: suggestions.slice(0, 8),
  };
}

function sanitizeCvReview(rawReview, fallbackReview) {
  const suggestions = Array.isArray(rawReview?.suggestions)
    ? rawReview.suggestions
        .map((item) => ({
          section: String(item?.section || 'CV').trim(),
          priority: normalizePriority(item?.priority),
          issue: String(item?.issue || '').trim(),
          suggestion: String(item?.suggestion || '').trim(),
          example: String(item?.example || '').trim(),
        }))
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

async function generateCvReview({ htmlContent = '', plainText = '', targetRole = '' } = {}) {
  const text = (plainText || stripHtmlContent(htmlContent)).slice(0, 12000);
  const fallbackReview = buildLocalCvReview({ plainText: text, targetRole });

  if (!process.env.GEMINI_API_KEY) {
    return fallbackReview;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
    const result = await model.generateContent(buildCvReviewPrompt({ plainText: text, targetRole }));
    const parsed = extractJsonObject(result.response.text());
    return sanitizeCvReview(parsed, fallbackReview);
  } catch (err) {
    console.error('CV review AI error, using local fallback:', err.message);
    return fallbackReview;
  }
}

function buildLocalRevisedCvHtml({ htmlContent = '', suggestions = [] } = {}) {
  const normalizedSuggestions = suggestions
    .map((item) => ({
      section: String(item?.section || 'CV').trim(),
      suggestion: String(item?.suggestion || '').trim(),
      example: String(item?.example || '').trim(),
    }))
    .filter((item) => item.suggestion);

  if (!normalizedSuggestions.length) return htmlContent;

  const suggestionItems = normalizedSuggestions
    .map((item) => `
      <li style="margin-bottom: 10px;">
        <strong>${formatSafeHtmlText(item.section)}:</strong> ${formatSafeHtmlText(item.suggestion)}
        ${item.example ? `<br/><span style="color: #64748b;">Ví dụ: ${formatSafeHtmlText(item.example)}</span>` : ''}
      </li>
    `)
    .join('');

  const patchBlock = `
    <div style="margin: 22px 0; border: 1px solid #fbbf24; border-radius: 18px; padding: 18px 20px; background: #fffbeb; color: #374151;">
      <h2 style="margin: 0 0 12px 0; color: #92400e; font-size: 16px; text-transform: uppercase; letter-spacing: 0.04em;">Thông tin cần cập nhật</h2>
      <ul style="margin: 0; padding-left: 20px;">${suggestionItems}</ul>
    </div>
  `;

  if (String(htmlContent || '').includes('</div>')) {
    return String(htmlContent).replace(/<\/div>\s*$/i, `${patchBlock}</div>`);
  }

  return `${htmlContent}${patchBlock}`;
}

async function generateRevisedCv({ htmlContent = '', targetRole = '', suggestions = [] } = {}) {
  const fallbackHtml = buildLocalRevisedCvHtml({ htmlContent, suggestions });

  if (!process.env.GEMINI_API_KEY) {
    return fallbackHtml;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
    const result = await model.generateContent(buildCvRevisionPrompt({ htmlContent, targetRole, suggestions }));
    const html = cleanModelHtml(result.response.text());
    return html || fallbackHtml;
  } catch (err) {
    console.error('CV revise AI error, using local fallback:', err.message);
    return fallbackHtml;
  }
}

/**
 * GET /api/cv/suggestions
 * Lấy dữ liệu gợi ý từ Resume Knowledge Base
 */
exports.getSuggestions = (req, res) => {
  try {
    const kbPath = path.join(__dirname, 'resume_knowledge.json');
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
  const { fullName, email, phone, role, objective, education, experience, skills, certifications, hobbies, portraitDataUrl } = req.body;
  const resolvedLocation = resolveCurrentLocationPayload(req.body);

  if (resolvedLocation.error) {
    return res.status(400).json({ error: resolvedLocation.error });
  }

  const payload = {
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
    portraitDataUrl,
    currentLocation: resolvedLocation.location,
  };
  const prompt = buildGeneratePrompt(payload);

  try {
    // Nếu có CUSTOM_AI_API_URL (Kaggle Ngrok URL) thì gọi tới đó
    if (process.env.CUSTOM_AI_API_URL) {
      try {
        const customRes = await fetch(`${process.env.CUSTOM_AI_API_URL}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt })
        });
        
        if (customRes.ok) {
          const customData = await customRes.json();
          let html = cleanModelHtml(customData.cv || customData.response || '');
          html = mergePortraitIntoHtml(html, portraitDataUrl, fullName);
          return res.json({ cv: html });
        }
        console.log('Custom API failed, falling back to Gemini...');
      } catch (e) {
        console.log('Error calling Custom API:', e.message, '. Falling back to Gemini...');
      }
    }

    // Fallback: Gemini
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Chưa cấu hình API Key cho AI. Vui lòng thêm GEMINI_API_KEY hoặc bật Kaggle Model.' });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
    const result = await model.generateContent(prompt);
    const response = result.response;
    let text = cleanModelHtml(response.text());

    text = mergePortraitIntoHtml(text, portraitDataUrl, fullName);

    res.json({ cv: text });
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

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Chưa cấu hình GEMINI_API_KEY để import ảnh' });
    }

    const mimeType = req.file.mimetype || 'image/png';
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
      rawText = '',
      layoutStyle = '',
      primaryColor = '',
      sectionOrder = '',
    } = extracted || {};

    try {
      const buildPrompt = buildImportHtmlPrompt({
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
        rawText,
        layoutStyle,
        primaryColor,
        sectionOrder,
      });

      const buildResult = await model.generateContent([
        { text: buildPrompt },
        { inlineData: { data: base64, mimeType } },
      ]);
      const html = cleanModelHtml(buildResult.response.text());

      return res.json({ extracted, cv: html });
    } catch (buildError) {
      console.error('Build CV HTML from image error, using local fallback:', buildError);

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
        }),
      });
    }
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

  if (!htmlContent && !plainText) {
    return res.status(400).json({ error: 'Nội dung CV không được trống' });
  }

  try {
    const review = await generateCvReview({ htmlContent, plainText, targetRole });
    res.json({ data: review });
  } catch (err) {
    console.error('Review CV content error:', err);
    res.status(500).json({ error: 'Không thể phân tích CV' });
  }
};

exports.reviewSavedCV = async (req, res) => {
  const { id } = req.params;

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

  if (!htmlContent) {
    return res.status(400).json({ error: 'Nội dung CV không được trống' });
  }

  try {
    const cv = await generateRevisedCv({ htmlContent, targetRole, suggestions });
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
