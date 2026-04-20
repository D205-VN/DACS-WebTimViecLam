const pool = require('../config/db');

const SALARY_RANGE_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: '0-10', label: 'Dưới 10 triệu' },
  { value: '10-15', label: '10 - 15 triệu' },
  { value: '15-20', label: '15 - 20 triệu' },
  { value: '20-30', label: '20 - 30 triệu' },
  { value: '30+', label: 'Trên 30 triệu' },
];

let publicJobSchemaReady = false;

async function ensureJobStatusSchema() {
  if (publicJobSchemaReady) return;

  await pool.query(`
    ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved'
  `);

  await pool.query(`
    UPDATE jobs
    SET status = 'approved'
    WHERE status IS NULL OR TRIM(status) = ''
  `);

  publicJobSchemaReady = true;
}

function parseListParam(value) {
  if (!value) return [];
  const rawValues = Array.isArray(value) ? value : String(value).split(',');

  return rawValues
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function appendLikeAnyClause(field, values, params, paramIndex) {
  if (!values.length) {
    return { clause: '', nextIndex: paramIndex };
  }

  const placeholders = values.map((_, index) => `$${paramIndex + index}`).join(', ');
  params.push(...values.map((value) => `%${value}%`));

  return {
    clause: ` AND ${field} ILIKE ANY (ARRAY[${placeholders}]::text[])`,
    nextIndex: paramIndex + values.length,
  };
}

const normalizedSalaryExpr = `regexp_replace(lower(COALESCE(salary, '')), '\\s+', '', 'g')`;
const salaryLowerTokenExpr = `split_part(${normalizedSalaryExpr}, '-', 1)`;
const salaryUpperTokenExpr = `CASE
  WHEN POSITION('-' IN ${normalizedSalaryExpr}) > 0
    THEN split_part(${normalizedSalaryExpr}, '-', 2)
  ELSE split_part(${normalizedSalaryExpr}, '-', 1)
END`;

function buildSalaryValueExpression(tokenExpr) {
  return `CASE
    WHEN COALESCE(TRIM(salary), '') = '' THEN NULL
    WHEN lower(salary) ~ 'th[oỏ]a\\s*thu[aậ]n|thuong\\s*luong|c[aạ]nh\\s*tranh' THEN NULL
    WHEN NULLIF(regexp_replace(${tokenExpr}, '[^0-9]', '', 'g'), '') IS NULL THEN NULL
    WHEN lower(salary) ~ '(usd|\\$)' THEN regexp_replace(${tokenExpr}, '[^0-9]', '', 'g')::numeric * 25000
    WHEN regexp_replace(${tokenExpr}, '[^0-9]', '', 'g')::numeric < 1000 THEN regexp_replace(${tokenExpr}, '[^0-9]', '', 'g')::numeric * 1000000
    ELSE regexp_replace(${tokenExpr}, '[^0-9]', '', 'g')::numeric
  END`;
}

const salaryLowerExpr = buildSalaryValueExpression(salaryLowerTokenExpr);
const salaryUpperExpr = buildSalaryValueExpression(salaryUpperTokenExpr);

function appendSalaryRangeClause(rangeValue, params, paramIndex) {
  if (!rangeValue) {
    return { clause: '', nextIndex: paramIndex };
  }

  if (rangeValue === '0-10') {
    params.push(10000000);
    return {
      clause: ` AND ${salaryLowerExpr} IS NOT NULL AND COALESCE(${salaryUpperExpr}, ${salaryLowerExpr}) < $${paramIndex}`,
      nextIndex: paramIndex + 1,
    };
  }

  if (rangeValue === '30+') {
    params.push(30000000);
    return {
      clause: ` AND ${salaryLowerExpr} IS NOT NULL AND COALESCE(${salaryUpperExpr}, ${salaryLowerExpr}) >= $${paramIndex}`,
      nextIndex: paramIndex + 1,
    };
  }

  const [minMillions, maxMillions] = String(rangeValue).split('-').map(Number);
  if (!Number.isFinite(minMillions) || !Number.isFinite(maxMillions)) {
    return { clause: '', nextIndex: paramIndex };
  }

  params.push(minMillions * 1000000, maxMillions * 1000000);
  return {
    clause: ` AND ${salaryLowerExpr} IS NOT NULL
      AND COALESCE(${salaryUpperExpr}, ${salaryLowerExpr}) >= $${paramIndex}
      AND ${salaryLowerExpr} < $${paramIndex + 1}`,
    nextIndex: paramIndex + 2,
  };
}

function buildLocationLikePatterns(rawLocation) {
  const input = (rawLocation || '').trim();
  if (!input) return [];

  const lower = input.toLowerCase();
  const patterns = new Set([`%${input}%`]);

  // Handle common Vietnam admin prefixes users may omit
  const withoutPrefix = input.replace(/^(Thành phố|Tỉnh)\s+/i, '').trim();
  if (withoutPrefix && withoutPrefix !== input) patterns.add(`%${withoutPrefix}%`);

  // Special-case HCMC: data often stored as HCM / TP.HCM / Sai Gon
  if (
    /hồ\s*chí\s*minh/i.test(input) ||
    /ho\s*chi\s*minh/i.test(lower) ||
    /\bhcm\b/i.test(lower) ||
    /sài\s*gòn/i.test(input) ||
    /sai\s*gon/i.test(lower)
  ) {
    [
      '%Hồ Chí Minh%',
      '%Ho Chi Minh%',
      '%HCM%',
      '%TP.HCM%',
      '%TP HCM%',
      '%Sài Gòn%',
      '%Sai Gon%',
      '%SG%'
    ].forEach((p) => patterns.add(p));
  }

  // Special-case Hanoi
  if (/hà\s*nội/i.test(input) || /ha\s*noi/i.test(lower) || /\bhn\b/i.test(lower)) {
    ['%Hà Nội%', '%Ha Noi%', '%HN%'].forEach((p) => patterns.add(p));
  }

  return Array.from(patterns);
}

// GET /api/jobs — Danh sách jobs (có phân trang)
exports.getJobs = async (req, res) => {
  try {
    await ensureJobStatusSchema();

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const keyword = req.query.keyword || req.query.q || '';
    const location = req.query.location || '';
    const jobType = req.query.jobType || req.query.job_type || '';
    const salaryRange = req.query.salaryRange || req.query.salary_range || '';
    const company = String(req.query.company || '').trim();
    const levels = parseListParam(req.query.levels);
    const industries = parseListParam(req.query.industries);

    let whereClause = '';
    const params = [];
    let paramIndex = 1;

    if (keyword) {
      whereClause += ` AND (job_title ILIKE $${paramIndex} OR company_name ILIKE $${paramIndex} OR industry ILIKE $${paramIndex} OR job_description ILIKE $${paramIndex} OR job_requirements ILIKE $${paramIndex})`;
      params.push(`%${keyword}%`);
      paramIndex++;
    }

    if (location) {
      const patterns = buildLocationLikePatterns(location);
      if (patterns.length > 0) {
        const placeholders = patterns.map((_, i) => `$${paramIndex + i}`).join(', ');
        whereClause += ` AND job_address ILIKE ANY (ARRAY[${placeholders}]::text[])`;
        params.push(...patterns);
        paramIndex += patterns.length;
      }
    }

    if (jobType) {
      whereClause += ` AND job_type ILIKE $${paramIndex}`;
      params.push(`%${jobType}%`);
      paramIndex++;
    }

    if (company) {
      whereClause += ` AND LOWER(TRIM(company_name)) = LOWER(TRIM($${paramIndex}))`;
      params.push(company);
      paramIndex++;
    }

    const levelClause = appendLikeAnyClause('career_level', levels, params, paramIndex);
    whereClause += levelClause.clause;
    paramIndex = levelClause.nextIndex;

    const industryClause = appendLikeAnyClause('industry', industries, params, paramIndex);
    whereClause += industryClause.clause;
    paramIndex = industryClause.nextIndex;

    const salaryClause = appendSalaryRangeClause(salaryRange, params, paramIndex);
    whereClause += salaryClause.clause;
    paramIndex = salaryClause.nextIndex;

    const countQuery = `SELECT COUNT(*) FROM jobs WHERE COALESCE(NULLIF(TRIM(status), ''), 'approved') = 'approved'${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const totalJobs = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const query = `SELECT id, job_title as title, job_description as description, job_requirements as requirements,
              benefits, job_address as location, job_type, years_of_experience as experience,
              salary, submission_deadline as deadline, company_name, company_overview, company_size,
              company_address, industry, career_level, created_at 
              FROM jobs WHERE COALESCE(NULLIF(TRIM(status), ''), 'approved') = 'approved'${whereClause} 
              ORDER BY created_at DESC NULLS LAST, id DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const result = await pool.query(query, params);
    
    res.json({
      data: result.rows,
      meta: {
        total: totalJobs,
        page,
        limit,
        totalPages: Math.ceil(totalJobs / limit)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/jobs/filters — Dữ liệu filter cho frontend
exports.getJobFilters = async (_req, res) => {
  try {
    await ensureJobStatusSchema();

    const [levelsResult, industriesResult] = await Promise.all([
      pool.query(
        `SELECT career_level as value, COUNT(*)::int as count
         FROM jobs
         WHERE COALESCE(NULLIF(TRIM(status), ''), 'approved') = 'approved'
           AND career_level IS NOT NULL AND TRIM(career_level) <> ''
         GROUP BY career_level
         ORDER BY count DESC, value ASC`
      ),
      pool.query(
        `SELECT industry as value, COUNT(*)::int as count
         FROM jobs
         WHERE COALESCE(NULLIF(TRIM(status), ''), 'approved') = 'approved'
           AND industry IS NOT NULL AND TRIM(industry) <> ''
         GROUP BY industry
         ORDER BY count DESC, value ASC
         LIMIT 20`
      ),
    ]);

    res.json({
      data: {
        salaryRanges: SALARY_RANGE_OPTIONS,
        levels: levelsResult.rows,
        industries: industriesResult.rows,
      },
    });
  } catch (err) {
    console.error('Get job filters error:', err);
    res.status(500).json({ error: 'Lỗi khi tải bộ lọc' });
  }
};

// GET /api/jobs/companies — Danh sách công ty đang có tin tuyển dụng
exports.getCompanies = async (req, res) => {
  try {
    await ensureJobStatusSchema();

    const keyword = String(req.query.keyword || '').trim();
    const params = [];
    let whereClause = `WHERE COALESCE(NULLIF(TRIM(status), ''), 'approved') = 'approved'
      AND company_name IS NOT NULL AND TRIM(company_name) <> ''`;

    if (keyword) {
      whereClause += ` AND company_name ILIKE $1`;
      params.push(`%${keyword}%`);
    }

    const result = await pool.query(
      `SELECT
          company_name,
          MAX(NULLIF(TRIM(company_overview), '')) as company_overview,
          MAX(NULLIF(TRIM(company_size), '')) as company_size,
          MAX(NULLIF(TRIM(company_address), '')) as company_address,
          COUNT(*)::int as job_count
       FROM jobs
       ${whereClause}
       GROUP BY company_name
       ORDER BY job_count DESC, company_name ASC`,
      params
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error('Get companies error:', err);
    res.status(500).json({ error: 'Lỗi khi tải danh sách công ty' });
  }
};

// GET /api/jobs/saved — Danh sách job đã lưu (cần JWT)
exports.getSavedJobs = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT j.id, j.job_title as title, j.company_name, j.job_address as location, j.salary, j.job_type,
              sj.created_at as saved_at
       FROM saved_jobs sj
       JOIN jobs j ON j.id = sj.job_id
       WHERE sj.user_id = $1
       ORDER BY sj.created_at DESC`,
      [req.user.id]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi khi tải danh sách đã lưu' });
  }
};

// GET /api/jobs/applied — Danh sách job đã ứng tuyển (cần JWT)
exports.getAppliedJobs = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT j.id, j.job_title as title, j.company_name, j.job_address as location, j.salary,
              aj.status, aj.created_at as applied_at
       FROM applied_jobs aj
       JOIN jobs j ON j.id = aj.job_id
       WHERE aj.user_id = $1
       ORDER BY aj.created_at DESC`,
      [req.user.id]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi khi tải danh sách đã ứng tuyển' });
  }
};

// GET /api/jobs/saved-ids — Lấy danh sách job_id đã lưu (dùng cho UI bookmark)
exports.getSavedJobIds = async (req, res) => {
  try {
    const result = await pool.query('SELECT job_id FROM saved_jobs WHERE user_id = $1', [req.user.id]);
    res.json({ ids: result.rows.map(r => r.job_id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi' });
  }
};

// GET /api/jobs/:id — Chi tiết 1 job
exports.getJobById = async (req, res) => {
  try {
    await ensureJobStatusSchema();

    const result = await pool.query(
      `SELECT id, url_job, job_title as title, job_description as description, job_requirements as requirements,
              benefits, job_address as location, job_type, years_of_experience as experience,
              salary, submission_deadline as deadline, company_name, company_overview, company_size,
              company_address, industry, career_level, number_candidate, created_at
       FROM jobs
       WHERE id = $1
         AND COALESCE(NULLIF(TRIM(status), ''), 'approved') = 'approved'`, 
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy việc làm' });
    }
    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/jobs/:id/save — Toggle lưu/bỏ lưu job (cần JWT)
exports.toggleSaveJob = async (req, res) => {
  try {
    const jobId = req.params.id;
    const userId = req.user.id;

    const existing = await pool.query(
      'SELECT id FROM saved_jobs WHERE user_id = $1 AND job_id = $2',
      [userId, jobId]
    );

    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM saved_jobs WHERE user_id = $1 AND job_id = $2', [userId, jobId]);
      res.json({ saved: false, message: 'Đã bỏ lưu việc làm' });
    } else {
      await pool.query('INSERT INTO saved_jobs (user_id, job_id) VALUES ($1, $2)', [userId, jobId]);
      res.json({ saved: true, message: 'Đã lưu việc làm' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi khi lưu việc làm' });
  }
};

// POST /api/jobs/:id/apply — Ứng tuyển job (cần JWT)
exports.applyJob = async (req, res) => {
  try {
    await ensureJobStatusSchema();

    const jobId = req.params.id;
    const userId = req.user.id;

    const jobResult = await pool.query(
      `SELECT id
       FROM jobs
       WHERE id = $1
         AND COALESCE(NULLIF(TRIM(status), ''), 'approved') = 'approved'`,
      [jobId]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'KhÃ´ng tÃ¬m tháº¥y viá»‡c lÃ m' });
    }

    const existing = await pool.query(
      'SELECT id FROM applied_jobs WHERE user_id = $1 AND job_id = $2',
      [userId, jobId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Bạn đã ứng tuyển việc làm này rồi' });
    }

    await pool.query(
      'INSERT INTO applied_jobs (user_id, job_id) VALUES ($1, $2)',
      [userId, jobId]
    );

    res.json({ message: 'Ứng tuyển thành công!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi khi ứng tuyển' });
  }
};
