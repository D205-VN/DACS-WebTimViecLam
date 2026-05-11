const express = require('express');
const cors = require('cors');
const modules = require('./modules');

function normalizeOrigin(origin) {
  return String(origin || '').trim().replace(/\/+$/, '');
}

function parseOriginList(value) {
  return String(value || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
}

function getAllowedOrigins() {
  return [...new Set([
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://aptertekwork.pages.dev',
    ...parseOriginList(process.env.FRONTEND_URL),
    ...parseOriginList(process.env.FRONTEND_URLS),
  ])];
}

function isAllowedOrigin(origin, allowedOrigins) {
  const normalizedOrigin = normalizeOrigin(origin);
  if (allowedOrigins.includes(normalizedOrigin)) return true;

  try {
    const { protocol, hostname } = new URL(normalizedOrigin);
    return protocol === 'https:' && (
      hostname === 'aptertekwork.pages.dev' || hostname.endsWith('.aptertekwork.pages.dev')
    );
  } catch {
    return false;
  }
}

function createApp() {
  const app = express();
  const allowedOrigins = getAllowedOrigins();

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (isAllowedOrigin(origin, allowedOrigins) || process.env.NODE_ENV !== 'production') {
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
  isAllowedOrigin,
};
