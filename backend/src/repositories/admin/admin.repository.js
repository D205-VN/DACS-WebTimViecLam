const pool = require('../infrastructure/database/postgres');

async function getStatsCounts() {
  const [userCount, jobCount, pendingJobCount, appliedCount] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM users'),
    pool.query("SELECT COUNT(*) FROM jobs WHERE COALESCE(NULLIF(TRIM(status), ''), 'approved') = 'approved'"),
    pool.query("SELECT COUNT(*) FROM jobs WHERE COALESCE(NULLIF(TRIM(status), ''), 'approved') = 'pending'"),
    pool.query('SELECT COUNT(*) FROM applied_jobs'),
  ]);

  return {
    users: Number.parseInt(userCount.rows[0].count, 10),
    jobs: Number.parseInt(jobCount.rows[0].count, 10),
    pendingJobs: Number.parseInt(pendingJobCount.rows[0].count, 10),
    applied: Number.parseInt(appliedCount.rows[0].count, 10),
  };
}

async function findUsers() {
  const result = await pool.query(
    `SELECT
        u.id,
        u.full_name,
        u.email,
        r.code AS role_code,
        r.name AS role_name,
        u.is_verified,
        COALESCE(u.is_suspended, false) AS is_suspended,
        u.created_at
     FROM users u
     JOIN roles r ON u.role_id = r.id
     ORDER BY u.created_at DESC, u.id DESC`
  );

  return result.rows;
}

async function findPendingJobs() {
  const result = await pool.query(
    `SELECT *
     FROM jobs
     WHERE COALESCE(NULLIF(TRIM(status), ''), 'approved') = 'pending'
     ORDER BY created_at DESC NULLS LAST, id DESC`
  );

  return result.rows;
}

async function updateJobStatus({ jobId, status, reason }) {
  const result = await pool.query(
    'UPDATE jobs SET status = $1, rejection_reason = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
    [status, reason || null, jobId]
  );

  return result.rows[0] || null;
}

async function updateUserSuspension({ userId, suspended }) {
  const result = await pool.query(
    'UPDATE users SET is_suspended = $1 WHERE id = $2 RETURNING id, full_name, email, is_suspended',
    [suspended, userId]
  );

  return result.rows[0] || null;
}

module.exports = {
  findPendingJobs,
  findUsers,
  getStatsCounts,
  updateJobStatus,
  updateUserSuspension,
};
