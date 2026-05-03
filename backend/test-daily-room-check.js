require('dotenv').config();
const apiKey = process.env.DAILY_API_KEY;

async function test() {
  try {
    const roomName = 'aptertekwork-interview-14644-20260503-7123c50ef7e57fe4';
    const response = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    const data = await response.json();
    console.log("Status:", response.status);
    console.log("Data:", data);
  } catch (err) {
    console.error(err);
  }
}
test();
