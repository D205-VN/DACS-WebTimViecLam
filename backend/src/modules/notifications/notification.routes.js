const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../core/middlewares/auth.middleware');
const notificationController = require('./notification.controller');

router.use(authenticateToken);

router.get('/', notificationController.getNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.post('/read-all', notificationController.markAllAsRead);
router.get('/job-alerts', notificationController.getJobAlertRules);
router.post('/job-alerts', notificationController.createJobAlert);
router.get('/job-alerts/:id/matches', notificationController.getJobAlertMatches);
router.put('/job-alerts/:id', notificationController.updateJobAlert);
router.delete('/job-alerts/:id', notificationController.deleteJobAlert);

module.exports = router;
