const jwt = require('jsonwebtoken');
const pool = require('../../infrastructure/database/postgres');
const { ensureUserAccountStatusSchema } = require('../../models/auth/auth.model');
require('dotenv').config();

/**
 * Middleware xác thực JWT token.
 * Gắn user info vào req.user nếu token hợp lệ và tài khoản còn hoạt động.
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Không có token xác thực' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(403).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
  }

  try {
    await ensureUserAccountStatusSchema();

    const result = await pool.query(
      `SELECT
          u.id,
          u.email,
          u.is_verified,
          COALESCE(u.is_suspended, false) AS is_suspended,
          r.code AS role_code,
          r.name AS role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Tài khoản không tồn tại' });
    }

    const user = result.rows[0];
    if (user.is_suspended) {
      return res.status(403).json({
        error: 'Tài khoản của bạn đã bị tạm dừng bởi quản trị viên.',
        suspended: true,
      });
    }

    req.user = {
      ...decoded,
      id: user.id,
      email: user.email,
      role_code: user.role_code,
      role_name: user.role_name,
      is_verified: user.is_verified,
    };

    next();
  } catch (err) {
    console.error('Authenticate token error:', err);
    return res.status(500).json({ error: 'Đã xảy ra lỗi khi xác thực tài khoản' });
  }
}

module.exports = { authenticateToken };
