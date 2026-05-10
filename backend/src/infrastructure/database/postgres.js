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

const connectionString = getDatabaseUrl();

const pool = new Pool({
  connectionString,
  ssl: connectionString?.includes('neon.tech') && !hasSslMode(connectionString)
    ? { rejectUnauthorized: false }
    : undefined,
});

module.exports = pool;
