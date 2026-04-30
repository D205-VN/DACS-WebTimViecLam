const pool = require('./src/infrastructure/database/postgres');

async function checkUsers() {
  try {
    const res = await pool.query('SELECT id, email, full_name, is_verified, role_id FROM users');
    console.log('Users in database:');
    console.table(res.rows);
  } catch (err) {
    console.error('Error querying database:', err);
  } finally {
    await pool.end();
  }
}

checkUsers();
