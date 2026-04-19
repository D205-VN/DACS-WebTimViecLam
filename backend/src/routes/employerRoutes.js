const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { getDashboard, createJob, getMyJobs } = require('../controllers/employerController');

// Middleware kiểm tra role employer
function requireEmployer(req, res, next) {
  if (req.user.role !== 'employer') {
    return res.status(403).json({ error: 'Chỉ nhà tuyển dụng mới có quyền truy cập' });
  }
  next();
}

// Tất cả routes cần xác thực + role employer
router.use(authenticateToken, requireEmployer);

router.get('/dashboard', getDashboard);
router.get('/jobs', getMyJobs);
router.post('/jobs', createJob);

module.exports = router;