const employerService = require('../services/employer.service');

const delegate = (handler) => (req, res, next) => handler(req, res, next);

module.exports = {
  ensureEmployerJobSchemaForRequest: delegate(employerService.ensureEmployerJobSchemaForRequest),
  getDashboard: delegate(employerService.getDashboard),
  createJob: delegate(employerService.createJob),
  getMyJobs: delegate(employerService.getMyJobs),
  getCandidates: delegate(employerService.getCandidates),
  getCandidateStats: delegate(employerService.getCandidateStats),
  getCandidateById: delegate(employerService.getCandidateById),
  getProfile: delegate(employerService.getProfile),
  updateProfile: delegate(employerService.updateProfile),
  getNotifications: delegate(employerService.getNotifications),
  getAnalytics: delegate(employerService.getAnalytics),
  updateJob: delegate(employerService.updateJob),
  updateJobStatus: delegate(employerService.updateJobStatus),
  deleteJob: delegate(employerService.deleteJob),
  updateApplicationStatus: delegate(employerService.updateApplicationStatus),
  saveCandidateNote: delegate(employerService.saveCandidateNote),
  scheduleInterview: delegate(employerService.scheduleInterview),
  getCompanyPublicProfile: delegate(employerService.getCompanyPublicProfile),
  reviewOnboardingDocument: delegate(employerService.reviewOnboardingDocument),
};
