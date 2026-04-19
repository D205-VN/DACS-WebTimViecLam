const pool = require('../config/db');

/**
 * GET /api/employer/dashboard
 * Lấy dữ liệu dashboard cho nhà tuyển dụng
 */
async function getDashboard(req, res) {
  try {
    const userId = req.user.id;

    // Thống kê
    const totalJobsResult = await pool.query(
      'SELECT COUNT(*) FROM jobs WHERE employer_id = $1', [userId]
    );
    const activeJobsResult = await pool.query(
      "SELECT COUNT(*) FROM jobs WHERE employer_id = $1 AND (deadline IS NULL OR deadline >= NOW())", [userId]
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
      `SELECT j.*, 
              (SELECT COUNT(*) FROM applied_jobs WHERE job_id = j.id) as applicant_count
       FROM jobs j 
       WHERE j.employer_id = $1 
       ORDER BY j.created_at DESC 
       LIMIT 5`, [userId]
    );

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

    const result = await pool.query(
      `INSERT INTO jobs (title, description, requirements, benefits, location, salary_min, salary_max, 
                         job_type, experience, deadline, tags, positions, employer_id, company_name, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
       RETURNING *`,
      [
        title, description, requirements || null, benefits || null,
        location || company?.company_city || null,
        salary_min || null, salary_max || null,
        job_type || 'Toàn thời gian',
        experience || 'Không yêu cầu',
        deadline || null,
        tags ? JSON.stringify(tags) : null,
        positions || 1,
        userId,
        company?.company_name || null,
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
      `SELECT j.*, 
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

module.exports = { getDashboard, createJob, getMyJobs };