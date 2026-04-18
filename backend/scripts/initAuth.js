const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../src/config/db');

async function initAuthTables() {
  const client = await pool.connect();
  try {
    console.log('🔄 Creating auth tables...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        password_hash VARCHAR(255),
        role VARCHAR(20) DEFAULT 'seeker',
        is_verified BOOLEAN DEFAULT FALSE,
        google_id VARCHAR(255),
        avatar_url TEXT,
        company_name VARCHAR(255),
        company_email VARCHAR(255),
        company_city VARCHAR(255),
        company_ward VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Table "users" created.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS email_otps (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        otp VARCHAR(6) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Table "email_otps" created.');

    console.log('🎉 Auth tables initialized successfully!');
  } catch (err) {
    console.error('❌ Error creating auth tables:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

initAuthTables();
