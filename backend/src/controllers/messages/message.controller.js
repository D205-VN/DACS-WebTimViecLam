const messageService = require('../services/message.service');

function sendControllerError(res, err, fallbackMessage, logLabel) {
  if (err?.isOperational) {
    return res.status(err.status || 400).json({ error: err.message, code: err.code });
  }

  console.error(logLabel, err);
  return res.status(500).json({ error: fallbackMessage });
}

async function getOrCreateConversation(req, res) {
  try {
    res.status(201).json(await messageService.getOrCreateConversation(req.params.applicationId, req.user.id));
  } catch (err) {
    sendControllerError(res, err, 'Lỗi khi tạo hội thoại', 'Get/create conversation error:');
  }
}

async function listConversations(req, res) {
  try {
    res.json(await messageService.listConversations(req.user.id));
  } catch (err) {
    sendControllerError(res, err, 'Lỗi khi tải danh sách hội thoại', 'List conversations error:');
  }
}

async function getMessages(req, res) {
  try {
    res.json(await messageService.getMessages(req.params.id, req.user.id, req.query.limit));
  } catch (err) {
    sendControllerError(res, err, 'Lỗi khi tải tin nhắn', 'Get messages error:');
  }
}

async function sendMessage(req, res) {
  try {
    res.status(201).json(await messageService.sendMessage(req.params.id, req.user, req.body?.body));
  } catch (err) {
    sendControllerError(res, err, 'Lỗi khi gửi tin nhắn', 'Send message error:');
  }
}

async function markAsRead(req, res) {
  try {
    res.json(await messageService.markAsRead(req.params.id, req.user.id));
  } catch (err) {
    sendControllerError(res, err, 'Lỗi khi đánh dấu đã đọc', 'Mark conversation as read error:');
  }
}

module.exports = {
  getOrCreateConversation,
  listConversations,
  getMessages,
  sendMessage,
  markAsRead,
};
