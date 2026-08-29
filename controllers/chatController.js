const Chat = require('../models/Chat');
const { sendSuccess, sendError } = require('../helpers/response');

const buildAttachment = (file) => {
  if (!file) return null;
  const url = file.path || `/uploads/media/${file.filename}`;
  let type = 'document';
  if (file.mimetype.startsWith('image/')) type = 'image';
  else if (file.mimetype.startsWith('video/')) type = 'video';
  return { url, type, name: file.originalname };
};

const canAccess = (chat, user) => {
  if (user.role === 'admin') return true;
  return chat && String(chat.userId) === String(user._id);
};

exports.getMyChat = async (req, res, next) => {
  try {
    let chat = await Chat.findOneAndUpdate(
      { userId: req.user._id },
      { $setOnInsert: { userId: req.user._id } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    chat = await Chat.findById(chat._id).populate('messages.sender', 'firstName lastName');
    sendSuccess(res, chat);
  } catch (error) { next(error); }
};

exports.getChat = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id)
      .populate('userId', 'firstName lastName email avatar phone')
      .populate('messages.sender', 'firstName lastName');
    if (!chat) return sendError(res, 'Chat not found', 404);
    if (!canAccess(chat, req.user)) return sendError(res, 'Not authorized to access this chat', 403);
    sendSuccess(res, chat);
  } catch (error) { next(error); }
};

exports.listChats = async (req, res, next) => {
  try {
    const chats = await Chat.find({})
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate('userId', 'firstName lastName email avatar phone')
      .populate('messages.sender', 'firstName lastName');
    sendSuccess(res, chats);
  } catch (error) { next(error); }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const message = (req.body.message || '').toString().trim();
    const attachment = buildAttachment(req.file);

    if (!message && !attachment) {
      return sendError(res, 'Message or attachment is required', 400);
    }

    const chat = await Chat.findById(req.params.id);
    if (!chat) return sendError(res, 'Chat not found', 404);
    if (!canAccess(chat, req.user)) return sendError(res, 'Not authorized to access this chat', 403);

    const newMessage = { sender: req.user._id, message };
    if (attachment) newMessage.attachments = [attachment];

    chat.messages.push(newMessage);
    chat.lastMessageAt = new Date();
    await chat.save();

    const updated = await Chat.findById(chat._id)
      .populate('userId', 'firstName lastName email avatar phone')
      .populate('messages.sender', 'firstName lastName');
    sendSuccess(res, updated, 'Message sent', 201);
  } catch (error) { next(error); }
};

exports.markRead = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) return sendError(res, 'Chat not found', 404);
    if (!canAccess(chat, req.user)) return sendError(res, 'Not authorized to access this chat', 403);

    let changed = false;
    chat.messages.forEach((msg) => {
      if (!msg.isRead && String(msg.sender) !== String(req.user._id)) {
        msg.isRead = true;
        msg.readAt = new Date();
        changed = true;
      }
    });

    if (changed) {
      chat.markModified('messages');
      await chat.save();
    }
    sendSuccess(res, chat);
  } catch (error) { next(error); }
};

exports.getUnreadCount = async (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      const chats = await Chat.find({}).select('messages userId');
      const total = chats.reduce((sum, chat) => {
        return sum + chat.messages.filter(m => !m.isRead && String(m.sender) !== String(chat.userId)).length;
      }, 0);
      return sendSuccess(res, { count: total });
    }

    const chat = await Chat.findOne({ userId: req.user._id }).select('messages userId');
    const count = chat
      ? chat.messages.filter(m => !m.isRead && String(m.sender) !== String(req.user._id)).length
      : 0;
    sendSuccess(res, { count });
  } catch (error) { next(error); }
};
