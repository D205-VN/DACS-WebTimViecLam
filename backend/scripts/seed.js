require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

// Thay đổi nguồn file CSV sang thư mục data nội bộ của dự án
const CSV_FILE_PATH = path.join(__dirname, '../data/JOB_DATA_FINAL.csv');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seedDatabase() {
  const client = await pool.connect();

  try {
    console.log('Đang kết nối đến CSDL Neon...');

    // Tạo cấu trúc bảng mới phù hợp với Dataset mới
    await client.query(`DROP TABLE IF EXISTS jobs;`);
    await client.query(`
      CREATE TABLE jobs (
        id SERIAL PRIMARY KEY,
        url_job TEXT,
        job_title TEXT,
        company_name TEXT,
        company_overview TEXT,
        company_size VARCHAR(255),
        company_address TEXT,
        job_description TEXT,
        job_requirements TEXT,
        benefits TEXT,
        job_address TEXT,
        job_type VARCHAR(255),
        gender VARCHAR(255),
        number_candidate INTEGER,
        career_level VARCHAR(255),
        years_of_experience VARCHAR(255),
        salary VARCHAR(255),
        submission_deadline VARCHAR(255),
        industry TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Đã tạo bảng (hoặc đã tồn tại). Đang xóa dữ liệu cũ nếu có...');
    await client.query('TRUNCATE TABLE jobs RESTART IDENTITY;');

    console.log('Đang đọc file CSV và chuẩn bị nhúng toàn bộ dữ liệu...');

    const results = [];

    await new Promise((resolve, reject) => {
      fs.createReadStream(CSV_FILE_PATH)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });

    console.log(`Đã đọc ${results.length} bản ghi. Đang insert theo batch...`);

    const BATCH_SIZE = 100;

    for (let i = 0; i < results.length; i += BATCH_SIZE) {
      const batch = results.slice(i, i + BATCH_SIZE);

      const valueStrings = [];
      const queryValues = [];
      let paramIndex = 1;

      for (const row of batch) {
        valueStrings.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11}, $${paramIndex + 12}, $${paramIndex + 13}, $${paramIndex + 14}, $${paramIndex + 15}, $${paramIndex + 16}, $${paramIndex + 17})`);

        queryValues.push(
          row['URL Job'] || null,
          row['Job Title'] || null,
          row['Name Company'] || null,
          row['Company Overview'] || null,
          row['Company Size'] || null,
          row['Company Address'] || null,
          row['Job Description'] || null,
          row['Job Requirements'] || null,
          row['Benefits'] || null,
          row['Job Address'] || null,
          row['Job Type'] || null,
          row['Gender'] || null,
          parseInt(row['Number Cadidate']) || 0,
          row['Career Level'] || null,
          row['Years of Experience'] || null,
          row['Salary'] || null,
          row['Submission Deadline'] || null,
          row['Industry'] || null
        );
        paramIndex += 18;
      }

      const insertQuery = `
        INSERT INTO jobs (
          url_job, job_title, company_name, company_overview, company_size, company_address, 
          job_description, job_requirements, benefits, job_address, job_type, gender, 
          number_candidate, career_level, years_of_experience, salary, submission_deadline, industry
        )
        VALUES ${valueStrings.join(', ')}
      `;

      await client.query(insertQuery, queryValues);

      if ((i + batch.length) % 1000 === 0 || i + batch.length === results.length) {
        console.log(`Đã insert ${i + batch.length} bản ghi...`);
      }
    }

    console.log('✅ Hoàn tất Seed toàn bộ dữ liệu!');
  } catch (err) {
    console.error('❌ Lỗi Seeding:', err);
  } finally {
    client.release();
    pool.end();
  }
}

seedDatabase();
