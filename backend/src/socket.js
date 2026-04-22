const { Server } = require('socket.io');

let io;
const userSockets = new Map(); // userId -> Set of socket IDs

function init(httpServer, allowedOrigins) {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join', (userId) => {
      if (userId) {
        const userIdStr = String(userId);
        console.log(`User ${userIdStr} joined room`);
        socket.join(`user_${userIdStr}`);
        
        if (!userSockets.has(userIdStr)) {
          userSockets.set(userIdStr, new Set());
        }
        userSockets.get(userIdStr).add(socket.id);
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      // Remove socket from userSockets map
      for (const [userId, sockets] of userSockets.entries()) {
        if (sockets.has(socket.id)) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            userSockets.delete(userId);
          }
          break;
        }
      }
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
}

function emitToUser(userId, event, data) {
  if (io && userId) {
    const userIdStr = String(userId);
    console.log(`Emitting ${event} to user_${userIdStr}`);
    io.to(`user_${userIdStr}`).emit(event, data);
  }
}

module.exports = {
  init,
  getIO,
  emitToUser
};
