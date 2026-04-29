const {
  ensureNotificationsSchema,
  ensureJobAlertSchema,
  getNotificationsByUser,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  getUserJobAlertRules,
  createJobAlertRule,
  updateJobAlertRule,
  deleteJobAlertRule,
  findJobsForAlert,
} = require('./notification.service');

function requireSeeker(req, res) {
  if (req.user?.role_code !== 'seeker') {
    res.status(403).json({ error: 'Chỉ ứng viên mới có thể quản lý job alerts' });
    return false;
  }

  return true;
}

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

async function getJobAlertRules(req, res) {
  try {
    if (!requireSeeker(req, res)) return;

    await ensureJobAlertSchema();
    const alerts = await getUserJobAlertRules(req.user.id);
    res.json({ data: alerts });
  } catch (err) {
    console.error('Get job alerts error:', err);
    res.status(500).json({ error: 'Lỗi khi tải job alerts' });
  }
}

async function createJobAlert(req, res) {
  try {
    if (!requireSeeker(req, res)) return;

    await ensureJobAlertSchema();
    const alert = await createJobAlertRule(req.user.id, req.body || {});
    const matches = await findJobsForAlert(alert, 3);
    res.status(201).json({
      message: 'Đã tạo job alert',
      data: {
        ...alert,
        preview_matches: matches,
        preview_count: matches.length,
      },
    });
  } catch (err) {
    console.error('Create job alert error:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Lỗi khi tạo job alert' });
  }
}

async function updateJobAlert(req, res) {
  try {
    if (!requireSeeker(req, res)) return;

    await ensureJobAlertSchema();
    const alert = await updateJobAlertRule(req.user.id, req.params.id, req.body || {});
    if (!alert) {
      return res.status(404).json({ error: 'Không tìm thấy job alert' });
    }

    const matches = await findJobsForAlert(alert, 3);
    res.json({
      message: 'Đã cập nhật job alert',
      data: {
        ...alert,
        preview_matches: matches,
        preview_count: matches.length,
      },
    });
  } catch (err) {
    console.error('Update job alert error:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Lỗi khi cập nhật job alert' });
  }
}

async function deleteJobAlert(req, res) {
  try {
    if (!requireSeeker(req, res)) return;

    await ensureJobAlertSchema();
    const deleted = await deleteJobAlertRule(req.user.id, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Không tìm thấy job alert' });
    }

    res.json({ message: 'Đã hủy nhận thông báo việc tương tự' });
  } catch (err) {
    console.error('Delete job alert error:', err);
    res.status(500).json({ error: 'Lỗi khi xóa job alert' });
  }
}

async function getJobAlertMatches(req, res) {
  try {
    if (!requireSeeker(req, res)) return;

    await ensureJobAlertSchema();
    const alerts = await getUserJobAlertRules(req.user.id);
    const alert = alerts.find((item) => Number(item.id) === Number(req.params.id));
    if (!alert) {
      return res.status(404).json({ error: 'Không tìm thấy job alert' });
    }

    const limit = Number.parseInt(req.query.limit, 10) || 12;
    const matches = await findJobsForAlert(alert, limit);
    res.json({ data: matches });
  } catch (err) {
    console.error('Get job alert matches error:', err);
    res.status(500).json({ error: 'Lỗi khi tải việc phù hợp' });
  }
}

module.exports = {
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  getJobAlertRules,
  createJobAlert,
  updateJobAlert,
  deleteJobAlert,
  getJobAlertMatches,
};
