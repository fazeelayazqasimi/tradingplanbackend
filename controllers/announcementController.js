const Announcement = require('../models/Announcement');
const User = require('../models/User');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');
const { sendAnnouncementEmail } = require('../services/emailService');

exports.getAnnouncements = async (req, res, next) => {
  try {
    const { page, limit, sort } = getPaginationOptions(req.query);
    const filter = req.user?.role !== 'admin' ? { isPublished: true } : {};
    const total = await Announcement.countDocuments(filter);
    const announcements = await Announcement.find(filter).sort(sort || { createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('authorId', 'firstName lastName');
    sendPaginated(res, announcements, total, page, limit);
  } catch (error) { next(error); }
};

exports.getAnnouncement = async (req, res, next) => {
  try {
    const announcement = await Announcement.findById(req.params.id).populate('authorId', 'firstName lastName');
    if (!announcement) return sendError(res, 'Not found', 404);
    sendSuccess(res, announcement);
  } catch (error) { next(error); }
};

exports.createAnnouncement = async (req, res, next) => {
  try {
    const announcement = await Announcement.create({ ...req.body, authorId: req.user._id });
    try {
      const students = await User.find({ role: 'student', isActive: true }).select('email firstName');
      if (students.length > 0) sendAnnouncementEmail(students, announcement);
    } catch (e) { console.error('[EMAIL] sendAnnouncementEmail:', e.message); }
    sendSuccess(res, announcement, 'Created', 201);
  } catch (error) { next(error); }
};

exports.updateAnnouncement = async (req, res, next) => {
  try {
    const announcement = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!announcement) return sendError(res, 'Not found', 404);
    sendSuccess(res, announcement, 'Updated');
  } catch (error) { next(error); }
};

exports.deleteAnnouncement = async (req, res, next) => {
  try {
    await Announcement.findByIdAndDelete(req.params.id);
    sendSuccess(res, null, 'Deleted');
  } catch (error) { next(error); }
};
