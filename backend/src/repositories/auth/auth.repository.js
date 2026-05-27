const pool = require('../infrastructure/database/postgres');

async function findUserByEmail(email, columns = '*') {
  const result = await pool.query(`SELECT ${columns} FROM users WHERE email = $1`, [email]);
  return result.rows[0] || null;
}

async function deleteUser(userId) {
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
}

async function createUser(payload) {
  const result = await pool.query(
    `INSERT INTO users (full_name, email, phone, password_hash, role_id, company_name, company_email, company_city, company_ward)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, email, role_id`,
    [
      payload.fullName,
      payload.email,
      payload.phone,
      payload.passwordHash,
      payload.roleId,
      payload.companyName || null,
      payload.companyEmail || null,
      payload.companyCity || null,
      payload.companyWard || null,
    ]
  );

  return result.rows[0] || null;
}

async function replaceOtp(email, otp, expiresAt) {
  await pool.query('DELETE FROM email_otps WHERE email = $1', [email]);
  await pool.query(
    'INSERT INTO email_otps (email, otp, expires_at) VALUES ($1, $2, $3)',
    [email, otp, expiresAt]
  );
}

async function findValidOtp(email, otp) {
  const result = await pool.query(
    'SELECT * FROM email_otps WHERE email = $1 AND otp = $2 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
    [email, otp]
  );

  return result.rows[0] || null;
}

async function deleteOtps(email) {
  await pool.query('DELETE FROM email_otps WHERE email = $1', [email]);
}

async function markUserVerified(email) {
  await pool.query('UPDATE users SET is_verified = TRUE WHERE email = $1', [email]);
}

async function findUserWithRoleByEmail(email, selectAll = false) {
  const columns = selectAll
    ? 'u.*, r.code AS role_code, r.name AS role_name'
    : 'u.id, u.full_name, u.email, u.avatar_url, COALESCE(u.is_suspended, false) AS is_suspended, r.code AS role_code, r.name AS role_name';
  const result = await pool.query(
    `SELECT ${columns}
     FROM users u JOIN roles r ON u.role_id = r.id
     WHERE email = $1`,
    [email]
  );

  return result.rows[0] || null;
}

async function createGoogleUser({ name, email, googleId, picture }) {
  await pool.query(
    `INSERT INTO users (full_name, email, google_id, avatar_url, is_verified, role_id)
     VALUES ($1, $2, $3, $4, TRUE, 3)`,
    [name, email, googleId, picture]
  );
}

async function attachGoogleInfo({ googleId, picture, email }) {
  await pool.query(
    'UPDATE users SET google_id = $1, avatar_url = COALESCE(avatar_url, $2), is_verified = TRUE WHERE email = $3',
    [googleId, picture, email]
  );
}

async function findMe(userId) {
  const result = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.avatar_url, u.company_name, u.company_email,
            u.company_city, u.company_ward, u.created_at, COALESCE(u.is_suspended, false) AS is_suspended,
            r.code AS role_code, r.name AS role_name
     FROM users u JOIN roles r ON u.role_id = r.id
     WHERE u.id = $1`,
    [userId]
  );

  return result.rows[0] || null;
}

async function findRawUserById(userId) {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
  return result.rows[0] || null;
}

async function updateProfile(userId, payload) {
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
      payload.fullName,
      payload.phone,
      payload.avatarUrl,
      payload.companyName,
      payload.companyEmail,
      payload.companyCity,
      payload.companyWard,
      userId,
    ]
  );

  return findMe(userId);
}

async function updatePasswordById(userId, passwordHash) {
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
}

async function updatePasswordByEmail(email, passwordHash) {
  await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [passwordHash, email]);
}

module.exports = {
  attachGoogleInfo,
  createGoogleUser,
  createUser,
  deleteOtps,
  deleteUser,
  findMe,
  findRawUserById,
  findUserByEmail,
  findUserWithRoleByEmail,
  findValidOtp,
  markUserVerified,
  replaceOtp,
  updatePasswordByEmail,
  updatePasswordById,
  updateProfile,
};
