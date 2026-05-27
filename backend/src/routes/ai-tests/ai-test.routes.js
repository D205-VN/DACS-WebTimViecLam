const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../core/middlewares/auth.middleware');
const { aiRateLimit } = require('../core/middlewares/rate-limit.middleware');
const aiTestController = require('../controllers/ai-test.controller');

function requireEmployerOrAdmin(req, res, next) {
  if (!['employer', 'admin'].includes(req.user?.role_code)) {
    return res.status(403).json({ error: 'Chỉ nhà tuyển dụng hoặc quản trị viên mới có quyền truy cập' });
  }

  next();
}

function requireSeeker(req, res, next) {
  if (req.user?.role_code !== 'seeker') {
    return res.status(403).json({ error: 'Chỉ ứng viên mới có quyền làm bài test' });
  }

  next();
}

// Public: Get test by job (for job detail page)
router.get('/by-job/:jobId', aiTestController.getTestByJobId);

// All routes below require authentication
router.use(authenticateToken);

// Test Management (employer)
router.post('/tests', requireEmployerOrAdmin, aiTestController.createTest);
router.get('/tests', requireEmployerOrAdmin, aiTestController.getTests);
router.get('/tests/:id', aiTestController.getTestById);
router.delete('/tests/:id', requireEmployerOrAdmin, aiTestController.deleteTest);

// Question Bank (employer)
router.post('/questions', requireEmployerOrAdmin, aiTestController.createQuestion);
router.get('/questions', requireEmployerOrAdmin, aiTestController.getQuestions);
router.post('/tests/:testId/questions/:questionId', requireEmployerOrAdmin, aiTestController.addQuestionToTest);
router.delete('/tests/:testId/questions/:questionId', requireEmployerOrAdmin, aiTestController.deleteQuestion);

// Config (employer)
router.put('/tests/:id/scoring-config', requireEmployerOrAdmin, aiTestController.updateScoringConfig);

// Hybrid AI question generation
router.post('/tests/:testId/generate-questions', requireEmployerOrAdmin, aiRateLimit, aiTestController.generateQuestions);

// AI utilities
router.post('/generate-video', requireEmployerOrAdmin, aiRateLimit, aiTestController.generateVideo);
router.post('/speech-to-text', aiRateLimit, aiTestController.speechToText);
router.post('/liveavatar/session-token', aiRateLimit, aiTestController.createLiveAvatarSessionToken);
router.post('/start-submission', requireSeeker, aiTestController.startSubmission);
router.post('/submit-answer', requireSeeker, aiRateLimit, aiTestController.submitAnswer);
router.post('/complete-submission', requireSeeker, aiTestController.completeSubmission);

// Candidate: my scores
router.get('/my-submissions', requireSeeker, aiTestController.getMySubmissions);

// Admin / HR Management
router.get('/submissions', requireEmployerOrAdmin, aiTestController.getSubmissions);
router.get('/submissions/:id', requireEmployerOrAdmin, aiTestController.getSubmissionDetails);
router.put('/answers/:answer_id/manual-score', requireEmployerOrAdmin, aiTestController.manualAdjustScore);

module.exports = router;
