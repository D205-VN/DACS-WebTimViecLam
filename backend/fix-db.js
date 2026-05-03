require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fix() {
  try {
    await pool.query(`ALTER TABLE meeting_rooms ALTER COLUMN jitsi_room_id TYPE TEXT`);
    await pool.query(`ALTER TABLE meeting_rooms ALTER COLUMN access_token TYPE TEXT`);
    await pool.query(`ALTER TABLE meeting_rooms ALTER COLUMN host_token TYPE TEXT`);
    await pool.query(`ALTER TABLE meeting_schedules ALTER COLUMN access_token TYPE TEXT`);
    console.log("DB columns altered successfully");
  } catch (err) {
    console.error("DB fix error:", err);
  } finally {
    pool.end();
  }
}
fix();
