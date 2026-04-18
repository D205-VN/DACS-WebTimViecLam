const express = require('express');
const router = express.Router();
const { register, verifyOTP, resendOTP, login, googleAuth, getMe } = require('../controllers/authController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// Public routes
router.post('/register', register);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/login', login);
router.post('/google', googleAuth);

// Protected routes
router.get('/me', authenticateToken, getMe);

module.exports = router;
