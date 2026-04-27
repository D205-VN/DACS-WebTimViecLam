const express = require('express');
const { authenticateToken } = require('../../core/middlewares/auth.middleware');
const controller = require('./verification.controller');

const router = express.Router();

router.get('/public/:code', controller.getPublicVerification);

router.use(authenticateToken);
router.get('/overview', controller.getOverview);
router.post('/cvs/:id/notarize', controller.notarizeCv);
router.get('/certificates', controller.getCertificates);
router.post('/certificates', controller.createCertificate);
router.patch('/certificates/:id/revoke', controller.revokeCertificate);
router.get('/work-history', controller.getWorkHistories);
router.post('/work-history', controller.createWorkHistory);
router.patch('/work-history/:id/revoke', controller.revokeWorkHistory);

module.exports = router;
