require('dotenv').config();
const apiKey = process.env.DAILY_API_KEY;

async function test() {
  try {
    const roomName = 'aptertekwork-interview-25-20260503-6e7e4c27fc';
    const response = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        name: roomName,
        privacy: 'public',
        properties: {
          enable_screenshare: true,
          enable_chat: true,
          start_video_off: false,
          start_audio_off: false,
        },
      }),
    });
    
    const data = await response.json();
    console.log("Room response:", response.status, data);

    const tokenRes = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          is_owner: true,
        },
      }),
    });
    const tokenData = await tokenRes.json();
    console.log("Token response:", tokenRes.status, tokenData);
  } catch (err) {
    console.error("Test Error:", err);
  }
}
test();
