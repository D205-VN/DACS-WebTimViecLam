const express = require('express');
const router = express.Router();
const aiTestController = require('./ai-test.controller');

// Test Management
router.post('/tests', aiTestController.createTest);
router.get('/tests', aiTestController.getTests);
router.get('/tests/:id', aiTestController.getTestById);

// Question Bank
router.post('/questions', aiTestController.createQuestion);
router.get('/questions', aiTestController.getQuestions);
router.post('/tests/:testId/questions/:questionId', aiTestController.addQuestionToTest);

// Config
router.put('/tests/:id/scoring-config', aiTestController.updateScoringConfig);

// Get test by job
router.get('/by-job/:jobId', aiTestController.getTestByJobId);

// Candidate UI / Mocks
router.post('/generate-video', aiTestController.generateVideo);
router.post('/speech-to-text', aiTestController.speechToText);
router.post('/start-submission', aiTestController.startSubmission);
router.post('/submit-answer', aiTestController.submitAnswer);
router.post('/complete-submission', aiTestController.completeSubmission);

// Admin / HR Management
router.get('/submissions', aiTestController.getSubmissions);
router.get('/submissions/:id', aiTestController.getSubmissionDetails);
router.put('/answers/:answer_id/manual-score', aiTestController.manualAdjustScore);

module.exports = router;
