const pool = require('../src/infrastructure/database/postgres');

async function migrateAITests() {
  try {
    console.log('Starting AI Tests Migration...');

    // 1. ai_tests
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_tests (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        job_id INTEGER,
        description TEXT,
        duration INTEGER DEFAULT 60, -- duration in minutes
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        test_type VARCHAR(50) DEFAULT 'normal', -- normal, video_ai, avatar_live2d
        creator_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Add creator_id column if table already exists
    await pool.query(`ALTER TABLE ai_tests ADD COLUMN IF NOT EXISTS creator_id INTEGER`).catch(() => {});
    console.log('Created ai_tests table');

    // 2. ai_questions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_questions (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'mcq', -- mcq, essay, video
        difficulty VARCHAR(50) DEFAULT 'medium',
        correct_answer TEXT,
        expected_answer TEXT,
        keywords TEXT, -- comma separated or JSON string
        video_url TEXT,
        options JSONB, -- MCQ options: {"A": "...", "B": "...", "C": "...", "D": "..."}
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Add options column if table already exists
    await pool.query(`ALTER TABLE ai_questions ADD COLUMN IF NOT EXISTS options JSONB`).catch(() => {});
    console.log('Created ai_questions table');

    // 3. ai_test_questions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_test_questions (
        id SERIAL PRIMARY KEY,
        test_id INTEGER REFERENCES ai_tests(id) ON DELETE CASCADE,
        question_id INTEGER REFERENCES ai_questions(id) ON DELETE CASCADE,
        order_index INTEGER DEFAULT 0
      );
    `);
    console.log('Created ai_test_questions table');

    // 4. ai_scoring_configs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_scoring_configs (
        id SERIAL PRIMARY KEY,
        test_id INTEGER REFERENCES ai_tests(id) ON DELETE CASCADE,
        semantic_weight DECIMAL(4,2) DEFAULT 0.50,
        keyword_weight DECIMAL(4,2) DEFAULT 0.20,
        voice_weight DECIMAL(4,2) DEFAULT 0.20,
        manual_weight DECIMAL(4,2) DEFAULT 0.10
      );
    `);
    console.log('Created ai_scoring_configs table');

    // 5. ai_submissions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_submissions (
        id SERIAL PRIMARY KEY,
        test_id INTEGER REFERENCES ai_tests(id) ON DELETE CASCADE,
        candidate_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'in_progress', -- in_progress, completed, graded
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        total_score DECIMAL(5,2) DEFAULT 0.00,
        suspicious_flag BOOLEAN DEFAULT FALSE,
        tab_switch_count INTEGER DEFAULT 0
      );
    `);
    console.log('Created ai_submissions table');

    // 6. ai_answers
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_answers (
        id SERIAL PRIMARY KEY,
        submission_id INTEGER REFERENCES ai_submissions(id) ON DELETE CASCADE,
        question_id INTEGER REFERENCES ai_questions(id) ON DELETE CASCADE,
        text_answer TEXT,
        audio_url TEXT,
        transcript TEXT,
        ai_score DECIMAL(5,2) DEFAULT 0.00,
        voice_score DECIMAL(5,2) DEFAULT 0.00,
        final_score DECIMAL(5,2) DEFAULT 0.00,
        scoring_details JSONB
      );
    `);
    console.log('Created ai_answers table');

    console.log('AI Tests Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrateAITests();
