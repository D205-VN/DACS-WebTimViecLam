const pool = require('../../infrastructure/database/postgres');

let meetingRoomSchemaReady = false;

async function ensureMeetingRoomSchema() {
  if (meetingRoomSchemaReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS meeting_rooms (
      id SERIAL PRIMARY KEY,
      employer_id INTEGER,
      application_id INTEGER,
      job_id INTEGER,
      interview_date DATE,
      name VARCHAR(255) NOT NULL,
      location VARCHAR(255),
      capacity INTEGER DEFAULT 2,
      description TEXT,
      meeting_link TEXT,
      jitsi_room_id VARCHAR(255),
      access_token VARCHAR(255),
      host_token VARCHAR(255),
      host_joined_at TIMESTAMP,
      recording_status VARCHAR(40),
      recording_url TEXT,
      queue_status VARCHAR(40),
      confirmed_at TIMESTAMP,
      checked_in_at TIMESTAMP,
      admitted_at TIMESTAMP,
      started_at TIMESTAMP,
      ended_at TIMESTAMP,
      start_time TIMESTAMP,
      end_time TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE meeting_rooms
    ADD COLUMN IF NOT EXISTS employer_id INTEGER,
    ADD COLUMN IF NOT EXISTS application_id INTEGER,
    ADD COLUMN IF NOT EXISTS job_id INTEGER,
    ADD COLUMN IF NOT EXISTS interview_date DATE,
    ADD COLUMN IF NOT EXISTS meeting_link TEXT,
    ADD COLUMN IF NOT EXISTS jitsi_room_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS access_token VARCHAR(255),
    ADD COLUMN IF NOT EXISTS host_token VARCHAR(255),
    ADD COLUMN IF NOT EXISTS host_joined_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS recording_status VARCHAR(40),
    ADD COLUMN IF NOT EXISTS recording_url TEXT,
    ADD COLUMN IF NOT EXISTS queue_status VARCHAR(40),
    ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS admitted_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS start_time TIMESTAMP,
    ADD COLUMN IF NOT EXISTS end_time TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS meeting_schedules (
      id SERIAL PRIMARY KEY,
      meeting_room_id INTEGER REFERENCES meeting_rooms(id) ON DELETE CASCADE,
      employer_id INTEGER,
      seeker_id INTEGER,
      application_id INTEGER,
      access_token VARCHAR(255),
      queue_status VARCHAR(40),
      confirmed_at TIMESTAMP,
      checked_in_at TIMESTAMP,
      admitted_at TIMESTAMP,
      started_at TIMESTAMP,
      ended_at TIMESTAMP,
      start_time TIMESTAMP NOT NULL,
      end_time TIMESTAMP NOT NULL,
      title VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE meeting_schedules
    ADD COLUMN IF NOT EXISTS application_id INTEGER,
    ADD COLUMN IF NOT EXISTS access_token VARCHAR(255),
    ADD COLUMN IF NOT EXISTS queue_status VARCHAR(40),
    ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS admitted_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_rooms_application_id
    ON meeting_rooms(application_id)
    WHERE application_id IS NOT NULL
  `);

  await pool.query(`
    DROP INDEX IF EXISTS idx_meeting_rooms_employer_job_date
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_rooms_group_job_date
    ON meeting_rooms(employer_id, job_id, interview_date)
    WHERE application_id IS NULL
      AND employer_id IS NOT NULL
      AND job_id IS NOT NULL
      AND interview_date IS NOT NULL
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_rooms_access_token
    ON meeting_rooms(access_token)
    WHERE access_token IS NOT NULL
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_rooms_host_token
    ON meeting_rooms(host_token)
    WHERE host_token IS NOT NULL
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_meeting_rooms_employer_start
    ON meeting_rooms(employer_id, start_time DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_meeting_schedules_room_time
    ON meeting_schedules(meeting_room_id, start_time, end_time)
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_schedules_access_token
    ON meeting_schedules(access_token)
    WHERE access_token IS NOT NULL
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_meeting_schedules_room_queue
    ON meeting_schedules(meeting_room_id, queue_status, checked_in_at)
  `);

  meetingRoomSchemaReady = true;
}

module.exports = {
  ensureMeetingRoomSchema,
};
