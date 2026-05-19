const { emitToUser } = require('../../core/realtime/socket');
const AppError = require('../../core/errors/AppError');
const notificationModel = require('./notification.model');
const jobAlertModel = require('./jobAlert.model');

function assertSeeker(user) {
  if (user?.role_code !== 'seeker') {
    throw new AppError('Chỉ ứng viên mới có thể quản lý job alerts', 403);
  }
}

async function createNotification({ userId, type = 'info', title, message, to = null, tab = null, meta = null }) {
  if (!userId || !title || !message) return null;

  const notification = await notificationModel.createNotification({
    userId,
    type,
    title,
    message,
    to,
    tab,
    meta,
  });

  if (notification) {
    emitToUser(userId, 'new_notification', {
      ...notification,
      to: notification.to_path || null,
      read: false,
    });
  }

  return notification;
}

async function createNotificationsForUsers(userIds, payload) {
  const uniqueUserIds = [...new Set((userIds || []).map(Number).filter(Boolean))];
  if (!uniqueUserIds.length) return [];

  const created = await Promise.all(
    uniqueUserIds.map((userId) => createNotification({ userId, ...payload }))
  );

  return created.filter(Boolean);
}

async function getNotificationsByUser(userId, limit = 20) {
  return notificationModel.getNotificationsByUser(userId, limit);
}

async function getUnreadNotificationCount(userId) {
  return notificationModel.getUnreadNotificationCount(userId);
}

async function markAllNotificationsAsRead(userId) {
  return notificationModel.markAllNotificationsAsRead(userId);
}

async function markNotificationAsRead(userId, notificationId) {
  return notificationModel.markNotificationAsRead(userId, notificationId);
}

async function deleteNotificationByUser(userId, notificationId) {
  return notificationModel.deleteNotificationByUser(userId, notificationId);
}

async function listNotificationsForUser(userId, limit = 20) {
  await notificationModel.ensureNotificationsSchema();

  const normalizedLimit = Number.parseInt(limit, 10) || 20;
  const [notifications, unread] = await Promise.all([
    getNotificationsByUser(userId, normalizedLimit),
    getUnreadNotificationCount(userId),
  ]);

  return { data: notifications, unread };
}

async function getUnreadCountForUser(userId) {
  await notificationModel.ensureNotificationsSchema();

  const unread = await getUnreadNotificationCount(userId);
  return { unread };
}

async function markAllAsReadForUser(userId) {
  await notificationModel.ensureNotificationsSchema();

  const updated = await markAllNotificationsAsRead(userId);
  return { message: 'Đã đánh dấu thông báo đã xem', updated };
}

async function markOneAsReadForUser(userId, notificationId) {
  await notificationModel.ensureNotificationsSchema();

  const updated = await markNotificationAsRead(userId, notificationId);
  if (!updated) {
    throw new AppError('Không tìm thấy thông báo', 404);
  }

  return { message: 'Đã đánh dấu thông báo đã đọc' };
}

async function deleteNotificationForUser(userId, notificationId) {
  await notificationModel.ensureNotificationsSchema();

  const deleted = await deleteNotificationByUser(userId, notificationId);
  if (!deleted) {
    throw new AppError('Không tìm thấy thông báo', 404);
  }

  return { message: 'Đã xóa thông báo' };
}

async function listJobAlertRulesForUser(user) {
  assertSeeker(user);

  await jobAlertModel.ensureJobAlertSchema();
  const alerts = await jobAlertModel.getUserJobAlertRules(user.id);
  return { data: alerts };
}

async function createJobAlertForUser(user, payload = {}) {
  assertSeeker(user);

  await jobAlertModel.ensureJobAlertSchema();
  const alert = await jobAlertModel.createJobAlertRule(user.id, payload);
  const matches = await jobAlertModel.findJobsForAlert(alert, 3);

  return {
    message: 'Đã tạo job alert',
    data: {
      ...alert,
      preview_matches: matches,
      preview_count: matches.length,
    },
  };
}

async function updateJobAlertForUser(user, alertId, payload = {}) {
  assertSeeker(user);

  await jobAlertModel.ensureJobAlertSchema();
  const alert = await jobAlertModel.updateJobAlertRule(user.id, alertId, payload);
  if (!alert) {
    throw new AppError('Không tìm thấy job alert', 404);
  }

  const matches = await jobAlertModel.findJobsForAlert(alert, 3);
  return {
    message: 'Đã cập nhật job alert',
    data: {
      ...alert,
      preview_matches: matches,
      preview_count: matches.length,
    },
  };
}

async function deleteJobAlertForUser(user, alertId) {
  assertSeeker(user);

  await jobAlertModel.ensureJobAlertSchema();
  const deleted = await jobAlertModel.deleteJobAlertRule(user.id, alertId);
  if (!deleted) {
    throw new AppError('Không tìm thấy job alert', 404);
  }

  return { message: 'Đã hủy nhận thông báo việc tương tự' };
}

async function listJobAlertMatchesForUser(user, alertId, limit = 12) {
  assertSeeker(user);

  await jobAlertModel.ensureJobAlertSchema();
  const alerts = await jobAlertModel.getUserJobAlertRules(user.id);
  const alert = alerts.find((item) => Number(item.id) === Number(alertId));
  if (!alert) {
    throw new AppError('Không tìm thấy job alert', 404);
  }

  const normalizedLimit = Number.parseInt(limit, 10) || 12;
  const matches = await jobAlertModel.findJobsForAlert(alert, normalizedLimit);
  return { data: matches };
}

module.exports = {
  ensureNotificationsSchema: notificationModel.ensureNotificationsSchema,
  ensureJobAlertSchema: jobAlertModel.ensureJobAlertSchema,
  createNotification,
  createNotificationsForUsers,
  getNotificationsByUser,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  deleteNotificationByUser,
  listNotificationsForUser,
  getUnreadCountForUser,
  markAllAsReadForUser,
  markOneAsReadForUser,
  deleteNotificationForUser,
  listJobAlertRulesForUser,
  createJobAlertForUser,
  updateJobAlertForUser,
  deleteJobAlertForUser,
  listJobAlertMatchesForUser,
  getUserJobAlertRules: jobAlertModel.getUserJobAlertRules,
  createJobAlertRule: jobAlertModel.createJobAlertRule,
  updateJobAlertRule: jobAlertModel.updateJobAlertRule,
  deleteJobAlertRule: jobAlertModel.deleteJobAlertRule,
  findJobsForAlert: jobAlertModel.findJobsForAlert,
};
