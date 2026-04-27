const pool = require('../../infrastructure/database/postgres');
const { ensurePublicApplicationSchema } = require('../jobs/job.model');
const { isEmailConfigured, sendInterviewReminderEmail } = require('../auth/email.service');
const { createNotification } = require('./notification.service');

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
const INTERVAL_MS = Number.parseInt(process.env.INTERVIEW_REMINDER_INTERVAL_MS, 10) || DEFAULT_INTERVAL_MS;
const LOOKAHEAD_HOURS = Number.parseInt(process.env.INTERVIEW_REMINDER_LOOKAHEAD_HOURS, 10) || 24;

let schemaReady = false;
let schedulerStarted = false;
let runInProgress = false;
let missingConfigLogged = false;

async function ensureInterviewReminderSchema() {
  if (schemaReady) return;

  await ensurePublicApplicationSchema();

  await pool.query(`
    ALTER TABLE applied_jobs
    ADD COLUMN IF NOT EXISTS interview_reminder_sent_at TIMESTAMP
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_applied_jobs_interview_reminder
    ON applied_jobs(interview_at)
    WHERE interview_reminder_sent_at IS NULL
  `);

  schemaReady = true;
}

async function getDueInterviewApplications() {
  const result = await pool.query(
    `SELECT
        aj.id,
        aj.user_id,
        aj.interview_at,
        aj.interview_mode,
        aj.interview_link,
        aj.candidate_interview_mode,
        u.email,
        u.full_name,
        j.job_title,
        j.company_name,
        j.company_address
     FROM applied_jobs aj
     JOIN users u ON u.id = aj.user_id
     JOIN jobs j ON j.id = aj.job_id
     WHERE COALESCE(NULLIF(TRIM(aj.status), ''), 'pending') = 'interview'
       AND aj.interview_at IS NOT NULL
       AND aj.interview_at > NOW()
       AND aj.interview_at <= NOW() + ($1::int * INTERVAL '1 hour')
       AND aj.interview_reminder_sent_at IS NULL
       AND u.email IS NOT NULL
       AND TRIM(u.email) <> ''
     ORDER BY aj.interview_at ASC
     LIMIT 50`,
    [LOOKAHEAD_HOURS]
  );

  return result.rows;
}

async function claimReminder(applicationId) {
  const result = await pool.query(
    `UPDATE applied_jobs
     SET interview_reminder_sent_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
       AND interview_reminder_sent_at IS NULL
     RETURNING id`,
    [applicationId]
  );

  return result.rowCount > 0;
}

async function releaseReminderClaim(applicationId) {
  await pool.query(
    `UPDATE applied_jobs
     SET interview_reminder_sent_at = NULL
     WHERE id = $1`,
    [applicationId]
  );
}

async function sendReminderForApplication(application) {
  const claimed = await claimReminder(application.id);
  if (!claimed) return false;

  const interviewMode = application.interview_mode || application.candidate_interview_mode || 'online';

  try {
    await sendInterviewReminderEmail(application.email, {
      candidateName: application.full_name,
      jobTitle: application.job_title,
      companyName: application.company_name,
      interviewAt: application.interview_at,
      interviewMode,
      interviewLink: application.interview_link,
      companyAddress: application.company_address,
    });
  } catch (err) {
    await releaseReminderClaim(application.id).catch(() => {});
    throw err;
  }

  await createNotification({
    userId: application.user_id,
    type: 'seeker_interview_reminder',
    title: 'Nhắc lịch phỏng vấn ngày mai',
    message: `Bạn có lịch phỏng vấn cho vị trí ${application.job_title || 'ứng tuyển'} trong 24 giờ tới.`,
    to: '/seeker/applied-jobs',
    meta: {
      application_id: application.id,
      company_name: application.company_name || null,
      interview_at: application.interview_at,
      interview_mode: interviewMode,
    },
  }).catch((notificationError) => {
    console.error('Create interview reminder notification error:', notificationError);
  });

  return true;
}

async function sendDueInterviewReminders() {
  if (runInProgress) return { sent: 0, skipped: true, reason: 'already_running' };

  if (!isEmailConfigured()) {
    if (!missingConfigLogged) {
      console.warn('Interview reminder email scheduler skipped because SMTP_EMAIL/SMTP_PASSWORD are not configured.');
      missingConfigLogged = true;
    }
    return { sent: 0, skipped: true, reason: 'missing_smtp_config' };
  }

  runInProgress = true;
  let sent = 0;
  let failed = 0;

  try {
    await ensureInterviewReminderSchema();
    const applications = await getDueInterviewApplications();

    for (const application of applications) {
      try {
        const didSend = await sendReminderForApplication(application);
        if (didSend) sent += 1;
      } catch (err) {
        failed += 1;
        console.error(`Send interview reminder email error for application ${application.id}:`, err);
      }
    }

    return { sent, failed, skipped: false };
  } finally {
    runInProgress = false;
  }
}

function startInterviewReminderScheduler() {
  if (schedulerStarted) return null;
  schedulerStarted = true;

  const run = () => {
    sendDueInterviewReminders().catch((err) => {
      console.error('Interview reminder scheduler error:', err);
    });
  };

  const startDelay = Number.parseInt(process.env.INTERVIEW_REMINDER_START_DELAY_MS, 10) || 5000;
  const starter = setTimeout(run, startDelay);
  const timer = setInterval(run, INTERVAL_MS);

  starter.unref?.();
  timer.unref?.();

  return timer;
}

module.exports = {
  ensureInterviewReminderSchema,
  sendDueInterviewReminders,
  startInterviewReminderScheduler,
};
