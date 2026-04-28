const pool = require('../../infrastructure/database/postgres');
const { ensurePublicApplicationSchema } = require('../jobs/job.model');

let messageSchemaReady = false;

async function ensureMessageSchema() {
  if (messageSchemaReady) return;

  await ensurePublicApplicationSchema();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS message_conversations (
      id SERIAL PRIMARY KEY,
      application_id INTEGER NOT NULL REFERENCES applied_jobs(id) ON DELETE CASCADE,
      seeker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      employer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(application_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversation_messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES message_conversations(id) ON DELETE CASCADE,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      read_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_message_conversations_seeker
    ON message_conversations(seeker_id, updated_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_message_conversations_employer
    ON message_conversations(employer_id, updated_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation
    ON conversation_messages(conversation_id, created_at ASC, id ASC)
  `);

  messageSchemaReady = true;
}

async function getApplicationAccess(applicationId, userId) {
  await ensureMessageSchema();

  const result = await pool.query(
    `SELECT
        aj.id AS application_id,
        aj.user_id AS seeker_id,
        j.employer_id,
        aj.job_id,
        j.job_title,
        j.company_name,
        seeker.full_name AS seeker_name,
        seeker.email AS seeker_email,
        seeker.avatar_url AS seeker_avatar_url,
        employer.full_name AS employer_name,
        employer.email AS employer_email,
        employer.avatar_url AS employer_avatar_url
     FROM applied_jobs aj
     JOIN jobs j ON j.id = aj.job_id
     JOIN users seeker ON seeker.id = aj.user_id
     LEFT JOIN users employer ON employer.id = j.employer_id
     WHERE aj.id = $1
       AND (aj.user_id = $2 OR j.employer_id = $2)`,
    [applicationId, userId]
  );

  return result.rows[0] || null;
}

async function getOrCreateConversationForApplication(applicationId, userId) {
  const access = await getApplicationAccess(applicationId, userId);
  if (!access || !access.employer_id) return null;

  const result = await pool.query(
    `INSERT INTO message_conversations (application_id, seeker_id, employer_id, job_id, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (application_id)
     DO UPDATE SET updated_at = message_conversations.updated_at
     RETURNING id, application_id, seeker_id, employer_id, job_id, created_at, updated_at`,
    [access.application_id, access.seeker_id, access.employer_id, access.job_id]
  );

  return {
    ...result.rows[0],
    job_title: access.job_title,
    company_name: access.company_name,
    seeker_name: access.seeker_name,
    seeker_email: access.seeker_email,
    seeker_avatar_url: access.seeker_avatar_url,
    employer_name: access.employer_name,
    employer_email: access.employer_email,
    employer_avatar_url: access.employer_avatar_url,
  };
}

async function getConversationAccess(conversationId, userId) {
  await ensureMessageSchema();

  const result = await pool.query(
    `SELECT
        c.id,
        c.application_id,
        c.seeker_id,
        c.employer_id,
        c.job_id,
        c.created_at,
        c.updated_at,
        j.job_title,
        j.company_name,
        seeker.full_name AS seeker_name,
        seeker.email AS seeker_email,
        seeker.avatar_url AS seeker_avatar_url,
        employer.full_name AS employer_name,
        employer.email AS employer_email,
        employer.avatar_url AS employer_avatar_url
     FROM message_conversations c
     JOIN jobs j ON j.id = c.job_id
     JOIN users seeker ON seeker.id = c.seeker_id
     LEFT JOIN users employer ON employer.id = c.employer_id
     WHERE c.id = $1
       AND (c.seeker_id = $2 OR c.employer_id = $2)`,
    [conversationId, userId]
  );

  return result.rows[0] || null;
}

async function listConversationsForUser(userId) {
  await ensureMessageSchema();

  const result = await pool.query(
    `SELECT
        c.id,
        c.application_id,
        c.seeker_id,
        c.employer_id,
        c.job_id,
        c.created_at,
        c.updated_at,
        j.job_title,
        j.company_name,
        seeker.full_name AS seeker_name,
        seeker.email AS seeker_email,
        seeker.avatar_url AS seeker_avatar_url,
        employer.full_name AS employer_name,
        employer.email AS employer_email,
        employer.avatar_url AS employer_avatar_url,
        last_message.body AS last_message,
        last_message.created_at AS last_message_at,
        last_message.sender_id AS last_sender_id,
        COALESCE(unread.unread_count, 0)::int AS unread_count
     FROM message_conversations c
     JOIN jobs j ON j.id = c.job_id
     JOIN users seeker ON seeker.id = c.seeker_id
     LEFT JOIN users employer ON employer.id = c.employer_id
     LEFT JOIN LATERAL (
       SELECT body, created_at, sender_id
       FROM conversation_messages cm
       WHERE cm.conversation_id = c.id
       ORDER BY cm.created_at DESC, cm.id DESC
       LIMIT 1
     ) last_message ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS unread_count
       FROM conversation_messages cm
       WHERE cm.conversation_id = c.id
         AND cm.sender_id <> $1
         AND cm.read_at IS NULL
     ) unread ON TRUE
     WHERE c.seeker_id = $1 OR c.employer_id = $1
     ORDER BY COALESCE(last_message.created_at, c.updated_at) DESC, c.id DESC`,
    [userId]
  );

  return result.rows;
}

async function getMessages(conversationId, userId, limit = 100) {
  const access = await getConversationAccess(conversationId, userId);
  if (!access) return null;

  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 100, 200));
  const result = await pool.query(
    `SELECT
        cm.id,
        cm.conversation_id,
        cm.sender_id,
        cm.body,
        cm.read_at,
        cm.created_at,
        u.full_name AS sender_name,
        u.avatar_url AS sender_avatar_url
     FROM conversation_messages cm
     JOIN users u ON u.id = cm.sender_id
     WHERE cm.conversation_id = $1
     ORDER BY cm.created_at DESC, cm.id DESC
     LIMIT $2`,
    [conversationId, normalizedLimit]
  );

  return {
    conversation: access,
    messages: result.rows.reverse(),
  };
}

async function createMessage(conversationId, senderId, body) {
  const access = await getConversationAccess(conversationId, senderId);
  if (!access) return null;

  const result = await pool.query(
    `INSERT INTO conversation_messages (conversation_id, sender_id, body)
     VALUES ($1, $2, $3)
     RETURNING id, conversation_id, sender_id, body, read_at, created_at`,
    [conversationId, senderId, body]
  );

  await pool.query(
    `UPDATE message_conversations
     SET updated_at = NOW()
     WHERE id = $1`,
    [conversationId]
  );

  return {
    conversation: access,
    message: result.rows[0],
  };
}

async function markConversationAsRead(conversationId, userId) {
  const access = await getConversationAccess(conversationId, userId);
  if (!access) return null;

  const result = await pool.query(
    `UPDATE conversation_messages
     SET read_at = NOW()
     WHERE conversation_id = $1
       AND sender_id <> $2
       AND read_at IS NULL
     RETURNING id`,
    [conversationId, userId]
  );

  return result.rowCount || 0;
}

module.exports = {
  ensureMessageSchema,
  getOrCreateConversationForApplication,
  getConversationAccess,
  listConversationsForUser,
  getMessages,
  createMessage,
  markConversationAsRead,
};
