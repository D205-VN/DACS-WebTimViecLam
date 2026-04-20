const pool = require('../config/db');

let employerJobSchemaReady = false;
let employerProfileSchemaReady = false;
let employerApplicationSchemaReady = false;

function normalizeDeadline(deadline) {
  if (!deadline) return null;
  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split('T')[0];
}

function normalizeSalary(salaryMin, salaryMax) {
  const min = Number.isFinite(Number(salaryMin)) && String(salaryMin).trim() !== '' ? Number(salaryMin) : null;
  const max = Number.isFinite(Number(salaryMax)) && String(salaryMax).trim() !== '' ? Number(salaryMax) : null;

  if (min !== null && max !== null) return `${min.toLocaleString('vi-VN')} - ${max.toLocaleString('vi-VN')} VND`;
  if (min !== null) return `Từ ${min.toLocaleString('vi-VN')} VND`;
  if (max !== null) return `Lên đến ${max.toLocaleString('vi-VN')} VND`;
  return 'Thỏa thuận';
}

async function ensureEmployerJobSchema() {
  if (employerJobSchemaReady) return;

  await pool.query(`
    ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS employer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS tags TEXT
  `);

  employerJobSchemaReady = true;
}

async function ensureEmployerProfileSchema() {
  if (employerProfileSchemaReady) return;

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS company_description TEXT,
    ADD COLUMN IF NOT EXISTS company_website VARCHAR(255),
    ADD COLUMN IF NOT EXISTS company_size VARCHAR(255),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
  `);

  employerProfileSchemaReady = true;
}

async function ensureEmployerApplicationSchema() {
  if (employerApplicationSchemaReady) return;

  await pool.query(`
    ALTER TABLE applied_jobs
    ADD COLUMN IF NOT EXISTS note TEXT,
    ADD COLUMN IF NOT EXISTS interview_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS interview_mode VARCHAR(50),
    ADD COLUMN IF NOT EXISTS interview_link TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
  `);

  employerApplicationSchemaReady = true;
}

async function ensureEmployerJobSchemaForRequest(req, res, next) {
  try {
    await ensureEmployerJobSchema();
    await ensureEmployerProfileSchema();
    await ensureEmployerApplicationSchema();
    return next();
  } catch (err) {
    console.error('Ensure employer job schema error:', err);
    return next();
    res.status(500).json({ error: 'Lỗi cấu hình dữ liệu tuyển dụng' });
  }
}

function normalizeApplicationStatus(status) {
  const allowed = ['pending', 'interview', 'hired', 'rejected'];
  return allowed.includes(status) ? status : 'pending';
}

async function getCandidateOwnership(applicationId, employerId) {
  const result = await pool.query(
    `SELECT aj.id
     FROM applied_jobs aj
     JOIN jobs j ON aj.job_id = j.id
     WHERE aj.id = $1 AND j.employer_id = $2`,
    [applicationId, employerId]
  );

  return result.rows[0] || null;
}

function buildDeadlineSqlExpression(columnName) {
  return `
    CASE
      WHEN ${columnName} IS NULL OR TRIM(${columnName}) = '' THEN NULL
      WHEN ${columnName} ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN TO_DATE(${columnName}, 'YYYY-MM-DD')
      WHEN ${columnName} ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN TO_DATE(${columnName}, 'DD/MM/YYYY')
      ELSE NULL
    END
  `;
}

/**
 * GET /api/employer/dashboard
 * Lấy dữ liệu dashboard cho nhà tuyển dụng
 */
async function getDashboard(req, res) {
  try {
    const userId = req.user.id;
    const deadlineDateSql = buildDeadlineSqlExpression('submission_deadline');

    // Thống kê
    const totalJobsResult = await pool.query(
      'SELECT COUNT(*) FROM jobs WHERE employer_id = $1', [userId]
    );
    const activeJobsResult = await pool.query(
      `SELECT COUNT(*) FROM jobs
       WHERE employer_id = $1
         AND (${deadlineDateSql} IS NULL OR ${deadlineDateSql} >= CURRENT_DATE)`,
      [userId]
    );
    const totalCandidatesResult = await pool.query(
      `SELECT COUNT(*) FROM applied_jobs aj 
       JOIN jobs j ON aj.job_id = j.id 
       WHERE j.employer_id = $1`, [userId]
    );
    const newCandidatesResult = await pool.query(
      `SELECT COUNT(*) FROM applied_jobs aj 
       JOIN jobs j ON aj.job_id = j.id 
       WHERE j.employer_id = $1 AND aj.created_at >= NOW() - INTERVAL '7 days'`, [userId]
    );

    // Tin mới nhất
    const recentJobsResult = await pool.query(
      `SELECT j.id, j.job_title as title, j.job_address as location, j.salary, 
              j.submission_deadline as deadline, j.created_at,
              (SELECT COUNT(*) FROM applied_jobs WHERE job_id = j.id) as applicant_count
       FROM jobs j 
       WHERE j.employer_id = $1 
       ORDER BY j.created_at DESC 
       LIMIT 5`, [userId]
    );

    console.log(`Dashboard stats for user ${userId}:`, {
      totalJobs: totalJobsResult.rows[0].count,
      activeJobs: activeJobsResult.rows[0].count,
      totalCandidates: totalCandidatesResult.rows[0].count,
      newCandidates: newCandidatesResult.rows[0].count,
    });
    console.log(`Recent jobs for user ${userId}:`, recentJobsResult.rows.length);

    res.json({
      stats: {
        totalJobs: parseInt(totalJobsResult.rows[0].count),
        activeJobs: parseInt(activeJobsResult.rows[0].count),
        totalCandidates: parseInt(totalCandidatesResult.rows[0].count),
        newCandidates: parseInt(newCandidatesResult.rows[0].count),
      },
      recentJobs: recentJobsResult.rows,
    });
  } catch (err) {
    console.error('Employer dashboard error:', err);
    res.status(500).json({ error: 'Lỗi khi tải dữ liệu dashboard' });
  }
}

/**
 * POST /api/employer/jobs
 * Tạo tin tuyển dụng mới
 */
async function createJob(req, res) {
  try {
    const userId = req.user.id;
    const {
      title, description, requirements, benefits,
      location, salary_min, salary_max, job_type,
      experience, deadline, tags, positions
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Tiêu đề và mô tả là bắt buộc' });
    }

    // Lấy thông tin công ty từ user
    const userResult = await pool.query(
      'SELECT company_name, company_city FROM users WHERE id = $1', [userId]
    );
    const company = userResult.rows[0];
    const normalizedDeadline = normalizeDeadline(deadline);
    const normalizedSalary = normalizeSalary(salary_min, salary_max);
    const normalizedTags = Array.isArray(tags)
      ? tags.map((tag) => String(tag).trim()).filter(Boolean).join(', ')
      : null;

    const result = await pool.query(
      `INSERT INTO jobs (job_title, job_description, job_requirements, benefits, job_address, salary, 
                         job_type, years_of_experience, submission_deadline, number_candidate, employer_id, company_name, tags, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
       RETURNING *`,
      [
        title, description, requirements || null, benefits || null,
        location || company?.company_city || null,
        normalizedSalary,
        job_type || 'Toàn thời gian',
        experience || 'Không yêu cầu',
        normalizedDeadline,
        parseInt(positions) || 1,
        userId,
        company?.company_name || null,
        normalizedTags,
      ]
    );

    res.status(201).json({
      message: 'Đăng tin thành công!',
      job: result.rows[0],
    });
  } catch (err) {
    console.error('Create job error:', err);
    res.status(500).json({ error: 'Lỗi khi đăng tin tuyển dụng' });
  }
}

/**
 * GET /api/employer/jobs
 * Danh sách tin tuyển dụng của employer
 */
async function getMyJobs(req, res) {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT j.id, j.job_title as title, j.job_address as location, j.job_type, 
              j.years_of_experience as experience, j.submission_deadline as deadline,
              j.salary, j.job_description as description, j.job_requirements as requirements,
              j.benefits, j.created_at, j.updated_at, j.number_candidate as positions, j.tags,
              (SELECT COUNT(*) FROM applied_jobs WHERE job_id = j.id) as applicant_count
       FROM jobs j 
       WHERE j.employer_id = $1 
       ORDER BY j.created_at DESC`,
      [userId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Get my jobs error:', err);
    res.status(500).json({ error: 'Lỗi khi tải danh sách tin' });
  }
}

/**
 * GET /api/employer/candidates
 * Danh sách ứng viên đã ứng tuyển vào các tin của employer
 */
async function getCandidates(req, res) {
  try {
    const userId = req.user.id;
    const { status, keyword, job_id, applied_from, applied_to } = req.query;
    const conditions = ['j.employer_id = $1'];
    const params = [userId];

    if (status && status !== 'all') {
      params.push(normalizeApplicationStatus(status));
      conditions.push(`COALESCE(NULLIF(TRIM(aj.status), ''), 'pending') = $${params.length}`);
    }

    if (keyword?.trim()) {
      params.push(`%${keyword.trim()}%`);
      conditions.push(`(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }

    if (job_id) {
      params.push(job_id);
      conditions.push(`j.id = $${params.length}`);
    }

    if (applied_from) {
      params.push(applied_from);
      conditions.push(`DATE(aj.created_at) >= $${params.length}`);
    }

    if (applied_to) {
      params.push(applied_to);
      conditions.push(`DATE(aj.created_at) <= $${params.length}`);
    }
    const result = await pool.query(
      `SELECT aj.id, aj.user_id, aj.job_id, aj.cv_text, aj.note, aj.interview_at, aj.interview_mode,
              aj.interview_link, aj.created_at, aj.updated_at,
              COALESCE(NULLIF(TRIM(aj.status), ''), 'pending') as status,
              u.full_name as candidate_name, u.email as candidate_email, u.phone as candidate_phone, u.avatar_url,
              j.job_title as job_title
       FROM applied_jobs aj
       JOIN users u ON aj.user_id = u.id
       JOIN jobs j ON aj.job_id = j.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY aj.created_at DESC`,
      params
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Get candidates error:', err);
    res.status(500).json({ error: 'Lỗi khi tải danh sách ứng viên' });
  }
}

async function getCandidateStats(req, res) {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE COALESCE(NULLIF(TRIM(aj.status), ''), 'pending') = 'pending')::int AS pending,
          COUNT(*) FILTER (WHERE COALESCE(NULLIF(TRIM(aj.status), ''), 'pending') = 'interview')::int AS interview,
          COUNT(*) FILTER (WHERE COALESCE(NULLIF(TRIM(aj.status), ''), 'pending') = 'hired')::int AS hired,
          COUNT(*) FILTER (WHERE COALESCE(NULLIF(TRIM(aj.status), ''), 'pending') = 'rejected')::int AS rejected
       FROM applied_jobs aj
       JOIN jobs j ON aj.job_id = j.id
       WHERE j.employer_id = $1`,
      [userId]
    );

    res.json({ data: result.rows[0] || { total: 0, pending: 0, interview: 0, hired: 0, rejected: 0 } });
  } catch (err) {
    console.error('Get candidate stats error:', err);
    res.status(500).json({ error: 'Lỗi khi tải thống kê ứng viên' });
  }
}

async function getCandidateById(req, res) {
  try {
    const userId = req.user.id;
    const applicationId = req.params.id;
    const result = await pool.query(
      `SELECT aj.id, aj.user_id, aj.job_id, aj.cv_text, aj.note, aj.interview_at, aj.interview_mode,
              aj.interview_link, aj.created_at, aj.updated_at,
              COALESCE(NULLIF(TRIM(aj.status), ''), 'pending') as status,
              u.full_name as candidate_name, u.email as candidate_email, u.phone as candidate_phone, u.avatar_url,
              j.job_title as job_title
       FROM applied_jobs aj
       JOIN users u ON aj.user_id = u.id
       JOIN jobs j ON aj.job_id = j.id
       WHERE aj.id = $1 AND j.employer_id = $2`,
      [applicationId, userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Không tìm thấy ứng viên' });
    }

    const candidate = result.rows[0];
    const skills = candidate.cv_text
      ? candidate.cv_text.split(/[\n,|]/).map((item) => item.trim()).filter(Boolean).slice(0, 10)
      : [];

    res.json({
      data: {
        ...candidate,
        skills,
        experience_summary: candidate.cv_text || '',
        cv_file_url: null,
      }
    });
  } catch (err) {
    console.error('Get candidate detail error:', err);
    res.status(500).json({ error: 'Lỗi khi tải chi tiết ứng viên' });
  }
}

/**
 * GET /api/employer/profile
 * Lấy thông tin hồ sơ công ty
 */
async function getProfile(req, res) {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT id, email, full_name, company_name, company_description, company_city, company_website, company_size, phone, avatar_url FROM users WHERE id = $1',
      [userId]
    );
    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Lỗi khi tải hồ sơ công ty' });
  }
}

/**
 * PUT /api/employer/profile
 * Cập nhật thông tin hồ sơ công ty
 */
async function updateProfile(req, res) {
  try {
    const userId = req.user.id;
    const { company_name, company_description, company_city, company_website, company_size, phone } = req.body;
    
    const result = await pool.query(
      `UPDATE users 
       SET company_name = $1, company_description = $2, company_city = $3, 
           company_website = $4, company_size = $5, phone = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING id, company_name, company_description, company_city, company_website, company_size, phone`,
      [
        company_name?.trim() || null,
        company_description?.trim() || null,
        company_city?.trim() || null,
        company_website?.trim() || null,
        company_size?.trim() || null,
        phone?.trim() || null,
        userId
      ]
    );
    
    res.json({ message: 'Cập nhật hồ sơ thành công!', data: result.rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Lỗi khi cập nhật hồ sơ' });
  }
}

/**
 * GET /api/employer/notifications
 * Danh sách thông báo cho employer
 */
async function getNotifications(req, res) {
  try {
    const userId = req.user.id;
    // Tạm thời lấy các ứng tuyển mới làm thông báo
    const result = await pool.query(
      `SELECT aj.id, 'candidate' as type, 'Ứng viên mới' as title, 
              u.full_name || ' vừa ứng tuyển vào vị trí ' || j.job_title as message,
              aj.created_at as time, FALSE as read
       FROM applied_jobs aj
       JOIN users u ON aj.user_id = u.id
       JOIN jobs j ON aj.job_id = j.id
       WHERE j.employer_id = $1
       ORDER BY aj.created_at DESC
       LIMIT 20`,
      [userId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Lỗi khi tải thông báo' });
  }
}

/**
 * GET /api/employer/analytics
 * Dữ liệu thống kê chi tiết
 */
async function getAnalytics(req, res) {
  try {
    const userId = req.user.id;
    
    // Thống kê theo tuần (7 ngày qua)
    const weeklyStats = await pool.query(
      `SELECT TO_CHAR(created_at, 'Dy') as day, COUNT(*) as count
       FROM applied_jobs aj
       JOIN jobs j ON aj.job_id = j.id
       WHERE j.employer_id = $1 AND aj.created_at >= NOW() - INTERVAL '7 days'
       GROUP BY TO_CHAR(created_at, 'Dy'), DATE_TRUNC('day', aj.created_at)
       ORDER BY DATE_TRUNC('day', aj.created_at)`,
      [userId]
    );

    // Thống kê theo nguồn (giả định)
    const sourceStats = [
      { source: 'Tìm kiếm hữu cơ', count: 45 },
      { source: 'Mạng xã hội', count: 35 },
      { source: 'Giới thiệu', count: 20 },
    ];

    res.json({
      weekly: weeklyStats.rows,
      sources: sourceStats,
    });
  } catch (err) {
    console.error('Get analytics error:', err);
    res.status(500).json({ error: 'Lỗi khi tải thống kê' });
  }
}

async function getAnalyticsV2(req, res) {
  try {
    const userId = req.user.id;
    const deadlineDateSql = buildDeadlineSqlExpression('j.submission_deadline');

    const [summaryResult, weeklyResult, statusResult, topJobsResult] = await Promise.all([
      pool.query(
        `SELECT
            COUNT(DISTINCT j.id) AS total_jobs,
            COUNT(DISTINCT CASE WHEN ${deadlineDateSql} IS NULL OR ${deadlineDateSql} >= CURRENT_DATE THEN j.id END) AS active_jobs,
            COUNT(aj.id) AS total_candidates,
            COUNT(CASE WHEN aj.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) AS new_candidates
         FROM jobs j
         LEFT JOIN applied_jobs aj ON aj.job_id = j.id
         WHERE j.employer_id = $1`,
        [userId]
      ),
      pool.query(
        `WITH days AS (
            SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day')::date AS day_date
          ),
          applications AS (
            SELECT DATE(aj.created_at) AS day_date, COUNT(*)::int AS count
            FROM applied_jobs aj
            JOIN jobs j ON aj.job_id = j.id
            WHERE j.employer_id = $1
              AND aj.created_at >= CURRENT_DATE - INTERVAL '6 days'
            GROUP BY DATE(aj.created_at)
          )
          SELECT
            TO_CHAR(days.day_date, 'DD/MM') AS label,
            TO_CHAR(days.day_date, 'Dy') AS day,
            COALESCE(applications.count, 0) AS count
          FROM days
          LEFT JOIN applications ON applications.day_date = days.day_date
          ORDER BY days.day_date`,
        [userId]
      ),
      pool.query(
        `SELECT
            COALESCE(NULLIF(TRIM(aj.status), ''), 'pending') AS status,
            COUNT(*)::int AS count
         FROM applied_jobs aj
         JOIN jobs j ON aj.job_id = j.id
         WHERE j.employer_id = $1
         GROUP BY COALESCE(NULLIF(TRIM(aj.status), ''), 'pending')
         ORDER BY count DESC, status ASC`,
        [userId]
      ),
      pool.query(
        `SELECT
            j.id,
            j.job_title AS title,
            COUNT(aj.id)::int AS applicant_count
         FROM jobs j
         LEFT JOIN applied_jobs aj ON aj.job_id = j.id
         WHERE j.employer_id = $1
         GROUP BY j.id, j.job_title
         ORDER BY applicant_count DESC, j.id DESC
         LIMIT 5`,
        [userId]
      )
    ]);

    const summary = summaryResult.rows[0] || {};
    const totalJobs = parseInt(summary.total_jobs || 0, 10);
    const activeJobs = parseInt(summary.active_jobs || 0, 10);
    const totalCandidates = parseInt(summary.total_candidates || 0, 10);
    const newCandidates = parseInt(summary.new_candidates || 0, 10);

    res.json({
      summary: {
        totalJobs,
        activeJobs,
        totalCandidates,
        newCandidates,
        conversionRate: activeJobs > 0 ? Number(((totalCandidates / activeJobs) * 100).toFixed(1)) : 0,
      },
      weekly: weeklyResult.rows.map((row) => ({
        ...row,
        count: parseInt(row.count, 10) || 0,
      })),
      statuses: statusResult.rows.map((row) => ({
        ...row,
        count: parseInt(row.count, 10) || 0,
      })),
      topJobs: topJobsResult.rows.map((row) => ({
        ...row,
        applicant_count: parseInt(row.applicant_count, 10) || 0,
      })),
    });
  } catch (err) {
    console.error('Get analytics error:', err);
    res.status(500).json({ error: 'Lỗi khi tải thống kê' });
  }
}

/**
 * PUT /api/employer/jobs/:id
 * Cập nhật tin tuyển dụng
 */
async function updateJob(req, res) {
  try {
    const userId = req.user.id;
    const jobId = req.params.id;
    const {
      title, description, requirements, benefits, location,
      salary, salary_min, salary_max, job_type, experience,
      deadline, positions, tags
    } = req.body;

    // Kiểm tra quyền sở hữu
    const check = await pool.query('SELECT id FROM jobs WHERE id = $1 AND employer_id = $2', [jobId, userId]);
    if (!ownership || check.rows.length === 0) {
      return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa tin này' });
    }

    const normalizedDeadline = normalizeDeadline(deadline);
    const normalizedSalary = salary || normalizeSalary(salary_min, salary_max);
    const normalizedTags = Array.isArray(tags)
      ? tags.map((tag) => String(tag).trim()).filter(Boolean).join(', ')
      : typeof tags === 'string'
        ? tags
        : null;

    const result = await pool.query(
      `UPDATE jobs 
       SET job_title = $1, job_description = $2, job_requirements = $3, benefits = $4, 
           job_address = $5, salary = $6, job_type = $7, years_of_experience = $8, 
           submission_deadline = $9, number_candidate = $10, tags = $11, updated_at = NOW()
       WHERE id = $12 AND employer_id = $13
       RETURNING *`,
      [
        title, description, requirements, benefits, location,
        normalizedSalary, job_type, experience, normalizedDeadline,
        parseInt(positions) || 1, normalizedTags, jobId, userId
      ]
    );

    res.json({ message: 'Cập nhật thành công!', job: result.rows[0] });
  } catch (err) {
    console.error('Update job error:', err);
    res.status(500).json({ error: 'Lỗi khi cập nhật tin' });
  }
}

/**
 * PATCH /api/employer/jobs/:id/status
 * Cập nhật trạng thái tin (ngừng tuyển)
 */
async function updateJobStatus(req, res) {
  try {
    const userId = req.user.id;
    const jobId = req.params.id;
    const { status } = req.body; // VD: 'Ngừng tuyển'

    // Trong database hiện tại chưa thấy cột status rõ ràng, tạm thời dùng deadline để ẩn tin nếu cần
    // Hoặc giả định có cột status. Nếu không có, ta dùng submission_deadline = quá khứ
    const newDeadline = status === 'Ngừng tuyển' ? new Date(Date.now() - 86400000) : null;

    const result = await pool.query(
      `UPDATE jobs SET submission_deadline = $1, updated_at = NOW() WHERE id = $2 AND employer_id = $3 RETURNING id`,
      [newDeadline, jobId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Không tìm thấy tin hoặc không có quyền' });
    }

    res.json({ message: 'Đã cập nhật trạng thái tin' });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Lỗi khi cập nhật trạng thái' });
  }
}

/**
 * DELETE /api/employer/jobs/:id
 * Xóa tin tuyển dụng
 */
async function deleteJob(req, res) {
  try {
    const userId = req.user.id;
    const jobId = req.params.id;

    // Xóa các ứng tuyển liên quan trước (nếu database không có ON DELETE CASCADE)
    await pool.query('DELETE FROM applied_jobs WHERE job_id = $1', [jobId]);
    await pool.query('DELETE FROM saved_jobs WHERE job_id = $1', [jobId]);

    const result = await pool.query(
      'DELETE FROM jobs WHERE id = $1 AND employer_id = $2 RETURNING id',
      [jobId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Không tìm thấy tin hoặc không có quyền' });
    }

    res.json({ message: 'Đã xóa tin tuyển dụng thành công' });
  } catch (err) {
    console.error('Delete job error:', err);
    res.status(500).json({ error: 'Lỗi khi xóa tin' });
  }
}

/**
 * PATCH /api/employer/applications/:id/status
 * Cập nhật trạng thái hồ sơ ứng tuyển (Duyệt, Phỏng vấn, Từ chối...)
 */
async function updateApplicationStatus(req, res) {
  try {
    const userId = req.user.id;
    const applicationId = req.params.id;
    const { status } = req.body; // pending, interview, hired, rejected
    const normalizedStatus = normalizeApplicationStatus(status);

    // Kiểm tra quyền sở hữu (job của application này phải thuộc về employer này)
    const ownership = await getCandidateOwnership(applicationId, userId);
    const check = await pool.query(
      `SELECT aj.id FROM applied_jobs aj
       JOIN jobs j ON aj.job_id = j.id
       WHERE aj.id = $1 AND j.employer_id = $2`,
      [applicationId, userId]
    );

    if (!ownership || check.rows.length === 0) {
      return res.status(403).json({ error: 'Không có quyền thay đổi hồ sơ này' });
    }

    const result = await pool.query(
      `UPDATE applied_jobs
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, COALESCE(NULLIF(TRIM(status), ''), 'pending') as status, updated_at`,
      [normalizedStatus, applicationId]
    );

    res.json({ message: 'Đã cập nhật trạng thái ứng viên' });
  } catch (err) {
    console.error('Update app status error:', err);
    res.status(500).json({ error: 'Lỗi khi cập nhật trạng thái' });
  }
}

async function updateCandidateStatus(req, res) {
  try {
    const userId = req.user.id;
    const applicationId = req.params.id;
    const normalizedStatus = normalizeApplicationStatus(req.body.status);

    const ownership = await getCandidateOwnership(applicationId, userId);
    if (!ownership) {
      return res.status(403).json({ error: 'Không có quyền thay đổi hồ sơ này' });
    }

    const result = await pool.query(
      `UPDATE applied_jobs
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, COALESCE(NULLIF(TRIM(status), ''), 'pending') as status, updated_at`,
      [normalizedStatus, applicationId]
    );

    res.json({ message: 'Đã cập nhật trạng thái ứng viên', data: result.rows[0] });
  } catch (err) {
    console.error('Update candidate status error:', err);
    res.status(500).json({ error: 'Lỗi khi cập nhật trạng thái ứng viên' });
  }
}

async function saveCandidateNote(req, res) {
  try {
    const userId = req.user.id;
    const applicationId = req.params.id;
    const note = req.body.note?.trim() || null;

    const ownership = await getCandidateOwnership(applicationId, userId);
    if (!ownership) {
      return res.status(403).json({ error: 'Không có quyền cập nhật ghi chú cho ứng viên này' });
    }

    const result = await pool.query(
      `UPDATE applied_jobs
       SET note = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, note, updated_at`,
      [note, applicationId]
    );

    res.json({ message: 'Đã lưu ghi chú nội bộ', data: result.rows[0] });
  } catch (err) {
    console.error('Save candidate note error:', err);
    res.status(500).json({ error: 'Lỗi khi lưu ghi chú nội bộ' });
  }
}

async function scheduleInterview(req, res) {
  try {
    const userId = req.user.id;
    const applicationId = req.params.id;
    const { interview_at, interview_mode, interview_link } = req.body;

    const ownership = await getCandidateOwnership(applicationId, userId);
    if (!ownership) {
      return res.status(403).json({ error: 'Không có quyền lên lịch phỏng vấn cho ứng viên này' });
    }

    const normalizedAt = interview_at ? new Date(interview_at) : null;
    if (!normalizedAt || Number.isNaN(normalizedAt.getTime())) {
      return res.status(400).json({ error: 'Ngày giờ phỏng vấn không hợp lệ' });
    }

    const result = await pool.query(
      `UPDATE applied_jobs
       SET status = 'interview',
           interview_at = $1,
           interview_mode = $2,
           interview_link = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, COALESCE(NULLIF(TRIM(status), ''), 'pending') as status,
                 interview_at, interview_mode, interview_link, updated_at`,
      [normalizedAt.toISOString(), interview_mode?.trim() || 'online', interview_link?.trim() || null, applicationId]
    );

    res.json({ message: 'Đã lên lịch phỏng vấn', data: result.rows[0] });
  } catch (err) {
    console.error('Schedule interview error:', err);
    res.status(500).json({ error: 'Lỗi khi lên lịch phỏng vấn' });
  }
}

module.exports = { 
  ensureEmployerJobSchemaForRequest,
  getDashboard, createJob, getMyJobs, getCandidates, getCandidateStats, getCandidateById, getProfile, 
  updateProfile, getNotifications, getAnalytics: getAnalyticsV2,
  updateJob, updateJobStatus, deleteJob, updateApplicationStatus: updateCandidateStatus, saveCandidateNote, scheduleInterview
};
