require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function test() {
  try {
    const roomName = 'Phỏng vấn test';
    const interviewDateKey = '2026-05-03';
    const generatedRoomId = 'https://aptertekwork.daily.co/test';
    const finalHostToken = 'test-token';
    const interviewStartIso = new Date().toISOString();
    const interviewEndIso = new Date().toISOString();

    const result = await pool.query(
      `INSERT INTO meeting_rooms (
         employer_id, application_id, job_id, interview_date, name, location,
         capacity, description, meeting_link, jitsi_room_id, access_token,
         host_token, recording_status, queue_status, start_time, end_time, updated_at
       )
       VALUES ($1, NULL, $2, $3::date, $4, $5, $6, $7, NULL, $8, NULL, $9, 'idle', 'invited', $10, $11, NOW())
       ON CONFLICT (employer_id, job_id, interview_date)
       WHERE application_id IS NULL
         AND employer_id IS NOT NULL
         AND job_id IS NOT NULL
         AND interview_date IS NOT NULL
       DO UPDATE SET
         employer_id = EXCLUDED.employer_id,
         job_id = EXCLUDED.job_id,
         interview_date = EXCLUDED.interview_date,
         name = EXCLUDED.name,
         location = EXCLUDED.location,
         capacity = GREATEST(COALESCE(meeting_rooms.capacity, 0), EXCLUDED.capacity),
         description = EXCLUDED.description,
         jitsi_room_id = COALESCE(meeting_rooms.jitsi_room_id, EXCLUDED.jitsi_room_id),
         host_token = COALESCE(meeting_rooms.host_token, EXCLUDED.host_token),
         recording_status = COALESCE(meeting_rooms.recording_status, EXCLUDED.recording_status),
         queue_status = CASE
           WHEN meeting_rooms.queue_status IN ('waiting', 'in_interview') THEN meeting_rooms.queue_status
           ELSE 'invited'
         END,
         start_time = LEAST(COALESCE(meeting_rooms.start_time, EXCLUDED.start_time), EXCLUDED.start_time),
         end_time = GREATEST(COALESCE(meeting_rooms.end_time, EXCLUDED.end_time), EXCLUDED.end_time),
         updated_at = NOW()
       RETURNING *`,
      [
        1, 
        1, 
        interviewDateKey,
        roomName,
        'Online (Jitsi Meet)',
        20,
        'desc',
        generatedRoomId,
        finalHostToken,
        interviewStartIso,
        interviewEndIso,
      ]
    );
    console.log("Success:", result.rows[0].id);
  } catch (err) {
    console.error("SQL Error:", err);
  } finally {
    pool.end();
  }
}
test();
