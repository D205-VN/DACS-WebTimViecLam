const { isEmailConfigured, sendJobAlertDigestEmail } = require('../auth/email.service');
const { createNotification } = require('./notification.service');
const {
  ensureJobAlertSchema,
  getDueJobAlerts,
  findJobsForAlert,
  markAlertDigestSent,
  markAlertChecked,
} = require('./jobAlert.model');

const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000;
const INTERVAL_MS = Number.parseInt(process.env.JOB_ALERT_DIGEST_INTERVAL_MS, 10) || DEFAULT_INTERVAL_MS;
const DIGEST_LIMIT = Number.parseInt(process.env.JOB_ALERT_DIGEST_LIMIT, 10) || 8;

let schedulerStarted = false;
let runInProgress = false;
let missingConfigLogged = false;

function getAlertTitle(alert) {
  if (alert.keyword) return alert.keyword;
  if (alert.location) return `Việc tại ${alert.location}`;
  if (alert.salary_range) return `Mức lương ${alert.salary_range}`;
  if (alert.source_job_title) return `Việc tương tự ${alert.source_job_title}`;
  return 'Job alert';
}

async function sendDigestForAlert(alert) {
  const matches = await findJobsForAlert(alert, DIGEST_LIMIT);

  if (!matches.length) {
    await markAlertChecked(alert.id);
    return { sent: false, reason: 'no_matches' };
  }

  await sendJobAlertDigestEmail(alert.email, {
    candidateName: alert.full_name,
    alert,
    jobs: matches,
  });

  await markAlertDigestSent(alert.id);

  await createNotification({
    userId: alert.user_id,
    type: 'seeker_job_alert_digest',
    title: 'Job alert tuần này đã sẵn sàng',
    message: `Có ${matches.length} việc phù hợp với "${getAlertTitle(alert)}".`,
    to: '/seeker/job-alerts',
    meta: {
      alert_id: alert.id,
      job_ids: matches.map((job) => job.id),
      top_match_score: matches[0]?.match_score || null,
    },
  }).catch((notificationError) => {
    console.error('Create job alert digest notification error:', notificationError);
  });

  return { sent: true, matches: matches.length };
}

async function sendDueJobAlertDigests() {
  if (runInProgress) return { sent: 0, skipped: true, reason: 'already_running' };

  if (!isEmailConfigured()) {
    if (!missingConfigLogged) {
      console.warn('Job alert digest scheduler skipped because SMTP_EMAIL/SMTP_PASSWORD are not configured.');
      missingConfigLogged = true;
    }
    return { sent: 0, skipped: true, reason: 'missing_smtp_config' };
  }

  runInProgress = true;
  let sent = 0;
  let empty = 0;
  let failed = 0;

  try {
    await ensureJobAlertSchema();
    const alerts = await getDueJobAlerts();

    for (const alert of alerts) {
      try {
        const result = await sendDigestForAlert(alert);
        if (result.sent) sent += 1;
        else empty += 1;
      } catch (err) {
        failed += 1;
        console.error(`Send job alert digest error for alert ${alert.id}:`, err);
      }
    }

    return { sent, empty, failed, skipped: false };
  } finally {
    runInProgress = false;
  }
}

function startJobAlertDigestScheduler() {
  if (schedulerStarted) return null;
  schedulerStarted = true;

  const run = () => {
    sendDueJobAlertDigests().catch((err) => {
      console.error('Job alert digest scheduler error:', err);
    });
  };

  const startDelay = Number.parseInt(process.env.JOB_ALERT_DIGEST_START_DELAY_MS, 10) || 8000;
  const starter = setTimeout(run, startDelay);
  const timer = setInterval(run, INTERVAL_MS);

  starter.unref?.();
  timer.unref?.();

  return timer;
}

module.exports = {
  sendDueJobAlertDigests,
  startJobAlertDigestScheduler,
};
