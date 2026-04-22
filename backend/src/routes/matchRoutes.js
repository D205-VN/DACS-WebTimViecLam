const express = require('express');
const router = express.Router();
const matchController = require('../controllers/matchController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// AI job matching — requires login
router.get('/recommendations', authenticateToken, matchController.getRecommendations);

module.exports = router;
