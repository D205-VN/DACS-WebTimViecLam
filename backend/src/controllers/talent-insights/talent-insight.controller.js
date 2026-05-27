const talentInsightService = require('../services/talent-insight.service');

function sendError(res, err, fallbackMessage) {
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    error: status === 500 ? fallbackMessage : err.message,
    code: err.code,
  });
}

exports.getMySkillPassport = async (req, res) => {
  try {
    res.json(await talentInsightService.getMySkillPassport(req.user));
  } catch (err) {
    console.error('Get skill passport error:', err);
    sendError(res, err, 'Không thể tải Skill Passport');
  }
};

exports.getPublicSkillPassport = async (req, res) => {
  try {
    res.json(await talentInsightService.getPublicSkillPassport(req.params.token));
  } catch (err) {
    console.error('Get public skill passport error:', err);
    sendError(res, err, 'Không thể tải Skill Passport public');
  }
};

exports.getJobFit = async (req, res) => {
  try {
    res.json(await talentInsightService.getJobFit(req.user, req.params.jobId));
  } catch (err) {
    console.error('Get job fit error:', err);
    sendError(res, err, 'Không thể tính Job Fit Score');
  }
};

exports.getEmployerTrustForJob = async (req, res) => {
  try {
    res.json(await talentInsightService.getEmployerTrustForJob(req.params.jobId));
  } catch (err) {
    console.error('Get employer trust error:', err);
    sendError(res, err, 'Không thể tải Employer Trust Score');
  }
};

exports.getInterviewCopilotForJob = async (req, res) => {
  try {
    res.json(await talentInsightService.getInterviewCopilotForJob(req.user, req.params.jobId));
  } catch (err) {
    console.error('Get interview copilot error:', err);
    sendError(res, err, 'Không thể tải Interview Copilot');
  }
};

exports.getEmployerInterviews = async (req, res) => {
  try {
    res.json(await talentInsightService.getEmployerInterviews(req.user));
  } catch (err) {
    console.error('Get employer interviews error:', err);
    sendError(res, err, 'Không thể tải danh sách phỏng vấn');
  }
};

exports.saveInterviewEvaluation = async (req, res) => {
  try {
    res.json(await talentInsightService.saveInterviewEvaluation(req.user, req.params.applicationId, req.body));
  } catch (err) {
    console.error('Save interview evaluation error:', err);
    sendError(res, err, 'Không thể lưu đánh giá phỏng vấn');
  }
};

exports.getWorkSimulationForJob = async (req, res) => {
  try {
    res.json(await talentInsightService.getWorkSimulationForJob(req.user, req.params.jobId));
  } catch (err) {
    console.error('Get work simulation error:', err);
    sendError(res, err, 'Không thể tải Mini Work Simulation');
  }
};

exports.submitWorkSimulation = async (req, res) => {
  try {
    res.status(201).json(await talentInsightService.submitWorkSimulation(req.user, req.params.jobId, req.body));
  } catch (err) {
    console.error('Submit work simulation error:', err);
    sendError(res, err, 'Không thể chấm Mini Work Simulation');
  }
};

exports.getLatestWorkSimulation = async (req, res) => {
  try {
    res.json(await talentInsightService.getLatestWorkSimulation(req.user, req.params.jobId));
  } catch (err) {
    console.error('Get latest work simulation error:', err);
    sendError(res, err, 'Không thể tải bài làm gần nhất');
  }
};
