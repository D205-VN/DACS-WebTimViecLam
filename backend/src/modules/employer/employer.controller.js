const pool = require('../../infrastructure/database/postgres');
const { createNotification, createNotificationsForUsers } = require('../notifications/notification.service');
const { resolveCurrentLocationPayload } = require('../../core/utils/currentLocation');
const { ensureVerificationSchema } = require('../verification/verification.model');
const { ensureJobAnalyticsSchema } = require('../jobs/job.model');
const {
  ensureEmployerJobSchema,
  ensureEmployerProfileSchema,
  ensureEmployerApplicationSchema,
  ensureCompanyBrandingSchema,
} = require('./employer.model');

function normalizeDeadline(deadline) {
  if (!deadline) return null;
  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split('T')[0];
}

function isPastDeadline(normalizedDeadline) {
  if (!normalizedDeadline) return false;
  const endOfDeadline = new Date(`${normalizedDeadline}T23:59:59.999`);
  return !Number.isNaN(endOfDeadline.getTime()) && endOfDeadline.getTime() < Date.now();
}

function normalizeSalary(salaryMin, salaryMax) {
  const min = Number.isFinite(Number(salaryMin)) && String(salaryMin).trim() !== '' ? Number(salaryMin) : null;
  const max = Number.isFinite(Number(salaryMax)) && String(salaryMax).trim() !== '' ? Number(salaryMax) : null;

  if (min !== null && max !== null) return `${min.toLocaleString('vi-VN')} - ${max.toLocaleString('vi-VN')} VND`;
  if (min !== null) return `Từ ${min.toLocaleString('vi-VN')} VND`;
  if (max !== null) return `Lên đến ${max.toLocaleString('vi-VN')} VND`;
  return 'Thỏa thuận';
}

function normalizeJobModerationStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  return ['pending', 'approved', 'rejected', 'stopped'].includes(normalized) ? normalized : 'approved';
}

async function ensureEmployerJobSchemaForRequest(req, res, next) {
  try {
    await ensureEmployerJobSchema();
    await ensureEmployerProfileSchema();
    await ensureEmployerApplicationSchema();
    await ensureJobAnalyticsSchema();
    await ensureCompanyBrandingSchema();
    return next();
  } catch (err) {
    console.error('Ensure employer job schema error:', err);
    return res.status(500).json({ error: 'Lỗi cấu hình dữ liệu tuyển dụng' });
  }
}

function normalizeApplicationStatus(status) {
  const allowed = ['pending', 'interview', 'hired', 'rejected'];
  return allowed.includes(status) ? status : 'pending';
}

function normalizeInterviewMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['online', 'offline'].includes(normalized) ? normalized : null;
}

function stripHtml(value = '') {
  return String(value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildVerificationPublicUrl(verificationCode) {
  return verificationCode ? `/verify/${verificationCode}` : null;
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

async function getAdminUserIds() {
  const result = await pool.query(
    `SELECT u.id
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE r.code = 'admin'`
  );

  return result.rows.map((row) => row.id);
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

function buildSalaryExpressions(columnName) {
  const normalizedSalaryExpr = `regexp_replace(lower(COALESCE(${columnName}, '')), '\\s+', '', 'g')`;
  const salaryLowerTokenExpr = `split_part(${normalizedSalaryExpr}, '-', 1)`;
  const salaryUpperTokenExpr = `CASE
    WHEN POSITION('-' IN ${normalizedSalaryExpr}) > 0
      THEN split_part(${normalizedSalaryExpr}, '-', 2)
    ELSE split_part(${normalizedSalaryExpr}, '-', 1)
  END`;

  const buildSalaryValueExpression = (tokenExpr) => `CASE
    WHEN COALESCE(TRIM(${columnName}), '') = '' THEN NULL
    WHEN lower(${columnName}) ~ 'th[oỏ]a\\s*thu[aậ]n|thuong\\s*luong|c[aạ]nh\\s*tranh' THEN NULL
    WHEN NULLIF(regexp_replace(${tokenExpr}, '[^0-9]', '', 'g'), '') IS NULL THEN NULL
    WHEN lower(${columnName}) ~ '(usd|\\$)' THEN regexp_replace(${tokenExpr}, '[^0-9]', '', 'g')::numeric * 25000
    WHEN regexp_replace(${tokenExpr}, '[^0-9]', '', 'g')::numeric < 1000 THEN regexp_replace(${tokenExpr}, '[^0-9]', '', 'g')::numeric * 1000000
    ELSE regexp_replace(${tokenExpr}, '[^0-9]', '', 'g')::numeric
  END`;

  const salaryLowerExpr = buildSalaryValueExpression(salaryLowerTokenExpr);
  const salaryUpperExpr = buildSalaryValueExpression(salaryUpperTokenExpr);
  const salaryMidExpr = `CASE
    WHEN ${salaryLowerExpr} IS NOT NULL AND ${salaryUpperExpr} IS NOT NULL THEN ((${salaryLowerExpr} + ${salaryUpperExpr}) / 2.0)
    ELSE COALESCE(${salaryLowerExpr}, ${salaryUpperExpr})
  END`;

  return {
    salaryLowerExpr,
    salaryUpperExpr,
    salaryMidExpr,
  };
}

function buildJobDescriptionInsights(jobs = []) {
  const insights = [];

  jobs.forEach((job) => {
    const title = job.title || 'Tin tuyển dụng';
    const descriptionText = stripHtml(job.description || '');
    const requirementsText = stripHtml(job.requirements || '');
    const benefitsText = stripHtml(job.benefits || '');
    const viewCount = parseInt(job.view_count || 0, 10);
    const applicantCount = parseInt(job.applicant_count || 0, 10);
    const conversionRate = viewCount > 0 ? (applicantCount / viewCount) * 100 : 0;
    const salaryText = String(job.salary || '').toLowerCase();

    if (descriptionText.length < 250) {
      insights.push({
        job_id: job.id,
        title,
        severity: 'high',
        type: 'description_length',
        message: 'Mô tả công việc còn ngắn, ứng viên có thể chưa hiểu rõ phạm vi công việc.',
        recommendation: 'Bổ sung mục tiêu vai trò, nhiệm vụ hằng ngày, stack công nghệ/công cụ và tiêu chí thành công trong 3 tháng đầu.',
      });
    }

    if (requirementsText.length < 160) {
      insights.push({
        job_id: job.id,
        title,
        severity: 'medium',
        type: 'requirements_detail',
        message: 'Yêu cầu ứng viên chưa đủ cụ thể để lọc đúng hồ sơ.',
        recommendation: 'Tách rõ yêu cầu bắt buộc và điểm cộng, nêu số năm kinh nghiệm, kỹ năng chính và mức độ thành thạo.',
      });
    }

    if (!benefitsText) {
      insights.push({
        job_id: job.id,
        title,
        severity: 'medium',
        type: 'benefits_missing',
        message: 'Tin chưa nêu quyền lợi nổi bật.',
        recommendation: 'Thêm phúc lợi, lộ trình phát triển, chính sách làm việc linh hoạt hoặc cơ hội học tập để tăng tỷ lệ ứng tuyển.',
      });
    }

    if (!job.salary || salaryText.includes('thỏa thuận') || salaryText.includes('thoả thuận')) {
      insights.push({
        job_id: job.id,
        title,
        severity: 'medium',
        type: 'salary_transparency',
        message: 'Mức lương chưa minh bạch nên có thể làm giảm chuyển đổi.',
        recommendation: 'Cân nhắc công bố khoảng lương hoặc ghi rõ cấu trúc lương, thưởng và điều kiện review.',
      });
    }

    if (viewCount >= 10 && applicantCount === 0) {
      insights.push({
        job_id: job.id,
        title,
        severity: 'high',
        type: 'low_conversion',
        message: `Tin có ${viewCount} lượt xem nhưng chưa có ứng tuyển.`,
        recommendation: 'Rà lại tiêu đề, mức lương, yêu cầu bắt buộc và lời kêu gọi ứng tuyển. Có thể giảm bớt yêu cầu không thiết yếu.',
      });
    } else if (viewCount >= 20 && conversionRate < 3) {
      insights.push({
        job_id: job.id,
        title,
        severity: 'medium',
        type: 'conversion_rate',
        message: `Tỷ lệ chuyển đổi chỉ ${conversionRate.toFixed(1)}% từ lượt xem sang ứng tuyển.`,
        recommendation: 'Đưa thông tin quan trọng lên đầu tin: lương, địa điểm, hình thức làm việc, quy trình phỏng vấn và quyền lợi khác biệt.',
      });
    }
  });

  const severityRank = { high: 0, medium: 1, low: 2 };
  return insights
    .sort((left, right) => (severityRank[left.severity] ?? 9) - (severityRank[right.severity] ?? 9))
    .slice(0, 6);
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
    const [
      totalJobsResult,
      activeJobsResult,
      pendingJobsResult,
      rejectedJobsResult,
      totalCandidatesResult,
      newCandidatesResult,
      recentJobsResult,
    ] = await Promise.all([
      pool.query(
        'SELECT COUNT(*) FROM jobs WHERE employer_id = $1',
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*) FROM jobs
         WHERE employer_id = $1
           AND COALESCE(NULLIF(TRIM(status), ''), 'approved') = 'approved'
           AND (${deadlineDateSql} IS NULL OR ${deadlineDateSql} >= CURRENT_DATE)`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*) FROM jobs
         WHERE employer_id = $1
           AND COALESCE(NULLIF(TRIM(status), ''), 'approved') = 'pending'`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*) FROM jobs
         WHERE employer_id = $1
           AND COALESCE(NULLIF(TRIM(status), ''), 'approved') = 'rejected'`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*) FROM applied_jobs aj 
         JOIN jobs j ON aj.job_id = j.id 
         WHERE j.employer_id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*) FROM applied_jobs aj 
         JOIN jobs j ON aj.job_id = j.id 
         WHERE j.employer_id = $1 AND aj.created_at >= NOW() - INTERVAL '7 days'`,
        [userId]
      ),
      pool.query(
        `SELECT j.id, j.job_title as title, j.job_address as location, j.salary, 
                j.submission_deadline as deadline, j.created_at,
                COALESCE(NULLIF(TRIM(j.status), ''), 'approved') as status,
                (SELECT COUNT(*) FROM applied_jobs WHERE job_id = j.id) as applicant_count
         FROM jobs j 
         WHERE j.employer_id = $1 
         ORDER BY j.created_at DESC 
         LIMIT 5`,
        [userId]
      ),
    ]);

    console.log(`Dashboard stats for user ${userId}:`, {
      totalJobs: totalJobsResult.rows[0].count,
      activeJobs: activeJobsResult.rows[0].count,
      pendingJobs: pendingJobsResult.rows[0].count,
      rejectedJobs: rejectedJobsResult.rows[0].count,
      totalCandidates: totalCandidatesResult.rows[0].count,
      newCandidates: newCandidatesResult.rows[0].count,
    });
    console.log(`Recent jobs for user ${userId}:`, recentJobsResult.rows.length);

    res.json({
      stats: {
        totalJobs: parseInt(totalJobsResult.rows[0].count),
        activeJobs: parseInt(activeJobsResult.rows[0].count),
        pendingJobs: parseInt(pendingJobsResult.rows[0].count),
        rejectedJobs: parseInt(rejectedJobsResult.rows[0].count),
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
      salary_min, salary_max, job_type,
      experience, deadline, tags, positions
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Tiêu đề và mô tả là bắt buộc' });
    }

    const resolvedLocation = resolveCurrentLocationPayload(req.body);
    if (resolvedLocation.error) {
      return res.status(400).json({ error: resolvedLocation.error });
    }

    // Lấy thông tin công ty từ user
    const userResult = await pool.query(
      'SELECT company_name, company_city FROM users WHERE id = $1', [userId]
    );
    const company = userResult.rows[0];
    const normalizedDeadline = normalizeDeadline(deadline);
    if (isPastDeadline(normalizedDeadline)) {
      return res.status(400).json({ error: 'Hạn nộp hồ sơ không được nhỏ hơn ngày hiện tại' });
    }
    const normalizedSalary = normalizeSalary(salary_min, salary_max);
    const normalizedTags = Array.isArray(tags)
      ? tags.map((tag) => String(tag).trim()).filter(Boolean).join(', ')
      : null;

    const result = await pool.query(
      `INSERT INTO jobs (job_title, job_description, job_requirements, benefits, job_address, salary, 
                         job_type, years_of_experience, submission_deadline, number_candidate, employer_id, company_name, tags, status, created_at, updated_at, location_lat, location_lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending', NOW(), NOW(), $14, $15)
       RETURNING *`,
      [
        title, description, requirements || null, benefits || null,
        resolvedLocation.location,
        normalizedSalary,
        job_type || 'Toàn thời gian',
        experience || 'Không yêu cầu',
        normalizedDeadline,
        parseInt(positions) || 1,
        userId,
        company?.company_name || null,
        normalizedTags,
        resolvedLocation.lat,
        resolvedLocation.lng,
      ]
    );

    const adminUserIds = await getAdminUserIds();
    await createNotificationsForUsers(adminUserIds, {
      type: 'admin_job_pending',
      title: 'Có tin tuyển dụng mới chờ duyệt',
      message: `${company?.company_name || 'Nhà tuyển dụng'} vừa gửi tin ${title} để admin phê duyệt.`,
      to: '/admin/dashboard',
      tab: 'jobs',
      meta: { job_id: result.rows[0]?.id || null, employer_id: userId },
    }).catch((notificationError) => {
      console.error('Create admin pending job notifications error:', notificationError);
    });

    res.status(201).json({
      message: 'Tin tuyển dụng đã được gửi và đang chờ admin phê duyệt.',
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
              j.salary, COALESCE(NULLIF(TRIM(j.status), ''), 'approved') as status,
              j.job_description as description, j.job_requirements as requirements,
              j.benefits, j.created_at, j.updated_at, j.number_candidate as positions, j.tags,
              (SELECT COUNT(*) FROM applied_jobs WHERE job_id = j.id) as applicant_count,
              (SELECT COUNT(*) FROM applied_jobs WHERE job_id = j.id AND created_at >= NOW() - INTERVAL '7 days') as recent_applicant_count
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
      `SELECT aj.id, aj.user_id, aj.job_id, aj.cv_text, aj.cv_id, aj.cover_letter, aj.note, aj.interview_at, aj.interview_mode,
              aj.candidate_interview_mode,
              aj.interview_link, aj.created_at, aj.updated_at,
              COALESCE(NULLIF(TRIM(aj.status), ''), 'pending') as status,
              u.full_name as candidate_name, u.email as candidate_email, u.phone as candidate_phone, u.avatar_url,
              j.job_title as job_title, j.company_address, j.company_name,
              COALESCE(NULLIF(TRIM(j.status), ''), 'approved') as job_status,
              j.submission_deadline as job_deadline
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
    await ensureVerificationSchema();

    const userId = req.user.id;
    const applicationId = req.params.id;
    const result = await pool.query(
      `SELECT aj.id, aj.user_id, aj.job_id, aj.cv_text, aj.cv_id, aj.cover_letter, aj.note, aj.interview_at, aj.interview_mode,
              aj.candidate_interview_mode,
              aj.interview_link, aj.created_at, aj.updated_at,
              COALESCE(NULLIF(TRIM(aj.status), ''), 'pending') as status,
              u.full_name as candidate_name, u.email as candidate_email, u.phone as candidate_phone, u.avatar_url,
              j.job_title as job_title,
              j.company_address,
              j.company_name,
              cv.id as resolved_cv_id,
              cv.title as cv_title,
              cv.target_role as cv_target_role,
              cv.html_content as cv_html_content,
              cv.created_at as cv_created_at,
              cv_chain.verification_code as cv_verification_code,
              cv_chain.created_at as cv_notarized_at
       FROM applied_jobs aj
       JOIN users u ON aj.user_id = u.id
       JOIN jobs j ON aj.job_id = j.id
       LEFT JOIN LATERAL (
         SELECT id, title, target_role, html_content, created_at
         FROM user_cvs
         WHERE user_id = aj.user_id
         ORDER BY CASE WHEN id = aj.cv_id THEN 0 ELSE 1 END, created_at DESC, id DESC
         LIMIT 1
       ) cv ON TRUE
       LEFT JOIN LATERAL (
         SELECT verification_code, created_at
         FROM blockchain_blocks
         WHERE asset_type = 'cv' AND asset_id = cv.id
         ORDER BY block_index DESC
         LIMIT 1
       ) cv_chain ON TRUE
       WHERE aj.id = $1 AND j.employer_id = $2`,
      [applicationId, userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Không tìm thấy ứng viên' });
    }

    const candidate = result.rows[0];
    const cvPlainText = stripHtml(candidate.cv_html_content || candidate.cv_text || '');
    const skills = cvPlainText
      ? cvPlainText.split(/[\n,|]/).map((item) => item.trim()).filter(Boolean).slice(0, 10)
      : [];
    const workHistoriesResult = await pool.query(
      `SELECT id, company_name, job_title, employment_type, start_date, end_date,
              currently_working, summary, status, verification_code, created_at, updated_at
       FROM user_work_histories
       WHERE user_id = $1
       ORDER BY currently_working DESC, start_date DESC NULLS LAST, created_at DESC, id DESC`,
      [candidate.user_id]
    );

    res.json({
      data: {
        ...candidate,
        skills,
        experience_summary: cvPlainText || '',
        cv_file_url: null,
        cv_html_content: candidate.cv_html_content || null,
        work_histories: workHistoriesResult.rows.map((row) => ({
          ...row,
          public_url: buildVerificationPublicUrl(row.verification_code),
        })),
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
      `SELECT id, email, full_name, company_name, company_description, company_city, company_website,
              company_size, phone, avatar_url, company_cover_url,
              COALESCE(company_gallery, '[]'::jsonb) AS company_gallery,
              company_video_url,
              COALESCE(company_perks, '[]'::jsonb) AS company_perks,
              company_founded_year, company_industry
       FROM users WHERE id = $1`,
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
    const {
      company_name,
      company_description,
      company_city,
      company_website,
      company_size,
      phone,
      avatar_url,
      company_cover_url,
      company_gallery,
      company_video_url,
      company_perks,
      company_founded_year,
      company_industry,
    } = req.body;

    const currentUserResult = await pool.query(
      'SELECT avatar_url, company_cover_url, company_gallery FROM users WHERE id = $1',
      [userId]
    );
    const currentUser = currentUserResult.rows[0] || {};
    const resolveImageValue = (incomingValue, currentValue) => {
      if (incomingValue === undefined) return currentValue || null;
      const trimmed = String(incomingValue || '').trim();
      return trimmed || null;
    };

    // Validate and normalize gallery (max 8 images)
    let normalizedGallery = currentUser.company_gallery || [];
    if (company_gallery !== undefined) {
      const galleryArr = Array.isArray(company_gallery) ? company_gallery : [];
      normalizedGallery = galleryArr.slice(0, 8);
    }

    // Validate and normalize perks (max 12)
    let normalizedPerks = [];
    if (company_perks !== undefined) {
      const perksArr = Array.isArray(company_perks) ? company_perks : [];
      normalizedPerks = perksArr.slice(0, 12).map((perk) => ({
        icon: String(perk.icon || '').slice(0, 10),
        title: String(perk.title || '').trim().slice(0, 100),
        description: String(perk.description || '').trim().slice(0, 300),
      }));
    } else {
      const currentPerksResult = await pool.query('SELECT company_perks FROM users WHERE id = $1', [userId]);
      normalizedPerks = currentPerksResult.rows[0]?.company_perks || [];
    }

    const result = await pool.query(
      `UPDATE users 
       SET company_name = $1, company_description = $2, company_city = $3, 
           company_website = $4, company_size = $5, phone = $6,
           avatar_url = $7, company_cover_url = $8,
           company_gallery = $9::jsonb, company_video_url = $10,
           company_perks = $11::jsonb,
           company_founded_year = $12, company_industry = $13,
           updated_at = NOW()
       WHERE id = $14
       RETURNING id, company_name, company_description, company_city, company_website, company_size,
                 phone, avatar_url, company_cover_url, company_gallery, company_video_url,
                 company_perks, company_founded_year, company_industry`,
      [
        company_name?.trim() || null,
        company_description?.trim() || null,
        company_city?.trim() || null,
        company_website?.trim() || null,
        company_size?.trim() || null,
        phone?.trim() || null,
        resolveImageValue(avatar_url, currentUser.avatar_url),
        resolveImageValue(company_cover_url, currentUser.company_cover_url),
        JSON.stringify(normalizedGallery),
        company_video_url?.trim() || null,
        JSON.stringify(normalizedPerks),
        company_founded_year?.trim() || null,
        company_industry?.trim() || null,
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
 * GET /api/jobs/company-profile?name=<company_name>
 * Public endpoint — Lấy toàn bộ branding của 1 công ty cho ứng viên xem
 */
async function getCompanyPublicProfile(req, res) {
  try {
    await ensureCompanyBrandingSchema();
    const { name } = req.query;
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Thiếu tên công ty' });
    }

    const profileResult = await pool.query(
      `SELECT u.id, u.company_name, u.company_description, u.company_city, u.company_website,
              u.company_size, u.avatar_url, u.company_cover_url,
              COALESCE(u.company_gallery, '[]'::jsonb) AS company_gallery,
              u.company_video_url,
              COALESCE(u.company_perks, '[]'::jsonb) AS company_perks,
              u.company_founded_year, u.company_industry
       FROM users u
       WHERE LOWER(TRIM(u.company_name)) = LOWER(TRIM($1))
         AND u.role_id = (SELECT id FROM roles WHERE code = 'employer' LIMIT 1)
       LIMIT 1`,
      [name.trim()]
    );

    if (!profileResult.rows.length) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin công ty' });
    }

    const company = profileResult.rows[0];

    // Lấy danh sách jobs đang tuyển của công ty
    const jobsResult = await pool.query(
      `SELECT j.id, j.job_title AS title, j.job_address AS location, j.salary,
              j.job_type, j.years_of_experience AS experience,
              j.submission_deadline AS deadline, j.created_at
       FROM jobs j
       WHERE LOWER(TRIM(j.company_name)) = LOWER(TRIM($1))
         AND COALESCE(NULLIF(TRIM(j.status), ''), 'approved') = 'approved'
       ORDER BY j.created_at DESC
       LIMIT 20`,
      [name.trim()]
    );

    res.json({
      data: {
        ...company,
        jobs: jobsResult.rows,
        job_count: jobsResult.rows.length,
      }
    });
  } catch (err) {
    console.error('Get company public profile error:', err);
    res.status(500).json({ error: 'Lỗi khi tải thông tin công ty' });
  }
}

/**
 * GET /api/employer/notifications
 * Danh sách thông báo cho employer
 */
async function getNotifications(req, res) {
  try {
    const userId = req.user.id;
    const [candidateResult, pendingJobResult, rejectedJobResult] = await Promise.all([
      pool.query(
        `SELECT
            'candidate-' || aj.id AS id,
            'candidate' as type,
            'Ứng viên mới' as title,
            u.full_name || ' vừa ứng tuyển vào vị trí ' || j.job_title as message,
            '/employer/dashboard' as to,
            'candidates' as tab,
            aj.created_at as time,
            FALSE as read
         FROM applied_jobs aj
         JOIN users u ON aj.user_id = u.id
         JOIN jobs j ON aj.job_id = j.id
         WHERE j.employer_id = $1
         ORDER BY aj.created_at DESC
         LIMIT 10`,
        [userId]
      ),
      pool.query(
        `SELECT
            'pending-job-' || j.id AS id,
            'warning' as type,
            'Tin đang chờ duyệt' as title,
            COALESCE(j.job_title, 'Tin tuyển dụng') || ' đang chờ admin chấp nhận hoặc từ chối.' as message,
            '/employer/dashboard' as to,
            'jobs' as tab,
            COALESCE(j.updated_at, j.created_at) as time,
            FALSE as read
         FROM jobs j
         WHERE j.employer_id = $1
           AND COALESCE(NULLIF(TRIM(j.status), ''), 'approved') = 'pending'
         ORDER BY COALESCE(j.updated_at, j.created_at) DESC
         LIMIT 10`,
        [userId]
      ),
      pool.query(
        `SELECT
            'rejected-job-' || j.id AS id,
            'rejected' as type,
            'Tin bị từ chối' as title,
            COALESCE(j.job_title, 'Tin tuyển dụng') || ' đã bị từ chối. Hãy chỉnh sửa rồi gửi lại để admin xem xét.' as message,
            '/employer/dashboard' as to,
            'jobs' as tab,
            COALESCE(j.updated_at, j.created_at) as time,
            FALSE as read
         FROM jobs j
         WHERE j.employer_id = $1
           AND COALESCE(NULLIF(TRIM(j.status), ''), 'approved') = 'rejected'
         ORDER BY COALESCE(j.updated_at, j.created_at) DESC
         LIMIT 10`,
        [userId]
      ),
    ]);

    const notifications = [
      ...candidateResult.rows,
      ...pendingJobResult.rows,
      ...rejectedJobResult.rows,
    ]
      .sort((left, right) => new Date(right.time || 0) - new Date(left.time || 0))
      .slice(0, 20);

    res.json({ data: notifications });
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
    await ensureJobAnalyticsSchema();

    const deadlineDateSql = buildDeadlineSqlExpression('j.submission_deadline');
    const approvedJobsWhere = `COALESCE(NULLIF(TRIM(j.status), ''), 'approved') = 'approved'`;
    const openApprovedJobsWhere = `${approvedJobsWhere} AND (${deadlineDateSql} IS NULL OR ${deadlineDateSql} >= CURRENT_DATE)`;
    const { salaryMidExpr } = buildSalaryExpressions('j.salary');

    const [
      summaryResult,
      weeklyResult,
      statusResult,
      topJobsResult,
      sourceResult,
      weeklyViewsResult,
      insightJobsResult,
      marketSummaryResult,
      marketRolesResult,
      marketIndustriesResult,
      marketSkillDemandResult,
    ] = await Promise.all([
      pool.query(
        `SELECT
            COUNT(DISTINCT j.id) AS total_jobs,
            COUNT(DISTINCT CASE
              WHEN COALESCE(NULLIF(TRIM(j.status), ''), 'approved') = 'approved'
               AND (${deadlineDateSql} IS NULL OR ${deadlineDateSql} >= CURRENT_DATE)
              THEN j.id
            END) AS active_jobs,
            COUNT(aj.id) AS total_candidates,
            COUNT(CASE WHEN aj.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) AS new_candidates,
            (
              SELECT COUNT(*)::int
              FROM job_views jv
              JOIN jobs viewed_job ON viewed_job.id = jv.job_id
              WHERE viewed_job.employer_id = $1
            ) AS total_views
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
            COUNT(DISTINCT aj.id)::int AS applicant_count,
            COUNT(DISTINCT jv.id)::int AS view_count
         FROM jobs j
         LEFT JOIN applied_jobs aj ON aj.job_id = j.id
         LEFT JOIN job_views jv ON jv.job_id = j.id
         WHERE j.employer_id = $1
         GROUP BY j.id, j.job_title
         ORDER BY applicant_count DESC, view_count DESC, j.id DESC
         LIMIT 5`,
        [userId]
      ),
      pool.query(
        `SELECT
            COALESCE(NULLIF(TRIM(aj.application_source), ''), 'organic') AS source,
            COUNT(*)::int AS count
         FROM applied_jobs aj
         JOIN jobs j ON aj.job_id = j.id
         WHERE j.employer_id = $1
         GROUP BY COALESCE(NULLIF(TRIM(aj.application_source), ''), 'organic')
         ORDER BY count DESC, source ASC`,
        [userId]
      ),
      pool.query(
        `WITH days AS (
            SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day')::date AS day_date
          ),
          views AS (
            SELECT DATE(jv.created_at) AS day_date, COUNT(*)::int AS count
            FROM job_views jv
            JOIN jobs j ON j.id = jv.job_id
            WHERE j.employer_id = $1
              AND jv.created_at >= CURRENT_DATE - INTERVAL '6 days'
            GROUP BY DATE(jv.created_at)
          )
          SELECT
            TO_CHAR(days.day_date, 'DD/MM') AS label,
            COALESCE(views.count, 0) AS count
          FROM days
          LEFT JOIN views ON views.day_date = days.day_date
          ORDER BY days.day_date`,
        [userId]
      ),
      pool.query(
        `SELECT
            j.id,
            j.job_title AS title,
            j.job_description AS description,
            j.job_requirements AS requirements,
            j.benefits,
            j.salary,
            COUNT(DISTINCT aj.id)::int AS applicant_count,
            COUNT(DISTINCT jv.id)::int AS view_count
         FROM jobs j
         LEFT JOIN applied_jobs aj ON aj.job_id = j.id
         LEFT JOIN job_views jv ON jv.job_id = j.id
         WHERE j.employer_id = $1
         GROUP BY j.id, j.job_title, j.job_description, j.job_requirements, j.benefits, j.salary, j.created_at
         ORDER BY j.created_at DESC NULLS LAST, j.id DESC
         LIMIT 50`,
        [userId]
      ),
      pool.query(
        `SELECT
            COUNT(*)::int AS total_jobs,
            COUNT(*) FILTER (WHERE ${openApprovedJobsWhere})::int AS open_jobs,
            COUNT(*) FILTER (WHERE ${approvedJobsWhere} AND j.created_at >= NOW() - INTERVAL '30 days')::int AS new_jobs_30d,
            COUNT(*) FILTER (
              WHERE ${approvedJobsWhere}
                AND j.created_at >= NOW() - INTERVAL '60 days'
                AND j.created_at < NOW() - INTERVAL '30 days'
            )::int AS previous_jobs_30d,
            ROUND(AVG(${salaryMidExpr}))::bigint AS avg_salary,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${salaryMidExpr}))::bigint AS median_salary
         FROM jobs j
         WHERE ${approvedJobsWhere}`
      ),
      pool.query(
        `SELECT
            COALESCE(NULLIF(TRIM(j.job_title), ''), 'Chưa phân loại') AS role,
            COUNT(*)::int AS demand_count,
            ROUND(AVG(${salaryMidExpr}))::bigint AS avg_salary,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${salaryMidExpr}))::bigint AS median_salary
         FROM jobs j
         WHERE ${approvedJobsWhere}
         GROUP BY COALESCE(NULLIF(TRIM(j.job_title), ''), 'Chưa phân loại')
         ORDER BY demand_count DESC, role ASC
         LIMIT 6`
      ),
      pool.query(
        `SELECT
            COALESCE(NULLIF(TRIM(j.industry), ''), 'Chưa phân loại') AS industry,
            COUNT(*)::int AS demand_count
         FROM jobs j
         WHERE ${approvedJobsWhere}
           AND j.industry IS NOT NULL
           AND TRIM(j.industry) <> ''
         GROUP BY COALESCE(NULLIF(TRIM(j.industry), ''), 'Chưa phân loại')
         ORDER BY demand_count DESC, industry ASC
         LIMIT 6`
      ),
      pool.query(
        `WITH market_text AS (
            SELECT lower(
              COALESCE(j.tags, '') || ' ' ||
              COALESCE(j.job_requirements, '') || ' ' ||
              COALESCE(j.job_description, '')
            ) AS text_blob
            FROM jobs j
            WHERE ${approvedJobsWhere}
          )
          SELECT
            COUNT(*) FILTER (WHERE text_blob LIKE '%react%' OR text_blob LIKE '%reactjs%' OR text_blob LIKE '%react.js%')::int AS react,
            COUNT(*) FILTER (WHERE text_blob LIKE '%typescript%')::int AS typescript,
            COUNT(*) FILTER (WHERE text_blob LIKE '%javascript%')::int AS javascript,
            COUNT(*) FILTER (WHERE text_blob LIKE '%nodejs%' OR text_blob LIKE '%node.js%')::int AS nodejs,
            COUNT(*) FILTER (WHERE text_blob LIKE '%python%')::int AS python,
            COUNT(*) FILTER (WHERE text_blob LIKE '%sql%' OR text_blob LIKE '%postgres%' OR text_blob LIKE '%mysql%')::int AS sql,
            COUNT(*) FILTER (WHERE text_blob LIKE '%excel%' OR text_blob LIKE '%power bi%' OR text_blob LIKE '%tableau%')::int AS analytics,
            COUNT(*) FILTER (WHERE text_blob LIKE '%aws%' OR text_blob LIKE '%azure%' OR text_blob LIKE '%gcp%')::int AS cloud,
            COUNT(*) FILTER (WHERE text_blob LIKE '%docker%' OR text_blob LIKE '%kubernetes%' OR text_blob LIKE '%k8s%')::int AS devops,
            COUNT(*) FILTER (WHERE text_blob LIKE '%marketing%' OR text_blob LIKE '%seo%' OR text_blob LIKE '%google ads%' OR text_blob LIKE '%facebook ads%')::int AS marketing,
            COUNT(*) FILTER (WHERE text_blob LIKE '%sales%' OR text_blob LIKE '%crm%')::int AS sales,
            COUNT(*) FILTER (WHERE text_blob LIKE '%english%' OR text_blob LIKE '%toeic%' OR text_blob LIKE '%ielts%')::int AS english
          FROM market_text`
      )
    ]);

    const summary = summaryResult.rows[0] || {};
    const totalJobs = parseInt(summary.total_jobs || 0, 10);
    const activeJobs = parseInt(summary.active_jobs || 0, 10);
    const totalCandidates = parseInt(summary.total_candidates || 0, 10);
    const newCandidates = parseInt(summary.new_candidates || 0, 10);
    const totalViews = parseInt(summary.total_views || 0, 10);
    const marketSummary = marketSummaryResult.rows[0] || {};
    const marketTotalJobs = parseInt(marketSummary.total_jobs || 0, 10);
    const marketOpenJobs = parseInt(marketSummary.open_jobs || 0, 10);
    const marketNewJobs30d = parseInt(marketSummary.new_jobs_30d || 0, 10);
    const marketPreviousJobs30d = parseInt(marketSummary.previous_jobs_30d || 0, 10);
    const marketGrowth30d = marketPreviousJobs30d > 0
      ? Number((((marketNewJobs30d - marketPreviousJobs30d) / marketPreviousJobs30d) * 100).toFixed(1))
      : marketNewJobs30d > 0 ? 100 : 0;
    const hotRole = marketRolesResult.rows[0]?.role || '';
    const hotIndustry = marketIndustriesResult.rows[0]?.industry || '';
    const skillDemandRow = marketSkillDemandResult.rows[0] || {};
    const hotSkills = [
      { skill: 'React', demand_count: parseInt(skillDemandRow.react || 0, 10) },
      { skill: 'TypeScript', demand_count: parseInt(skillDemandRow.typescript || 0, 10) },
      { skill: 'JavaScript', demand_count: parseInt(skillDemandRow.javascript || 0, 10) },
      { skill: 'Node.js', demand_count: parseInt(skillDemandRow.nodejs || 0, 10) },
      { skill: 'Python', demand_count: parseInt(skillDemandRow.python || 0, 10) },
      { skill: 'SQL / DB', demand_count: parseInt(skillDemandRow.sql || 0, 10) },
      { skill: 'Data Analytics', demand_count: parseInt(skillDemandRow.analytics || 0, 10) },
      { skill: 'Cloud', demand_count: parseInt(skillDemandRow.cloud || 0, 10) },
      { skill: 'DevOps', demand_count: parseInt(skillDemandRow.devops || 0, 10) },
      { skill: 'Marketing', demand_count: parseInt(skillDemandRow.marketing || 0, 10) },
      { skill: 'Sales', demand_count: parseInt(skillDemandRow.sales || 0, 10) },
      { skill: 'English', demand_count: parseInt(skillDemandRow.english || 0, 10) },
    ]
      .filter((item) => item.demand_count > 0)
      .sort((a, b) => b.demand_count - a.demand_count || a.skill.localeCompare(b.skill, 'vi'))
      .slice(0, 8);

    res.json({
      summary: {
        totalJobs,
        activeJobs,
        totalViews,
        totalCandidates,
        newCandidates,
        conversionRate: totalViews > 0 ? Number(((totalCandidates / totalViews) * 100).toFixed(1)) : 0,
      },
      weekly: weeklyResult.rows.map((row) => ({
        ...row,
        count: parseInt(row.count, 10) || 0,
      })),
      weeklyViews: weeklyViewsResult.rows.map((row) => ({
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
        view_count: parseInt(row.view_count, 10) || 0,
        conversion_rate: parseInt(row.view_count, 10) > 0
          ? Number(((parseInt(row.applicant_count, 10) / parseInt(row.view_count, 10)) * 100).toFixed(1))
          : 0,
      })),
      sources: sourceResult.rows.map((row) => ({
        source: row.source,
        count: parseInt(row.count, 10) || 0,
      })),
      aiInsights: buildJobDescriptionInsights(insightJobsResult.rows),
      marketInsights: {
        summary: {
          totalJobs: marketTotalJobs,
          openJobs: marketOpenJobs,
          newJobs30d: marketNewJobs30d,
          growth30d: marketGrowth30d,
          avgSalary: marketSummary.avg_salary == null ? null : parseInt(marketSummary.avg_salary, 10),
          medianSalary: marketSummary.median_salary == null ? null : parseInt(marketSummary.median_salary, 10),
          hottestRole: hotRole,
          hottestIndustry: hotIndustry,
        },
        topRoles: marketRolesResult.rows.map((row) => ({
          role: row.role,
          demand_count: parseInt(row.demand_count, 10) || 0,
          avg_salary: row.avg_salary == null ? null : parseInt(row.avg_salary, 10),
          median_salary: row.median_salary == null ? null : parseInt(row.median_salary, 10),
        })),
        topIndustries: marketIndustriesResult.rows.map((row) => ({
          industry: row.industry,
          demand_count: parseInt(row.demand_count, 10) || 0,
        })),
        hotSkills,
      },
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
    const check = await pool.query(
      `SELECT id, COALESCE(NULLIF(TRIM(status), ''), 'approved') as status
       FROM jobs
       WHERE id = $1 AND employer_id = $2`,
      [jobId, userId]
    );
    if (check.rows.length === 0) {
      return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa tin này' });
    }
    const currentStatus = normalizeJobModerationStatus(check.rows[0].status);
    const nextModerationStatus = currentStatus === 'approved' ? 'approved' : 'pending';

    const normalizedDeadline = normalizeDeadline(deadline);
    if (isPastDeadline(normalizedDeadline)) {
      return res.status(400).json({ error: 'Hạn nộp hồ sơ không được nhỏ hơn ngày hiện tại' });
    }
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
           submission_deadline = $9, number_candidate = $10, tags = $11, status = $12, updated_at = NOW()
       WHERE id = $13 AND employer_id = $14
       RETURNING *`,
      [
        title, description, requirements, benefits, location,
        normalizedSalary, job_type, experience, normalizedDeadline,
        parseInt(positions) || 1, normalizedTags, nextModerationStatus, jobId, userId
      ]
    );

    if (nextModerationStatus === 'pending') {
      const adminUserIds = await getAdminUserIds();
      await createNotificationsForUsers(adminUserIds, {
        type: 'admin_job_pending',
        title: 'Có tin tuyển dụng cập nhật cần duyệt lại',
        message: `${result.rows[0]?.company_name || 'Nhà tuyển dụng'} vừa cập nhật tin ${title || 'tuyển dụng'} và cần admin duyệt lại.`,
        to: '/admin/dashboard',
        tab: 'jobs',
        meta: { job_id: jobId, employer_id: userId },
      }).catch((notificationError) => {
        console.error('Create admin re-review notifications error:', notificationError);
      });
    }

    res.json({
      message: nextModerationStatus === 'pending'
        ? 'Tin đã được cập nhật và gửi lại để admin phê duyệt.'
        : 'Cập nhật thành công!',
      job: result.rows[0],
    });
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

    if (!['Đang tuyển', 'Ngừng tuyển'].includes(status)) {
      return res.status(400).json({ error: 'Trạng thái cập nhật không hợp lệ' });
    }

    const ownership = await pool.query(
      `SELECT id, COALESCE(NULLIF(TRIM(status), ''), 'approved') as status
       FROM jobs
       WHERE id = $1 AND employer_id = $2`,
      [jobId, userId]
    );

    if (!ownership.rows.length) {
      return res.status(403).json({ error: 'Không tìm thấy tin hoặc không có quyền' });
    }

    const moderationStatus = normalizeJobModerationStatus(ownership.rows[0].status);
    if (moderationStatus !== 'approved' && moderationStatus !== 'stopped') {
      return res.status(400).json({
        error: moderationStatus === 'pending'
          ? 'Tin đang chờ admin phê duyệt nên chưa thể thay đổi trạng thái tuyển dụng'
          : 'Tin đã bị từ chối. Hãy chỉnh sửa và gửi lại để admin xem xét',
      });
    }

    if (status === 'Ngừng tuyển') {
      // Set status to 'stopped' so seeker-facing queries (which require status='approved') will exclude this job
      await pool.query(
        `UPDATE jobs SET status = 'stopped', updated_at = NOW() WHERE id = $1 AND employer_id = $2`,
        [jobId, userId]
      );
    } else {
      // Resume recruitment: restore status to 'approved'
      await pool.query(
        `UPDATE jobs SET status = 'approved', updated_at = NOW() WHERE id = $1 AND employer_id = $2`,
        [jobId, userId]
      );
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

    if (!['pending', 'interview', 'hired', 'rejected'].includes(normalizedStatus)) {
      return res.status(400).json({ error: 'Trạng thái hồ sơ không hợp lệ' });
    }

    const ownershipResult = await pool.query(
      `SELECT aj.id,
              aj.user_id,
              COALESCE(NULLIF(TRIM(aj.status), ''), 'pending') as current_status,
              j.job_title,
              j.company_name
       FROM applied_jobs aj
       JOIN jobs j ON aj.job_id = j.id
       WHERE aj.id = $1
         AND j.employer_id = $2`,
      [applicationId, userId]
    );

    if (!ownershipResult.rows.length) {
      return res.status(403).json({ error: 'Không có quyền thay đổi hồ sơ này' });
    }

    const ownership = ownershipResult.rows[0];
    const result = await pool.query(
      `UPDATE applied_jobs
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, COALESCE(NULLIF(TRIM(status), ''), 'pending') as status, updated_at`,
      [normalizedStatus, applicationId]
    );

    if (normalizedStatus !== ownership.current_status && normalizedStatus !== 'pending') {
      const statusCopy = {
        interview: {
          type: 'seeker_application_interview',
          title: 'Hồ sơ được chuyển sang vòng phỏng vấn',
          message: `Nhà tuyển dụng đã chuyển hồ sơ của bạn cho vị trí ${ownership.job_title || 'ứng tuyển'} sang vòng phỏng vấn.`,
        },
        hired: {
          type: 'seeker_application_hired',
          title: 'Hồ sơ đã được duyệt',
          message: `Nhà tuyển dụng đã duyệt hồ sơ của bạn cho vị trí ${ownership.job_title || 'ứng tuyển'}.`,
        },
        rejected: {
          type: 'seeker_application_rejected',
          title: 'Hồ sơ bị từ chối',
          message: `Nhà tuyển dụng đã từ chối hồ sơ của bạn cho vị trí ${ownership.job_title || 'ứng tuyển'}.`,
        },
      }[normalizedStatus];

      if (statusCopy) {
        await createNotification({
          userId: ownership.user_id,
          type: statusCopy.type,
          title: statusCopy.title,
          message: statusCopy.message,
          to: '/seeker/applied-jobs',
          meta: { application_id: applicationId, company_name: ownership.company_name || null },
        }).catch((notificationError) => {
          console.error('Create seeker application status notification error:', notificationError);
        });
      }
    }

    res.json({ message: 'Đã cập nhật trạng thái ứng viên', data: result.rows[0] });
  } catch (err) {
    console.error('Update app status error:', err);
    res.status(500).json({ error: 'Lỗi khi cập nhật trạng thái' });
  }
}

// updateCandidateStatus is now alias for updateApplicationStatus or redundant
const updateCandidateStatus = updateApplicationStatus;

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

    const ownership = await pool.query(
      `SELECT aj.id,
              aj.user_id,
              aj.candidate_interview_mode,
              COALESCE(NULLIF(TRIM(aj.status), ''), 'pending') as status,
              j.company_address,
              j.job_title,
              j.company_name
       FROM applied_jobs aj
       JOIN jobs j ON aj.job_id = j.id
       WHERE aj.id = $1 AND j.employer_id = $2`,
      [applicationId, userId]
    );
    if (!ownership.rows.length) {
      return res.status(403).json({ error: 'Không có quyền lên lịch phỏng vấn cho ứng viên này' });
    }
    const application = ownership.rows[0];

    const normalizedAt = interview_at ? new Date(interview_at) : null;
    if (!normalizedAt || Number.isNaN(normalizedAt.getTime())) {
      return res.status(400).json({ error: 'Ngày giờ phỏng vấn không hợp lệ' });
    }

    if (normalizedAt.getTime() <= Date.now()) {
      return res.status(400).json({ error: 'Ngày giờ phỏng vấn phải lớn hơn thời điểm hiện tại' });
    }

    const lockedMode = normalizeInterviewMode(application.candidate_interview_mode);
    const normalizedMode = lockedMode || normalizeInterviewMode(interview_mode) || 'online';
    const normalizedLink = normalizedMode === 'online' ? interview_link?.trim() || null : null;

    if (normalizedMode === 'online' && !normalizedLink) {
      return res.status(400).json({ error: 'Phỏng vấn online cần có link video call' });
    }

    const result = await pool.query(
      `UPDATE applied_jobs
       SET status = $1,
           interview_at = $2,
           interview_mode = $3,
           interview_link = $4,
           interview_reminder_sent_at = NULL,
           updated_at = NOW()
       WHERE id = $5
       RETURNING id, COALESCE(NULLIF(TRIM(status), ''), 'pending') as status,
                 interview_at, interview_mode, interview_link, candidate_interview_mode, updated_at`,
      ['interview', normalizedAt.toISOString(), normalizedMode, normalizedLink, applicationId]
    );

    await createNotification({
      userId: application.user_id,
      type: 'seeker_application_interview',
      title: 'Bạn có lịch phỏng vấn mới',
      message: `Nhà tuyển dụng đã cập nhật lịch phỏng vấn cho vị trí ${application.job_title || 'ứng tuyển'}.`,
      to: '/seeker/applied-jobs',
      meta: {
        application_id: applicationId,
        company_name: application.company_name || null,
        interview_at: normalizedAt.toISOString(),
        interview_mode: normalizedMode,
      },
    }).catch((notificationError) => {
      console.error('Create seeker interview notification error:', notificationError);
    });

    res.json({
      message: 'Đã lên lịch phỏng vấn',
      data: {
        ...result.rows[0],
        company_address: application.company_address || null,
      },
    });
  } catch (err) {
    console.error('Schedule interview error:', err);
    res.status(500).json({ error: 'Lỗi khi lên lịch phỏng vấn' });
  }
}

module.exports = { 
  ensureEmployerJobSchemaForRequest,
  getDashboard, createJob, getMyJobs, getCandidates, getCandidateStats, getCandidateById, getProfile, 
  updateProfile, getNotifications, getAnalytics: getAnalyticsV2,
  updateJob, updateJobStatus, deleteJob, updateApplicationStatus: updateCandidateStatus, saveCandidateNote, scheduleInterview,
  getCompanyPublicProfile,
};
