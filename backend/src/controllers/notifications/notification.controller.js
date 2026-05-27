const notificationService = require('../services/notification.service');

function sendError(res, err, fallbackMessage) {
  const status = err.statusCode || err.status || 500;
  res.status(status).json({ error: status === 500 ? fallbackMessage : err.message });
}

async function getNotifications(req, res) {
  try {
    const result = await notificationService.listNotificationsForUser(req.user.id, req.query.limit);
    res.json(result);
  } catch (err) {
    console.error('Get notifications error:', err);
    sendError(res, err, 'Lỗi khi tải thông báo');
  }
}

async function getUnreadCount(req, res) {
  try {
    const result = await notificationService.getUnreadCountForUser(req.user.id);
    res.json(result);
  } catch (err) {
    console.error('Get unread notifications count error:', err);
    sendError(res, err, 'Lỗi khi tải số thông báo chưa đọc');
  }
}

async function markAllAsRead(req, res) {
  try {
    const result = await notificationService.markAllAsReadForUser(req.user.id);
    res.json(result);
  } catch (err) {
    console.error('Mark notifications as read error:', err);
    sendError(res, err, 'Lỗi khi cập nhật trạng thái thông báo');
  }
}

async function markNotificationAsRead(req, res) {
  try {
    const result = await notificationService.markOneAsReadForUser(req.user.id, req.params.id);
    res.json(result);
  } catch (err) {
    console.error('Mark notification as read error:', err);
    sendError(res, err, 'Lỗi khi cập nhật trạng thái thông báo');
  }
}

async function deleteNotification(req, res) {
  try {
    const result = await notificationService.deleteNotificationForUser(req.user.id, req.params.id);
    res.json(result);
  } catch (err) {
    console.error('Delete notification error:', err);
    sendError(res, err, 'Lỗi khi xóa thông báo');
  }
}

async function getJobAlertRules(req, res) {
  try {
    const result = await notificationService.listJobAlertRulesForUser(req.user);
    res.json(result);
  } catch (err) {
    console.error('Get job alerts error:', err);
    sendError(res, err, 'Lỗi khi tải job alerts');
  }
}

async function createJobAlert(req, res) {
  try {
    const result = await notificationService.createJobAlertForUser(req.user, req.body || {});
    res.status(201).json(result);
  } catch (err) {
    console.error('Create job alert error:', err);
    sendError(res, err, 'Lỗi khi tạo job alert');
  }
}

async function updateJobAlert(req, res) {
  try {
    const result = await notificationService.updateJobAlertForUser(req.user, req.params.id, req.body || {});
    res.json(result);
  } catch (err) {
    console.error('Update job alert error:', err);
    sendError(res, err, 'Lỗi khi cập nhật job alert');
  }
}

async function deleteJobAlert(req, res) {
  try {
    const result = await notificationService.deleteJobAlertForUser(req.user, req.params.id);
    res.json(result);
  } catch (err) {
    console.error('Delete job alert error:', err);
    sendError(res, err, 'Lỗi khi xóa job alert');
  }
}

async function getJobAlertMatches(req, res) {
  try {
    const result = await notificationService.listJobAlertMatchesForUser(req.user, req.params.id, req.query.limit);
    res.json(result);
  } catch (err) {
    console.error('Get job alert matches error:', err);
    sendError(res, err, 'Lỗi khi tải việc phù hợp');
  }
}

module.exports = {
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markNotificationAsRead,
  deleteNotification,
  getJobAlertRules,
  createJobAlert,
  updateJobAlert,
  deleteJobAlert,
  getJobAlertMatches,
};
