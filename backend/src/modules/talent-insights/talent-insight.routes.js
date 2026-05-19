const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../core/middlewares/auth.middleware');
const { aiRateLimit } = require('../../core/middlewares/rate-limit.middleware');
const talentInsightController = require('./talent-insight.controller');

router.get('/passport/public/:token', talentInsightController.getPublicSkillPassport);
router.get('/jobs/:jobId/trust', talentInsightController.getEmployerTrustForJob);

router.use(authenticateToken);

router.get('/passport/me', talentInsightController.getMySkillPassport);
router.get('/jobs/:jobId/fit', talentInsightController.getJobFit);
router.get('/interview-copilot/jobs/:jobId', talentInsightController.getInterviewCopilotForJob);
router.get('/employer/interviews', talentInsightController.getEmployerInterviews);
router.put('/employer/applications/:applicationId/evaluation', talentInsightController.saveInterviewEvaluation);
router.get('/work-simulations/jobs/:jobId', talentInsightController.getWorkSimulationForJob);
router.get('/work-simulations/jobs/:jobId/latest', talentInsightController.getLatestWorkSimulation);
router.post('/work-simulations/jobs/:jobId/submit', aiRateLimit, talentInsightController.submitWorkSimulation);

module.exports = router;
