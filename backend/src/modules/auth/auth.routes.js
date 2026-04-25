const express = require('express');
const router = express.Router();
const { register, verifyOTP, resendOTP, login, googleAuth, getMe, updateProfile, changePassword, forgotPassword, verifyResetOTP, resetPassword } = require('./auth.controller');
const { authenticateToken } = require('../../core/middlewares/auth.middleware');

// Public routes
router.post('/register', register);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/login', login);
router.post('/google', googleAuth);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOTP);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/me', authenticateToken, getMe);
router.put('/profile', authenticateToken, updateProfile);
router.post('/change-password', authenticateToken, changePassword);

module.exports = router;
