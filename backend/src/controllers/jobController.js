const pool = require('../config/db');

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
