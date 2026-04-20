const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  try {
    console.log('Creating user_cvs table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_cvs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        target_role VARCHAR(255),
        html_content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Successfully created user_cvs table.');
  } catch (err) {
    console.error('Error creating table:', err);
  } finally {
    pool.end();
  }
}

run();
