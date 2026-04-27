const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../infrastructure/database/postgres');
const { sendOTPEmail, sendPasswordResetOTPEmail } = require('./email.service');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Helper: generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper: create JWT token
function createToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role_code: user.role_code, role_name: user.role_name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * POST /api/auth/register
 * Đăng ký tài khoản mới + gửi OTP qua email
 */
async function register(req, res) {
  const { fullName, email, phone, password, role_code, companyName, companyEmail, companyCity, companyWard } = req.body;

  try {
    // Check existing user
    const existing = await pool.query('SELECT id, is_verified FROM users WHERE email = $1', [email]);

    if (existing.rows.length > 0) {
      if (existing.rows[0].is_verified) {
        return res.status(400).json({ error: 'Email này đã được đăng ký' });
      }
      // If not verified, delete old record and re-register
      await pool.query('DELETE FROM users WHERE id = $1', [existing.rows[0].id]);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Map role string to role_id
    const roleId = role_code === 'employer' ? 2 : 3;

    // Insert user
    const result = await pool.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role_id, company_name, company_email, company_city, company_ward)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, email, role_id`,
      [fullName, email, phone, passwordHash, roleId, companyName || null, companyEmail || null, companyCity || null, companyWard || null]
    );

    // Generate and save OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await pool.query('DELETE FROM email_otps WHERE email = $1', [email]);
    await pool.query(
      'INSERT INTO email_otps (email, otp, expires_at) VALUES ($1, $2, $3)',
      [email, otp, expiresAt]
    );

    // Send OTP email
    await sendOTPEmail(email, otp);

    res.status(201).json({
      message: 'Đăng ký thành công! Vui lòng kiểm tra email để lấy mã OTP.',
      email: result.rows[0].email,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Đã xảy ra lỗi khi đăng ký' });
  }
}

/**
 * POST /api/auth/verify-otp
 * Xác thực mã OTP 6 số
 */
async function verifyOTP(req, res) {
  const { email, otp } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM email_otps WHERE email = $1 AND otp = $2 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [email, otp]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Mã OTP không hợp lệ hoặc đã hết hạn' });
    }

    // Activate user
    await pool.query('UPDATE users SET is_verified = TRUE WHERE email = $1', [email]);
    // Clean up OTPs
    await pool.query('DELETE FROM email_otps WHERE email = $1', [email]);

    // Get user and return token
    const user = await pool.query(`
      SELECT u.id, u.full_name, u.email, u.avatar_url, r.code as role_code, r.name as role_name 
      FROM users u JOIN roles r ON u.role_id = r.id 
      WHERE email = $1`, [email]);
    const token = createToken(user.rows[0]);

    res.json({
      message: 'Xác thực thành công!',
      token,
      user: user.rows[0],
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Đã xảy ra lỗi khi xác thực' });
  }
}

/**
 * POST /api/auth/resend-otp
 * Gửi lại mã OTP
 */
async function resendOTP(req, res) {
  const { email } = req.body;

  try {
    const user = await pool.query('SELECT id, is_verified FROM users WHERE email = $1', [email]);
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'Email không tồn tại' });
    }
    if (user.rows[0].is_verified) {
      return res.status(400).json({ error: 'Tài khoản đã được xác thực' });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await pool.query('DELETE FROM email_otps WHERE email = $1', [email]);
    await pool.query(
      'INSERT INTO email_otps (email, otp, expires_at) VALUES ($1, $2, $3)',
      [email, otp, expiresAt]
    );

    await sendOTPEmail(email, otp);

    res.json({ message: 'Đã gửi lại mã OTP. Vui lòng kiểm tra email.' });
  } catch (err) {
    console.error('Resend OTP error:', err);
    res.status(500).json({ error: 'Đã xảy ra lỗi khi gửi lại OTP' });
  }
}

/**
 * POST /api/auth/login
 * Đăng nhập bằng email/password
 */
async function login(req, res) {
  const { email, password } = req.body;

  try {
    const result = await pool.query(`
      SELECT u.*, r.code as role_code, r.name as role_name 
      FROM users u JOIN roles r ON u.role_id = r.id 
      WHERE email = $1`, [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      return res.status(400).json({ error: 'Tài khoản này được đăng ký qua Google. Vui lòng đăng nhập bằng Google.' });
    }

    if (!user.is_verified) {
      return res.status(403).json({ error: 'Tài khoản chưa được xác thực email', needVerify: true, email: user.email });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    }

    const token = createToken(user);

    res.json({
      message: 'Đăng nhập thành công!',
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role_code: user.role_code,
        role_name: user.role_name,
        avatar_url: user.avatar_url,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Đã xảy ra lỗi khi đăng nhập' });
  }
}

/**
 * POST /api/auth/google
 * Đăng ký / Đăng nhập bằng Google ID token
 */
async function googleAuth(req, res) {
  const { credential } = req.body;

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // Check if user exists
    let user = await pool.query(`
      SELECT u.*, r.code as role_code, r.name as role_name 
      FROM users u JOIN roles r ON u.role_id = r.id 
      WHERE email = $1`, [email]);

    if (user.rows.length === 0) {
      // Create new user (auto-verified via Google)
      await pool.query(
        `INSERT INTO users (full_name, email, google_id, avatar_url, is_verified, role_id)
         VALUES ($1, $2, $3, $4, TRUE, 3)`,
        [name, email, googleId, picture]
      );
      user = await pool.query(`
        SELECT u.id, u.full_name, u.email, u.avatar_url, r.code as role_code, r.name as role_name 
        FROM users u JOIN roles r ON u.role_id = r.id 
        WHERE email = $1`, [email]);
    } else {
      // Update Google info if missing
      if (!user.rows[0].google_id) {
        await pool.query(
          'UPDATE users SET google_id = $1, avatar_url = COALESCE(avatar_url, $2), is_verified = TRUE WHERE email = $3',
          [googleId, picture, email]
        );
      }
      user = await pool.query(`
        SELECT u.id, u.full_name, u.email, u.avatar_url, r.code as role_code, r.name as role_name 
        FROM users u JOIN roles r ON u.role_id = r.id 
        WHERE email = $1`, [email]);
    }

    const token = createToken(user.rows[0]);

    res.json({
      message: 'Đăng nhập Google thành công!',
      token,
      user: user.rows[0],
    });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(400).json({ error: 'Xác thực Google thất bại' });
  }
}

/**
 * GET /api/auth/me
 * Lấy thông tin user hiện tại (cần JWT)
 */
async function getMe(req, res) {
  try {
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.avatar_url, u.company_name, u.company_email, 
              u.company_city, u.company_ward, u.created_at, r.code as role_code, r.name as role_name 
       FROM users u JOIN roles r ON u.role_id = r.id 
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Đã xảy ra lỗi' });
  }
}

/**
 * PUT /api/auth/profile
 * Cập nhật thông tin tài khoản (cần JWT)
 */
async function updateProfile(req, res) {
  const {
    fullName,
    phone,
    avatarUrl,
    avatar_url,
    companyName,
    companyEmail,
    companyCity,
    companyWard,
  } = req.body;

  try {
    const currentUserResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (currentUserResult.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    const currentUser = currentUserResult.rows[0];
    const nextFullName = String(fullName ?? currentUser.full_name ?? '').trim();

    if (!nextFullName) {
      return res.status(400).json({ error: 'Họ và tên không được để trống' });
    }

    const resolveNextValue = (incomingValue, currentValue) => {
      if (incomingValue === undefined) return currentValue;
      const trimmed = String(incomingValue).trim();
      return trimmed || null;
    };

    await pool.query(
      `UPDATE users
       SET full_name = $1,
           phone = $2,
           avatar_url = $3,
           company_name = $4,
           company_email = $5,
           company_city = $6,
           company_ward = $7
       WHERE id = $8`,
      [
        nextFullName,
        resolveNextValue(phone, currentUser.phone),
        resolveNextValue(avatarUrl ?? avatar_url, currentUser.avatar_url),
        resolveNextValue(companyName, currentUser.company_name),
        resolveNextValue(companyEmail, currentUser.company_email),
        resolveNextValue(companyCity, currentUser.company_city),
        resolveNextValue(companyWard, currentUser.company_ward),
        req.user.id,
      ]
    );

    const updatedUser = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.avatar_url, u.company_name, u.company_email, 
              u.company_city, u.company_ward, u.created_at, r.code as role_code, r.name as role_name 
       FROM users u JOIN roles r ON u.role_id = r.id 
       WHERE u.id = $1`,
      [req.user.id]
    );

    res.json({
      message: 'Cập nhật thông tin thành công',
      user: updatedUser.rows[0],
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Đã xảy ra lỗi khi cập nhật thông tin' });
  }
}

/**
 * POST /api/auth/change-password
 * Đổi mật khẩu (cần JWT)
 */
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      return res.status(400).json({ error: 'Tài khoản đăng ký qua Google không có mật khẩu để đổi' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Mật khẩu hiện tại không đúng' });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);

    res.json({ message: 'Đổi mật khẩu thành công!' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Đã xảy ra lỗi khi đổi mật khẩu' });
   }
}

/**
 * POST /api/auth/forgot-password
 * Gửi mã OTP để đặt lại mật khẩu
 */
async function forgotPassword(req, res) {
  const { email } = req.body;

  if (!email?.trim()) {
    return res.status(400).json({ error: 'Vui lòng nhập email' });
  }

  try {
    const user = await pool.query('SELECT id, is_verified, password_hash FROM users WHERE email = $1', [email]);
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'Email không tồn tại trong hệ thống' });
    }
    if (!user.rows[0].is_verified) {
      return res.status(400).json({ error: 'Tài khoản chưa được xác thực email. Vui lòng đăng ký lại.' });
    }
    if (!user.rows[0].password_hash) {
      return res.status(400).json({ error: 'Tài khoản này được đăng ký qua Google. Vui lòng đăng nhập bằng Google.' });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Use prefix 'reset:' to distinguish from registration OTPs
    const resetEmail = `reset:${email}`;
    await pool.query('DELETE FROM email_otps WHERE email = $1', [resetEmail]);
    await pool.query(
      'INSERT INTO email_otps (email, otp, expires_at) VALUES ($1, $2, $3)',
      [resetEmail, otp, expiresAt]
    );

    await sendPasswordResetOTPEmail(email, otp);

    res.json({ message: 'Mã xác thực đã được gửi đến email của bạn.', email });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Đã xảy ra lỗi khi gửi mã xác thực' });
  }
}

/**
 * POST /api/auth/verify-reset-otp
 * Xác thực mã OTP cho đặt lại mật khẩu
 */
async function verifyResetOTP(req, res) {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ email và mã OTP' });
  }

  try {
    const resetEmail = `reset:${email}`;
    const result = await pool.query(
      'SELECT * FROM email_otps WHERE email = $1 AND otp = $2 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [resetEmail, otp]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Mã OTP không hợp lệ hoặc đã hết hạn' });
    }

    // Generate a temporary reset token (valid 10 min)
    const resetToken = jwt.sign(
      { email, purpose: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    // Clean up OTP
    await pool.query('DELETE FROM email_otps WHERE email = $1', [resetEmail]);

    res.json({ message: 'Xác thực thành công! Bạn có thể đặt lại mật khẩu.', resetToken });
  } catch (err) {
    console.error('Verify reset OTP error:', err);
    res.status(500).json({ error: 'Đã xảy ra lỗi khi xác thực mã OTP' });
  }
}

/**
 * POST /api/auth/reset-password
 * Đặt lại mật khẩu mới (cần resetToken)
 */
async function resetPassword(req, res) {
  const { resetToken, newPassword } = req.body;

  if (!resetToken || !newPassword) {
    return res.status(400).json({ error: 'Thiếu thông tin cần thiết' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 8 ký tự' });
  }

  try {
    const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    if (decoded.purpose !== 'password_reset') {
      return res.status(400).json({ error: 'Token không hợp lệ' });
    }

    const { email } = decoded;
    const user = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);
    await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [newHash, email]);

    res.json({ message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập với mật khẩu mới.' });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'Phiên đặt lại mật khẩu đã hết hạn. Vui lòng thử lại.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(400).json({ error: 'Token không hợp lệ' });
    }
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Đã xảy ra lỗi khi đặt lại mật khẩu' });
  }
}

module.exports = { register, verifyOTP, resendOTP, login, googleAuth, getMe, updateProfile, changePassword, forgotPassword, verifyResetOTP, resetPassword };
