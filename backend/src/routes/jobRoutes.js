const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// Public routes
router.get('/', jobController.getJobs);
router.get('/filters', jobController.getJobFilters);
router.get('/companies', jobController.getCompanies);
router.get('/saved', authenticateToken, jobController.getSavedJobs);
router.get('/applied', authenticateToken, jobController.getAppliedJobs);
router.get('/saved-ids', authenticateToken, jobController.getSavedJobIds);
router.get('/:id', jobController.getJobById);

// Protected routes
router.post('/:id/save', authenticateToken, jobController.toggleSaveJob);
router.post('/:id/apply', authenticateToken, jobController.applyJob);

module.exports = router;
