const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const {
  ensureEmployerJobSchemaForRequest,
  getDashboard,
  createJob,
  getMyJobs,
  getCandidates,
  getProfile,
  updateProfile,
  getNotifications,
  getAnalytics,
  updateJob,
  updateJobStatus,
  deleteJob,
  updateApplicationStatus
} = require('../controllers/employerController');

// Middleware kiểm tra role employer
function requireEmployer(req, res, next) {
  if (req.user.role !== 'employer') {
    return res.status(403).json({ error: 'Chỉ nhà tuyển dụng mới có quyền truy cập' });
  }
  next();
}

// Tất cả routes cần xác thực + role employer
router.use(authenticateToken, requireEmployer);
router.use(ensureEmployerJobSchemaForRequest);

router.get('/dashboard', getDashboard);
router.get('/jobs', getMyJobs);
router.post('/jobs', createJob);
router.get('/candidates', getCandidates);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.get('/notifications', getNotifications);
router.get('/analytics', getAnalytics);

// Chi tiết, Cập nhật, Xóa job
router.put('/jobs/:id', updateJob);
router.patch('/jobs/:id/status', updateJobStatus);
router.delete('/jobs/:id', deleteJob);

// Trạng thái ứng tuyển
router.patch('/applications/:id/status', updateApplicationStatus);

module.exports = router;
