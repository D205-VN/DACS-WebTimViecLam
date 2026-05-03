require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fix() {
  try {
    const res = await pool.query("SELECT id, host_token FROM meeting_rooms");
    const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
    for (const room of res.rows) {
      if (room.host_token) {
        const link = `${baseUrl}/interview-room/${room.host_token}`;
        await pool.query("UPDATE meeting_rooms SET meeting_link = $1 WHERE id = $2", [link, room.id]);
      }
    }
    console.log("Updated meeting_link for all rooms");
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
fix();
