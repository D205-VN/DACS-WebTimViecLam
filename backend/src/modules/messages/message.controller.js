const { emitToUser } = require('../../core/realtime/socket');
const { createNotification } = require('../notifications/notification.service');
const messageModel = require('./message.model');

function getOtherParticipant(conversation, userId) {
  const isSeeker = Number(conversation.seeker_id) === Number(userId);

  return {
    id: isSeeker ? conversation.employer_id : conversation.seeker_id,
    name: isSeeker ? conversation.employer_name : conversation.seeker_name,
    email: isSeeker ? conversation.employer_email : conversation.seeker_email,
    avatar_url: isSeeker ? conversation.employer_avatar_url : conversation.seeker_avatar_url,
    role: isSeeker ? 'employer' : 'seeker',
  };
}

function mapConversation(conversation, userId) {
  return {
    id: conversation.id,
    application_id: conversation.application_id,
    job_id: conversation.job_id,
    job_title: conversation.job_title,
    company_name: conversation.company_name,
    seeker_id: conversation.seeker_id,
    employer_id: conversation.employer_id,
    other_user: getOtherParticipant(conversation, userId),
    last_message: conversation.last_message || null,
    last_message_at: conversation.last_message_at || null,
    last_sender_id: conversation.last_sender_id || null,
    unread_count: Number(conversation.unread_count || 0),
    created_at: conversation.created_at,
    updated_at: conversation.updated_at,
  };
}

function mapMessage(message, userId) {
  return {
    ...message,
    mine: Number(message.sender_id) === Number(userId),
  };
}

async function getOrCreateConversation(req, res) {
  try {
    await messageModel.ensureMessageSchema();

    const conversation = await messageModel.getOrCreateConversationForApplication(req.params.applicationId, req.user.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Không tìm thấy hồ sơ ứng tuyển để tạo hội thoại' });
    }

    res.status(201).json({ data: mapConversation(conversation, req.user.id) });
  } catch (err) {
    console.error('Get/create conversation error:', err);
    res.status(500).json({ error: 'Lỗi khi tạo hội thoại' });
  }
}

async function listConversations(req, res) {
  try {
    await messageModel.ensureMessageSchema();

    const conversations = await messageModel.listConversationsForUser(req.user.id);
    res.json({ data: conversations.map((conversation) => mapConversation(conversation, req.user.id)) });
  } catch (err) {
    console.error('List conversations error:', err);
    res.status(500).json({ error: 'Lỗi khi tải danh sách hội thoại' });
  }
}

async function getMessages(req, res) {
  try {
    await messageModel.ensureMessageSchema();

    const payload = await messageModel.getMessages(req.params.id, req.user.id, req.query.limit);
    if (!payload) {
      return res.status(404).json({ error: 'Không tìm thấy hội thoại' });
    }

    await messageModel.markConversationAsRead(req.params.id, req.user.id);

    res.json({
      conversation: mapConversation(payload.conversation, req.user.id),
      data: payload.messages.map((message) => mapMessage(message, req.user.id)),
    });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Lỗi khi tải tin nhắn' });
  }
}

async function sendMessage(req, res) {
  try {
    await messageModel.ensureMessageSchema();

    const body = String(req.body?.body || '').trim();
    if (!body) {
      return res.status(400).json({ error: 'Nội dung tin nhắn không được để trống' });
    }

    if (body.length > 2000) {
      return res.status(400).json({ error: 'Tin nhắn không được vượt quá 2000 ký tự' });
    }

    const payload = await messageModel.createMessage(req.params.id, req.user.id, body);
    if (!payload) {
      return res.status(404).json({ error: 'Không tìm thấy hội thoại' });
    }

    const { conversation, message } = payload;
    const recipientId = Number(conversation.seeker_id) === Number(req.user.id)
      ? conversation.employer_id
      : conversation.seeker_id;
    const senderName = (Number(conversation.seeker_id) === Number(req.user.id)
      ? conversation.seeker_name
      : conversation.employer_name) || 'Người dùng';
    const mappedForSender = mapMessage(message, req.user.id);
    const mappedForRecipient = mapMessage(message, recipientId);
    const conversationForRecipient = mapConversation(conversation, recipientId);

    emitToUser(recipientId, 'new_message', {
      conversation: conversationForRecipient,
      message: mappedForRecipient,
    });

    await createNotification({
      userId: recipientId,
      type: 'message_new',
      title: `Tin nhắn mới từ ${senderName}`,
      message: body.length > 120 ? `${body.slice(0, 117)}...` : body,
      to: Number(conversation.employer_id) === Number(recipientId) ? '/employer/dashboard' : '/seeker/applied-jobs',
      tab: Number(conversation.employer_id) === Number(recipientId) ? 'candidates' : null,
      meta: {
        conversation_id: conversation.id,
        application_id: conversation.application_id,
        job_id: conversation.job_id,
      },
    }).catch((notificationError) => {
      console.error('Create message notification error:', notificationError);
    });

    res.status(201).json({
      conversation: mapConversation(conversation, req.user.id),
      data: mappedForSender,
    });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Lỗi khi gửi tin nhắn' });
  }
}

async function markAsRead(req, res) {
  try {
    await messageModel.ensureMessageSchema();

    const updated = await messageModel.markConversationAsRead(req.params.id, req.user.id);
    if (updated === null) {
      return res.status(404).json({ error: 'Không tìm thấy hội thoại' });
    }

    res.json({ updated });
  } catch (err) {
    console.error('Mark conversation as read error:', err);
    res.status(500).json({ error: 'Lỗi khi đánh dấu đã đọc' });
  }
}

module.exports = {
  getOrCreateConversation,
  listConversations,
  getMessages,
  sendMessage,
  markAsRead,
};
