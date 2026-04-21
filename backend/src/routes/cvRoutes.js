const express = require('express');
const router = express.Router();
const cvController = require('../controllers/cvController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.get('/suggestions', authenticateToken, cvController.getSuggestions);
router.post('/generate', authenticateToken, cvController.generateCV);
router.post('/import-image', authenticateToken, upload.single('image'), cvController.importFromImage);
router.post('/save', authenticateToken, cvController.saveCV);
router.get('/my-cvs', authenticateToken, cvController.getMyCVs);
router.patch('/:id/primary', authenticateToken, cvController.setPrimaryCV);
router.delete('/:id', authenticateToken, cvController.deleteCV);

module.exports = router;
