require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const { getRoomCandidates, getCurrentCandidate, deriveRoomQueueStatus } = require('./src/modules/meeting-rooms/meeting-room.model');

async function test() {
  const token = '4cdec2511ffb3e0021448d3ae21de4b5a932e2ea16763960';
  try {
    const hostResult = await pool.query(
        `SELECT
            mr.id, mr.name, mr.location, mr.description, mr.meeting_link,
            mr.jitsi_room_id, mr.recording_status, mr.recording_url,
            mr.host_joined_at, mr.start_time, mr.end_time,
            mr.host_token
         FROM meeting_rooms mr
         WHERE mr.host_token = $1
         LIMIT 1`,
        [token]
    );
    if (hostResult.rows.length) {
        const room = hostResult.rows[0];
        console.log("Room found:", room.id);
        const candidates = await getRoomCandidates(pool, room.id);
        console.log("Candidates:", candidates.length);
        const currentCandidate = getCurrentCandidate(candidates);
        room.role = 'host';
        room.candidates = candidates;
        room.current_candidate = currentCandidate;
        room.application_id = currentCandidate?.application_id || null;
        room.candidate_name = currentCandidate?.candidate_name || null;
        room.interview_at = currentCandidate?.interview_at || room.start_time;
        room.queue_status = deriveRoomQueueStatus(room, candidates);
        room.can_join = true;
        room.daily_token = room.host_token;
        delete room.host_token;
        console.log("Success");
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    pool.end();
  }
}
test();
