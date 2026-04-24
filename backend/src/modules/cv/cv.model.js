const pool = require('../../infrastructure/database/postgres');

let cvSchemaReady = false;

async function ensureCvSchema() {
  if (cvSchemaReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_cvs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      target_role VARCHAR(255),
      html_content TEXT NOT NULL,
      is_primary BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    ALTER TABLE user_cvs
    ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE
  `);

  cvSchemaReady = true;
}

async function ensurePrimaryCvForUser(userId) {
  await ensureCvSchema();

  const primaryResult = await pool.query(
    `SELECT id
     FROM user_cvs
     WHERE user_id = $1
       AND is_primary = TRUE
     LIMIT 1`,
    [userId]
  );

  if (primaryResult.rows.length > 0) {
    return primaryResult.rows[0].id;
  }

  const latestResult = await pool.query(
    `SELECT id
     FROM user_cvs
     WHERE user_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [userId]
  );

  const latestCvId = latestResult.rows[0]?.id;
  if (!latestCvId) return null;

  await pool.query(
    `UPDATE user_cvs
     SET is_primary = TRUE
     WHERE id = $1 AND user_id = $2`,
    [latestCvId, userId]
  );

  return latestCvId;
}

module.exports = {
  ensureCvSchema,
  ensurePrimaryCvForUser,
};
