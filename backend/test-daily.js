require('dotenv').config();
const apiKey = process.env.DAILY_API_KEY;
console.log("Key:", apiKey);
fetch('https://api.daily.co/v1/rooms', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    name: 'test-room-1234',
    privacy: 'public'
  }),
}).then(res => res.json()).then(console.log).catch(console.error);
