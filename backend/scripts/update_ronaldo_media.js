const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function updateQuestion() {
  try {
    const result = await pool.query(`
      SELECT q.id FROM ai_questions q
      JOIN ai_test_questions tq ON q.id = tq.question_id
      WHERE tq.test_id = $1
      ORDER BY tq.order_index ASC
      LIMIT 1
    `, [2]);

    if (result.rows.length > 0) {
      const questionId = result.rows[0].id;
      console.log('Found first question with ID:', questionId);

      await pool.query('UPDATE ai_questions SET video_url = $1 WHERE id = $2', ['/ronaldo_q1.png', questionId]);
      console.log('Updated video_url successfully!');
    } else {
      console.log('No questions found for Test ID 2');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    pool.end();
  }
}

updateQuestion();
