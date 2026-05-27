const express = require('express');
const router = express.Router();
const jobController = require('../controllers/job.controller');
const { authenticateToken } = require('../core/middlewares/auth.middleware');
const { uploadRateLimit } = require('../core/middlewares/rate-limit.middleware');
const { createFileFilter, handleMulterUpload, sanitizeUploadFilename } = require('../core/middlewares/upload.middleware');
const { getCompanyPublicProfile } = require('../controllers/employer.controller');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const onboardingUploadDir = path.join(__dirname, '..', '..', '..', 'uploads', 'onboarding');
const onboardingUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(onboardingUploadDir, { recursive: true });
      cb(null, onboardingUploadDir);
    },
    filename: (req, file, cb) => {
      const safeName = sanitizeUploadFilename(file.originalname);
      cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter: createFileFilter({
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/webp',
    ],
    allowedExtensions: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp'],
    label: 'tài liệu onboarding',
  }),
});

// Public routes
router.get('/', jobController.getJobs);
router.get('/filters', jobController.getJobFilters);
router.get('/companies', jobController.getCompanies);
router.get('/company-profile', getCompanyPublicProfile);
router.get('/saved', authenticateToken, jobController.getSavedJobs);
router.get('/applied', authenticateToken, jobController.getAppliedJobs);
router.get('/saved-ids', authenticateToken, jobController.getSavedJobIds);
router.get('/alert-ids', authenticateToken, jobController.getJobAlertIds);
router.patch('/applications/:id/interview-preference', authenticateToken, jobController.updateInterviewPreference);
router.post('/applications/:id/onboarding-documents', authenticateToken, uploadRateLimit, handleMulterUpload(onboardingUpload.array('documents', 10)), jobController.submitOnboardingDocuments);
router.get('/:id', jobController.getJobById);

// Protected routes
router.post('/:id/save', authenticateToken, jobController.toggleSaveJob);
router.post('/:id/apply', authenticateToken, jobController.applyJob);
router.post('/:id/alert', authenticateToken, jobController.toggleJobAlert);

module.exports = router;
