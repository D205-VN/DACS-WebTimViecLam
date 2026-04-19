const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../src/config/db');

async function initFeatureTables() {
  const client = await pool.connect();
  try {
    console.log('🔄 Creating feature tables...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS saved_jobs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, job_id)
      );
    `);
    console.log('✅ Table "saved_jobs" created.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS applied_jobs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
        cv_text TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, job_id)
      );
    `);
    console.log('✅ Table "applied_jobs" created.');
    console.log('🎉 Feature tables initialized!');
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

initFeatureTables();
