const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { authenticateToken } = require('../../core/middlewares/auth.middleware');

function requireAdmin(req, res, next) {
  if (req.user?.role_code !== 'admin') {
    return res.status(403).json({ error: 'Truy cập bị từ chối. Yêu cầu quyền Admin.' });
  }

  next();
}

router.use(authenticateToken, requireAdmin, adminController.ensureAdminSchemaForRequest);

router.get('/stats', adminController.getStats);
router.get('/users', adminController.getUsers);
router.get('/jobs/pending', adminController.getPendingJobs);
router.put('/jobs/:id/status', adminController.updateJobStatus);

module.exports = router;
