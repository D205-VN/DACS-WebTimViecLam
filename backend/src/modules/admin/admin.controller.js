const adminService = require('./admin.service');

function sendControllerError(res, err, fallbackMessage, logLabel) {
  if (err?.isOperational) {
    return res.status(err.status || 400).json({ error: err.message, code: err.code });
  }

  console.error(logLabel, err);
  return res.status(500).json({ error: fallbackMessage });
}

async function ensureAdminSchemaForRequest(_req, res, next) {
  try {
    await adminService.ensureAdminSchema();
    next();
  } catch (err) {
    sendControllerError(res, err, 'Lỗi cấu hình dữ liệu quản trị', 'Ensure admin schema error:');
  }
}

exports.ensureAdminSchemaForRequest = ensureAdminSchemaForRequest;

exports.getStats = async (_req, res) => {
  try {
    res.json(await adminService.getStats());
  } catch (err) {
    sendControllerError(res, err, 'Lỗi khi lấy thống kê', 'Get admin stats error:');
  }
};

exports.getUsers = async (_req, res) => {
  try {
    res.json(await adminService.getUsers());
  } catch (err) {
    sendControllerError(res, err, 'Lỗi khi lấy danh sách người dùng', 'Get admin users error:');
  }
};

exports.getPendingJobs = async (_req, res) => {
  try {
    res.json(await adminService.getPendingJobs());
  } catch (err) {
    sendControllerError(res, err, 'Lỗi khi lấy danh sách chờ duyệt', 'Get pending jobs error:');
  }
};

exports.updateJobStatus = async (req, res) => {
  try {
    res.json(await adminService.updateJobStatus({
      jobId: req.params.id,
      status: req.body?.status,
      reason: req.body?.reason,
    }));
  } catch (err) {
    sendControllerError(res, err, 'Lỗi khi cập nhật trạng thái', 'Update job status error:');
  }
};

exports.toggleUserSuspend = async (req, res) => {
  try {
    res.json(await adminService.toggleUserSuspend({
      targetUserId: req.params.id,
      suspended: req.body?.suspended,
      actorUserId: req.user.id,
    }));
  } catch (err) {
    sendControllerError(res, err, 'Lỗi khi cập nhật trạng thái tài khoản', 'Toggle user suspend error:');
  }
};
