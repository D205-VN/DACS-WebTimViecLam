const express = require('express');
const router = express.Router();
const cvController = require('./cv.controller');
const { authenticateToken } = require('../../core/middlewares/auth.middleware');
const { aiRateLimit, uploadRateLimit } = require('../../core/middlewares/rate-limit.middleware');
const { createFileFilter, handleMulterUpload } = require('../../core/middlewares/upload.middleware');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: createFileFilter({
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
    label: 'ảnh CV',
  }),
});

router.get('/suggestions', authenticateToken, cvController.getSuggestions);
router.post('/generate', authenticateToken, aiRateLimit, cvController.generateCV);
router.post('/review', authenticateToken, aiRateLimit, cvController.reviewCVContent);
router.post('/revise', authenticateToken, aiRateLimit, cvController.reviseCVContent);
router.post('/import-image', authenticateToken, uploadRateLimit, aiRateLimit, handleMulterUpload(upload.single('image')), cvController.importFromImage);
router.post('/save', authenticateToken, cvController.saveCV);
router.get('/my-cvs', authenticateToken, cvController.getMyCVs);
router.patch('/:id/primary', authenticateToken, cvController.setPrimaryCV);
router.post('/:id/review', authenticateToken, aiRateLimit, cvController.reviewSavedCV);
router.post('/:id/revise', authenticateToken, aiRateLimit, cvController.reviseSavedCV);
router.delete('/:id', authenticateToken, cvController.deleteCV);

module.exports = router;
