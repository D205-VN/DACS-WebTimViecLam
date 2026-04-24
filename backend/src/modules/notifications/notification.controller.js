const {
  ensureNotificationsSchema,
  getNotificationsByUser,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
} = require('./notification.service');

async function getNotifications(req, res) {
  try {
    await ensureNotificationsSchema();

    const limit = Number.parseInt(req.query.limit, 10) || 20;
    const notifications = await getNotificationsByUser(req.user.id, limit);

    res.json({ data: notifications });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Lỗi khi tải thông báo' });
  }
}

async function getUnreadCount(req, res) {
  try {
    await ensureNotificationsSchema();

    const unread = await getUnreadNotificationCount(req.user.id);
    res.json({ unread });
  } catch (err) {
    console.error('Get unread notifications count error:', err);
    res.status(500).json({ error: 'Lỗi khi tải số thông báo chưa đọc' });
  }
}

async function markAllAsRead(req, res) {
  try {
    await ensureNotificationsSchema();

    const updated = await markAllNotificationsAsRead(req.user.id);
    res.json({ message: 'Đã đánh dấu thông báo đã xem', updated });
  } catch (err) {
    console.error('Mark notifications as read error:', err);
    res.status(500).json({ error: 'Lỗi khi cập nhật trạng thái thông báo' });
  }
}

module.exports = {
  getNotifications,
  getUnreadCount,
  markAllAsRead,
};
