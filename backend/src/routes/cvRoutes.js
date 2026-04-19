const express = require('express');
const router = express.Router();
const cvController = require('../controllers/cvController');
const { authenticateToken } = require('../middlewares/authMiddleware');

router.get('/suggestions', authenticateToken, cvController.getSuggestions);
router.post('/generate', authenticateToken, cvController.generateCV);

module.exports = router;
