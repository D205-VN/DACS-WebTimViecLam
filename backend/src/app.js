const express = require('express');
const cors = require('cors');
const modules = require('./modules');

function getAllowedOrigins() {
  return [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    process.env.FRONTEND_URL,
  ].filter(Boolean);
}

function createApp() {
  const app = express();
  const allowedOrigins = getAllowedOrigins();

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  app.use(express.json({ limit: '5mb' }));

  modules.forEach(({ path, router }) => {
    app.use(path, router);
  });

  app.get('/api', (req, res) => {
    res.json({ message: 'Chào mừng đến với WebTimViec API' });
  });

  return { app, allowedOrigins };
}

module.exports = {
  createApp,
  getAllowedOrigins,
};
