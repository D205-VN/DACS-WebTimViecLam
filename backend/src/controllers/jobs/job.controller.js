const fs = require('fs');
const jobService = require('../services/job.service');

function getRequestContext(req) {
  return {
    body: req.body || {},
    host: req.get?.('host') || '',
    ip: req.ip,
    query: req.query || {},
    referer: req.get?.('referer') || '',
    userAgent: req.get?.('user-agent') || '',
  };
}

function sendControllerError(res, err, fallbackMessage, logLabel) {
  if (err?.isOperational) {
    return res.status(err.status || 400).json({ error: err.message, code: err.code });
  }

  console.error(logLabel, err);
  return res.status(500).json({ error: fallbackMessage });
}

exports.getJobs = async (req, res) => {
  try {
    res.json(await jobService.listJobs(req.query));
  } catch (err) {
    sendControllerError(res, err, 'Internal server error', 'Get jobs error:');
  }
};

exports.getJobFilters = async (_req, res) => {
  try {
    res.json(await jobService.getJobFilters());
  } catch (err) {
    sendControllerError(res, err, 'Lỗi khi tải bộ lọc', 'Get job filters error:');
  }
};

exports.getCompanies = async (req, res) => {
  try {
    res.json(await jobService.getCompanies(req.query));
  } catch (err) {
    sendControllerError(res, err, 'Lỗi khi tải danh sách công ty', 'Get companies error:');
  }
};

exports.getSavedJobs = async (req, res) => {
  try {
    res.json(await jobService.getSavedJobs(req.user.id));
  } catch (err) {
    sendControllerError(res, err, 'Lỗi khi tải danh sách đã lưu', 'Get saved jobs error:');
  }
};

exports.getAppliedJobs = async (req, res) => {
  try {
    res.json(await jobService.getAppliedJobs(req.user.id));
  } catch (err) {
    sendControllerError(res, err, 'Lỗi khi tải danh sách đã ứng tuyển', 'Get applied jobs error:');
  }
};

exports.getSavedJobIds = async (req, res) => {
  try {
    res.json(await jobService.getSavedJobIds(req.user.id));
  } catch (err) {
    sendControllerError(res, err, 'Lỗi', 'Get saved job ids error:');
  }
};

exports.getJobById = async (req, res) => {
  try {
    res.json(await jobService.getJobById(req.params.id, getRequestContext(req)));
  } catch (err) {
    sendControllerError(res, err, 'Internal server error', 'Get job detail error:');
  }
};

exports.toggleSaveJob = async (req, res) => {
  try {
    res.json(await jobService.toggleSaveJob(req.user.id, req.params.id));
  } catch (err) {
    sendControllerError(res, err, 'Lỗi khi lưu việc làm', 'Toggle save job error:');
  }
};

exports.applyJob = async (req, res) => {
  try {
    res.json(await jobService.applyJob({
      jobId: req.params.id,
      user: req.user,
      body: req.body,
      context: getRequestContext(req),
    }));
  } catch (err) {
    sendControllerError(res, err, 'Lỗi khi ứng tuyển', 'Apply job error:');
  }
};

exports.updateInterviewPreference = async (req, res) => {
  try {
    res.json(await jobService.updateInterviewPreference({
      userId: req.user.id,
      applicationId: req.params.id,
      interviewMode: req.body?.interview_mode,
    }));
  } catch (err) {
    sendControllerError(res, err, 'Lỗi khi lưu lựa chọn phỏng vấn', 'Update interview preference error:');
  }
};

exports.submitOnboardingDocuments = async (req, res) => {
  const uploadedFiles = req.files || [];

  try {
    const payload = await jobService.submitOnboardingDocuments({
      applicationId: req.params.id,
      user: req.user,
      body: req.body,
      files: uploadedFiles,
    });

    res.status(201).json(payload);
  } catch (err) {
    uploadedFiles.forEach((file) => {
      if (file.path) fs.unlink(file.path, () => {});
    });
    sendControllerError(res, err, 'Không thể gửi hồ sơ onboarding', 'Submit onboarding documents error:');
  }
};

exports.getJobAlertIds = async (req, res) => {
  try {
    res.json(await jobService.getJobAlertIds(req.user.id));
  } catch (err) {
    sendControllerError(res, err, 'Lỗi', 'Get job alert ids error:');
  }
};

exports.toggleJobAlert = async (req, res) => {
  try {
    res.json(await jobService.toggleJobAlert(req.user.id, req.params.id));
  } catch (err) {
    sendControllerError(res, err, 'Lỗi khi đăng ký nhận thông báo', 'Toggle job alert error:');
  }
};
