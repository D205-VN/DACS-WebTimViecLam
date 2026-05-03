const pool = require('../../infrastructure/database/postgres');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini for scoring mock
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'mock-api-key');

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
        questions: questions.rows,
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
      const { content, type, difficulty, correct_answer, expected_answer, keywords, video_url, options } = req.body;
      const newQuestion = await pool.query(
        `INSERT INTO ai_questions (content, type, difficulty, correct_answer, expected_answer, keywords, video_url, options)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [content, type, difficulty, correct_answer, expected_answer, keywords, video_url, options ? JSON.stringify(options) : null]
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
      res.json(questions.rows);
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
      // Finalize total score logic could go here or after all answers are scored
      res.json({ message: 'Submission completed' });
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
      const { job_id, topic, count = 10, mcq_ratio = 0.7 } = req.body;

      // 1. Get test info
      const testRes = await pool.query('SELECT * FROM ai_tests WHERE id = $1', [testId]);
      if (testRes.rows.length === 0) return res.status(404).json({ error: 'Test not found' });

      // 2. Determine generation context (Topic vs Job JD)
      let contextInfo = '';
      let targetSubject = '';

      if (topic) {
        targetSubject = topic;
        contextInfo = `Chủ đề bài test: ${topic}`;
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
        contextInfo = `
Vị trí: ${job.job_title || 'Không rõ'}
Mô tả công việc: ${job.job_description || 'Không có'}
Yêu cầu: ${job.job_requirements || 'Không có'}`;
      }

      const mcqCount = Math.round(count * mcq_ratio);
      const essayCount = count - mcqCount;

      // 3. Build Hybrid prompt
      const prompt = `Bạn là chuyên gia ra đề thi tuyển dụng cấp cao. Hãy tạo bộ câu hỏi phỏng vấn chất lượng cao tập trung TUYỆT ĐỐI vào kiến thức chuyên môn dựa trên thông tin sau:

=== THÔNG TIN YÊU CẦU ===
${contextInfo}

=== YÊU CẦU ===
Tạo CHÍNH XÁC ${mcqCount} câu trắc nghiệm (MCQ) và ${essayCount} câu tự luận (essay). Nội dung CẦN phải kiểm tra trực tiếp kỹ năng và kiến thức liên quan đến chủ đề/vị trí trên. Đừng hỏi chung chung. Từng câu hỏi phải có độ sâu về chuyên môn.

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

          // Remove markdown formatting if any
          responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

          // Extract JSON from response
          const jsonMatch = responseText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            generatedQuestions = JSON.parse(jsonMatch[0]);
          } else {
             console.log("No JSON match found in Gemini response: ", responseText);
          }
        } catch (aiErr) {
          console.error('Gemini generation failed:', aiErr.message);
        }
      }

      // Fallback: generate mock questions if AI fails
      if (generatedQuestions.length === 0) {
        const fallbackSubject = targetSubject || 'nhân sự';
        for (let i = 0; i < mcqCount; i++) {
          generatedQuestions.push({
            content: `[Mock Câu ${i + 1}] Kiến thức hoặc kỹ năng nào sau đây là yêu cầu quan trọng nhất đối với chuyên môn ${fallbackSubject}?`,
            type: 'mcq',
            difficulty: i % 2 === 0 ? 'medium' : 'hard',
            options: {
              A: `Kỹ năng chuyên môn sâu cấp độ ${i + 1}`,
              B: `Kỹ năng giao tiếp và làm việc nhóm trong mảng ${fallbackSubject}`,
              C: 'Quản lý thời gian và tiến độ công việc',
              D: 'Tất cả các phương án trên đều đúng'
            },
            correct_answer: 'D',
            expected_answer: 'Ứng viên cần toàn diện các kỹ năng trên',
            keywords: fallbackSubject
          });
        }
        for (let i = 0; i < essayCount; i++) {
          generatedQuestions.push({
            content: `[Mock Tự luận ${i + 1}] Dựa trên chuyên môn về ${fallbackSubject}, bạn sẽ áp dụng kỹ năng của mình như thế nào để xử lý các vấn đề phát sinh trong dự án thực tế?`,
            type: 'essay',
            difficulty: 'hard',
            options: null,
            correct_answer: null,
            expected_answer: 'Ứng viên nên trình bày phương pháp giải quyết vấn đề, kèm ví dụ cụ thể bám sát các yêu cầu',
            keywords: 'giải quyết vấn đề, thực tế'
          });
        }
      }

      // 4. Save to database
      const savedQuestions = [];
      for (let idx = 0; idx < generatedQuestions.length; idx++) {
        const q = generatedQuestions[idx];
        const qRes = await pool.query(
          `INSERT INTO ai_questions (content, type, difficulty, correct_answer, expected_answer, keywords, options)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [q.content, q.type || 'mcq', q.difficulty || 'medium', q.correct_answer || null,
           q.expected_answer || null, q.keywords || null, q.options ? JSON.stringify(q.options) : null]
        );
        const savedQ = qRes.rows[0];

        // Link to test
        const currentCount = await pool.query('SELECT COUNT(*) FROM ai_test_questions WHERE test_id = $1', [testId]);
        await pool.query(
          `INSERT INTO ai_test_questions (test_id, question_id, order_index) VALUES ($1, $2, $3)`,
          [testId, savedQ.id, parseInt(currentCount.rows[0].count) + idx]
        );
        savedQuestions.push(savedQ);
      }

      res.json({ message: `Đã tạo ${savedQuestions.length} câu hỏi`, questions: savedQuestions });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server Error' });
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
        questions: questions.rows,
        scoring_config: config.rows[0]
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server Error' });
    }
  }

};

module.exports = aiTestController;
