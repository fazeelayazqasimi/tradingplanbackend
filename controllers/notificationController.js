const Notification = require('../models/Notification');
const { sendSuccess, sendError } = require('../utils/response');

exports.getMyNotifications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const filter = { userId: req.user._id };
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, isRead: false }),
    ]);
    sendSuccess(res, {
      notifications,
      total,
      unreadCount,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) { next(error); }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { isRead: true },
      { new: true }
    );
    if (!notification) return sendError(res, 'Notification not found', 404);
    sendSuccess(res, notification, 'Notification marked as read');
  } catch (error) { next(error); }
};

exports.markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { isRead: true }
    );
    sendSuccess(res, null, 'All notifications marked as read');
  } catch (error) { next(error); }
};

exports.getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user._id, isRead: false });
    sendSuccess(res, { count });
  } catch (error) { next(error); }
};

exports.bulkCreate = async (userId, type, title, message, link, relatedId) => {
  return Notification.create({ userId, type, title, message, link, relatedId });
};
