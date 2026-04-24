const pool = require('../../infrastructure/database/postgres');

let publicJobSchemaReady = false;
let publicApplicationSchemaReady = false;

async function ensureJobStatusSchema() {
  if (publicJobSchemaReady) return;

  await pool.query(`
    ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved'
  `);

  await pool.query(`
    UPDATE jobs
    SET status = 'approved'
    WHERE status IS NULL OR TRIM(status) = ''
  `);

  publicJobSchemaReady = true;
}

async function ensurePublicApplicationSchema() {
  if (publicApplicationSchemaReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS applied_jobs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
      cv_text TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, job_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS job_alerts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, job_id)
    )
  `);

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
    ALTER TABLE applied_jobs
    ADD COLUMN IF NOT EXISTS note TEXT,
    ADD COLUMN IF NOT EXISTS interview_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS interview_mode VARCHAR(50),
    ADD COLUMN IF NOT EXISTS interview_link TEXT,
    ADD COLUMN IF NOT EXISTS candidate_interview_mode VARCHAR(20),
    ADD COLUMN IF NOT EXISTS cv_id INTEGER REFERENCES user_cvs(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
  `);

  await pool.query(`
    ALTER TABLE user_cvs
    ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE
  `);

  publicApplicationSchemaReady = true;
}

module.exports = {
  ensureJobStatusSchema,
  ensurePublicApplicationSchema,
};
