const pool = require('../../infrastructure/database/postgres');
const { createPublicToken } = require('../../models/talent-insights/talent-insight.model');

async function getUserProfile(userId) {
  const result = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.avatar_url, u.created_at,
            r.code AS role_code
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [userId]
  );

  return result.rows[0] || null;
}

async function getPrimaryCv(userId) {
  const result = await pool.query(
    `SELECT id, title, target_role, html_content, is_primary, current_location,
            current_lat, current_lng, created_at
     FROM user_cvs
     WHERE user_id = $1
     ORDER BY is_primary DESC, created_at DESC, id DESC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
}

async function getCandidateTestSummaries(userId, limit = 10) {
  const result = await pool.query(
    `SELECT s.id, s.test_id, s.total_score, s.status, s.completed_at, s.started_at,
            t.title AS test_title, t.test_type, t.job_id,
            j.job_title, j.company_name,
            (SELECT COUNT(*) FROM ai_test_questions WHERE test_id = s.test_id)::int AS total_questions
     FROM ai_submissions s
     JOIN ai_tests t ON t.id = s.test_id
     LEFT JOIN jobs j ON j.id = t.job_id
     WHERE s.candidate_id = $1
       AND s.status IN ('completed', 'graded')
     ORDER BY s.completed_at DESC NULLS LAST, s.started_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows;
}

async function getCandidateApplications(userId, limit = 10) {
  const result = await pool.query(
    `SELECT aj.id, aj.status, aj.created_at, aj.updated_at, aj.interview_at,
            j.id AS job_id, j.job_title, j.company_name, j.industry, j.job_address
     FROM applied_jobs aj
     JOIN jobs j ON j.id = aj.job_id
     WHERE aj.user_id = $1
     ORDER BY aj.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows;
}

async function getCandidateCertifications(userId) {
  const result = await pool.query(
    `SELECT id, certificate_name, issuer_name, credential_id, issue_date, expiry_date,
            status, verification_code, created_at
     FROM user_certifications
     WHERE user_id = $1
       AND COALESCE(status, 'active') = 'active'
     ORDER BY created_at DESC, id DESC`,
    [userId]
  );

  return result.rows;
}

async function getCandidateWorkHistories(userId) {
  const result = await pool.query(
    `SELECT id, company_name, job_title, employment_type, start_date, end_date,
            currently_working, summary, status, verification_code, created_at
     FROM user_work_histories
     WHERE user_id = $1
       AND COALESCE(status, 'active') = 'active'
     ORDER BY currently_working DESC, start_date DESC NULLS LAST, created_at DESC`,
    [userId]
  );

  return result.rows;
}

async function getOrCreatePassportShare(userId) {
  const existing = await pool.query(
    `SELECT user_id, public_token, is_public, created_at, updated_at
     FROM candidate_passports
     WHERE user_id = $1`,
    [userId]
  );

  if (existing.rows[0]) {
    if (!existing.rows[0].is_public) {
      const updated = await pool.query(
        `UPDATE candidate_passports
         SET is_public = TRUE, updated_at = NOW()
         WHERE user_id = $1
         RETURNING user_id, public_token, is_public, created_at, updated_at`,
        [userId]
      );
      return updated.rows[0];
    }

    return existing.rows[0];
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const inserted = await pool.query(
        `INSERT INTO candidate_passports (user_id, public_token, is_public)
         VALUES ($1, $2, TRUE)
         RETURNING user_id, public_token, is_public, created_at, updated_at`,
        [userId, createPublicToken()]
      );
      return inserted.rows[0];
    } catch (err) {
      if (err.code !== '23505') throw err;
    }
  }

  throw new Error('Không thể tạo link Skill Passport.');
}

async function getPassportShareByToken(token) {
  const result = await pool.query(
    `SELECT user_id, public_token, is_public, created_at, updated_at
     FROM candidate_passports
     WHERE public_token = $1 AND is_public = TRUE`,
    [token]
  );

  return result.rows[0] || null;
}

async function getJobById(jobId) {
  const result = await pool.query(
    `SELECT id, employer_id, job_title, job_description, job_requirements, benefits,
            job_address, company_address, company_name, company_overview,
            salary, job_type, industry, career_level, years_of_experience,
            number_candidate, submission_deadline, status, created_at, updated_at
     FROM jobs
     WHERE id = $1`,
    [jobId]
  );

  return result.rows[0] || null;
}

async function getEmployerTrustByJobId(jobId) {
  const result = await pool.query(
    `WITH selected_job AS (
       SELECT id, employer_id, company_name
       FROM jobs
       WHERE id = $1
       LIMIT 1
     ),
     employer_jobs AS (
       SELECT j.*
       FROM jobs j
       JOIN selected_job sj
         ON (sj.employer_id IS NOT NULL AND j.employer_id = sj.employer_id)
         OR (sj.employer_id IS NULL AND LOWER(TRIM(j.company_name)) = LOWER(TRIM(sj.company_name)))
     ),
     application_stats AS (
       SELECT
         COUNT(aj.id)::int AS total_applications,
         COUNT(*) FILTER (WHERE COALESCE(aj.status, 'pending') <> 'pending')::int AS responded_applications,
         COUNT(*) FILTER (WHERE COALESCE(aj.status, '') IN ('hired', 'accepted'))::int AS hired_applications,
         COUNT(*) FILTER (WHERE aj.interview_at IS NOT NULL)::int AS scheduled_interviews,
         AVG(EXTRACT(EPOCH FROM (COALESCE(aj.updated_at, aj.created_at) - aj.created_at)) / 3600)
           FILTER (WHERE COALESCE(aj.status, 'pending') <> 'pending') AS avg_response_hours
       FROM applied_jobs aj
       JOIN employer_jobs ej ON ej.id = aj.job_id
     ),
     evaluation_stats AS (
       SELECT COUNT(ie.id)::int AS interview_feedback_count
       FROM interview_evaluations ie
       JOIN employer_jobs ej ON ej.id = ie.job_id
     )
     SELECT
       sj.id AS job_id,
       sj.employer_id,
       COALESCE(u.company_name, sj.company_name) AS company_name,
       u.company_email,
       u.company_website,
       u.company_description,
       u.company_cover_url,
       u.company_industry,
       COUNT(ej.id)::int AS total_jobs,
       COUNT(*) FILTER (WHERE COALESCE(ej.status, 'approved') = 'approved')::int AS approved_jobs,
       COALESCE(MAX(ast.total_applications), 0)::int AS total_applications,
       COALESCE(MAX(ast.responded_applications), 0)::int AS responded_applications,
       COALESCE(MAX(ast.hired_applications), 0)::int AS hired_applications,
       COALESCE(MAX(ast.scheduled_interviews), 0)::int AS scheduled_interviews,
       COALESCE(MAX(ast.avg_response_hours), NULL) AS avg_response_hours,
       COALESCE(MAX(est.interview_feedback_count), 0)::int AS interview_feedback_count
     FROM selected_job sj
     LEFT JOIN users u ON u.id = sj.employer_id
     LEFT JOIN employer_jobs ej ON TRUE
     LEFT JOIN application_stats ast ON TRUE
     LEFT JOIN evaluation_stats est ON TRUE
     GROUP BY sj.id, sj.employer_id, sj.company_name, u.company_name, u.company_email,
              u.company_website, u.company_description, u.company_cover_url, u.company_industry`,
    [jobId]
  );

  return result.rows[0] || null;
}

async function getEmployerInterviewApplications(employerId) {
  const result = await pool.query(
    `SELECT aj.id AS application_id, aj.status, aj.created_at, aj.updated_at, aj.interview_at,
            aj.note,
            u.id AS candidate_id, u.full_name, u.email, u.avatar_url,
            j.id AS job_id, j.job_title, j.company_name,
            ie.id AS evaluation_id, ie.ratings, ie.strengths, ie.concerns,
            ie.recommendation, ie.feedback_to_candidate, ie.updated_at AS evaluated_at
     FROM applied_jobs aj
     JOIN jobs j ON j.id = aj.job_id
     JOIN users u ON u.id = aj.user_id
     LEFT JOIN interview_evaluations ie ON ie.application_id = aj.id
     WHERE j.employer_id = $1
       AND (
         aj.interview_at IS NOT NULL
         OR COALESCE(aj.status, '') IN ('approved', 'interview', 'interviewed', 'hired', 'accepted')
       )
     ORDER BY aj.interview_at DESC NULLS LAST, aj.updated_at DESC NULLS LAST, aj.created_at DESC
     LIMIT 100`,
    [employerId]
  );

  return result.rows;
}

async function getApplicationForEmployer(applicationId, employerId) {
  const result = await pool.query(
    `SELECT aj.id AS application_id, aj.user_id AS candidate_id, aj.job_id,
            j.employer_id, j.job_title, j.company_name
     FROM applied_jobs aj
     JOIN jobs j ON j.id = aj.job_id
     WHERE aj.id = $1 AND j.employer_id = $2`,
    [applicationId, employerId]
  );

  return result.rows[0] || null;
}

async function upsertInterviewEvaluation(application, employerId, payload) {
  const result = await pool.query(
    `INSERT INTO interview_evaluations (
       application_id, employer_id, candidate_id, job_id, ratings,
       strengths, concerns, recommendation, feedback_to_candidate, updated_at
     )
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, NOW())
     ON CONFLICT (application_id)
     DO UPDATE SET
       ratings = EXCLUDED.ratings,
       strengths = EXCLUDED.strengths,
       concerns = EXCLUDED.concerns,
       recommendation = EXCLUDED.recommendation,
       feedback_to_candidate = EXCLUDED.feedback_to_candidate,
       updated_at = NOW()
     RETURNING id, application_id, employer_id, candidate_id, job_id, ratings,
               strengths, concerns, recommendation, feedback_to_candidate,
               created_at, updated_at`,
    [
      application.application_id,
      employerId,
      application.candidate_id,
      application.job_id,
      JSON.stringify(payload.ratings || {}),
      payload.strengths || null,
      payload.concerns || null,
      payload.recommendation || 'consider',
      payload.feedback_to_candidate || null,
    ]
  );

  return result.rows[0];
}

async function insertWorkSimulationSubmission({ userId, jobId, scenario, answer, score, feedback }) {
  const result = await pool.query(
    `INSERT INTO work_simulation_submissions (user_id, job_id, scenario, answer, score, feedback)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6::jsonb)
     RETURNING id, user_id, job_id, scenario, answer, score, feedback, created_at`,
    [userId, jobId, JSON.stringify(scenario || {}), answer, score, JSON.stringify(feedback || {})]
  );

  return result.rows[0];
}

async function getLatestWorkSimulationSubmission(userId, jobId) {
  const result = await pool.query(
    `SELECT id, user_id, job_id, scenario, answer, score, feedback, created_at
     FROM work_simulation_submissions
     WHERE user_id = $1 AND job_id = $2
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [userId, jobId]
  );

  return result.rows[0] || null;
}

module.exports = {
  getApplicationForEmployer,
  getCandidateApplications,
  getCandidateCertifications,
  getCandidateTestSummaries,
  getCandidateWorkHistories,
  getEmployerInterviewApplications,
  getEmployerTrustByJobId,
  getJobById,
  getLatestWorkSimulationSubmission,
  getOrCreatePassportShare,
  getPassportShareByToken,
  getPrimaryCv,
  getUserProfile,
  insertWorkSimulationSubmission,
  upsertInterviewEvaluation,
};
