const Announcement = require('../models/Announcement');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');
const { sendAnnouncementEmail, getEmailRecipients } = require('../services/emailService');

const toPublicUrl = (file, folder) => {
  const p = file && file.path;
  if (p && /^https?:\/\//.test(p)) return p;
  return `/uploads/${folder}/${file.filename}`;
};

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

exports.uploadImage = async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 'No image uploaded', 400);
    const url = toPublicUrl(req.file, 'media');
    sendSuccess(res, { url }, 'Image uploaded', 201);
  } catch (error) { next(error); }
};

exports.uploadPdf = async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 'No document uploaded', 400);
    const url = toPublicUrl(req.file, 'media');
    sendSuccess(res, {
      url,
      fileName: req.file.originalname,
      fileSize: req.file.size || 0
    }, 'Document uploaded', 201);
  } catch (error) { next(error); }
};

exports.uploadVideo = async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 'No video uploaded', 400);
    const url = toPublicUrl(req.file, 'videos');
    sendSuccess(res, { url }, 'Video uploaded', 201);
  } catch (error) { next(error); }
};

exports.createAnnouncement = async (req, res, next) => {
  try {
    const announcement = await Announcement.create({ ...req.body, authorId: req.user._id });
    if (announcement.isPublished) {
      try {
        const students = await getEmailRecipients();
        if (students.length > 0) {
          const result = await sendAnnouncementEmail(students, announcement);
          if (result?.total) {
            await Announcement.findByIdAndUpdate(announcement._id, { $inc: { emailSentCount: result.total } });
          }
        }
      } catch (e) { console.error('[EMAIL] sendAnnouncementEmail:', e.message); }
    }
    sendSuccess(res, announcement, 'Created', 201);
  } catch (error) { next(error); }
};

exports.updateAnnouncement = async (req, res, next) => {
  try {
    const oldAnnouncement = await Announcement.findById(req.params.id);
    const wasPublished = oldAnnouncement?.isPublished;
    console.log('[DEBUG UPDATE] old isPublished:', wasPublished, 'new body isPublished:', req.body.isPublished);
    const announcement = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!announcement) return sendError(res, 'Not found', 404);
    console.log('[DEBUG UPDATE] after update isPublished:', announcement.isPublished, 'shouldSend:', announcement.isPublished && !wasPublished);
    if (announcement.isPublished && !wasPublished) {
      try {
        const students = await getEmailRecipients();
        console.log('[DEBUG UPDATE] recipients:', students.length);
        if (students.length > 0) {
          const result = await sendAnnouncementEmail(students, announcement);
          if (result?.total) {
            await Announcement.findByIdAndUpdate(announcement._id, { $inc: { emailSentCount: result.total } });
          }
        }
      } catch (e) { console.error('[EMAIL] sendAnnouncementEmail:', e.message); }
    }
    sendSuccess(res, announcement, 'Updated');
  } catch (error) { next(error); }
};

exports.deleteAnnouncement = async (req, res, next) => {
  try {
    await Announcement.findByIdAndDelete(req.params.id);
    sendSuccess(res, null, 'Deleted');
  } catch (error) { next(error); }
};
