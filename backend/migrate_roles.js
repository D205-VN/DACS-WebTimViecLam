const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  try {
    await pool.query('BEGIN');
    
    console.log('1. Creating roles table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        code VARCHAR(20) NOT NULL UNIQUE
      );
    `);

    console.log('2. Inserting roles...');
    await pool.query(`
      INSERT INTO roles (id, name, code)
      VALUES 
        (1, 'Admin', 'admin'),
        (2, 'Nhà tuyển dụng', 'employer'),
        (3, 'Người tìm việc', 'seeker')
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code;
    `);

    console.log('3. Adding role_id to users...');
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id);
    `);

    console.log('4. Migrating data...');
    // We check if 'role' column exists before trying to migrate data
    const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='users' AND column_name='role';
    `);

    if (res.rows.length > 0) {
      await pool.query(`
        UPDATE users 
        SET role_id = roles.id 
        FROM roles 
        WHERE users.role = roles.code AND users.role_id IS NULL;
      `);
      
      console.log('5. Setting default role_id for any nulls...');
      await pool.query(`
        UPDATE users SET role_id = 3 WHERE role_id IS NULL;
      `);

      console.log('6. Dropping old role column...');
      await pool.query(`
        ALTER TABLE users DROP COLUMN IF EXISTS role;
      `);
    } else {
      console.log('Old role column already dropped.');
    }

    await pool.query('COMMIT');
    console.log('Migration successful!');
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    pool.end();
  }
}

migrate();
