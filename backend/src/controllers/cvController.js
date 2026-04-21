const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pool = require('../config/db');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
let cvSchemaReady = false;

async function ensureCvSchema() {
  if (cvSchemaReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_cvs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      target_role VARCHAR(255),
      html_content TEXT NOT NULL,
      is_primary BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    ALTER TABLE user_cvs
    ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE
  `);

  cvSchemaReady = true;
}

async function ensurePrimaryCvForUser(userId) {
  await ensureCvSchema();

  const primaryResult = await pool.query(
    `SELECT id
     FROM user_cvs
     WHERE user_id = $1
       AND is_primary = TRUE
     LIMIT 1`,
    [userId]
  );

  if (primaryResult.rows.length > 0) {
    return primaryResult.rows[0].id;
  }

  const latestResult = await pool.query(
    `SELECT id
     FROM user_cvs
     WHERE user_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [userId]
  );

  const latestCvId = latestResult.rows[0]?.id;
  if (!latestCvId) return null;

  await pool.query(
    `UPDATE user_cvs
     SET is_primary = TRUE
     WHERE id = $1 AND user_id = $2`,
    [latestCvId, userId]
  );

  return latestCvId;
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
  return String(text || '')
    .replace(/```html\n?/gi, '')
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();
}

function formatHtmlText(value) {
  return String(value || '').trim().replace(/\n/g, '<br/>');
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
  const headerMeta = [role?.trim(), email ? `Email: ${email}` : '', phone ? `SĐT: ${phone}` : '']
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
} = {}) {
  return `Bạn là chuyên gia viết CV chuyên nghiệp tại Việt Nam. Hãy tạo một CV hoàn chỉnh bằng tiếng Việt dưới dạng HTML đẹp mắt với inline CSS (không dùng class, không dùng external CSS).

Thông tin ứng viên:
- Họ tên: ${fullName || 'Chưa cung cấp'}
- Email: ${email || 'Chưa cung cấp'}
- Điện thoại: ${phone || 'Chưa cung cấp'}
- Vị trí ứng tuyển: ${role || 'Chưa cung cấp'}
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
8. Chỉ trả về HTML, không thêm markdown hay giải thích.`;
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
6. Chỉ trả về HTML hoàn chỉnh, không markdown, không giải thích.`;
}

/**
 * GET /api/cv/suggestions
 * Lấy dữ liệu gợi ý từ Resume Knowledge Base
 */
exports.getSuggestions = (req, res) => {
  try {
    const kbPath = path.join(__dirname, '../data/resume_knowledge.json');
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
  const payload = { fullName, email, phone, role, objective, education, experience, skills, certifications, hobbies, portraitDataUrl };
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

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
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
      `INSERT INTO user_cvs (user_id, title, target_role, html_content, is_primary) 
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, is_primary`,
      [req.user.id, title || 'CV chưa đặt tên', target_role || 'Chưa rõ', html_content, isPrimary]
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
      `SELECT id, title, target_role, html_content, created_at, is_primary
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

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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
