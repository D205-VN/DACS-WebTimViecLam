const express = require('express');
const router = express.Router();
const jobController = require('./job.controller');
const { authenticateToken } = require('../../core/middlewares/auth.middleware');

// Public routes
router.get('/', jobController.getJobs);
router.get('/filters', jobController.getJobFilters);
router.get('/companies', jobController.getCompanies);
router.get('/saved', authenticateToken, jobController.getSavedJobs);
router.get('/applied', authenticateToken, jobController.getAppliedJobs);
router.get('/saved-ids', authenticateToken, jobController.getSavedJobIds);
router.get('/alert-ids', authenticateToken, jobController.getJobAlertIds);
router.patch('/applications/:id/interview-preference', authenticateToken, jobController.updateInterviewPreference);
router.get('/:id', jobController.getJobById);

// Protected routes
router.post('/:id/save', authenticateToken, jobController.toggleSaveJob);
router.post('/:id/apply', authenticateToken, jobController.applyJob);
router.post('/:id/alert', authenticateToken, jobController.toggleJobAlert);

module.exports = router;
