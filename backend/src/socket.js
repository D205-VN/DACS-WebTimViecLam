const { Server } = require('socket.io');

let io;
const userSockets = new Map(); // userId -> Set of socket IDs

function init(httpServer, frontendUrl) {
  io = new Server(httpServer, {
    cors: {
      origin: frontendUrl,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join', (userId) => {
      if (userId) {
        console.log(`User ${userId} joined room`);
        socket.join(`user_${userId}`);
        
        if (!userSockets.has(userId)) {
          userSockets.set(userId, new Set());
        }
        userSockets.get(userId).add(socket.id);
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
  if (io) {
    console.log(`Emitting ${event} to user_${userId}`);
    io.to(`user_${userId}`).emit(event, data);
  }
}

module.exports = {
  init,
  getIO,
  emitToUser
};
