require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyIjoiYXB0ZXJ0ZWt3b3JrLWludGVydmlldy0xNDY0NC0yMDI2MDUwMy03MTIzYzUwZWY3ZTU3ZmU0IiwibyI6dHJ1ZSwiZCI6IjJhZTZjOGMzLTNhYzEtNGJiMC05MjQ0LWNhNDU1OWY1NzhjZiIsImlhdCI6MTc3Nzc5NjMxNH0.08KO86qrbqHGHZgqQgkFMJTJG9bipKmMVXwXLxCVgco';
    await client.query('BEGIN');
    const roomResult = await client.query('SELECT id FROM meeting_rooms WHERE host_token = $1 FOR UPDATE', [token]);
    const room = roomResult.rows[0];
    if (!room) {
      console.log('Room not found');
      return;
    }
    console.log('Room ID:', room.id);

    const completed = await client.query(`
      UPDATE meeting_schedules
      SET queue_status = 'completed', ended_at = NOW()
      WHERE id = (
        SELECT id FROM meeting_schedules
        WHERE meeting_room_id = $1 AND queue_status = 'in_interview' AND ended_at IS NULL
        ORDER BY admitted_at ASC NULLS LAST, id ASC LIMIT 1
      ) RETURNING id`, [room.id]);
    console.log('Completed schedule:', completed.rows[0]);

    // Check active
    const active = await client.query(`SELECT id FROM meeting_schedules WHERE meeting_room_id = $1 AND ended_at IS NULL AND queue_status = 'in_interview' ORDER BY admitted_at ASC NULLS LAST, id ASC LIMIT 1`, [room.id]);
    console.log('Active after complete:', active.rows[0]);

    const next = await client.query(`
      UPDATE meeting_schedules
      SET queue_status = 'in_interview', admitted_at = NOW(), started_at = NOW()
      WHERE id = (
        SELECT id FROM meeting_schedules
        WHERE meeting_room_id = $1 AND checked_in_at IS NOT NULL AND ended_at IS NULL AND COALESCE(queue_status, 'invited') = 'waiting'
        ORDER BY checked_in_at ASC, id ASC LIMIT 1
      ) RETURNING id`, [room.id]);
    console.log('Admitted schedule:', next.rows[0]);

    await client.query('ROLLBACK');
  } catch (err) {
    console.error('Error:', err);
    await client.query('ROLLBACK');
  } finally {
    client.release();
    pool.end();
  }
}
run();
