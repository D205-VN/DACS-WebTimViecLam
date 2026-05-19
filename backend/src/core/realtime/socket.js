const { Server } = require('socket.io');

let io;
const userSockets = new Map(); // userId -> Set of socket IDs
const isDev = process.env.NODE_ENV !== 'production';

function init(httpServer, allowedOrigins) {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    if (isDev) console.log('A user connected:', socket.id);

    socket.on('join', (userId) => {
      if (userId) {
        const userIdStr = String(userId);
        if (isDev) console.log(`User ${userIdStr} joined room`);
        socket.join(`user_${userIdStr}`);
        
        if (!userSockets.has(userIdStr)) {
          userSockets.set(userIdStr, new Set());
        }
        userSockets.get(userIdStr).add(socket.id);
      }
    });

    // ── WebRTC Signaling for Interview Rooms ──────────────────────
    socket.on('webrtc:join-room', (roomId) => {
      const room = `interview_${roomId}`;
      socket.join(room);
      // Notify others in the room that someone joined
      socket.to(room).emit('webrtc:peer-joined', { peerId: socket.id });
      // Tell the joiner about existing peers
      const clients = io.sockets.adapter.rooms.get(room);
      if (clients) {
        const peers = [...clients].filter((id) => id !== socket.id);
        socket.emit('webrtc:existing-peers', { peers });
      }
    });

    socket.on('webrtc:offer', ({ to, offer }) => {
      io.to(to).emit('webrtc:offer', { from: socket.id, offer });
    });

    socket.on('webrtc:answer', ({ to, answer }) => {
      io.to(to).emit('webrtc:answer', { from: socket.id, answer });
    });

    socket.on('webrtc:ice-candidate', ({ to, candidate }) => {
      io.to(to).emit('webrtc:ice-candidate', { from: socket.id, candidate });
    });

    socket.on('webrtc:leave-room', (roomId) => {
      const room = `interview_${roomId}`;
      socket.to(room).emit('webrtc:peer-left', { peerId: socket.id });
      socket.leave(room);
    });

    socket.on('webrtc:interview-completed', (roomId) => {
      const room = `interview_${roomId}`;
      socket.to(room).emit('webrtc:interview-completed', { peerId: socket.id });
    });
    // ──────────────────────────────────────────────────────────────

    socket.on('disconnect', () => {
      if (isDev) console.log('User disconnected:', socket.id);
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
      // Notify all interview rooms this socket was in
      for (const [roomName] of socket.rooms) {
        if (roomName.startsWith('interview_')) {
          socket.to(roomName).emit('webrtc:peer-left', { peerId: socket.id });
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
    if (isDev) console.log(`Emitting ${event} to user_${userIdStr}`);
    io.to(`user_${userIdStr}`).emit(event, data);
  }
}

module.exports = {
  init,
  getIO,
  emitToUser
};
