require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("UPDATE meeting_rooms SET location = 'Online (Daily.co)' WHERE location = 'Online (Jitsi Meet)'")
  .then(() => pool.end());
