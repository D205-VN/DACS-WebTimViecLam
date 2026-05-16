const pool = require('../../infrastructure/database/postgres');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini for scoring mock
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'mock-api-key');

const MCQ_KEYS = ['A', 'B', 'C', 'D'];
const ALLOWED_QUESTION_TYPES = new Set(['mcq', 'essay']);
const ALLOWED_DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const LIVEAVATAR_API_URL = (process.env.LIVEAVATAR_API_URL || 'https://api.liveavatar.com').replace(/\/+$/, '');

function parseBooleanEnv(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(value).trim().toLowerCase());
}

function pickLiveAvatarToken(data) {
  return data?.sessionToken
    || data?.session_token
    || data?.token
    || data?.access_token
    || data?.data?.sessionToken
    || data?.data?.session_token
    || data?.data?.token
    || data?.data?.access_token
    || null;
}

function buildLiveAvatarPayload(body = {}) {
  const mode = String(body.mode || process.env.LIVEAVATAR_MODE || 'LITE').trim().toUpperCase();
  const avatarId = body.avatar_id || process.env.LIVEAVATAR_AVATAR_ID;
  const voiceId = body.voice_id || process.env.LIVEAVATAR_VOICE_ID;
  const contextId = body.context_id || process.env.LIVEAVATAR_CONTEXT_ID;
  const language = body.language || process.env.LIVEAVATAR_LANGUAGE || 'vi';
  const videoEncoding = body.video_encoding || process.env.LIVEAVATAR_VIDEO_ENCODING || 'VP8';
  const videoQuality = body.video_quality || process.env.LIVEAVATAR_VIDEO_QUALITY || 'medium';
  const disableGreeting = body.disable_greeting !== undefined
    ? Boolean(body.disable_greeting)
    : parseBooleanEnv(process.env.LIVEAVATAR_DISABLE_GREETING, true);
  const isSandbox = body.is_sandbox !== undefined
    ? Boolean(body.is_sandbox)
    : parseBooleanEnv(process.env.LIVEAVATAR_IS_SANDBOX, true);

  const payload = {
    mode,
    avatar_id: avatarId,
    is_sandbox: isSandbox,
    video_settings: {
      encoding: videoEncoding,
      quality: videoQuality,
    },
  };

  if (voiceId || contextId || language || disableGreeting) {
    payload.avatar_persona = {
      language,
      disable_greeting: disableGreeting,
    };
    if (voiceId) payload.avatar_persona.voice_id = voiceId;
    if (contextId) payload.avatar_persona.context_id = contextId;
  }

  return payload;
}

function compactText(value = '') {
  return String(value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePhraseKey(value = '') {
  return compactText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/node\.?\s*js/g, 'nodejs')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function removeRepeatedWords(value = '') {
  const words = compactText(value).split(/\s+/).filter(Boolean);
  const cleaned = [];
  words.forEach((word) => {
    if (normalizePhraseKey(word) !== normalizePhraseKey(cleaned[cleaned.length - 1] || '')) {
      cleaned.push(word);
    }
  });
  return cleaned.join(' ');
}

function samePhrase(left, right) {
  const leftKey = normalizePhraseKey(left);
  const rightKey = normalizePhraseKey(right);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function clampRatio(value, fallback = 0.7) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, parsed));
}

function normalizeQuestionType(value, fallback = 'mcq') {
  const normalized = compactText(value).toLowerCase();
  if (['multiple_choice', 'multiple-choice', 'multiple choice', 'choice', 'quiz', 'trac nghiem', 'trắc nghiệm'].includes(normalized)) {
    return 'mcq';
  }
  if (['short_answer', 'short-answer', 'short answer', 'written', 'text', 'voice', 'tu_luan', 'tu luan', 'tự luận'].includes(normalized)) {
    return 'essay';
  }
  return ALLOWED_QUESTION_TYPES.has(normalized) ? normalized : fallback;
}

function normalizeDifficulty(value) {
  const normalized = compactText(value).toLowerCase();
  return ALLOWED_DIFFICULTIES.has(normalized) ? normalized : 'medium';
}

function parseOptionsInput(options) {
  if (!options) return {};
  if (typeof options === 'string') {
    try {
      return parseOptionsInput(JSON.parse(options));
    } catch {
      return {};
    }
  }

  if (Array.isArray(options)) {
    return options.slice(0, 4).reduce((acc, option, index) => {
      const key = MCQ_KEYS[index];
      const value = typeof option === 'object' && option !== null
        ? option.text || option.content || option.value || option.answer || option.label
        : option;
      acc[key] = compactText(value);
      return acc;
    }, {});
  }

  if (typeof options === 'object') {
    return MCQ_KEYS.reduce((acc, key) => {
      const raw = options[key] ?? options[key.toLowerCase()];
      const value = typeof raw === 'object' && raw !== null
        ? raw.text || raw.content || raw.value || raw.answer || raw.label
        : raw;
      acc[key] = compactText(value);
      return acc;
    }, {});
  }

  return {};
}

function normalizeCorrectAnswer(value, options) {
  const raw = compactText(value);
  if (!raw) return null;

  const directKey = raw.toUpperCase().match(/^[A-D](?=\.|\)|:|\s|$)/)?.[0];
  if (directKey && options[directKey]) return directKey;

  const mentionedKey = raw.toUpperCase().match(/(?:ĐÁP ÁN|PHƯƠNG ÁN|OPTION|ANSWER)\s*([A-D])(?=\.|\)|:|\s|$)/)?.[1];
  if (mentionedKey && options[mentionedKey]) return mentionedKey;

  const normalizedRaw = raw.toLowerCase();
  const matchedKey = MCQ_KEYS.find((key) => options[key] && options[key].toLowerCase() === normalizedRaw);
  if (matchedKey) return matchedKey;

  return null;
}

function normalizeKeywords(value, fallbackKeywords = []) {
  if (Array.isArray(value)) {
    return value.map(compactText).filter(Boolean).join(', ');
  }
  const normalized = compactText(value);
  if (normalized) return normalized;
  return fallbackKeywords.map(compactText).filter(Boolean).slice(0, 5).join(', ');
}

function syncMcqExpectedAnswer(question) {
  const correctAnswer = compactText(question?.correct_answer).toUpperCase();
  if (question?.type !== 'mcq' || !MCQ_KEYS.includes(correctAnswer) || !question.expected_answer) {
    return question;
  }

  const expectedAnswer = compactText(question.expected_answer);
  const syncedExpectedAnswer = expectedAnswer
    .replace(/^(Đáp\s*án)\s+[A-D](\s+đúng\b)/i, `$1 ${correctAnswer}$2`)
    .replace(/^(Giải\s*thích\s+vì\s+sao)\s+[A-D](\s+đúng\b)/i, `$1 ${correctAnswer}$2`);

  return {
    ...question,
    expected_answer: syncedExpectedAnswer,
  };
}

function syncQuestionListExpectedAnswers(questions = []) {
  return questions.map(syncMcqExpectedAnswer);
}

function getQuestionFingerprint(content) {
  return compactText(content)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/node\.?\s*js/g, 'nodejs')
    .replace(/\b(mock|cau|question|trac nghiem|tu luan|essay|mcq)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isDuplicateQuestion(question, usedFingerprints) {
  const fingerprint = getQuestionFingerprint(question?.content);
  return Boolean(fingerprint && usedFingerprints.has(fingerprint));
}

function markQuestionAsUsed(question, usedFingerprints) {
  const fingerprint = getQuestionFingerprint(question?.content);
  if (fingerprint) usedFingerprints.add(fingerprint);
}

function normalizeQuestionPayload(input = {}, { expectedType = null, fallbackKeywords = [] } = {}) {
  const type = normalizeQuestionType(input.type, expectedType || 'mcq');
  const normalized = {
    content: compactText(input.content || input.question || input.prompt || input.text),
    type,
    difficulty: normalizeDifficulty(input.difficulty),
    correct_answer: null,
    expected_answer: compactText(input.expected_answer || input.expectedAnswer || input.model_answer || input.explanation),
    keywords: normalizeKeywords(input.keywords, fallbackKeywords),
    video_url: compactText(input.video_url || input.videoUrl),
    options: null,
  };

  if (!normalized.content) return null;

  if (type === 'mcq') {
    const options = parseOptionsInput(input.options || input.answers || input.choices);
    const nonEmptyKeys = MCQ_KEYS.filter((key) => options[key]);
    const correctAnswer = normalizeCorrectAnswer(
      input.correct_answer || input.correctAnswer || input.answer || input.correct,
      options
    );

    if (nonEmptyKeys.length < 2 || !correctAnswer) return null;
    normalized.correct_answer = correctAnswer;
    normalized.options = MCQ_KEYS.reduce((acc, key) => {
      if (options[key]) acc[key] = options[key];
      return acc;
    }, {});
  }

  if (type === 'essay') {
    normalized.correct_answer = null;
    normalized.options = null;
  }

  return syncMcqExpectedAnswer(normalized);
}

function extractSkillPhrases(text, subject) {
  const uniqueParts = [subject, text]
    .map(removeRepeatedWords)
    .filter(Boolean)
    .filter((part, index, parts) => parts.findIndex((candidate) => samePhrase(candidate, part)) === index);
  const source = removeRepeatedWords(uniqueParts.join(' '));
  const sourceLower = source.toLowerCase();
  const knownTerms = [
    'React', 'Node.js', 'Nodejs', 'Express', 'JavaScript', 'TypeScript', 'PostgreSQL', 'MongoDB',
    'REST API', 'Docker', 'AWS', 'Azure', 'Git', 'HTML/CSS', 'Tailwind',
    'Marketing', 'SEO', 'Sales', 'CRM', 'Chăm sóc khách hàng', 'Tư vấn bán hàng',
    'Phân tích dữ liệu', 'Quản lý dự án', 'Giao tiếp', 'Làm việc nhóm',
  ];

  const skills = knownTerms.filter((term) => sourceLower.includes(term.toLowerCase()));
  const fallbackWords = source
    .split(/[,\n.;:()\-]+|\s{2,}/)
    .map(compactText)
    .filter((word) => word.length >= 4 && word.length <= 40)
    .map(removeRepeatedWords)
    .slice(0, 8);

  return [...skills, ...fallbackWords]
    .filter(Boolean)
    .filter((skill, index, allSkills) => allSkills.findIndex((candidate) => samePhrase(candidate, skill)) === index)
    .slice(0, 8);
}

function hashString(value = '') {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shuffleMcqOptions(question, seed = '') {
  if (question?.type !== 'mcq' || !question.options || !question.correct_answer) return question;

  const entries = MCQ_KEYS
    .filter((key) => question.options[key])
    .map((key) => [key, question.options[key]]);
  if (entries.length < 2) return question;

  const sortedEntries = [...entries].sort((left, right) => {
    const leftHash = hashString(`${seed}:${question.content}:${left[0]}:${left[1]}`);
    const rightHash = hashString(`${seed}:${question.content}:${right[0]}:${right[1]}`);
    return leftHash - rightHash;
  });

  const shuffledOptions = {};
  let shuffledCorrectAnswer = question.correct_answer;
  sortedEntries.forEach(([oldKey, text], index) => {
    const newKey = MCQ_KEYS[index];
    shuffledOptions[newKey] = text;
    if (oldKey === question.correct_answer) shuffledCorrectAnswer = newKey;
  });

  return syncMcqExpectedAnswer({
    ...question,
    options: shuffledOptions,
    correct_answer: shuffledCorrectAnswer,
  });
}

function buildFallbackQuestion(type, index, context) {
  const subject = removeRepeatedWords(context.targetSubject) || 'vị trí tuyển dụng';
  const skills = context.skills?.length ? context.skills : [subject];
  const rawSkill = removeRepeatedWords(skills[index % skills.length]);
  const aspect = [
    'xác định yêu cầu',
    'xử lý tình huống',
    'đo lường kết quả',
    'kiểm soát rủi ro',
    'phối hợp với các bên',
    'tối ưu quy trình',
    'ra quyết định dựa trên dữ liệu',
    'đảm bảo chất lượng',
    'ưu tiên công việc',
    'cải tiến sau triển khai',
  ][index % 10];
  const scenario = [
    'khi deadline gấp',
    'khi dữ liệu đầu vào chưa rõ',
    'khi khách hàng thay đổi yêu cầu',
    'khi kết quả ban đầu không đạt kỳ vọng',
    'khi cần bàn giao cho đội khác',
    'khi phải cân bằng chất lượng và tốc độ',
  ][Math.floor(index / 2) % 6];
  const skill = samePhrase(rawSkill, subject) ? aspect : rawSkill;
  const scope = samePhrase(rawSkill, subject) ? subject : `${skill} trong ${subject}`;
  const skillAction = samePhrase(rawSkill, subject) ? `khía cạnh ${aspect}` : skill;

  if (type === 'mcq') {
    const templates = [
      {
        content: `Khi đánh giá năng lực ${scope}, tiêu chí nào phản ánh đúng nhất khả năng làm việc thực tế của ứng viên?`,
        options: {
          A: `Ứng viên giải thích được quy trình, rủi ro và cách đo kết quả khi áp dụng ${skillAction}`,
          B: `Ứng viên chỉ nêu khái niệm chung về ${skillAction} nhưng không có ví dụ`,
          C: 'Ứng viên chọn giải pháp theo cảm tính, không dựa trên yêu cầu',
          D: 'Ứng viên bỏ qua phản hồi của khách hàng hoặc người dùng',
        },
        expected_answer: `Đáp án A đúng vì đánh giá được cả hiểu biết, cách triển khai và kết quả thực tế của ${scope}.`,
      },
      {
        content: `Trong một nhiệm vụ liên quan đến ${subject}, bước nào nên được ưu tiên trước khi triển khai ${skillAction}?`,
        options: {
          A: 'Làm rõ mục tiêu, phạm vi, dữ liệu đầu vào và tiêu chí nghiệm thu',
          B: 'Triển khai ngay để tiết kiệm thời gian phân tích',
          C: 'Chỉ tập trung vào công cụ mà bỏ qua bối cảnh kinh doanh',
          D: 'Chờ đến cuối dự án mới kiểm tra rủi ro',
        },
        expected_answer: 'Đáp án A đúng vì bước làm rõ yêu cầu giúp giảm sai lệch và tăng khả năng đo lường kết quả.',
      },
      {
        content: `Tình huống nào cho thấy ứng viên có tư duy giải quyết vấn đề tốt với ${scope}?`,
        options: {
          A: 'Xác định nguyên nhân gốc, đề xuất nhiều phương án và chọn phương án dựa trên dữ liệu',
          B: 'Chỉ làm theo một cách quen thuộc dù điều kiện đã thay đổi',
          C: 'Đổ lỗi cho yếu tố bên ngoài mà không kiểm chứng giả thuyết',
          D: 'Bỏ qua tài liệu và không trao đổi với bên liên quan',
        },
        expected_answer: 'Đáp án A đúng vì thể hiện tư duy phân tích, so sánh phương án và ra quyết định có cơ sở.',
      },
      {
        content: `Trong bối cảnh ${scenario}, cách tiếp cận nào phù hợp nhất để áp dụng ${skillAction} cho ${subject}?`,
        options: {
          A: `Phân tích mục tiêu, giới hạn nguồn lực, rủi ro và chọn giải pháp ${skillAction} có thể kiểm chứng`,
          B: 'Ưu tiên làm nhanh mà không cần tiêu chí đánh giá',
          C: 'Chỉ hỏi lại yêu cầu mà không đề xuất hướng xử lý',
          D: 'Đẩy toàn bộ quyết định sang bên liên quan khác',
        },
        expected_answer: `Đáp án A đúng vì kết hợp phân tích bối cảnh, kiểm soát rủi ro và khả năng xác minh khi dùng ${scope}.`,
      },
      {
        content: `Nếu cần đánh giá khía cạnh ${aspect} trong công việc ${subject}, câu trả lời nào thể hiện năng lực ${scope} tốt nhất?`,
        options: {
          A: 'Nêu được mục tiêu, hành động cụ thể, chỉ số đo lường và bài học sau khi thực hiện',
          B: 'Chỉ mô tả công việc đã làm mà không có kết quả',
          C: 'Dùng nhiều thuật ngữ nhưng không gắn với tình huống thực tế',
          D: 'Tránh nói về khó khăn hoặc sai sót từng gặp',
        },
        expected_answer: 'Đáp án A đúng vì câu trả lời có đủ mục tiêu, hành động, kết quả và khả năng tự cải thiện.',
      },
      {
        content: `Khi triển khai ${skillAction} cho ${subject}, dấu hiệu nào cho thấy ứng viên hiểu đúng yêu cầu chuyên môn?`,
        options: {
          A: 'Biết tách vấn đề thành các bước kiểm chứng được và giải thích vì sao chọn từng bước',
          B: 'Chỉ chọn công cụ phổ biến nhất mà không so sánh phương án',
          C: 'Tập trung vào cảm nhận cá nhân thay vì tiêu chí công việc',
          D: 'Không đề cập cách xử lý lỗi hoặc ngoại lệ',
        },
        expected_answer: 'Đáp án A đúng vì thể hiện tư duy hệ thống và khả năng giải thích quyết định chuyên môn.',
      },
      {
        content: `Trong quá trình làm ${subject}, yếu tố nào quan trọng nhất để tránh sai lệch khi sử dụng ${skillAction}?`,
        options: {
          A: 'Xác nhận giả định, kiểm tra dữ liệu đầu vào và cập nhật phản hồi theo từng vòng',
          B: 'Giữ nguyên kế hoạch ban đầu bất kể thông tin mới',
          C: 'Chỉ báo cáo khi công việc đã hoàn tất',
          D: 'Bỏ qua các trường hợp biên để tập trung vào phần dễ',
        },
        expected_answer: 'Đáp án A đúng vì giúp giảm sai lệch và phát hiện vấn đề sớm trong quá trình thực hiện.',
      },
    ];
    const picked = templates[index % templates.length];
    return {
      content: picked.content,
      type: 'mcq',
      difficulty: index % 3 === 2 ? 'hard' : 'medium',
      options: picked.options,
      correct_answer: 'A',
      expected_answer: picked.expected_answer,
      keywords: normalizeKeywords(null, [skill, subject, 'giải quyết vấn đề']),
      video_url: null,
    };
  }

  const essayTemplates = [
    `Hãy mô tả một tình huống thực tế bạn đã sử dụng ${skillAction} trong công việc liên quan đến ${subject}. Bạn phân tích vấn đề, chọn giải pháp và đo kết quả như thế nào?`,
    `Nếu được giao một nhiệm vụ khó trong mảng ${subject} có liên quan đến ${skillAction}, bạn sẽ lập kế hoạch xử lý, phối hợp với các bên và kiểm soát rủi ro ra sao?`,
    `Hãy nêu một ví dụ cho thấy bạn đã cải thiện hiệu quả công việc bằng ${skillAction}. Kết quả đạt được là gì và bạn rút ra bài học nào?`,
    `Trong tình huống ${scenario}, bạn sẽ dùng ${skillAction} như thế nào để xử lý khía cạnh ${aspect} cho ${subject}? Hãy nêu các bước và tiêu chí đánh giá.`,
    `Hãy phân tích một sai lầm thường gặp khi áp dụng ${skillAction} trong ${subject}. Bạn sẽ phát hiện, sửa và ngăn lỗi lặp lại ra sao?`,
    `Nếu phải hướng dẫn một nhân sự mới thực hiện phần việc liên quan đến ${skillAction}, bạn sẽ thiết kế quy trình kiểm tra chất lượng cho ${subject} như thế nào?`,
    `Hãy trình bày cách bạn ưu tiên công việc khi cùng lúc có nhiều yêu cầu liên quan đến ${skillAction} trong ${subject}. Bạn dùng dữ liệu nào để quyết định?`,
    `Khi kết quả triển khai ${skillAction} chưa đạt kỳ vọng, bạn sẽ phân tích nguyên nhân và đề xuất cải tiến cho ${subject} theo trình tự nào?`,
  ];

  return {
    content: essayTemplates[index % essayTemplates.length],
    type: 'essay',
    difficulty: index % 2 === 0 ? 'medium' : 'hard',
    options: null,
    correct_answer: null,
    expected_answer: `Ứng viên nên trả lời theo cấu trúc bối cảnh, nhiệm vụ, hành động, kết quả; có ví dụ cụ thể bám sát ${scope}.`,
    keywords: normalizeKeywords(null, [skill, subject, 'STAR', 'kết quả']),
    video_url: null,
  };
}

function buildUniqueFallbackQuestion(type, index, context, usedFingerprints) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const question = buildFallbackQuestion(type, index + attempt, context);
    if (!isDuplicateQuestion(question, usedFingerprints)) return question;
  }

  const question = buildFallbackQuestion(type, index, context);
  question.content = `${question.content} Trọng tâm đánh giá bổ sung: ${index + 1}.`;
  return question;
}

function parseGeneratedQuestionList(responseText) {
  const cleaned = compactText(responseText)
    .replace(/^```json/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '')
    .trim();

  const candidates = [
    cleaned,
    cleaned.match(/\[[\s\S]*\]/)?.[0],
    cleaned.match(/\{[\s\S]*\}/)?.[0],
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed.questions)) return parsed.questions;
    } catch {
      // Try the next candidate.
    }
  }

  return [];
}

const aiTestController = {
  // ==================== TEST MANAGEMENT ====================
  createTest: async (req, res) => {
    try {
      const { title, job_id, description, duration, start_time, end_time, test_type } = req.body;
      const creator_id = req.user?.id || null;

      // Ensure creator_id column exists (safe to call multiple times)
      await pool.query(`ALTER TABLE ai_tests ADD COLUMN IF NOT EXISTS creator_id INTEGER`).catch(() => {});

      const newTest = await pool.query(
        `INSERT INTO ai_tests (title, job_id, description, duration, start_time, end_time, test_type, creator_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [title, job_id || null, description, duration, start_time, end_time, test_type, creator_id]
      );

      // Create default scoring config
      await pool.query(
        `INSERT INTO ai_scoring_configs (test_id) VALUES ($1)`,
        [newTest.rows[0].id]
      );

      res.status(201).json(newTest.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server Error' });
    }
  },

  getTests: async (req, res) => {
    try {
      const userId = req.user?.id;

      await pool.query(`ALTER TABLE ai_tests ADD COLUMN IF NOT EXISTS creator_id INTEGER`).catch(() => {});

      // Get tests created by this employer or linked to their jobs
      const tests = await pool.query(
        `SELECT DISTINCT t.*, j.job_title
         FROM ai_tests t
         LEFT JOIN jobs j ON t.job_id = j.id
         WHERE t.creator_id = $1
            OR j.employer_id = $1
            OR (t.creator_id IS NULL AND t.job_id IS NULL)
         ORDER BY t.created_at DESC`,
        [userId]
      );
      res.json(tests.rows);
    } catch (err) {
      console.error(err);
      // Fallback for legacy databases that do not have the newer columns yet.
      try {
        const tests = await pool.query('SELECT * FROM ai_tests ORDER BY created_at DESC');
        res.json(tests.rows);
      } catch (err2) {
        console.error(err2);
        res.status(500).json({ error: 'Server Error' });
      }
    }
  },

  getTestById: async (req, res) => {
    try {
      const { id } = req.params;
      const test = await pool.query('SELECT * FROM ai_tests WHERE id = $1', [id]);

      if (test.rows.length === 0) return res.status(404).json({ error: 'Test not found' });

      // Get questions
      const questions = await pool.query(
        `SELECT q.*, tq.order_index
         FROM ai_questions q
         JOIN ai_test_questions tq ON q.id = tq.question_id
         WHERE tq.test_id = $1 ORDER BY tq.order_index ASC`,
        [id]
      );

      // Get scoring config
      const config = await pool.query('SELECT * FROM ai_scoring_configs WHERE test_id = $1', [id]);

      res.json({
        ...test.rows[0],
        questions: syncQuestionListExpectedAnswers(questions.rows),
        scoring_config: config.rows[0]
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server Error' });
    }
  },

  deleteTest: async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query('DELETE FROM ai_tests WHERE id = $1', [id]);
      res.json({ message: 'Test deleted successfully' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server Error' });
    }
  },

  deleteQuestion: async (req, res) => {
    try {
      const { testId, questionId } = req.params;
      // Remove question from test first
      await pool.query('DELETE FROM ai_test_questions WHERE test_id = $1 AND question_id = $2', [testId, questionId]);
      // Optionally delete the question itself
      await pool.query('DELETE FROM ai_questions WHERE id = $1', [questionId]);
      res.json({ message: 'Question removed successfully' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server Error' });
    }
  },

  // ==================== SCORING CONFIG ====================
  updateScoringConfig: async (req, res) => {
    try {
      const { id } = req.params;
      const { semantic_weight, keyword_weight, voice_weight, manual_weight } = req.body;
      const updated = await pool.query(
        `UPDATE ai_scoring_configs
         SET semantic_weight = $1, keyword_weight = $2, voice_weight = $3, manual_weight = $4
         WHERE test_id = $5 RETURNING *`,
        [semantic_weight, keyword_weight, voice_weight, manual_weight, id]
      );
      res.json(updated.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server Error' });
    }
  },

  // ==================== QUESTION BANK ====================
  createQuestion: async (req, res) => {
    try {
      const normalizedQuestion = normalizeQuestionPayload(req.body);
      if (!normalizedQuestion) {
        return res.status(400).json({
          error: 'Câu hỏi không hợp lệ. MCQ cần nội dung, ít nhất 2 đáp án và đáp án đúng phải trỏ tới đáp án có nội dung.',
        });
      }

      const newQuestion = await pool.query(
        `INSERT INTO ai_questions (content, type, difficulty, correct_answer, expected_answer, keywords, video_url, options)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          normalizedQuestion.content,
          normalizedQuestion.type,
          normalizedQuestion.difficulty,
          normalizedQuestion.correct_answer,
          normalizedQuestion.expected_answer || null,
          normalizedQuestion.keywords || null,
          normalizedQuestion.video_url || null,
          normalizedQuestion.options ? JSON.stringify(normalizedQuestion.options) : null,
        ]
      );
      res.status(201).json(newQuestion.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server Error' });
    }
  },

  getQuestions: async (req, res) => {
    try {
      const questions = await pool.query('SELECT * FROM ai_questions ORDER BY created_at DESC');
      res.json(syncQuestionListExpectedAnswers(questions.rows));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server Error' });
    }
  },

  addQuestionToTest: async (req, res) => {
    try {
      const { testId, questionId } = req.params;
      const { order_index } = req.body;
      const mapping = await pool.query(
        `INSERT INTO ai_test_questions (test_id, question_id, order_index)
         VALUES ($1, $2, $3) RETURNING *`,
        [testId, questionId, order_index || 0]
      );
      res.status(201).json(mapping.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server Error' });
    }
  },

  // ==================== MOCK APIs ====================
  generateVideo: async (req, res) => {
    try {
      // Mock AI Video generation
      const { text } = req.body;
      setTimeout(() => {
        res.json({
          success: true,
          video_url: 'https://www.w3schools.com/html/mov_bbb.mp4', // sample video
          generated_from: text
        });
      }, 1500); // Simulate API delay
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server Error' });
    }
  },

  speechToText: async (req, res) => {
    try {
      // Mock Whisper API
      // In real app, we would process req.file (audio blob)
      setTimeout(() => {
        res.json({
          success: true,
          transcript: 'This is a mock transcript generated from the audio input. I think the answer is related to component lifecycle.'
        });
      }, 1000);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server Error' });
    }
  },

  // ==================== SUBMISSIONS & SCORING ====================
  startSubmission: async (req, res) => {
    try {
      const { test_id } = req.body;
      const candidate_id = req.user.id;

      const submission = await pool.query(
        `INSERT INTO ai_submissions (test_id, candidate_id, status)
         VALUES ($1, $2, 'in_progress') RETURNING *`,
        [test_id, candidate_id]
      );
      res.status(201).json(submission.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server Error' });
    }
  },

  submitAnswer: async (req, res) => {
    try {
      const { submission_id, question_id, text_answer, audio_url, transcript, suspicious_flag, tab_switch_count } = req.body;

      // Log anti-cheat data if provided
      if (suspicious_flag !== undefined || tab_switch_count !== undefined) {
        await pool.query(
          `UPDATE ai_submissions SET
            suspicious_flag = COALESCE($1, suspicious_flag),
            tab_switch_count = tab_switch_count + COALESCE($2, 0)
           WHERE id = $3`,
          [suspicious_flag, tab_switch_count || 0, submission_id]
        );
      }

      const answer = await pool.query(
        `INSERT INTO ai_answers (submission_id, question_id, text_answer, audio_url, transcript)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [submission_id, question_id, text_answer, audio_url, transcript]
      );

      // Async scoring
      aiTestController.scoreAnswer(answer.rows[0].id).catch(console.error);

      res.status(201).json({ message: 'Answer submitted and queued for AI scoring', answer_id: answer.rows[0].id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server Error' });
    }
  },

  completeSubmission: async (req, res) => {
    try {
      const { submission_id } = req.body;
      await pool.query(
        `UPDATE ai_submissions SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [submission_id]
      );

      // Wait a moment for async scoring to finish
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Recalculate total score to ensure it's up-to-date
      await pool.query(
        `UPDATE ai_submissions SET total_score = (SELECT COALESCE(SUM(final_score),0) FROM ai_answers WHERE submission_id = $1) WHERE id = $1`,
        [submission_id]
      );

      // Fetch submission with test info
      const submissionRes = await pool.query(
        `SELECT s.*, t.title as test_title, t.test_type,
                (SELECT COUNT(*) FROM ai_test_questions WHERE test_id = s.test_id) as total_questions
         FROM ai_submissions s
         JOIN ai_tests t ON s.test_id = t.id
         WHERE s.id = $1`,
        [submission_id]
      );

      if (submissionRes.rows.length === 0) {
        return res.json({ message: 'Submission completed' });
      }

      const submission = submissionRes.rows[0];

      // Fetch per-answer scores
      const answersRes = await pool.query(
        `SELECT a.id, a.question_id, a.text_answer, a.final_score, a.scoring_details,
                q.content as question_content, q.type as question_type, q.correct_answer
         FROM ai_answers a
         JOIN ai_questions q ON a.question_id = q.id
         WHERE a.submission_id = $1
         ORDER BY a.id ASC`,
        [submission_id]
      );

      const totalQuestions = parseInt(submission.total_questions) || answersRes.rows.length;
      const maxScore = totalQuestions * 10;
      const totalScore = parseFloat(submission.total_score) || 0;
      const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
      const correctCount = answersRes.rows.filter(a => parseFloat(a.final_score) >= 10).length;

      res.json({
        message: 'Submission completed',
        result: {
          submission_id: submission.id,
          test_title: submission.test_title,
          test_type: submission.test_type,
          total_score: totalScore,
          max_score: maxScore,
          percentage,
          total_questions: totalQuestions,
          answered_questions: answersRes.rows.length,
          correct_count: correctCount,
          completed_at: submission.completed_at,
          answers: answersRes.rows.map(a => ({
            question_id: a.question_id,
            question_content: a.question_content,
            question_type: a.question_type,
            text_answer: a.text_answer,
            correct_answer: a.correct_answer,
            final_score: parseFloat(a.final_score) || 0,
            scoring_details: typeof a.scoring_details === 'string' ? JSON.parse(a.scoring_details || '{}') : (a.scoring_details || {}),
          })),
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server Error' });
    }
  },

  scoreAnswer: async (answerId) => {
    const answerRes = await pool.query(`
      SELECT a.*, q.expected_answer, q.keywords, q.correct_answer, q.type as q_type, q.options, s.test_id
      FROM ai_answers a
      JOIN ai_questions q ON a.question_id = q.id
      JOIN ai_submissions s ON a.submission_id = s.id
      WHERE a.id = $1
    `, [answerId]);

    if (answerRes.rows.length === 0) return;
    const answer = answerRes.rows[0];

    // --- MCQ: simple correct/wrong scoring ---
    if (answer.q_type === 'mcq') {
      const isCorrect = answer.text_answer && answer.correct_answer &&
        answer.text_answer.trim().toUpperCase() === answer.correct_answer.trim().toUpperCase();
      const finalScore = isCorrect ? 10 : 0;
      const scoringDetails = JSON.stringify({
        type: 'mcq', selected: answer.text_answer, correct: answer.correct_answer, is_correct: isCorrect
      });
      await pool.query(
        `UPDATE ai_answers SET ai_score = $1, final_score = $1, scoring_details = $2 WHERE id = $3`,
        [finalScore, scoringDetails, answerId]
      );
      await pool.query(
        `UPDATE ai_submissions SET total_score = (SELECT COALESCE(SUM(final_score),0) FROM ai_answers WHERE submission_id = $1) WHERE id = $1`,
        [answer.submission_id]
      );
      return;
    }

    // --- Essay scoring (existing logic) ---
    const configRes = await pool.query('SELECT * FROM ai_scoring_configs WHERE test_id = $1', [answer.test_id]);
    const config = configRes.rows[0] || { semantic_weight: 0.5, keyword_weight: 0.2, voice_weight: 0.2 };
    const contentToScore = answer.text_answer || answer.transcript || '';
    let semanticScore = 0, keywordScore = 0;
    let voiceScore = answer.transcript ? 8.0 : 0;

    if (answer.keywords && contentToScore) {
      const keywords = answer.keywords.split(',').map(k => k.trim().toLowerCase());
      const contentLower = contentToScore.toLowerCase();
      let matches = 0;
      keywords.forEach(kw => { if (contentLower.includes(kw)) matches++; });
      keywordScore = keywords.length > 0 ? (matches / keywords.length) * 10 : 0;
    }

    try {
      if (process.env.GEMINI_API_KEY) {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const prompt = `Rate the similarity and correctness of the answer based on the expected answer on a scale of 0.0 to 10.0. Only return a number.\nExpected: ${answer.expected_answer}\nAnswer: ${contentToScore}`;
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        semanticScore = parseFloat(responseText.trim()) || 7.5;
      } else {
        semanticScore = Math.random() * 4 + 6;
      }
    } catch(e) {
      console.log('Gemini scoring failed, using fallback', e.message);
      semanticScore = 7.5;
    }

    const finalScore = (
      (semanticScore * parseFloat(config.semantic_weight)) +
      (keywordScore * parseFloat(config.keyword_weight)) +
      (voiceScore * parseFloat(config.voice_weight))
    );
    const scoringDetails = JSON.stringify({ semantic_score: semanticScore, keyword_score: keywordScore, voice_score: voiceScore, weights_used: config });

    await pool.query(
      `UPDATE ai_answers SET ai_score = $1, voice_score = $2, final_score = $3, scoring_details = $4 WHERE id = $5`,
      [finalScore, voiceScore, finalScore, scoringDetails, answerId]
    );
    await pool.query(
      `UPDATE ai_submissions SET total_score = (SELECT COALESCE(SUM(final_score),0) FROM ai_answers WHERE submission_id = $1) WHERE id = $1`,
      [answer.submission_id]
    );
  },

  // ==================== CANDIDATE: MY SCORES ====================
  getMySubmissions: async (req, res) => {
    try {
      const candidateId = req.user?.id;
      if (!candidateId) return res.status(401).json({ error: 'Unauthorized' });

      const submissions = await pool.query(
        `SELECT s.id, s.test_id, s.status, s.total_score, s.completed_at, s.started_at,
                s.suspicious_flag, s.tab_switch_count,
                t.title as test_title, t.test_type, t.duration,
                t.job_id,
                j.job_title, j.company_name, j.job_address as job_location, j.salary as job_salary,
                (SELECT COUNT(*) FROM ai_test_questions WHERE test_id = s.test_id) as total_questions,
                (SELECT COUNT(*) FROM ai_answers WHERE submission_id = s.id) as answered_questions,
                (SELECT COUNT(*) FROM ai_answers WHERE submission_id = s.id AND final_score >= 10) as correct_count
         FROM ai_submissions s
         JOIN ai_tests t ON s.test_id = t.id
         LEFT JOIN jobs j ON j.id = t.job_id
         WHERE s.candidate_id = $1 AND s.status IN ('completed', 'graded')
         ORDER BY s.completed_at DESC NULLS LAST, s.started_at DESC`,
        [candidateId]
      );

      const rows = submissions.rows.map(row => {
        const totalQ = parseInt(row.total_questions) || 0;
        const maxScore = totalQ * 10;
        const totalScore = parseFloat(row.total_score) || 0;
        const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
        return {
          ...row,
          total_questions: totalQ,
          answered_questions: parseInt(row.answered_questions) || 0,
          correct_count: parseInt(row.correct_count) || 0,
          max_score: maxScore,
          total_score: totalScore,
          percentage,
        };
      });

      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server Error' });
    }
  },

  // ==================== ADMIN / HR ====================
  getSubmissions: async (req, res) => {
    try {
      const { test_id } = req.query;
      let query = `
        SELECT s.*, u.full_name, u.email
        FROM ai_submissions s
        JOIN users u ON s.candidate_id = u.id
      `;
      let params = [];
      if (test_id) {
        query += ` WHERE s.test_id = $1`;
        params.push(test_id);
      }
      query += ` ORDER BY s.completed_at DESC NULLS LAST`;

      const submissions = await pool.query(query, params);
      res.json(submissions.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server Error' });
    }
  },

  getSubmissionDetails: async (req, res) => {
    try {
      const { id } = req.params;
      const submission = await pool.query(
        `SELECT s.*, u.full_name, u.email, t.title as test_title
         FROM ai_submissions s
         JOIN users u ON s.candidate_id = u.id
         JOIN ai_tests t ON s.test_id = t.id
         WHERE s.id = $1`,
        [id]
      );

      if (submission.rows.length === 0) return res.status(404).json({ error: 'Not found' });

      const answers = await pool.query(
        `SELECT a.*, q.content as question_content, q.expected_answer
         FROM ai_answers a
         JOIN ai_questions q ON a.question_id = q.id
         WHERE a.submission_id = $1`,
        [id]
      );

      res.json({
        ...submission.rows[0],
        answers: answers.rows
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server Error' });
    }
  },

  manualAdjustScore: async (req, res) => {
    try {
      const { answer_id } = req.params;
      const { manual_score } = req.body; // Score from 0-10 given by HR

      const answerRes = await pool.query('SELECT * FROM ai_answers WHERE id = $1', [answer_id]);
      if (answerRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });

      const answer = answerRes.rows[0];
      const submission = await pool.query('SELECT test_id FROM ai_submissions WHERE id = $1', [answer.submission_id]);
      const configRes = await pool.query('SELECT * FROM ai_scoring_configs WHERE test_id = $1', [submission.rows[0].test_id]);
      const config = configRes.rows[0];

      let details = typeof answer.scoring_details === 'string' ? JSON.parse(answer.scoring_details) : (answer.scoring_details || {});
      details.manual_score = manual_score;

      // Re-calculate final score
      const finalScore = (
        (details.semantic_score * parseFloat(config.semantic_weight)) +
        (details.keyword_score * parseFloat(config.keyword_weight)) +
        (details.voice_score * parseFloat(config.voice_weight)) +
        (manual_score * parseFloat(config.manual_weight))
      );

      await pool.query(
        `UPDATE ai_answers SET final_score = $1, scoring_details = $2 WHERE id = $3`,
        [finalScore, JSON.stringify(details), answer_id]
      );

      // Update total
      await pool.query(
        `UPDATE ai_submissions SET total_score = (SELECT SUM(final_score) FROM ai_answers WHERE submission_id = $1)
         WHERE id = $1`,
        [answer.submission_id]
      );

      res.json({ message: 'Score adjusted', finalScore });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server Error' });
    }
  },

  // ==================== HYBRID AI QUESTION GENERATION ====================
  generateQuestions: async (req, res) => {
    try {
      const { testId } = req.params;
      const { job_id, topic } = req.body;
      const requestedCount = clampInteger(req.body.count, 10, 1, 30);
      const requestedMcqRatio = clampRatio(req.body.mcq_ratio, 0.7);

      // 1. Get test info
      const testRes = await pool.query('SELECT * FROM ai_tests WHERE id = $1', [testId]);
      if (testRes.rows.length === 0) return res.status(404).json({ error: 'Test not found' });

      // 2. Determine generation context (Topic vs Job JD)
      let contextInfo = '';
      let targetSubject = '';
      let rawContextText = '';

      if (compactText(topic)) {
        targetSubject = compactText(topic);
        rawContextText = targetSubject;
        contextInfo = `Chủ đề bài test: ${targetSubject}`;
      } else {
        const resolvedJobId = job_id || testRes.rows[0].job_id;
        if (!resolvedJobId) return res.status(400).json({ error: 'Cần nhập chủ đề hoặc chọn tin tuyển dụng' });

        const jobRes = await pool.query(
          `SELECT job_title, job_description, job_requirements FROM jobs WHERE id = $1`,
          [resolvedJobId]
        );
        if (jobRes.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy tin tuyển dụng' });

        const job = jobRes.rows[0];
        targetSubject = job.job_title || 'vị trí này';
        rawContextText = `${job.job_title || ''} ${job.job_description || ''} ${job.job_requirements || ''}`;
        contextInfo = `
Vị trí: ${job.job_title || 'Không rõ'}
Mô tả công việc: ${job.job_description || 'Không có'}
Yêu cầu: ${job.job_requirements || 'Không có'}`;
      }

      const mcqCount = Math.round(requestedCount * requestedMcqRatio);
      const essayCount = requestedCount - mcqCount;
      const desiredTypes = [
        ...Array.from({ length: mcqCount }, () => 'mcq'),
        ...Array.from({ length: essayCount }, () => 'essay'),
      ];
      const generationContext = {
        targetSubject,
        skills: extractSkillPhrases(rawContextText, targetSubject),
      };

      // 3. Build Hybrid prompt
      const prompt = `Bạn là chuyên gia ra đề thi tuyển dụng cấp cao. Hãy tạo bộ câu hỏi phỏng vấn chất lượng cao tập trung TUYỆT ĐỐI vào kiến thức chuyên môn dựa trên thông tin sau:

=== THÔNG TIN YÊU CẦU ===
${contextInfo}

=== YÊU CẦU ===
Tạo CHÍNH XÁC ${mcqCount} câu trắc nghiệm (MCQ) và ${essayCount} câu tự luận (essay).
Nội dung CẦN kiểm tra trực tiếp kỹ năng và kiến thức liên quan đến chủ đề/vị trí trên. Đừng hỏi chung chung.
MCQ phải có đúng 4 lựa chọn A, B, C, D; correct_answer chỉ được là một trong A/B/C/D và phải trỏ tới đáp án đúng thật sự.
Vị trí đáp án đúng phải được phân bổ ngẫu nhiên giữa A/B/C/D, không được luôn là A.
Essay không được có options hoặc correct_answer; expected_answer phải mô tả các ý chính cần có để chấm điểm.
Không dùng câu hỏi dạng "bạn nghĩ gì", "hãy giới thiệu bản thân", hoặc câu hỏi kỹ năng mềm nếu JD/chủ đề yêu cầu kiến thức chuyên môn.
Tất cả câu hỏi phải khác nhau rõ rệt: không lặp content, không chỉ thay vài từ, mỗi câu phải kiểm tra một kỹ năng/tình huống/khía cạnh khác nhau.
Không lặp cùng một cấu trúc mở đầu quá 2 lần trong toàn bộ đề.

=== FORMAT TRẢ VỀ ===
TRẢ VỀ DUY NHẤT MỘT MẢNG JSON HỢP LỆ. KHÔNG CÓ MARKDOWN HAY BẤT KỲ TEXT NÀO KHÁC.
[
  {
    "content": "Nội dung câu hỏi kỹ năng chuyên môn",
    "type": "mcq",
    "difficulty": "medium",
    "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
    "correct_answer": "A",
    "expected_answer": "Giải thích vì sao A đúng",
    "keywords": "kỹ năng 1, kỹ năng 2"
  }
]`;

      let generatedQuestions = [];

      if (process.env.GEMINI_API_KEY) {
        try {
          const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
          const result = await model.generateContent(prompt);
          let responseText = result.response.text();
          generatedQuestions = parseGeneratedQuestionList(responseText);
          if (!generatedQuestions.length) console.log('No valid JSON question list found in Gemini response');
        } catch (aiErr) {
          console.error('Gemini generation failed:', aiErr.message);
        }
      }

      const normalizedGenerated = [];
      const usedIndexes = new Set();
      const usedFingerprints = new Set();
      desiredTypes.forEach((desiredType, index) => {
        const sourceIndex = generatedQuestions.findIndex((question, questionIndex) => (
          !usedIndexes.has(questionIndex)
          && normalizeQuestionType(question?.type, desiredType) === desiredType
          && (() => {
            const normalizedQuestion = normalizeQuestionPayload(question, {
              expectedType: desiredType,
              fallbackKeywords: generationContext.skills,
            });
            return normalizedQuestion && !isDuplicateQuestion(normalizedQuestion, usedFingerprints);
          })()
        ));
        const fallbackIndex = sourceIndex === -1
          ? generatedQuestions.findIndex((question, questionIndex) => {
              if (usedIndexes.has(questionIndex)) return false;
              const normalizedQuestion = normalizeQuestionPayload(question, {
                expectedType: desiredType,
                fallbackKeywords: generationContext.skills,
              });
              return normalizedQuestion?.type === desiredType && !isDuplicateQuestion(normalizedQuestion, usedFingerprints);
            })
          : sourceIndex;

        if (fallbackIndex !== -1) usedIndexes.add(fallbackIndex);

        const normalizedQuestion = fallbackIndex !== -1
          ? normalizeQuestionPayload(generatedQuestions[fallbackIndex], {
              expectedType: desiredType,
              fallbackKeywords: generationContext.skills,
            })
          : null;

        const selectedQuestion = normalizedQuestion?.type === desiredType && !isDuplicateQuestion(normalizedQuestion, usedFingerprints)
          ? normalizedQuestion
          : buildUniqueFallbackQuestion(desiredType, index, generationContext, usedFingerprints);
        const finalQuestion = shuffleMcqOptions(selectedQuestion, `${testId}:${index}:${targetSubject}`);

        normalizedGenerated.push(finalQuestion);
        markQuestionAsUsed(finalQuestion, usedFingerprints);
      });

      generatedQuestions = normalizedGenerated;

      // 4. Save to database
      const savedQuestions = [];
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const orderResult = await client.query(
          'SELECT COALESCE(MAX(order_index) + 1, 0)::int AS next_order FROM ai_test_questions WHERE test_id = $1',
          [testId]
        );
        const startOrder = orderResult.rows[0]?.next_order || 0;

        for (let idx = 0; idx < generatedQuestions.length; idx++) {
          const q = generatedQuestions[idx];
          const qRes = await client.query(
            `INSERT INTO ai_questions (content, type, difficulty, correct_answer, expected_answer, keywords, options)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [
              q.content,
              q.type,
              q.difficulty,
              q.correct_answer,
              q.expected_answer || null,
              q.keywords || null,
              q.options ? JSON.stringify(q.options) : null,
            ]
          );
          const savedQ = qRes.rows[0];

          await client.query(
            `INSERT INTO ai_test_questions (test_id, question_id, order_index) VALUES ($1, $2, $3)`,
            [testId, savedQ.id, startOrder + idx]
          );
          savedQuestions.push(syncMcqExpectedAnswer(savedQ));
        }

        await client.query('COMMIT');
      } catch (transactionError) {
        await client.query('ROLLBACK');
        throw transactionError;
      } finally {
        client.release();
      }

      res.json({ message: `Đã tạo ${savedQuestions.length} câu hỏi`, questions: savedQuestions });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server Error' });
    }
  },

  // ==================== LIVEAVATAR SESSION TOKEN ====================
  createLiveAvatarSessionToken: async (req, res) => {
    try {
      if (!process.env.LIVEAVATAR_API_KEY) {
        return res.status(503).json({
          error: 'LiveAvatar chưa được cấu hình. Thiếu LIVEAVATAR_API_KEY trong backend/.env.',
          code: 'LIVEAVATAR_NOT_CONFIGURED'
        });
      }

      const payload = buildLiveAvatarPayload(req.body);
      if (!payload.avatar_id) {
        return res.status(503).json({
          error: 'LiveAvatar chưa được cấu hình. Thiếu LIVEAVATAR_AVATAR_ID trong backend/.env.',
          code: 'LIVEAVATAR_AVATAR_MISSING'
        });
      }

      const response = await fetch(`${LIVEAVATAR_API_URL}/v1/sessions/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': process.env.LIVEAVATAR_API_KEY,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || (data.code && data.code !== 1000)) {
        return res.status(response.ok ? 502 : response.status).json({
          error: data.message || 'Không thể tạo LiveAvatar session token.',
          code: data.code || 'LIVEAVATAR_TOKEN_FAILED',
        });
      }

      const sessionToken = pickLiveAvatarToken(data);
      if (!sessionToken) {
        return res.status(502).json({
          error: 'LiveAvatar không trả về session token hợp lệ.',
          code: 'LIVEAVATAR_TOKEN_MISSING'
        });
      }

      res.json({
        sessionToken,
        apiUrl: LIVEAVATAR_API_URL,
        mode: payload.mode,
        isSandbox: payload.is_sandbox,
      });
    } catch (err) {
      console.error('LiveAvatar token error:', err);
      res.status(500).json({ error: 'Không thể kết nối LiveAvatar.' });
    }
  },

  // ==================== GET TEST BY JOB ====================
  getTestByJobId: async (req, res) => {
    try {
      const { jobId } = req.params;
      const test = await pool.query(
        'SELECT * FROM ai_tests WHERE job_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1',
        [jobId]
      );

      if (test.rows.length === 0) {
        return res.status(404).json({ error: 'No test found for this job' });
      }

      // Get questions
      const questions = await pool.query(
        `SELECT q.*, tq.order_index
         FROM ai_questions q
         JOIN ai_test_questions tq ON q.id = tq.question_id
         WHERE tq.test_id = $1 ORDER BY tq.order_index ASC`,
        [test.rows[0].id]
      );

      // Get scoring config
      const config = await pool.query('SELECT * FROM ai_scoring_configs WHERE test_id = $1', [test.rows[0].id]);

      res.json({
        ...test.rows[0],
        questions: syncQuestionListExpectedAnswers(questions.rows),
        scoring_config: config.rows[0]
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server Error' });
    }
  }

};

module.exports = aiTestController;
