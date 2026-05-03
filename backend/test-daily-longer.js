require('dotenv').config();
const apiKey = process.env.DAILY_API_KEY;
fetch('https://api.daily.co/v1/meeting-tokens', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    properties: {
      room_name: 'aptertekwork-interview-1234567890-20260503-1234567890abcdef',
      is_owner: true,
    },
  }),
}).then(res => res.json()).then(data => {
  console.log("Token length:", data.token.length);
}).catch(console.error);
