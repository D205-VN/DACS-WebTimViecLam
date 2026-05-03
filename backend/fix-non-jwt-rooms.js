require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fix() {
  try {
    // Find rooms where host_token is not a JWT (length < 100)
    const res = await pool.query("SELECT * FROM meeting_rooms WHERE LENGTH(host_token) < 100");
    console.log(`Found ${res.rows.length} rooms with invalid Daily tokens`);
    
    const apiKey = process.env.DAILY_API_KEY;
    const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
    
    for (const room of res.rows) {
      console.log(`Migrating room ${room.id} (${room.jitsi_room_id})`);
      
      // Extract the room name from the jitsi_room_id if it's a daily url, or just use it directly
      let generatedRoomName = room.jitsi_room_id;
      if (generatedRoomName.startsWith('https://aptertekwork.daily.co/')) {
        generatedRoomName = generatedRoomName.replace('https://aptertekwork.daily.co/', '');
      }
      
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
            dailyUrl = `https://aptertekwork.daily.co/${generatedRoomName}`;
        }
      } catch (err) {
        console.error("Create room error:", err);
      }
      
      if (dailyUrl) {
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
        
        const link = `${baseUrl}/interview-room/${hostToken}`;
        await pool.query(
          "UPDATE meeting_rooms SET jitsi_room_id = $1, host_token = $2, meeting_link = $3 WHERE id = $4",
          [dailyUrl, hostToken, link, room.id]
        );
        console.log(`Successfully fixed room ${room.id}`);
      }
    }
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    pool.end();
  }
}
fix();
