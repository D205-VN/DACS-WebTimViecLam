const { emitToUser } = require('../../core/realtime/socket');
const notificationModel = require('./notification.model');
const jobAlertModel = require('./jobAlert.model');

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
  getUserJobAlertRules: jobAlertModel.getUserJobAlertRules,
  createJobAlertRule: jobAlertModel.createJobAlertRule,
  updateJobAlertRule: jobAlertModel.updateJobAlertRule,
  deleteJobAlertRule: jobAlertModel.deleteJobAlertRule,
  findJobsForAlert: jobAlertModel.findJobsForAlert,
};
