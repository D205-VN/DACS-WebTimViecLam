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
      room_name: 'test-room-1234',
      is_owner: true,
    },
  }),
}).then(res => res.json()).then(data => {
  console.log("Token length:", data.token.length);
  console.log("Token:", data.token);
}).catch(console.error);
