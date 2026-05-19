const { Pool, types } = require('pg');
require('dotenv').config();

// Treat PostgreSQL TIMESTAMP (without time zone) values as UTC.
// This avoids client-side misinterpretation when the DB stores UTC timestamps
// in timestamp columns and the browser parses them as local time.
types.setTypeParser(1114, (stringValue) => {
  if (!stringValue) return null;
  const normalized = String(stringValue).trim().replace(' ', 'T');
  return new Date(`${normalized}Z`);
});

function getDatabaseUrl() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return connectionString;

  try {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get('sslmode');

    if (['prefer', 'require', 'verify-ca'].includes(sslMode)) {
      url.searchParams.set('sslmode', 'verify-full');
      return url.toString();
    }
  } catch {
    return connectionString;
  }

  return connectionString;
}

function hasSslMode(connectionString) {
  if (!connectionString) return false;

  try {
    return new URL(connectionString).searchParams.has('sslmode');
  } catch {
    return false;
  }
}

function readPositiveIntegerEnv(name, fallback) {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const connectionString = getDatabaseUrl();

const pool = new Pool({
  connectionString,
  max: readPositiveIntegerEnv('PG_POOL_MAX', 10),
  idleTimeoutMillis: readPositiveIntegerEnv('PG_IDLE_TIMEOUT_MS', 30_000),
  connectionTimeoutMillis: readPositiveIntegerEnv('PG_CONNECTION_TIMEOUT_MS', 10_000),
  maxLifetimeSeconds: readPositiveIntegerEnv('PG_MAX_LIFETIME_SECONDS', 60 * 30),
  ssl: connectionString?.includes('neon.tech') && !hasSslMode(connectionString)
    ? { rejectUnauthorized: false }
    : undefined,
});

module.exports = pool;
