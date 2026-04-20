const pool = require('./src/config/db');

async function checkJobs() {
  try {
    const res = await pool.query('SELECT id, employer_id, job_title FROM jobs LIMIT 10');
    console.log('Recent jobs in DB:', res.rows);
    
    const users = await pool.query('SELECT id, full_name, role_code FROM users WHERE role_code = \'employer\' LIMIT 5');
    console.log('Employers in DB:', users.rows);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkJobs();
