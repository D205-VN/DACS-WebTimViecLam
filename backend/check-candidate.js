require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function check() {
  const res = await pool.query("SELECT id, meeting_room_id, application_id, access_token, queue_status FROM meeting_schedules ORDER BY id DESC LIMIT 5");
  console.log("Schedules:");
  res.rows.forEach(r => console.log(r));
  
  const jobs = await pool.query("SELECT id, interview_link, interview_mode, status FROM applied_jobs WHERE interview_link IS NOT NULL ORDER BY id DESC LIMIT 5");
  console.log("\nApplied jobs with links:");
  jobs.rows.forEach(r => console.log(r));
  pool.end();
}
check();
