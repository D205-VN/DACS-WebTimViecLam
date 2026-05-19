const AppError = require('../../core/errors/AppError');
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

async function getOrCreateConversation(applicationId, userId) {
  await messageModel.ensureMessageSchema();

  const conversation = await messageModel.getOrCreateConversationForApplication(applicationId, userId);
  if (!conversation) {
    throw new AppError('Không tìm thấy hồ sơ ứng tuyển để tạo hội thoại', 404, 'CONVERSATION_SOURCE_NOT_FOUND');
  }

  return { data: mapConversation(conversation, userId) };
}

async function listConversations(userId) {
  await messageModel.ensureMessageSchema();
  const conversations = await messageModel.listConversationsForUser(userId);
  return { data: conversations.map((conversation) => mapConversation(conversation, userId)) };
}

async function getMessages(conversationId, userId, limit) {
  await messageModel.ensureMessageSchema();

  const payload = await messageModel.getMessages(conversationId, userId, limit);
  if (!payload) throw new AppError('Không tìm thấy hội thoại', 404, 'CONVERSATION_NOT_FOUND');

  await messageModel.markConversationAsRead(conversationId, userId);

  return {
    conversation: mapConversation(payload.conversation, userId),
    data: payload.messages.map((message) => mapMessage(message, userId)),
  };
}

async function sendMessage(conversationId, user, rawBody) {
  await messageModel.ensureMessageSchema();

  const body = String(rawBody || '').trim();
  if (!body) throw new AppError('Nội dung tin nhắn không được để trống', 400, 'MESSAGE_REQUIRED');
  if (body.length > 2000) throw new AppError('Tin nhắn không được vượt quá 2000 ký tự', 400, 'MESSAGE_TOO_LONG');

  const payload = await messageModel.createMessage(conversationId, user.id, body);
  if (!payload) throw new AppError('Không tìm thấy hội thoại', 404, 'CONVERSATION_NOT_FOUND');

  const { conversation, message } = payload;
  const recipientId = Number(conversation.seeker_id) === Number(user.id)
    ? conversation.employer_id
    : conversation.seeker_id;
  const senderName = (Number(conversation.seeker_id) === Number(user.id)
    ? conversation.seeker_name
    : conversation.employer_name) || 'Người dùng';
  const mappedForSender = mapMessage(message, user.id);
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
    to: Number(conversation.employer_id) === Number(recipientId)
      ? `/employer/messages?conversationId=${conversation.id}`
      : `/seeker/messages?conversationId=${conversation.id}`,
    tab: null,
    meta: {
      conversation_id: conversation.id,
      application_id: conversation.application_id,
      job_id: conversation.job_id,
    },
  }).catch((notificationError) => {
    console.error('Create message notification error:', notificationError);
  });

  return {
    conversation: mapConversation(conversation, user.id),
    data: mappedForSender,
  };
}

async function markAsRead(conversationId, userId) {
  await messageModel.ensureMessageSchema();

  const updated = await messageModel.markConversationAsRead(conversationId, userId);
  if (updated === null) throw new AppError('Không tìm thấy hội thoại', 404, 'CONVERSATION_NOT_FOUND');

  return { updated };
}

module.exports = {
  getMessages,
  getOrCreateConversation,
  listConversations,
  markAsRead,
  sendMessage,
};
