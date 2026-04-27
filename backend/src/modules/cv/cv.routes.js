const express = require('express');
const router = express.Router();
const cvController = require('./cv.controller');
const { authenticateToken } = require('../../core/middlewares/auth.middleware');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.get('/suggestions', authenticateToken, cvController.getSuggestions);
router.post('/generate', authenticateToken, cvController.generateCV);
router.post('/review', authenticateToken, cvController.reviewCVContent);
router.post('/revise', authenticateToken, cvController.reviseCVContent);
router.post('/import-image', authenticateToken, upload.single('image'), cvController.importFromImage);
router.post('/save', authenticateToken, cvController.saveCV);
router.get('/my-cvs', authenticateToken, cvController.getMyCVs);
router.patch('/:id/primary', authenticateToken, cvController.setPrimaryCV);
router.post('/:id/review', authenticateToken, cvController.reviewSavedCV);
router.post('/:id/revise', authenticateToken, cvController.reviseSavedCV);
router.delete('/:id', authenticateToken, cvController.deleteCV);

module.exports = router;
