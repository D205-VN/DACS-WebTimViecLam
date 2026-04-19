const pool = require('../config/db');

// GET /api/jobs — Danh sách jobs (có phân trang)
exports.getJobs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) FROM jobs');
    const totalJobs = parseInt(countResult.rows[0].count);

    const result = await pool.query('SELECT * FROM jobs ORDER BY id ASC LIMIT $1 OFFSET $2', [limit, offset]);
    
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

// GET /api/jobs/saved — Danh sách job đã lưu (cần JWT)
exports.getSavedJobs = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT j.*, sj.created_at as saved_at
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
      `SELECT j.*, aj.status, aj.created_at as applied_at
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
    const result = await pool.query('SELECT * FROM jobs WHERE id = $1', [req.params.id]);
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
    const jobId = req.params.id;
    const userId = req.user.id;

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
