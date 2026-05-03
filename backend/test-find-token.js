require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function find() {
  const token = '4cdec2511ffb3e0021448d3ae21de4b5a932e2ea16763960';
  const res1 = await pool.query('SELECT * FROM meeting_schedules WHERE access_token = $1', [token]);
  console.log("Schedules:", res1.rows.length);
  const res2 = await pool.query('SELECT * FROM meeting_rooms WHERE host_token = $1', [token]);
  console.log("Rooms (host):", res2.rows.length);
  pool.end();
}
find();
