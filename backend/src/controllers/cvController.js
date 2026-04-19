const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
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
    console.error('CV Generate error:', err);
    res.status(500).json({ error: 'Không thể tạo CV. Vui lòng thử lại.' });
  }
};
