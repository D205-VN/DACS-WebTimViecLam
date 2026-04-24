const express = require('express');
const router = express.Router();
const matchController = require('./match.controller');
const { authenticateToken } = require('../../core/middlewares/auth.middleware');

// AI job matching — requires login
router.get('/recommendations', authenticateToken, matchController.getRecommendations);

module.exports = router;
