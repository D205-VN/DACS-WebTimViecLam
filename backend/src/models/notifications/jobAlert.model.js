const pool = require('../../infrastructure/database/postgres');
const { ensureJobStatusSchema, ensurePublicApplicationSchema } = require('../jobs/job.model');

let jobAlertSchemaReady = false;

const DEFAULT_DIGEST_LIMIT = 8;
const VALID_FREQUENCIES = new Set(['weekly']);

const normalizedSalaryExpr = `regexp_replace(lower(COALESCE(j.salary, '')), '\\s+', '', 'g')`;
const salaryLowerTokenExpr = `split_part(${normalizedSalaryExpr}, '-', 1)`;
const salaryUpperTokenExpr = `CASE
  WHEN POSITION('-' IN ${normalizedSalaryExpr}) > 0
    THEN split_part(${normalizedSalaryExpr}, '-', 2)
  ELSE split_part(${normalizedSalaryExpr}, '-', 1)
END`;

function buildSalaryValueExpression(tokenExpr) {
  return `CASE
    WHEN COALESCE(TRIM(j.salary), '') = '' THEN NULL
    WHEN lower(j.salary) ~ 'th[oỏ]a\\s*thu[aậ]n|thuong\\s*luong|c[aạ]nh\\s*tranh' THEN NULL
    WHEN NULLIF(regexp_replace(${tokenExpr}, '[^0-9]', '', 'g'), '') IS NULL THEN NULL
    WHEN lower(j.salary) ~ '(usd|\\$)' THEN regexp_replace(${tokenExpr}, '[^0-9]', '', 'g')::numeric * 25000
    WHEN regexp_replace(${tokenExpr}, '[^0-9]', '', 'g')::numeric < 1000 THEN regexp_replace(${tokenExpr}, '[^0-9]', '', 'g')::numeric * 1000000
    ELSE regexp_replace(${tokenExpr}, '[^0-9]', '', 'g')::numeric
  END`;
}

const salaryLowerExpr = buildSalaryValueExpression(salaryLowerTokenExpr);
const salaryUpperExpr = buildSalaryValueExpression(salaryUpperTokenExpr);

function normalizeText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function tokenize(value = '') {
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'job', 'viec', 'lam', 'nhan', 'vien', 'cong', 'ty',
    'tuyen', 'dung', 'tai', 'can', 'nguoi', 'ung', 'vien', 'kinh', 'nghiem',
  ]);

  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !stopWords.has(token))
    .slice(0, 40);
}

function normalizeAlertPayload(payload = {}) {
  const keyword = String(payload.keyword || '').trim();
  const location = String(payload.location || '').trim();
  const salaryRange = String(payload.salaryRange || payload.salary_range || '').trim();
  const frequency = VALID_FREQUENCIES.has(String(payload.frequency || '').trim())
    ? String(payload.frequency).trim()
    : 'weekly';
  const isActive = payload.is_active === undefined && payload.isActive === undefined
    ? true
    : Boolean(payload.is_active ?? payload.isActive);

  return {
    keyword: keyword || null,
    location: location || null,
    salaryRange: salaryRange || null,
    frequency,
    isActive,
  };
}

function appendSalaryRangeClause(conditions, params, salaryRange) {
  if (!salaryRange) return;

  if (salaryRange === '0-10') {
    params.push(10000000);
    conditions.push(`${salaryLowerExpr} IS NOT NULL AND COALESCE(${salaryUpperExpr}, ${salaryLowerExpr}) < $${params.length}`);
    return;
  }

  if (salaryRange === '30+') {
    params.push(30000000);
    conditions.push(`${salaryLowerExpr} IS NOT NULL AND COALESCE(${salaryUpperExpr}, ${salaryLowerExpr}) >= $${params.length}`);
    return;
  }

  const [minMillions, maxMillions] = salaryRange.split('-').map(Number);
  if (!Number.isFinite(minMillions) || !Number.isFinite(maxMillions)) return;

  params.push(minMillions * 1000000, maxMillions * 1000000);
  conditions.push(`${salaryLowerExpr} IS NOT NULL
    AND COALESCE(${salaryUpperExpr}, ${salaryLowerExpr}) >= $${params.length - 1}
    AND ${salaryLowerExpr} < $${params.length}`);
}

function buildLocationPatterns(location) {
  const input = String(location || '').trim();
  if (!input) return [];

  const withoutPrefix = input.replace(/^(Thành phố|Tỉnh)\s+/i, '').trim();
  const patterns = new Set([`%${input}%`]);
  if (withoutPrefix && withoutPrefix !== input) patterns.add(`%${withoutPrefix}%`);

  const normalized = normalizeText(input);
  if (normalized.includes('ho chi minh') || /\bhcm\b/.test(normalized) || normalized.includes('sai gon')) {
    ['%Hồ Chí Minh%', '%Ho Chi Minh%', '%HCM%', '%TP.HCM%', '%Sài Gòn%', '%Sai Gon%'].forEach((pattern) => patterns.add(pattern));
  }
  if (normalized.includes('ha noi') || /\bhn\b/.test(normalized)) {
    ['%Hà Nội%', '%Ha Noi%', '%HN%'].forEach((pattern) => patterns.add(pattern));
  }

  return Array.from(patterns);
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

async function ensureJobAlertSchema() {
  if (jobAlertSchemaReady) return;

  await ensureJobStatusSchema();
  await ensurePublicApplicationSchema();

  await pool.query(`
    ALTER TABLE job_alerts
    ADD COLUMN IF NOT EXISTS keyword VARCHAR(255),
    ADD COLUMN IF NOT EXISTS location VARCHAR(255),
    ADD COLUMN IF NOT EXISTS salary_range VARCHAR(30),
    ADD COLUMN IF NOT EXISTS frequency VARCHAR(20) DEFAULT 'weekly',
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS last_digest_sent_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_job_alerts_user_active
    ON job_alerts(user_id, is_active)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_job_alerts_digest
    ON job_alerts(frequency, is_active, last_digest_sent_at, last_checked_at)
  `);

  jobAlertSchemaReady = true;
}

function mapAlertRule(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    job_id: row.job_id || null,
    keyword: row.keyword || '',
    location: row.location || '',
    salary_range: row.salary_range || '',
    frequency: row.frequency || 'weekly',
    is_active: row.is_active !== false,
    last_digest_sent_at: row.last_digest_sent_at || null,
    last_checked_at: row.last_checked_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapSimilarJobAlert(row) {
  return {
    ...mapAlertRule(row),
    type: 'similar_job',
    source_job_title: row.source_job_title || '',
    source_industry: row.source_industry || '',
    source_location: row.source_location || '',
    source_company_address: row.source_company_address || '',
    source_job: {
      id: row.job_id,
      title: row.source_job_title || '',
      company_name: row.source_company_name || '',
      location: row.source_location || row.source_company_address || '',
      salary: row.source_salary || '',
      industry: row.source_industry || '',
    },
  };
}

async function getUserRecommendationProfile(userId) {
  const [cvResult, historyResult] = await Promise.all([
    pool.query(
      `SELECT target_role, html_content
       FROM user_cvs
       WHERE user_id = $1
       ORDER BY is_primary DESC, created_at DESC, id DESC
       LIMIT 1`,
      [userId]
    ),
    pool.query(
      `SELECT j.job_title, j.industry, j.job_description, j.job_requirements
       FROM applied_jobs aj
       JOIN jobs j ON j.id = aj.job_id
       WHERE aj.user_id = $1
       ORDER BY aj.created_at DESC
       LIMIT 10`,
      [userId]
    ),
  ]);

  const cv = cvResult.rows[0] || {};
  const cvText = [cv.target_role, stripHtml(cv.html_content)].filter(Boolean).join(' ');
  const historyText = historyResult.rows
    .map((row) => [row.job_title, row.industry, row.job_description, row.job_requirements].filter(Boolean).join(' '))
    .join(' ');

  return {
    cvTokens: new Set(tokenize(cvText)),
    historyTokens: new Set(tokenize(historyText)),
  };
}

function scoreTokenOverlap(tokens, text, maxScore) {
  if (!tokens?.size || !text) return 0;

  const normalizedText = normalizeText(text);
  let matches = 0;
  for (const token of tokens) {
    if (normalizedText.includes(token)) matches += 1;
  }

  return Math.min(maxScore, matches * 4);
}

function scoreJobForAlert(job, alert, profile) {
  const jobText = [job.title, job.company_name, job.industry, job.description, job.requirements].filter(Boolean).join(' ');
  const normalizedJobText = normalizeText(jobText);
  const reasons = [];
  let score = 35;

  if (alert.keyword && normalizedJobText.includes(normalizeText(alert.keyword))) {
    score += 20;
    reasons.push('Khớp từ khóa alert');
  }

  if (alert.location && normalizeText([job.location, job.company_address].filter(Boolean).join(' ')).includes(normalizeText(alert.location))) {
    score += 12;
    reasons.push('Phù hợp địa điểm mong muốn');
  }

  if (alert.salary_range) {
    score += 8;
    reasons.push('Nằm trong khoảng lương đã chọn');
  }

  if (alert.source_job_title && scoreTokenOverlap(new Set(tokenize(alert.source_job_title)), jobText, 16) > 0) {
    score += 12;
    reasons.push('Tương tự tin bạn đã theo dõi');
  }

  if (alert.source_industry && normalizeText(job.industry || '').includes(normalizeText(alert.source_industry))) {
    score += 10;
    reasons.push('Cùng nhóm ngành');
  }

  const cvScore = scoreTokenOverlap(profile.cvTokens, jobText, 20);
  const historyScore = scoreTokenOverlap(profile.historyTokens, jobText, 15);
  score += cvScore + historyScore;

  if (cvScore > 0) reasons.push('Có tín hiệu phù hợp với CV chính');
  if (historyScore > 0) reasons.push('Liên quan tới lịch sử ứng tuyển');
  if (!reasons.length) reasons.push('Tin mới phù hợp với alert');

  return {
    ...job,
    match_score: Math.min(100, score),
    match_reasons: reasons.slice(0, 3),
  };
}

function appendKeywordClause(conditions, params, keyword) {
  if (!keyword) return;

  params.push(`%${keyword}%`);
  conditions.push(`(
    j.job_title ILIKE $${params.length}
    OR j.company_name ILIKE $${params.length}
    OR j.industry ILIKE $${params.length}
    OR j.job_description ILIKE $${params.length}
    OR j.job_requirements ILIKE $${params.length}
  )`);
}

function appendLocationClause(conditions, params, location) {
  const patterns = buildLocationPatterns(location);
  if (!patterns.length) return;

  const placeholders = patterns.map((_, index) => `$${params.length + index + 1}`).join(', ');
  params.push(...patterns);
  conditions.push(`(
    j.job_address ILIKE ANY (ARRAY[${placeholders}]::text[])
    OR j.company_address ILIKE ANY (ARRAY[${placeholders}]::text[])
  )`);
}

function appendSourceJobClause(conditions, params, alert) {
  const sourceConditions = [];

  const sourceTokens = tokenize(alert.source_job_title || '').slice(0, 4);
  if (sourceTokens.length) {
    const patterns = sourceTokens.map((token) => `%${token}%`);
    const placeholders = patterns.map((_, index) => `$${params.length + index + 1}`).join(', ');
    params.push(...patterns);
    sourceConditions.push(`(
      j.job_title ILIKE ANY (ARRAY[${placeholders}]::text[])
      OR j.job_description ILIKE ANY (ARRAY[${placeholders}]::text[])
      OR j.job_requirements ILIKE ANY (ARRAY[${placeholders}]::text[])
    )`);
  }

  if (alert.source_industry) {
    params.push(`%${alert.source_industry}%`);
    sourceConditions.push(`j.industry ILIKE $${params.length}`);
  }

  const sourceLocation = alert.source_location || alert.source_company_address || '';
  const sourceLocationPatterns = buildLocationPatterns(sourceLocation).slice(0, 4);
  if (sourceLocationPatterns.length) {
    const placeholders = sourceLocationPatterns.map((_, index) => `$${params.length + index + 1}`).join(', ');
    params.push(...sourceLocationPatterns);
    sourceConditions.push(`j.job_address ILIKE ANY (ARRAY[${placeholders}]::text[])`);
  }

  if (sourceConditions.length) {
    conditions.push(`(${sourceConditions.join(' OR ')})`);
  }
}

async function findJobsForAlert(alert, limit = DEFAULT_DIGEST_LIMIT) {
  await ensureJobAlertSchema();

  const normalizedLimit = Math.max(1, Math.min(Number(limit) || DEFAULT_DIGEST_LIMIT, 20));
  const deadlineDateSql = buildDeadlineSqlExpression('j.submission_deadline');
  const conditions = [
    `COALESCE(NULLIF(TRIM(j.status), ''), 'approved') = 'approved'`,
    `(${deadlineDateSql} IS NULL OR ${deadlineDateSql} >= CURRENT_DATE)`,
    `NOT EXISTS (
      SELECT 1
      FROM applied_jobs aj
      WHERE aj.user_id = $1 AND aj.job_id = j.id
    )`,
  ];
  const params = [alert.user_id];
  let matcherConditionStart = conditions.length;

  if (alert.job_id) {
    params.push(alert.job_id);
    conditions.push(`j.id <> $${params.length}`);
    matcherConditionStart = conditions.length;
    appendSourceJobClause(conditions, params, alert);
  } else {
    matcherConditionStart = conditions.length;
    appendKeywordClause(conditions, params, alert.keyword);
    appendLocationClause(conditions, params, alert.location);
    appendSalaryRangeClause(conditions, params, alert.salary_range);
  }

  if (conditions.length === matcherConditionStart) return [];

  params.push(Math.max(normalizedLimit * 4, 20));
  const result = await pool.query(
    `SELECT
        j.id,
        j.job_title AS title,
        j.company_name,
        j.job_address AS location,
        j.company_address,
        j.salary,
        j.job_type,
        j.industry,
        j.career_level,
        j.job_description AS description,
        j.job_requirements AS requirements,
        j.created_at
     FROM jobs j
     WHERE ${conditions.join(' AND ')}
     ORDER BY j.created_at DESC NULLS LAST, j.id DESC
     LIMIT $${params.length}`,
    params
  );

  const profile = await getUserRecommendationProfile(alert.user_id);

  return result.rows
    .map((job) => scoreJobForAlert(job, alert, profile))
    .sort((left, right) => right.match_score - left.match_score || new Date(right.created_at || 0) - new Date(left.created_at || 0))
    .slice(0, normalizedLimit);
}

async function getUserJobAlertRules(userId) {
  await ensureJobAlertSchema();

  const result = await pool.query(
    `SELECT
        ja.id,
        ja.user_id,
        ja.job_id,
        ja.keyword,
        ja.location,
        ja.salary_range,
        ja.frequency,
        ja.is_active,
        ja.last_digest_sent_at,
        ja.last_checked_at,
        ja.created_at,
        ja.updated_at,
        src.job_title AS source_job_title,
        src.company_name AS source_company_name,
        src.industry AS source_industry,
        src.job_address AS source_location,
        src.company_address AS source_company_address,
        src.salary AS source_salary
     FROM job_alerts ja
     JOIN jobs src ON src.id = ja.job_id
     WHERE ja.user_id = $1
       AND ja.job_id IS NOT NULL
     ORDER BY ja.created_at DESC, ja.id DESC`,
    [userId]
  );

  const rules = [];
  for (const row of result.rows) {
    const rule = mapSimilarJobAlert(row);
    const matches = await findJobsForAlert(rule, 3);
    rules.push({
      ...rule,
      preview_matches: matches,
      preview_count: matches.length,
    });
  }

  return rules;
}

async function createJobAlertRule(userId, payload) {
  await ensureJobAlertSchema();
  const normalized = normalizeAlertPayload(payload);

  if (!normalized.keyword && !normalized.location && !normalized.salaryRange) {
    const err = new Error('Cần nhập ít nhất một tiêu chí: từ khóa, vị trí hoặc mức lương');
    err.status = 400;
    throw err;
  }

  const result = await pool.query(
    `INSERT INTO job_alerts (user_id, keyword, location, salary_range, frequency, is_active, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING id, user_id, keyword, location, salary_range, frequency, is_active,
               last_digest_sent_at, last_checked_at, created_at, updated_at`,
    [userId, normalized.keyword, normalized.location, normalized.salaryRange, normalized.frequency, normalized.isActive]
  );

  return mapAlertRule(result.rows[0]);
}

async function updateJobAlertRule(userId, alertId, payload) {
  await ensureJobAlertSchema();
  const normalized = normalizeAlertPayload(payload);

  if (!normalized.keyword && !normalized.location && !normalized.salaryRange) {
    const err = new Error('Cần nhập ít nhất một tiêu chí: từ khóa, vị trí hoặc mức lương');
    err.status = 400;
    throw err;
  }

  const result = await pool.query(
    `UPDATE job_alerts
     SET keyword = $1,
         location = $2,
         salary_range = $3,
         frequency = $4,
         is_active = $5,
         updated_at = NOW()
     WHERE id = $6
       AND user_id = $7
       AND job_id IS NULL
     RETURNING id, user_id, keyword, location, salary_range, frequency, is_active,
               last_digest_sent_at, last_checked_at, created_at, updated_at`,
    [normalized.keyword, normalized.location, normalized.salaryRange, normalized.frequency, normalized.isActive, alertId, userId]
  );

  return result.rows[0] ? mapAlertRule(result.rows[0]) : null;
}

async function deleteJobAlertRule(userId, alertId) {
  await ensureJobAlertSchema();
  const result = await pool.query(
    `DELETE FROM job_alerts
     WHERE id = $1
       AND user_id = $2
     RETURNING id`,
    [alertId, userId]
  );

  return result.rowCount > 0;
}

async function getDueJobAlerts(limit = 100) {
  await ensureJobAlertSchema();

  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
  const result = await pool.query(
    `SELECT
        ja.id,
        ja.user_id,
        ja.job_id,
        ja.keyword,
        ja.location,
        ja.salary_range,
        ja.frequency,
        ja.is_active,
        ja.last_digest_sent_at,
        ja.last_checked_at,
        ja.created_at,
        u.email,
        u.full_name,
        src.job_title AS source_job_title,
        src.industry AS source_industry,
        src.job_address AS source_location,
        src.company_address AS source_company_address
     FROM job_alerts ja
     JOIN users u ON u.id = ja.user_id
     LEFT JOIN roles r ON r.id = u.role_id
     LEFT JOIN jobs src ON src.id = ja.job_id
     WHERE COALESCE(ja.is_active, TRUE) = TRUE
       AND COALESCE(ja.frequency, 'weekly') = 'weekly'
       AND ja.job_id IS NOT NULL
       AND COALESCE(r.code, 'seeker') = 'seeker'
       AND u.email IS NOT NULL
       AND TRIM(u.email) <> ''
       AND (
         COALESCE(ja.last_digest_sent_at, ja.last_checked_at) IS NULL
         OR COALESCE(ja.last_digest_sent_at, ja.last_checked_at) <= NOW() - INTERVAL '7 days'
       )
     ORDER BY COALESCE(ja.last_digest_sent_at, ja.last_checked_at) ASC NULLS FIRST, ja.id ASC
     LIMIT $1`,
    [normalizedLimit]
  );

  return result.rows;
}

async function markAlertDigestSent(alertId) {
  await ensureJobAlertSchema();
  await pool.query(
    `UPDATE job_alerts
     SET last_digest_sent_at = NOW(),
         last_checked_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [alertId]
  );
}

async function markAlertChecked(alertId) {
  await ensureJobAlertSchema();
  await pool.query(
    `UPDATE job_alerts
     SET last_checked_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [alertId]
  );
}

module.exports = {
  ensureJobAlertSchema,
  getUserJobAlertRules,
  createJobAlertRule,
  updateJobAlertRule,
  deleteJobAlertRule,
  findJobsForAlert,
  getDueJobAlerts,
  markAlertDigestSent,
  markAlertChecked,
};
