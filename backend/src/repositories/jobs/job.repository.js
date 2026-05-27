const pool = require('../infrastructure/database/postgres');

async function query(sql, params = [], client = pool) {
  return client.query(sql, params);
}

async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function countJobs(whereClause, params) {
  const result = await query(
    `SELECT COUNT(*)::int AS count
     FROM jobs
     WHERE COALESCE(NULLIF(TRIM(status), ''), 'approved') = 'approved'${whereClause}`,
    params
  );

  return result.rows[0]?.count || 0;
}

async function findJobs({ selectClause, params, orderBy, limit, offset, paramIndex }) {
  const pagedParams = [...params, limit, offset];
  const result = await query(
    `${selectClause} ${orderBy} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    pagedParams
  );

  return result.rows;
}

async function findAllJobsForDistance({ selectClause, params, orderBy }) {
  const result = await query(`${selectClause} ${orderBy}`, params);
  return result.rows;
}

async function getFilterLevels() {
  const result = await query(
    `SELECT career_level AS value, COUNT(*)::int AS count
     FROM jobs
     WHERE COALESCE(NULLIF(TRIM(status), ''), 'approved') = 'approved'
       AND career_level IS NOT NULL AND TRIM(career_level) <> ''
     GROUP BY career_level
     ORDER BY count DESC, value ASC`
  );

  return result.rows;
}

async function getFilterIndustries() {
  const result = await query(
    `SELECT industry AS value, COUNT(*)::int AS count
     FROM jobs
     WHERE COALESCE(NULLIF(TRIM(status), ''), 'approved') = 'approved'
       AND industry IS NOT NULL AND TRIM(industry) <> ''
     GROUP BY industry
     ORDER BY count DESC, value ASC
     LIMIT 20`
  );

  return result.rows;
}

async function findCompanies(whereClause, params) {
  const result = await query(
    `SELECT
        company_name,
        MAX(NULLIF(TRIM(company_overview), '')) AS company_overview,
        MAX(NULLIF(TRIM(company_size), '')) AS company_size,
        MAX(NULLIF(TRIM(company_address), '')) AS company_address,
        COUNT(*)::int AS job_count
     FROM jobs
     ${whereClause}
     GROUP BY company_name
     ORDER BY job_count DESC, company_name ASC`,
    params
  );

  return result.rows;
}

async function findSavedJobs(userId) {
  const result = await query(
    `SELECT j.id, j.job_title AS title, j.company_name, j.job_address AS location, j.salary, j.job_type,
            sj.created_at AS saved_at
     FROM saved_jobs sj
     JOIN jobs j ON j.id = sj.job_id
     WHERE sj.user_id = $1
     ORDER BY sj.created_at DESC`,
    [userId]
  );

  return result.rows;
}

async function findAppliedJobs(userId) {
  const result = await query(
    `SELECT j.id, j.job_title AS title, j.company_name, j.job_address AS location, j.salary,
            j.company_address,
            aj.id AS application_id,
            CASE
              WHEN COALESCE(NULLIF(TRIM(aj.status), ''), 'pending') = 'hired'
               AND aj.interview_at IS NULL THEN 'approved'
              ELSE COALESCE(NULLIF(TRIM(aj.status), ''), 'pending')
            END AS status,
            aj.created_at AS applied_at,
            aj.updated_at,
            aj.interview_at,
            aj.interview_mode,
            aj.interview_link,
            aj.candidate_interview_mode,
            aj.cv_id,
            aj.cover_letter,
            ait.id AS ai_test_id,
            ait.title AS ai_test_title,
            ait.description AS ai_test_description,
            ait.duration AS ai_test_duration,
            ait.test_type AS ai_test_type,
            ait.created_at AS ai_test_created_at,
            ais.id AS ai_submission_id,
            ais.status AS ai_submission_status,
            ais.total_score AS ai_submission_total_score,
            ais.started_at AS ai_submission_started_at,
            ais.completed_at AS ai_submission_completed_at
     FROM applied_jobs aj
     JOIN jobs j ON j.id = aj.job_id
     LEFT JOIN LATERAL (
       SELECT id, title, description, duration, test_type, created_at
       FROM ai_tests
       WHERE job_id = j.id
       ORDER BY created_at DESC, id DESC
       LIMIT 1
     ) ait ON TRUE
     LEFT JOIN LATERAL (
       SELECT id, status, total_score, started_at, completed_at
       FROM ai_submissions
       WHERE test_id = ait.id AND candidate_id = aj.user_id
       ORDER BY completed_at DESC NULLS LAST, started_at DESC NULLS LAST, id DESC
       LIMIT 1
     ) ais ON TRUE
     WHERE aj.user_id = $1
     ORDER BY aj.created_at DESC`,
    [userId]
  );

  return result.rows;
}

async function findSavedJobIds(userId) {
  const result = await query('SELECT job_id FROM saved_jobs WHERE user_id = $1', [userId]);
  return result.rows.map((row) => row.job_id);
}

async function findApprovedJobById(jobId) {
  const result = await query(
    `SELECT id, url_job, job_title AS title, job_description AS description, job_requirements AS requirements,
            benefits, job_address AS location, job_type, years_of_experience AS experience,
            salary, submission_deadline AS deadline, company_name, company_overview, company_size,
            company_address, industry, career_level, number_candidate, created_at
     FROM jobs
     WHERE id = $1
       AND COALESCE(NULLIF(TRIM(status), ''), 'approved') = 'approved'`,
    [jobId]
  );

  return result.rows[0] || null;
}

async function findLinkedAiTest(jobId) {
  const result = await query(
    `SELECT id, title, duration, test_type
     FROM ai_tests
     WHERE job_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [jobId]
  );

  return result.rows[0] || null;
}

async function insertJobView({ jobId, viewerKey, source }) {
  await query(
    `INSERT INTO job_views (job_id, viewer_key, source)
     VALUES ($1, $2, $3)`,
    [jobId, viewerKey, source]
  );
}

async function findSavedJob(userId, jobId) {
  const result = await query(
    'SELECT id FROM saved_jobs WHERE user_id = $1 AND job_id = $2',
    [userId, jobId]
  );

  return result.rows[0] || null;
}

async function deleteSavedJob(userId, jobId) {
  await query('DELETE FROM saved_jobs WHERE user_id = $1 AND job_id = $2', [userId, jobId]);
}

async function insertSavedJob(userId, jobId) {
  await query('INSERT INTO saved_jobs (user_id, job_id) VALUES ($1, $2)', [userId, jobId]);
}

async function findApprovedJobForApplication(jobId) {
  const result = await query(
    `SELECT id, employer_id, job_title, company_name
     FROM jobs
     WHERE id = $1
       AND COALESCE(NULLIF(TRIM(status), ''), 'approved') = 'approved'`,
    [jobId]
  );

  return result.rows[0] || null;
}

async function findExistingApplication(userId, jobId) {
  const result = await query(
    'SELECT id FROM applied_jobs WHERE user_id = $1 AND job_id = $2',
    [userId, jobId]
  );

  return result.rows[0] || null;
}

async function findUserCvById(userId, cvId) {
  const result = await query(
    `SELECT id
     FROM user_cvs
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [cvId, userId]
  );

  return result.rows[0] || null;
}

async function findPrimaryCv(userId) {
  const result = await query(
    `SELECT id
     FROM user_cvs
     WHERE user_id = $1
       AND is_primary = TRUE
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
}

async function findLatestCv(userId) {
  const result = await query(
    `SELECT id
     FROM user_cvs
     WHERE user_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
}

async function markCvPrimary(userId, cvId) {
  await query(
    `UPDATE user_cvs
     SET is_primary = TRUE
     WHERE id = $1 AND user_id = $2`,
    [cvId, userId]
  );
}

async function insertApplication({ userId, jobId, cvId, applicationSource, coverLetter }) {
  const result = await query(
    `INSERT INTO applied_jobs (user_id, job_id, cv_id, application_source, cover_letter)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, jobId, cvId, applicationSource, coverLetter || null]
  );

  return result.rows[0] || null;
}

async function findApplicationInterviewPreference(userId, applicationId) {
  const result = await query(
    `SELECT id,
            COALESCE(NULLIF(TRIM(status), ''), 'pending') AS status,
            interview_mode
     FROM applied_jobs
     WHERE id = $1 AND user_id = $2`,
    [applicationId, userId]
  );

  return result.rows[0] || null;
}

async function updateCandidateInterviewMode(userId, applicationId, interviewMode) {
  const result = await query(
    `UPDATE applied_jobs
     SET candidate_interview_mode = $1,
         updated_at = NOW()
     WHERE id = $2 AND user_id = $3
     RETURNING id, candidate_interview_mode, updated_at`,
    [interviewMode, applicationId, userId]
  );

  return result.rows[0] || null;
}

async function findOnboardingApplication(userId, applicationId) {
  const result = await query(
    `SELECT aj.id, aj.job_id,
            COALESCE(NULLIF(TRIM(aj.status), ''), 'pending') AS status,
            j.employer_id, j.job_title, j.company_name
     FROM applied_jobs aj
     JOIN jobs j ON j.id = aj.job_id
     WHERE aj.id = $1 AND aj.user_id = $2
     LIMIT 1`,
    [applicationId, userId]
  );

  return result.rows[0] || null;
}

async function upsertOnboardingSubmission(client, { applicationId, userId, employerId, jobId }) {
  const result = await query(
    `INSERT INTO onboarding_submissions (application_id, user_id, employer_id, job_id, status, submitted_at, updated_at)
     VALUES ($1, $2, $3, $4, 'submitted', NOW(), NOW())
     ON CONFLICT (application_id)
     DO UPDATE SET status = 'submitted', submitted_at = NOW(), updated_at = NOW()
     RETURNING id`,
    [applicationId, userId, employerId, jobId],
    client
  );

  return result.rows[0] || null;
}

async function deleteOnboardingDocuments(client, submissionId) {
  await query('DELETE FROM onboarding_documents WHERE submission_id = $1', [submissionId], client);
}

async function insertOnboardingDocument(client, payload) {
  await query(
    `INSERT INTO onboarding_documents (
       submission_id, doc_type, doc_name, file_name, file_url, mime_type, file_size, ai_result, status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'pending')`,
    [
      payload.submissionId,
      payload.docType,
      payload.docName,
      payload.fileName,
      payload.fileUrl,
      payload.mimeType,
      payload.fileSize,
      JSON.stringify(payload.aiResult || {}),
    ],
    client
  );
}

async function markApplicationOnboarding(client, userId, applicationId) {
  await query(
    `UPDATE applied_jobs
     SET status = 'onboarding', updated_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [applicationId, userId],
    client
  );
}

async function findJobAlertIds(userId) {
  const result = await query(
    'SELECT job_id FROM job_alerts WHERE user_id = $1 AND job_id IS NOT NULL',
    [userId]
  );

  return result.rows.map((row) => row.job_id);
}

async function findJobAlert(userId, jobId) {
  const result = await query(
    'SELECT id FROM job_alerts WHERE user_id = $1 AND job_id = $2',
    [userId, jobId]
  );

  return result.rows[0] || null;
}

async function deleteJobAlert(userId, jobId) {
  await query('DELETE FROM job_alerts WHERE user_id = $1 AND job_id = $2', [userId, jobId]);
}

async function insertJobAlert(userId, jobId) {
  await query(
    `INSERT INTO job_alerts (user_id, job_id, frequency, is_active, updated_at)
     VALUES ($1, $2, 'weekly', TRUE, NOW())`,
    [userId, jobId]
  );
}

module.exports = {
  countJobs,
  deleteJobAlert,
  deleteOnboardingDocuments,
  deleteSavedJob,
  findAllJobsForDistance,
  findAppliedJobs,
  findApplicationInterviewPreference,
  findApprovedJobById,
  findApprovedJobForApplication,
  findCompanies,
  findExistingApplication,
  findJobAlert,
  findJobAlertIds,
  findJobs,
  findLatestCv,
  findLinkedAiTest,
  findOnboardingApplication,
  findPrimaryCv,
  findSavedJob,
  findSavedJobIds,
  findSavedJobs,
  findUserCvById,
  getFilterIndustries,
  getFilterLevels,
  insertApplication,
  insertJobAlert,
  insertJobView,
  insertOnboardingDocument,
  insertSavedJob,
  markApplicationOnboarding,
  markCvPrimary,
  updateCandidateInterviewMode,
  upsertOnboardingSubmission,
  withTransaction,
};
