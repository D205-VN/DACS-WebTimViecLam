const pool = require('../config/db');
const { emitToUser } = require('../socket');

let notificationsSchemaReady = false;

async function ensureNotificationsSchema() {
  if (notificationsSchemaReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(80) NOT NULL DEFAULT 'info',
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      to_path VARCHAR(255),
      tab VARCHAR(80),
      meta JSONB,
      read_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at
    ON notifications(user_id, created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_notifications_user_read_at
    ON notifications(user_id, read_at)
  `);

  notificationsSchemaReady = true;
}

async function createNotification({ userId, type = 'info', title, message, to = null, tab = null, meta = null }) {
  if (!userId || !title || !message) return null;

  await ensureNotificationsSchema();

  const result = await pool.query(
    `INSERT INTO notifications (user_id, type, title, message, to_path, tab, meta)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, user_id, type, title, message, to_path, tab, meta, read_at, created_at`,
    [userId, type, title, message, to, tab, meta]
  );

  const notification = result.rows[0] || null;
  
  if (notification) {
    // Real-time emit
    emitToUser(userId, 'new_notification', {
      ...notification,
      to: notification.to_path || null,
      read: false
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
  await ensureNotificationsSchema();

  const normalizedLimit = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(Number(limit), 100)) : 20;
  const result = await pool.query(
    `SELECT id, user_id, type, title, message, to_path, tab, meta, read_at, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT $2`,
    [userId, normalizedLimit]
  );

  return result.rows.map((row) => ({
    ...row,
    to: row.to_path || null,
    read: Boolean(row.read_at),
  }));
}

async function getUnreadNotificationCount(userId) {
  await ensureNotificationsSchema();

  const result = await pool.query(
    `SELECT COUNT(*)::int AS unread
     FROM notifications
     WHERE user_id = $1
       AND read_at IS NULL`,
    [userId]
  );

  return result.rows[0]?.unread || 0;
}

async function markAllNotificationsAsRead(userId) {
  await ensureNotificationsSchema();

  const result = await pool.query(
    `UPDATE notifications
     SET read_at = NOW()
     WHERE user_id = $1
       AND read_at IS NULL
     RETURNING id`,
    [userId]
  );

  return result.rowCount || 0;
}

module.exports = {
  ensureNotificationsSchema,
  createNotification,
  createNotificationsForUsers,
  getNotificationsByUser,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
};
