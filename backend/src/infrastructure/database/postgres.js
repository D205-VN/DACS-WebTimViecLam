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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : undefined,
});

module.exports = pool;
