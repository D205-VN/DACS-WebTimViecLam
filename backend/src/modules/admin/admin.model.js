const pool = require('../../infrastructure/database/postgres');

let adminJobSchemaReady = false;

async function ensureAdminJobSchema() {
  if (adminJobSchemaReady) return;

  await pool.query(`
    ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved',
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
  `);

  await pool.query(`
    UPDATE jobs
    SET status = 'approved'
    WHERE status IS NULL OR TRIM(status) = ''
  `);

  adminJobSchemaReady = true;
}

module.exports = {
  ensureAdminJobSchema,
};
