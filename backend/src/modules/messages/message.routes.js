const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../core/middlewares/auth.middleware');
const messageController = require('./message.controller');

router.use(authenticateToken);

router.get('/conversations', messageController.listConversations);
router.post('/applications/:applicationId/conversation', messageController.getOrCreateConversation);
router.get('/conversations/:id/messages', messageController.getMessages);
router.post('/conversations/:id/messages', messageController.sendMessage);
router.post('/conversations/:id/read', messageController.markAsRead);

module.exports = router;
