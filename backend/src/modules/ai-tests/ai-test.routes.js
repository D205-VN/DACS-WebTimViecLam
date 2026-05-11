const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../core/middlewares/auth.middleware');
const aiTestController = require('./ai-test.controller');

// Public: Get test by job (for job detail page)
router.get('/by-job/:jobId', aiTestController.getTestByJobId);

// All routes below require authentication
router.use(authenticateToken);

// Test Management (employer)
router.post('/tests', aiTestController.createTest);
router.get('/tests', aiTestController.getTests);
router.get('/tests/:id', aiTestController.getTestById);
router.delete('/tests/:id', aiTestController.deleteTest);

// Question Bank (employer)
router.post('/questions', aiTestController.createQuestion);
router.get('/questions', aiTestController.getQuestions);
router.post('/tests/:testId/questions/:questionId', aiTestController.addQuestionToTest);
router.delete('/tests/:testId/questions/:questionId', aiTestController.deleteQuestion);

// Config (employer)
router.put('/tests/:id/scoring-config', aiTestController.updateScoringConfig);

// Hybrid AI question generation
router.post('/tests/:testId/generate-questions', aiTestController.generateQuestions);

// Candidate UI / Mocks
router.post('/generate-video', aiTestController.generateVideo);
router.post('/speech-to-text', aiTestController.speechToText);
router.post('/liveavatar/session-token', aiTestController.createLiveAvatarSessionToken);
router.post('/start-submission', aiTestController.startSubmission);
router.post('/submit-answer', aiTestController.submitAnswer);
router.post('/complete-submission', aiTestController.completeSubmission);

// Candidate: my scores
router.get('/my-submissions', aiTestController.getMySubmissions);

// Admin / HR Management
router.get('/submissions', aiTestController.getSubmissions);
router.get('/submissions/:id', aiTestController.getSubmissionDetails);
router.put('/answers/:answer_id/manual-score', aiTestController.manualAdjustScore);

module.exports = router;
