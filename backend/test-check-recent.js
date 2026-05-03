require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const res = await pool.query("SELECT * FROM meeting_rooms ORDER BY updated_at DESC LIMIT 1");
    console.log(res.rows[0]);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
check();
