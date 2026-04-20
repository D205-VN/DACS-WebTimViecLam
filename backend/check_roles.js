const pool = require('./src/config/db');

async function checkRoles() {
  try {
    const res = await pool.query('SELECT * FROM roles');
    console.log('Roles:', res.rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkRoles();
