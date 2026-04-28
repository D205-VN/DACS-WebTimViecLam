const pool = require('../../infrastructure/database/postgres');

let employerJobSchemaReady = false;
let employerProfileSchemaReady = false;
let employerApplicationSchemaReady = false;

async function ensureEmployerJobSchema() {
  if (employerJobSchemaReady) return;

  await pool.query(`
    ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS employer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved',
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS tags TEXT,
    ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION
  `);

  await pool.query(`
    UPDATE jobs
    SET status = 'approved'
    WHERE status IS NULL OR TRIM(status) = ''
  `);

  employerJobSchemaReady = true;
}

async function ensureEmployerProfileSchema() {
  if (employerProfileSchemaReady) return;

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS company_description TEXT,
    ADD COLUMN IF NOT EXISTS company_website VARCHAR(255),
    ADD COLUMN IF NOT EXISTS company_size VARCHAR(255),
    ADD COLUMN IF NOT EXISTS company_cover_url TEXT,
    ADD COLUMN IF NOT EXISTS avatar_url TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
  `);

  await pool.query(`
    ALTER TABLE users
    ALTER COLUMN avatar_url TYPE TEXT,
    ALTER COLUMN company_cover_url TYPE TEXT
  `);

  employerProfileSchemaReady = true;
}

async function ensureEmployerApplicationSchema() {
  if (employerApplicationSchemaReady) return;

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
    ADD COLUMN IF NOT EXISTS cv_id INTEGER REFERENCES user_cvs(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
  `);

  await pool.query(`
    ALTER TABLE user_cvs
    ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS current_location VARCHAR(255),
    ADD COLUMN IF NOT EXISTS current_lat DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS current_lng DOUBLE PRECISION
  `);

  employerApplicationSchemaReady = true;
}

module.exports = {
  ensureEmployerJobSchema,
  ensureEmployerProfileSchema,
  ensureEmployerApplicationSchema,
};
