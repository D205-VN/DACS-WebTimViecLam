const pool = require('../../infrastructure/database/postgres');

let publicJobSchemaReady = false;
let publicApplicationSchemaReady = false;
let publicJobAnalyticsSchemaReady = false;

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
      keyword VARCHAR(255),
      location VARCHAR(255),
      salary_range VARCHAR(30),
      frequency VARCHAR(20) DEFAULT 'weekly',
      is_active BOOLEAN DEFAULT TRUE,
      last_digest_sent_at TIMESTAMP,
      last_checked_at TIMESTAMP,
      updated_at TIMESTAMP DEFAULT NOW(),
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
    ADD COLUMN IF NOT EXISTS interview_reminder_sent_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS application_source VARCHAR(40) DEFAULT 'organic',
    ADD COLUMN IF NOT EXISTS cover_letter TEXT,
    ADD COLUMN IF NOT EXISTS cv_id INTEGER REFERENCES user_cvs(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
  `);

  await pool.query(`
    ALTER TABLE job_alerts
    ADD COLUMN IF NOT EXISTS keyword VARCHAR(255),
    ADD COLUMN IF NOT EXISTS location VARCHAR(255),
    ADD COLUMN IF NOT EXISTS salary_range VARCHAR(30),
    ADD COLUMN IF NOT EXISTS frequency VARCHAR(20) DEFAULT 'weekly',
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS last_digest_sent_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_job_alerts_user_active
    ON job_alerts(user_id, is_active)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_job_alerts_digest
    ON job_alerts(frequency, is_active, last_digest_sent_at, last_checked_at)
  `);

  await pool.query(`
    ALTER TABLE user_cvs
    ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS current_location VARCHAR(255),
    ADD COLUMN IF NOT EXISTS current_lat DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS current_lng DOUBLE PRECISION
  `);

  publicApplicationSchemaReady = true;
}

async function ensureJobAnalyticsSchema() {
  if (publicJobAnalyticsSchemaReady) return;

  await ensurePublicApplicationSchema();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS job_views (
      id SERIAL PRIMARY KEY,
      job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      viewer_key VARCHAR(128),
      source VARCHAR(40) DEFAULT 'organic',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_job_views_job_created_at
    ON job_views(job_id, created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_job_views_job_source
    ON job_views(job_id, source)
  `);

  publicJobAnalyticsSchemaReady = true;
}

module.exports = {
  ensureJobStatusSchema,
  ensurePublicApplicationSchema,
  ensureJobAnalyticsSchema,
};
