const pool = require('../infrastructure/database/postgres');

let userAccountStatusSchemaReady = false;

async function ensureUserAccountStatusSchema() {
  if (userAccountStatusSchemaReady) return;

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false
  `);

  userAccountStatusSchemaReady = true;
}

module.exports = {
  ensureUserAccountStatusSchema,
};
