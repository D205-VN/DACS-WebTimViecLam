require('dotenv').config();
const http = require('http');
const { createApp } = require('./app');
const socketManager = require('./core/realtime/socket');

const { app, allowedOrigins } = createApp();
const server = http.createServer(app);
const PORT = process.env.PORT || 5001;

// Initialize Socket.io
socketManager.init(server, allowedOrigins);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
