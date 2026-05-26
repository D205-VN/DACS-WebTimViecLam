require('dotenv').config({ quiet: true });

const pool = require('../src/infrastructure/database/postgres');
const { createApp } = require('../src/app');
const { validateEnvironment } = require('../src/core/config/env');

const REQUIRED_TABLES = [
  'users',
  'roles',
  'jobs',
  'ai_tests',
  'ai_questions',
  'ai_test_questions',
  'ai_submissions',
  'ai_answers',
];

const PUBLIC_ENDPOINTS = [
  '/api',
  '/api/jobs?limit=1',
  '/api/jobs/filters',
  '/api/jobs/companies',
];

function fail(message) {
  throw new Error(message);
}

async function assertEnvironment() {
  const { errors, warnings } = validateEnvironment();

  warnings.forEach((warning) => {
    console.warn(`[env warning] ${warning}`);
  });

  if (errors.length) {
    fail(`Environment is invalid:\n${errors.map((error) => `- ${error}`).join('\n')}`);
  }
}

async function assertDatabase() {
  const health = await pool.query('SELECT 1 AS ok');
  if (health.rows[0]?.ok !== 1) fail('Database health check failed.');

  const tables = await pool.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])`,
    [REQUIRED_TABLES]
  );

  const existing = new Set(tables.rows.map((row) => row.table_name));
  const missing = REQUIRED_TABLES.filter((table) => !existing.has(table));
  if (missing.length) fail(`Missing required database tables: ${missing.join(', ')}`);
}

async function assertPublicEndpoints() {
  const { app } = createApp();
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.on('error', reject);
  });

  try {
    const { port } = server.address();

    for (const endpoint of PUBLIC_ENDPOINTS) {
      const response = await fetch(`http://127.0.0.1:${port}${endpoint}`);
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        fail(`${endpoint} returned ${response.status}: ${body.slice(0, 200)}`);
      }
    }
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function main() {
  try {
    await assertEnvironment();
    await assertDatabase();
    await assertPublicEndpoints();
    console.log('Smoke test passed.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
