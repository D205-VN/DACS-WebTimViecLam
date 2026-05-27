const crypto = require('crypto');
const pool = require('../infrastructure/database/postgres');
const { ensureCvSchema } = require('./cv.model');
const { ensurePublicApplicationSchema } = require('./job.model');
const { ensureVerificationSchema } = require('./verification.model');

let talentInsightSchemaReady = false;

function createPublicToken() {
  return crypto.randomBytes(18).toString('base64url');
}

async function ensureTalentInsightSchema() {
  if (talentInsightSchemaReady) return;

  await ensureCvSchema();
  await ensurePublicApplicationSchema();
  await ensureVerificationSchema();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS candidate_passports (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      public_token VARCHAR(80) NOT NULL UNIQUE,
      is_public BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS interview_evaluations (
      id SERIAL PRIMARY KEY,
      application_id INTEGER NOT NULL UNIQUE REFERENCES applied_jobs(id) ON DELETE CASCADE,
      employer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      candidate_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
      ratings JSONB DEFAULT '{}'::jsonb,
      strengths TEXT,
      concerns TEXT,
      recommendation VARCHAR(30) DEFAULT 'consider',
      feedback_to_candidate TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS work_simulation_submissions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
      scenario JSONB DEFAULT '{}'::jsonb,
      answer TEXT,
      score NUMERIC(5,2),
      feedback JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_work_simulation_user_job_created
    ON work_simulation_submissions(user_id, job_id, created_at DESC)
  `);

  talentInsightSchemaReady = true;
}

module.exports = {
  createPublicToken,
  ensureTalentInsightSchema,
};
