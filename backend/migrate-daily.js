require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  try {
    const res = await pool.query("SELECT * FROM meeting_rooms WHERE jitsi_room_id NOT LIKE 'https://%'");
    console.log(`Found ${res.rows.length} rooms to migrate`);
    const apiKey = process.env.DAILY_API_KEY;
    
    for (const room of res.rows) {
      console.log(`Migrating room ${room.id} (${room.jitsi_room_id})`);
      const generatedRoomName = room.jitsi_room_id;
      
      // Try to create the room on Daily.co
      let dailyUrl = null;
      let hostToken = room.host_token;
      
      try {
        const createRes = await fetch('https://api.daily.co/v1/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            name: generatedRoomName,
            privacy: 'public',
            properties: { enable_screenshare: true, enable_chat: true, start_video_off: false, start_audio_off: false },
          }),
        });
        const createData = await createRes.json();
        if (createRes.ok) {
          dailyUrl = createData.url;
        } else if (createData.error === 'invalid-request-error' && createData.info?.includes('already exists')) {
            // If already exists, fetch the URL
            dailyUrl = `https://aptertekwork.daily.co/${generatedRoomName}`;
        }
      } catch (err) {
        console.error("Create room error:", err);
      }
      
      if (dailyUrl) {
        // Create host token
        try {
          const tokenRes = await fetch('https://api.daily.co/v1/meeting-tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ properties: { room_name: generatedRoomName, is_owner: true } }),
          });
          if (tokenRes.ok) {
            const tokenData = await tokenRes.json();
            hostToken = tokenData.token;
          }
        } catch (err) {
          console.error("Create token error:", err);
        }
        
        // Update database
        await pool.query(
          "UPDATE meeting_rooms SET jitsi_room_id = $1, host_token = $2 WHERE id = $3",
          [dailyUrl, hostToken, room.id]
        );
        console.log(`Successfully migrated room ${room.id}`);
      }
    }
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    pool.end();
  }
}
migrate();
