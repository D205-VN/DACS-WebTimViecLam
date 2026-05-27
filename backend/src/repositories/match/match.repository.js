const pool = require('../../infrastructure/database/postgres');

async function findPrimaryOrLatestCv(userId) {
  const result = await pool.query(
    `SELECT id, title, target_role, html_content
     FROM user_cvs
     WHERE user_id = $1
     ORDER BY is_primary DESC, created_at DESC, id DESC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
}

async function findCandidateJobs(limit = 200) {
  const result = await pool.query(
    `SELECT id, job_title AS title, job_description AS description,
            job_requirements AS requirements, benefits,
            job_address AS location, job_type, salary,
            company_name, company_address, industry,
            career_level, created_at
     FROM jobs
     WHERE COALESCE(NULLIF(TRIM(status), ''), 'approved') = 'approved'
     ORDER BY created_at DESC NULLS LAST, id DESC
     LIMIT $1`,
    [limit]
  );

  return result.rows;
}

async function findAppliedJobIds(userId) {
  const result = await pool.query(
    'SELECT job_id FROM applied_jobs WHERE user_id = $1',
    [userId]
  );

  return result.rows.map((row) => row.job_id);
}

async function findApplicationHistory(userId) {
  const result = await pool.query(
    `SELECT j.job_title, j.industry, j.job_description, j.job_requirements
     FROM applied_jobs aj
     JOIN jobs j ON j.id = aj.job_id
     WHERE aj.user_id = $1
     ORDER BY aj.created_at DESC
     LIMIT 10`,
    [userId]
  );

  return result.rows;
}

module.exports = {
  findApplicationHistory,
  findAppliedJobIds,
  findCandidateJobs,
  findPrimaryOrLatestCv,
};
