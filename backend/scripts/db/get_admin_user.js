const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("SELECT * FROM users WHERE email = 'admin@gmail.com'").then(res => { console.log(res.rows); process.exit(0); }).catch(console.error);
