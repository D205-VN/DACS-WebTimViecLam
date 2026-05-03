require('dotenv').config();
const { completeCurrentInterview } = require('./src/modules/meeting-rooms/meeting-room.controller');

const req = { params: { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyIjoiYXB0ZXJ0ZWt3b3JrLWludGVydmlldy0xNDY0NC0yMDI2MDUwMy03MTIzYzUwZWY3ZTU3ZmU0IiwibyI6dHJ1ZSwiZCI6IjJhZTZjOGMzLTNhYzEtNGJiMC05MjQ0LWNhNDU1OWY1NzhjZiIsImlhdCI6MTc3Nzc5NjMxNH0.08KO86qrbqHGHZgqQgkFMJTJG9bipKmMVXwXLxCVgco' } };
const res = {
  status: (code) => ({
    json: (data) => console.log('Response:', code, data)
  }),
  json: (data) => console.log('Response: 200', data)
};

async function run() {
  await completeCurrentInterview(req, res);
}
run();
