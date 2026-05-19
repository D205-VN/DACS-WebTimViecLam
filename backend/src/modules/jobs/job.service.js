const crypto = require('crypto');
const AppError = require('../../core/errors/AppError');
const { getNearestDistanceForAddress } = require('../../core/utils/locationCoordinates');
const { createNotification } = require('../notifications/notification.service');
const {
  ensureJobStatusSchema,
  ensurePublicApplicationSchema,
  ensureJobAnalyticsSchema,
  ensureOnboardingSchema,
} = require('./job.model');
const jobRepository = require('./job.repository');

const SALARY_RANGE_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: '0-10', label: 'Dưới 10 triệu' },
  { value: '10-15', label: '10 - 15 triệu' },
  { value: '15-20', label: '15 - 20 triệu' },
  { value: '20-30', label: '20 - 30 triệu' },
  { value: '30+', label: 'Trên 30 triệu' },
];

const normalizedSalaryExpr = `regexp_replace(lower(COALESCE(salary, '')), '\\s+', '', 'g')`;
const salaryLowerTokenExpr = `split_part(${normalizedSalaryExpr}, '-', 1)`;
const salaryUpperTokenExpr = `CASE
  WHEN POSITION('-' IN ${normalizedSalaryExpr}) > 0
    THEN split_part(${normalizedSalaryExpr}, '-', 2)
  ELSE split_part(${normalizedSalaryExpr}, '-', 1)
END`;

function buildSalaryValueExpression(tokenExpr) {
  return `CASE
    WHEN COALESCE(TRIM(salary), '') = '' THEN NULL
    WHEN lower(salary) ~ 'th[oỏ]a\\s*thu[aậ]n|thuong\\s*luong|c[aạ]nh\\s*tranh' THEN NULL
    WHEN NULLIF(regexp_replace(${tokenExpr}, '[^0-9]', '', 'g'), '') IS NULL THEN NULL
    WHEN lower(salary) ~ '(usd|\\$)' THEN regexp_replace(${tokenExpr}, '[^0-9]', '', 'g')::numeric * 25000
    WHEN regexp_replace(${tokenExpr}, '[^0-9]', '', 'g')::numeric < 1000 THEN regexp_replace(${tokenExpr}, '[^0-9]', '', 'g')::numeric * 1000000
    ELSE regexp_replace(${tokenExpr}, '[^0-9]', '', 'g')::numeric
  END`;
}

const salaryLowerExpr = buildSalaryValueExpression(salaryLowerTokenExpr);
const salaryUpperExpr = buildSalaryValueExpression(salaryUpperTokenExpr);

function parseListParam(value) {
  if (!value) return [];
  const rawValues = Array.isArray(value) ? value : String(value).split(',');

  return rawValues
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function parsePositiveInteger(value, fallback, max = 100) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeInterviewMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['online', 'offline'].includes(normalized) ? normalized : null;
}

function normalizeTrafficSource(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['organic', 'referral', 'social', 'email', 'job_alert', 'direct'].includes(normalized)
    ? normalized
    : 'organic';
}

function resolveTrafficSource(context = {}) {
  const explicitSource = String(context.query?.source || context.body?.source || '').trim();
  if (explicitSource) return normalizeTrafficSource(explicitSource);

  if (context.query?.ref || context.query?.utm_source) {
    return 'referral';
  }

  const referer = String(context.referer || '').toLowerCase();
  const host = String(context.host || '').toLowerCase();
  if (!referer) return 'organic';

  if (/facebook|linkedin|twitter|x\.com|zalo|tiktok/.test(referer)) return 'social';
  if (host && !referer.includes(host)) return 'referral';

  return 'organic';
}

function appendLikeAnyClause(field, values, params, paramIndex) {
  if (!values.length) {
    return { clause: '', nextIndex: paramIndex };
  }

  const placeholders = values.map((_, index) => `$${paramIndex + index}`).join(', ');
  params.push(...values.map((value) => `%${value}%`));

  return {
    clause: ` AND ${field} ILIKE ANY (ARRAY[${placeholders}]::text[])`,
    nextIndex: paramIndex + values.length,
  };
}

function appendSalaryRangeClause(rangeValue, params, paramIndex) {
  if (!rangeValue) {
    return { clause: '', nextIndex: paramIndex };
  }

  if (rangeValue === '0-10') {
    params.push(10000000);
    return {
      clause: ` AND ${salaryLowerExpr} IS NOT NULL AND COALESCE(${salaryUpperExpr}, ${salaryLowerExpr}) < $${paramIndex}`,
      nextIndex: paramIndex + 1,
    };
  }

  if (rangeValue === '30+') {
    params.push(30000000);
    return {
      clause: ` AND ${salaryLowerExpr} IS NOT NULL AND COALESCE(${salaryUpperExpr}, ${salaryLowerExpr}) >= $${paramIndex}`,
      nextIndex: paramIndex + 1,
    };
  }

  const [minMillions, maxMillions] = String(rangeValue).split('-').map(Number);
  if (!Number.isFinite(minMillions) || !Number.isFinite(maxMillions)) {
    return { clause: '', nextIndex: paramIndex };
  }

  params.push(minMillions * 1000000, maxMillions * 1000000);
  return {
    clause: ` AND ${salaryLowerExpr} IS NOT NULL
      AND COALESCE(${salaryUpperExpr}, ${salaryLowerExpr}) >= $${paramIndex}
      AND ${salaryLowerExpr} < $${paramIndex + 1}`,
    nextIndex: paramIndex + 2,
  };
}

function buildLocationLikePatterns(rawLocation) {
  const input = (rawLocation || '').trim();
  if (!input) return [];

  const lower = input.toLowerCase();
  const patterns = new Set([`%${input}%`]);
  const withoutPrefix = input.replace(/^(Thành phố|Tỉnh)\s+/i, '').trim();
  if (withoutPrefix && withoutPrefix !== input) patterns.add(`%${withoutPrefix}%`);

  if (
    /hồ\s*chí\s*minh/i.test(input) ||
    /ho\s*chi\s*minh/i.test(lower) ||
    /\bhcm\b/i.test(lower) ||
    /sài\s*gòn/i.test(input) ||
    /sai\s*gon/i.test(lower)
  ) {
    [
      '%Hồ Chí Minh%',
      '%Ho Chi Minh%',
      '%HCM%',
      '%TP.HCM%',
      '%TP HCM%',
      '%Sài Gòn%',
      '%Sai Gon%',
      '%SG%',
    ].forEach((pattern) => patterns.add(pattern));
  }

  if (/hà\s*nội/i.test(input) || /ha\s*noi/i.test(lower) || /\bhn\b/i.test(lower)) {
    ['%Hà Nội%', '%Ha Noi%', '%HN%'].forEach((pattern) => patterns.add(pattern));
  }

  return Array.from(patterns);
}

function buildDeadlineSqlExpression(columnName) {
  return `
    CASE
      WHEN ${columnName} IS NULL OR TRIM(${columnName}) = '' THEN NULL
      WHEN ${columnName} ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN TO_DATE(${columnName}, 'YYYY-MM-DD')
      WHEN ${columnName} ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN TO_DATE(${columnName}, 'DD/MM/YYYY')
      ELSE NULL
    END
  `;
}

function buildJobListQuery(query = {}) {
  const keyword = query.keyword || query.q || '';
  const location = query.location || '';
  const jobType = query.jobType || query.job_type || '';
  const salaryRange = query.salaryRange || query.salary_range || '';
  const company = String(query.company || '').trim();
  const levels = parseListParam(query.levels);
  const industries = parseListParam(query.industries);
  const lat = toFiniteNumber(query.lat);
  const lng = toFiniteNumber(query.lng);
  const hasUserCoordinates = lat !== null && lng !== null;
  const params = [];
  let whereClause = '';
  let paramIndex = 1;

  const deadlineDateSql = buildDeadlineSqlExpression('submission_deadline');
  whereClause += ` AND (${deadlineDateSql} IS NULL OR ${deadlineDateSql} >= CURRENT_DATE)`;

  if (keyword) {
    whereClause += ` AND (job_title ILIKE $${paramIndex} OR company_name ILIKE $${paramIndex} OR industry ILIKE $${paramIndex} OR job_description ILIKE $${paramIndex} OR job_requirements ILIKE $${paramIndex})`;
    params.push(`%${keyword}%`);
    paramIndex++;
  }

  if (location && !hasUserCoordinates) {
    const patterns = buildLocationLikePatterns(location);
    if (patterns.length > 0) {
      const placeholders = patterns.map((_, index) => `$${paramIndex + index}`).join(', ');
      whereClause += ` AND job_address ILIKE ANY (ARRAY[${placeholders}]::text[])`;
      params.push(...patterns);
      paramIndex += patterns.length;
    }
  }

  if (jobType) {
    whereClause += ` AND job_type ILIKE $${paramIndex}`;
    params.push(`%${jobType}%`);
    paramIndex++;
  }

  if (company) {
    whereClause += ` AND LOWER(TRIM(company_name)) = LOWER(TRIM($${paramIndex}))`;
    params.push(company);
    paramIndex++;
  }

  const levelClause = appendLikeAnyClause('career_level', levels, params, paramIndex);
  whereClause += levelClause.clause;
  paramIndex = levelClause.nextIndex;

  const industryClause = appendLikeAnyClause('industry', industries, params, paramIndex);
  whereClause += industryClause.clause;
  paramIndex = industryClause.nextIndex;

  const salaryClause = appendSalaryRangeClause(salaryRange, params, paramIndex);
  whereClause += salaryClause.clause;
  paramIndex = salaryClause.nextIndex;

  return {
    hasUserCoordinates,
    origin: hasUserCoordinates ? { lat, lng } : null,
    paramIndex,
    params,
    whereClause,
  };
}

function getJobSelectClause(whereClause) {
  return `SELECT id, job_title AS title, job_description AS description, job_requirements AS requirements,
          benefits, job_address AS location, job_type, years_of_experience AS experience,
          salary, submission_deadline AS deadline, company_name, company_overview, company_size,
          company_address, industry, career_level, created_at
          FROM jobs
          WHERE COALESCE(NULLIF(TRIM(status), ''), 'approved') = 'approved'${whereClause}`;
}

function sortJobsByDistance(origin, jobs) {
  if (!origin) return jobs;

  return jobs
    .map((job) => {
      const distanceKm = getNearestDistanceForAddress(
        origin,
        [job.location, job.company_address, job.company_name].filter(Boolean).join(' ')
      );

      return {
        ...job,
        distance_km: distanceKm === null ? null : Number(distanceKm.toFixed(1)),
      };
    })
    .sort((left, right) => {
      const leftHasDistance = Number.isFinite(left.distance_km);
      const rightHasDistance = Number.isFinite(right.distance_km);

      if (leftHasDistance && rightHasDistance) {
        return left.distance_km - right.distance_km || new Date(right.created_at || 0) - new Date(left.created_at || 0) || right.id - left.id;
      }

      if (leftHasDistance) return -1;
      if (rightHasDistance) return 1;

      return new Date(right.created_at || 0) - new Date(left.created_at || 0) || right.id - left.id;
    });
}

function mapAppliedJob(row) {
  const {
    ai_test_id,
    ai_test_title,
    ai_test_description,
    ai_test_duration,
    ai_test_type,
    ai_test_created_at,
    ai_submission_id,
    ai_submission_status,
    ai_submission_total_score,
    ai_submission_started_at,
    ai_submission_completed_at,
    ...job
  } = row;

  return {
    ...job,
    ai_test: ai_test_id
      ? {
          id: ai_test_id,
          title: ai_test_title,
          description: ai_test_description,
          duration: ai_test_duration,
          test_type: ai_test_type,
          created_at: ai_test_created_at,
          submission: ai_submission_id
            ? {
                id: ai_submission_id,
                status: ai_submission_status,
                total_score: ai_submission_total_score,
                started_at: ai_submission_started_at,
                completed_at: ai_submission_completed_at,
              }
            : null,
        }
      : null,
  };
}

function buildViewerKey(context = {}) {
  const rawViewerKey = [context.ip, context.userAgent].filter(Boolean).join('|');
  return rawViewerKey
    ? crypto.createHash('sha256').update(rawViewerKey).digest('hex')
    : null;
}

async function recordJobView(jobId, context) {
  const source = resolveTrafficSource(context);
  const viewerKey = buildViewerKey(context);
  await jobRepository.insertJobView({ jobId, viewerKey, source });
}

async function listJobs(query = {}) {
  await ensureJobStatusSchema();

  const page = parsePositiveInteger(query.page, 1, 10000);
  const limit = parsePositiveInteger(query.limit, 20, 100);
  const offset = (page - 1) * limit;
  const { hasUserCoordinates, origin, paramIndex, params, whereClause } = buildJobListQuery(query);
  const selectClause = getJobSelectClause(whereClause);
  const orderBy = 'ORDER BY created_at DESC NULLS LAST, id DESC';

  let jobs = [];
  let totalJobs = 0;

  if (hasUserCoordinates) {
    const rows = await jobRepository.findAllJobsForDistance({ selectClause, params, orderBy });
    const sortedJobs = sortJobsByDistance(origin, rows);
    totalJobs = sortedJobs.length;
    jobs = sortedJobs.slice(offset, offset + limit);
  } else {
    totalJobs = await jobRepository.countJobs(whereClause, params);
    jobs = await jobRepository.findJobs({ selectClause, params, orderBy, limit, offset, paramIndex });
  }

  return {
    data: jobs,
    meta: {
      total: totalJobs,
      page,
      limit,
      totalPages: Math.ceil(totalJobs / limit),
    },
  };
}

async function getJobFilters() {
  await ensureJobStatusSchema();

  const [levels, industries] = await Promise.all([
    jobRepository.getFilterLevels(),
    jobRepository.getFilterIndustries(),
  ]);

  return {
    data: {
      salaryRanges: SALARY_RANGE_OPTIONS,
      levels,
      industries,
    },
  };
}

async function getCompanies(query = {}) {
  await ensureJobStatusSchema();

  const keyword = String(query.keyword || '').trim();
  const params = [];
  const deadlineDateSql = buildDeadlineSqlExpression('submission_deadline');
  let whereClause = `WHERE COALESCE(NULLIF(TRIM(status), ''), 'approved') = 'approved'
    AND company_name IS NOT NULL AND TRIM(company_name) <> ''
    AND (${deadlineDateSql} IS NULL OR ${deadlineDateSql} >= CURRENT_DATE)`;

  if (keyword) {
    whereClause += ' AND company_name ILIKE $1';
    params.push(`%${keyword}%`);
  }

  return { data: await jobRepository.findCompanies(whereClause, params) };
}

async function getSavedJobs(userId) {
  return { data: await jobRepository.findSavedJobs(userId) };
}

async function getAppliedJobs(userId) {
  await ensurePublicApplicationSchema();
  const rows = await jobRepository.findAppliedJobs(userId);
  return { data: rows.map(mapAppliedJob) };
}

async function getSavedJobIds(userId) {
  return { ids: await jobRepository.findSavedJobIds(userId) };
}

async function getJobById(jobId, context) {
  await ensureJobStatusSchema();
  await ensureJobAnalyticsSchema();

  const job = await jobRepository.findApprovedJobById(jobId);
  if (!job) throw new AppError('Không tìm thấy việc làm', 404, 'JOB_NOT_FOUND');

  recordJobView(job.id, context).catch((viewError) => {
    console.error('Record job view error:', viewError);
  });

  let linkedTest = null;
  try {
    linkedTest = await jobRepository.findLinkedAiTest(job.id);
  } catch (testErr) {
    console.error('Error fetching linked AI test:', testErr);
  }

  return { data: { ...job, ai_test: linkedTest } };
}

async function toggleSaveJob(userId, jobId) {
  const existing = await jobRepository.findSavedJob(userId, jobId);

  if (existing) {
    await jobRepository.deleteSavedJob(userId, jobId);
    return { saved: false, message: 'Đã bỏ lưu việc làm' };
  }

  await jobRepository.insertSavedJob(userId, jobId);
  return { saved: true, message: 'Đã lưu việc làm' };
}

async function resolveCvForApplication(userId, requestedCvId) {
  if (Number.isInteger(requestedCvId) && requestedCvId > 0) {
    const requestedCv = await jobRepository.findUserCvById(userId, requestedCvId);
    if (!requestedCv) {
      throw new AppError('CV đã chọn không hợp lệ hoặc không thuộc tài khoản của bạn', 400, 'INVALID_CV');
    }
    return requestedCv.id;
  }

  const primaryCv = await jobRepository.findPrimaryCv(userId);
  if (primaryCv?.id) return primaryCv.id;

  const latestCv = await jobRepository.findLatestCv(userId);
  if (latestCv?.id) {
    await jobRepository.markCvPrimary(userId, latestCv.id);
    return latestCv.id;
  }

  throw new AppError('Bạn chưa có CV để nộp hồ sơ. Hãy tạo CV và chọn 1 CV chính trước khi ứng tuyển.', 400, 'CV_REQUIRED');
}

async function applyJob({ jobId, user, body = {}, context = {} }) {
  await ensureJobStatusSchema();
  await ensureJobAnalyticsSchema();

  const userId = user.id;
  const requestedCvId = Number(body.cv_id);
  const coverLetter = String(body.cover_letter || '').trim();

  if (coverLetter.length > 2000) {
    throw new AppError('Thư giới thiệu không được vượt quá 2000 ký tự', 400, 'COVER_LETTER_TOO_LONG');
  }

  const job = await jobRepository.findApprovedJobForApplication(jobId);
  if (!job) throw new AppError('Không tìm thấy việc làm', 404, 'JOB_NOT_FOUND');

  const existing = await jobRepository.findExistingApplication(userId, jobId);
  if (existing) throw new AppError('Bạn đã ứng tuyển việc làm này rồi', 400, 'APPLICATION_EXISTS');

  const selectedCvId = await resolveCvForApplication(userId, requestedCvId);
  const applicationSource = resolveTrafficSource(context);
  const application = await jobRepository.insertApplication({
    userId,
    jobId,
    cvId: selectedCvId,
    applicationSource,
    coverLetter,
  });

  if (job.employer_id) {
    await createNotification({
      userId: job.employer_id,
      type: 'employer_new_candidate',
      title: 'Có ứng viên mới',
      message: `${user.full_name || 'Một ứng viên'} vừa ứng tuyển vào vị trí ${job.job_title || 'tin tuyển dụng'}.`,
      to: '/employer/dashboard',
      tab: 'candidates',
      meta: {
        application_id: application?.id || null,
        cv_id: selectedCvId,
        job_id: jobId,
        company_name: job.company_name || null,
      },
    }).catch((notificationError) => {
      console.error('Create employer application notification error:', notificationError);
    });
  }

  return {
    message: 'Ứng tuyển thành công!',
    application_id: application?.id || null,
    cv_id: selectedCvId,
  };
}

async function updateInterviewPreference({ userId, applicationId, interviewMode }) {
  await ensurePublicApplicationSchema();

  const normalizedMode = normalizeInterviewMode(interviewMode);
  if (!normalizedMode) {
    throw new AppError('Hình thức phỏng vấn không hợp lệ', 400, 'INVALID_INTERVIEW_MODE');
  }

  const application = await jobRepository.findApplicationInterviewPreference(userId, applicationId);
  if (!application) {
    throw new AppError('Không tìm thấy hồ sơ ứng tuyển', 404, 'APPLICATION_NOT_FOUND');
  }

  if (!['approved', 'interview', 'hired'].includes(application.status)) {
    throw new AppError('Nhà tuyển dụng chưa duyệt hồ sơ này để chọn hình thức phỏng vấn', 400, 'APPLICATION_NOT_APPROVED');
  }

  if (normalizeInterviewMode(application.interview_mode)) {
    throw new AppError('Nhà tuyển dụng đã chốt hình thức phỏng vấn cho hồ sơ này', 400, 'INTERVIEW_MODE_LOCKED');
  }

  const data = await jobRepository.updateCandidateInterviewMode(userId, applicationId, normalizedMode);
  return { message: 'Đã lưu lựa chọn phỏng vấn', data };
}

function parseOnboardingPayload(body = {}) {
  try {
    return {
      docTypes: JSON.parse(body.doc_types || '[]'),
      aiResults: JSON.parse(body.ai_results || '{}'),
    };
  } catch {
    throw new AppError('Dữ liệu hồ sơ onboarding không hợp lệ', 400, 'INVALID_ONBOARDING_PAYLOAD');
  }
}

async function submitOnboardingDocuments({ applicationId, user, body = {}, files = [] }) {
  await ensurePublicApplicationSchema();
  await ensureOnboardingSchema();

  const normalizedApplicationId = Number(applicationId);
  if (!Number.isInteger(normalizedApplicationId) || normalizedApplicationId <= 0) {
    throw new AppError('Mã hồ sơ ứng tuyển không hợp lệ', 400, 'INVALID_APPLICATION_ID');
  }

  const { docTypes, aiResults } = parseOnboardingPayload(body);
  if (!files.length) {
    throw new AppError('Bạn cần tải lên ít nhất một giấy tờ', 400, 'ONBOARDING_DOCUMENT_REQUIRED');
  }

  const application = await jobRepository.findOnboardingApplication(user.id, normalizedApplicationId);
  if (!application) {
    throw new AppError('Không tìm thấy hồ sơ ứng tuyển của bạn', 404, 'APPLICATION_NOT_FOUND');
  }

  if (!['hired', 'onboarding'].includes(application.status)) {
    throw new AppError('Chỉ ứng viên đã trúng tuyển mới được gửi hồ sơ onboarding', 400, 'APPLICATION_NOT_HIRED');
  }

  const submission = await jobRepository.withTransaction(async (client) => {
    const savedSubmission = await jobRepository.upsertOnboardingSubmission(client, {
      applicationId: normalizedApplicationId,
      userId: user.id,
      employerId: application.employer_id,
      jobId: application.job_id,
    });

    await jobRepository.deleteOnboardingDocuments(client, savedSubmission.id);

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const docType = String(docTypes[index] || `document_${index + 1}`).trim();
      await jobRepository.insertOnboardingDocument(client, {
        submissionId: savedSubmission.id,
        docType,
        docName: docType,
        fileName: file.originalname,
        fileUrl: `/uploads/onboarding/${file.filename}`,
        mimeType: file.mimetype,
        fileSize: file.size,
        aiResult: aiResults[docType] || {},
      });
    }

    await jobRepository.markApplicationOnboarding(client, user.id, normalizedApplicationId);
    return savedSubmission;
  });

  await createNotification({
    userId: application.employer_id,
    type: 'onboarding_submitted',
    title: 'Ứng viên đã gửi hồ sơ onboarding',
    message: `${user.full_name || 'Ứng viên'} đã gửi hồ sơ nhận việc cho vị trí ${application.job_title || 'ứng tuyển'}.`,
    to: '/employer/dashboard',
    tab: 'onboarding',
    meta: {
      application_id: normalizedApplicationId,
      job_id: application.job_id,
      company_name: application.company_name || null,
    },
  }).catch((notificationError) => {
    console.error('Create onboarding notification error:', notificationError);
  });

  return {
    message: 'Đã gửi hồ sơ onboarding cho nhà tuyển dụng xét duyệt',
    data: {
      submission_id: submission.id,
      document_count: files.length,
    },
  };
}

async function getJobAlertIds(userId) {
  await ensurePublicApplicationSchema();
  return { ids: await jobRepository.findJobAlertIds(userId) };
}

async function toggleJobAlert(userId, jobId) {
  await ensurePublicApplicationSchema();

  const existing = await jobRepository.findJobAlert(userId, jobId);
  if (existing) {
    await jobRepository.deleteJobAlert(userId, jobId);
    return { subscribed: false, message: 'Đã hủy nhận thông báo việc tương tự' };
  }

  await jobRepository.insertJobAlert(userId, jobId);
  return { subscribed: true, message: 'Đã đăng ký nhận thông báo việc tương tự' };
}

module.exports = {
  applyJob,
  getAppliedJobs,
  getCompanies,
  getJobAlertIds,
  getJobById,
  getJobFilters,
  getSavedJobIds,
  getSavedJobs,
  listJobs,
  submitOnboardingDocuments,
  toggleJobAlert,
  toggleSaveJob,
  updateInterviewPreference,
};
