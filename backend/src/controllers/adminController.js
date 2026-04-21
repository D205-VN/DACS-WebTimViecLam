const pool = require('../config/db');
const { createNotification } = require('../services/notificationService');

let adminJobSchemaReady = false;

async function ensureAdminJobSchema() {
  if (adminJobSchemaReady) return;

  await pool.query(`
    ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved',
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
  `);

  await pool.query(`
    UPDATE jobs
    SET status = 'approved'
    WHERE status IS NULL OR TRIM(status) = ''
  `);

  adminJobSchemaReady = true;
}

async function ensureAdminSchemaForRequest(req, res, next) {
  try {
    await ensureAdminJobSchema();
    next();
  } catch (err) {
    console.error('Ensure admin schema error:', err);
    res.status(500).json({ error: 'Lỗi cấu hình dữ liệu quản trị' });
  }
}

exports.ensureAdminSchemaForRequest = ensureAdminSchemaForRequest;

exports.getStats = async (req, res) => {
  try {
    await ensureAdminJobSchema();

    const [userCount, jobCount, pendingJobCount, appliedCount] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query("SELECT COUNT(*) FROM jobs WHERE COALESCE(NULLIF(TRIM(status), ''), 'approved') = 'approved'"),
      pool.query("SELECT COUNT(*) FROM jobs WHERE COALESCE(NULLIF(TRIM(status), ''), 'approved') = 'pending'"),
      pool.query('SELECT COUNT(*) FROM applied_jobs'),
    ]);

    res.json({
      users: parseInt(userCount.rows[0].count, 10),
      jobs: parseInt(jobCount.rows[0].count, 10),
      pendingJobs: parseInt(pendingJobCount.rows[0].count, 10),
      applied: parseInt(appliedCount.rows[0].count, 10),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi khi lấy thống kê' });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
          u.id,
          u.full_name,
          u.email,
          r.code AS role_code,
          r.name AS role_name,
          u.is_verified,
          u.created_at
       FROM users u
       JOIN roles r ON u.role_id = r.id
       ORDER BY u.created_at DESC, u.id DESC`
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi khi lấy danh sách người dùng' });
  }
};

exports.getPendingJobs = async (req, res) => {
  try {
    await ensureAdminJobSchema();

    const result = await pool.query(
      `SELECT *
       FROM jobs
       WHERE COALESCE(NULLIF(TRIM(status), ''), 'approved') = 'pending'
       ORDER BY created_at DESC NULLS LAST, id DESC`
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi khi lấy danh sách chờ duyệt' });
  }
};

exports.updateJobStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
  }

  try {
    await ensureAdminJobSchema();

    const result = await pool.query(
      'UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy việc làm' });
    }

    const job = result.rows[0];
    if (job.employer_id) {
      await createNotification({
        userId: job.employer_id,
        type: status === 'approved' ? 'employer_job_approved' : 'employer_job_rejected',
        title: status === 'approved' ? 'Tin tuyển dụng đã được duyệt' : 'Tin tuyển dụng bị từ chối',
        message:
          status === 'approved'
            ? `Admin đã duyệt tin ${job.job_title || 'tuyển dụng'} của bạn.`
            : `Admin đã từ chối tin ${job.job_title || 'tuyển dụng'} của bạn.`,
        to: '/employer/dashboard',
        tab: 'jobs',
        meta: { job_id: job.id },
      }).catch((notificationError) => {
        console.error('Create employer moderation notification error:', notificationError);
      });
    }

    res.json({ message: 'Cập nhật trạng thái thành công', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi khi cập nhật trạng thái' });
  }
};
