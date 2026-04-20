const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pool = require('../config/db');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
  const { fullName, email, phone, objective, education, experience, skills, certifications, hobbies } = req.body;

  const prompt = `Bạn là chuyên gia viết CV chuyên nghiệp tại Việt Nam. Hãy tạo một CV hoàn chỉnh bằng tiếng Việt dưới dạng HTML đẹp mắt với inline CSS (không dùng class, không dùng external CSS).

Thông tin ứng viên:
- Họ tên: ${fullName || 'Chưa cung cấp'}
- Email: ${email || 'Chưa cung cấp'}
- Điện thoại: ${phone || 'Chưa cung cấp'}
- Mục tiêu nghề nghiệp: ${objective || 'Chưa cung cấp'}
- Học vấn: ${education || 'Chưa cung cấp'}
- Kinh nghiệm làm việc: ${experience || 'Chưa cung cấp'}
- Kỹ năng: ${skills || 'Chưa cung cấp'}
- Chứng chỉ: ${certifications || 'Không có'}
- Sở thích: ${hobbies || 'Không có'}

Yêu cầu format CV:
1. Dùng HTML thuần với inline CSS (vì sẽ render trực tiếp và xuất PDF)
2. Thiết kế hiện đại, chuyên nghiệp, 1 cột, font sans-serif
3. Header có tên lớn, thông tin liên hệ
4. Các section rõ ràng: Mục tiêu, Học vấn, Kinh nghiệm, Kỹ năng, Chứng chỉ
5. Dùng màu xanh navy (#1e3a5f) làm accent color
6. Trang A4 (max-width: 800px, margin auto)
7. Nếu thông tin nào "Chưa cung cấp" thì hãy viết gợi ý mẫu phù hợp
8. CHỈ trả về HTML, không giải thích gì thêm`;

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
          let html = customData.cv || customData.response || '';
          html = html.replace(/```html\n?/gi, '').replace(/```\n?/g, '').trim();
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
    let text = response.text();

    // Clean markdown code fences if any
    text = text.replace(/```html\n?/gi, '').replace(/```\n?/g, '').trim();

    res.json({ cv: text });
  } catch (err) {
    console.error('CV Generate error, falling back to local template:', err.message);
    
    // Fallback Local HTML Generation (No AI required)
    const fallbackHtml = `
      <div style="font-family: sans-serif; max-width: 800px; margin: 0 auto; color: #333; line-height: 1.6;">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1e3a5f; padding-bottom: 20px;">
          <h1 style="color: #1e3a5f; margin: 0; font-size: 28px;">${fullName || 'Tên Ứng Viên'}</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">
            ${email ? 'Email: ' + email : ''} ${phone ? ' | SĐT: ' + phone : ''}
          </p>
        </div>

        ${objective ? `
        <div style="margin-bottom: 25px;">
          <h2 style="color: #1e3a5f; font-size: 18px; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px;">Mục Tiêu Nghề Nghiệp</h2>
          <p style="margin: 0;">${objective.replace(/\\n/g, '<br/>')}</p>
        </div>` : ''}

        ${experience ? `
        <div style="margin-bottom: 25px;">
          <h2 style="color: #1e3a5f; font-size: 18px; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px;">Kinh Nghiệm Làm Việc</h2>
          <p style="margin: 0; white-space: pre-wrap;">${experience}</p>
        </div>` : ''}

        ${education ? `
        <div style="margin-bottom: 25px;">
          <h2 style="color: #1e3a5f; font-size: 18px; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px;">Học Vấn</h2>
          <p style="margin: 0; white-space: pre-wrap;">${education}</p>
        </div>` : ''}

        ${skills ? `
        <div style="margin-bottom: 25px;">
          <h2 style="color: #1e3a5f; font-size: 18px; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px;">Kỹ Năng</h2>
          <p style="margin: 0; white-space: pre-wrap;">${skills}</p>
        </div>` : ''}

        ${certifications ? `
        <div style="margin-bottom: 25px;">
          <h2 style="color: #1e3a5f; font-size: 18px; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px;">Chứng Chỉ</h2>
          <p style="margin: 0; white-space: pre-wrap;">${certifications}</p>
        </div>` : ''}

        ${hobbies ? `
        <div style="margin-bottom: 25px;">
          <h2 style="color: #1e3a5f; font-size: 18px; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px;">Sở Thích</h2>
          <p style="margin: 0; white-space: pre-wrap;">${hobbies}</p>
        </div>` : ''}
      </div>
    `;

    res.json({ cv: fallbackHtml.trim() });
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
    const result = await pool.query(
      `INSERT INTO user_cvs (user_id, title, target_role, html_content) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [req.user.id, title || 'CV chưa đặt tên', target_role || 'Chưa rõ', html_content]
    );
    res.status(201).json({ message: 'Lưu CV thành công!', id: result.rows[0].id });
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
    const result = await pool.query(
      'SELECT id, title, target_role, html_content, created_at FROM user_cvs WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ cvs: result.rows });
  } catch (err) {
    console.error('Get my CVs error:', err);
    res.status(500).json({ error: 'Không thể lấy danh sách CV' });
  }
};

/**
 * POST /api/cv/import-image
 * Upload ảnh CV -> AI trích xuất -> trả HTML CV
 */
exports.importFromImage = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'Vui lòng chọn ảnh để import' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Chưa cấu hình GEMINI_API_KEY để import ảnh' });
    }

    const mimeType = req.file.mimetype || 'image/png';
    const base64 = req.file.buffer.toString('base64');

    const extractPrompt = `Bạn là hệ thống trích xuất thông tin CV từ ảnh (tiếng Việt).
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
  "rawText": string
}
Nếu không chắc trường nào, để chuỗi rỗng. "rawText" là toàn bộ text đọc được (nếu có).`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const extractResult = await model.generateContent([
      { text: extractPrompt },
      { inlineData: { data: base64, mimeType } },
    ]);

    let extractedText = extractResult.response.text().trim();
    extractedText = extractedText.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();

    let extracted;
    try {
      extracted = JSON.parse(extractedText);
    } catch (e) {
      // Nếu model trả không đúng JSON, vẫn trả rawText để frontend hiển thị
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
    } = extracted || {};

    const buildPrompt = `Bạn là chuyên gia viết CV chuyên nghiệp tại Việt Nam.
Hãy tạo một CV hoàn chỉnh bằng tiếng Việt dưới dạng HTML đẹp mắt với inline CSS (không dùng class, không dùng external CSS).

Thông tin ứng viên (được trích xuất từ ảnh):
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

Text thô (tham khảo thêm nếu thiếu thông tin):
${rawText || '(không có)'}

Yêu cầu format CV:
1. Dùng HTML thuần với inline CSS (vì sẽ render trực tiếp và xuất PDF)
2. Thiết kế hiện đại, chuyên nghiệp, 1 cột, font sans-serif
3. Header có tên lớn, thông tin liên hệ
4. Các section rõ ràng: Mục tiêu, Học vấn, Kinh nghiệm, Kỹ năng, Chứng chỉ
5. Dùng màu xanh navy (#1e3a5f) làm accent color
6. Trang A4 (max-width: 800px, margin auto)
7. Nếu thông tin nào "Chưa cung cấp" thì hãy viết gợi ý mẫu phù hợp
8. CHỈ trả về HTML, không giải thích gì thêm`;

    const buildResult = await model.generateContent(buildPrompt);
    let html = buildResult.response.text();
    html = html.replace(/```html\n?/gi, '').replace(/```\n?/g, '').trim();

    return res.json({ extracted, cv: html });
  } catch (err) {
    console.error('Import CV from image error:', err);
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
    const result = await pool.query(
      'DELETE FROM user_cvs WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy CV hoặc không có quyền xóa' });
    }
    res.json({ message: 'Đã xóa CV thành công' });
  } catch (err) {
    console.error('Delete CV error:', err);
    res.status(500).json({ error: 'Không thể xóa CV' });
  }
};
