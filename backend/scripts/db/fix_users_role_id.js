const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fix() {
  try {
    console.log('Fixing role_id nulls...');
    await pool.query(`
      UPDATE users 
      SET role_id = (SELECT id FROM roles WHERE roles.code = users.role) 
      WHERE role_id IS NULL AND role IS NOT NULL;
    `);

    // Any remaining nulls get 3 (seeker)
    await pool.query(`UPDATE users SET role_id = 3 WHERE role_id IS NULL;`);

    console.log('Dropping role column for good...');
    await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS role;`);

    // Let's also check if admin user is there and ensure it has password
    const res = await pool.query("SELECT * FROM users WHERE email = 'admin@gmail.com'");
    if (res.rows.length > 0) {
      console.log('Admin user found, role_id is:', res.rows[0].role_id);
    }
    console.log('Done.');
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
fix();
