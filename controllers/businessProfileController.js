const BusinessProfile = require('../models/BusinessProfile');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');

exports.getPublished = async (req, res, next) => {
  try {
    const profiles = await BusinessProfile.find({ isPublished: true })
      .sort({ order: 1, createdAt: -1 })
      .lean();
    sendSuccess(res, profiles);
  } catch (error) { next(error); }
};

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, sort } = getPaginationOptions(req.query);
    const total = await BusinessProfile.countDocuments();
    const profiles = await BusinessProfile.find()
      .sort(sort || { order: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('createdBy', 'firstName lastName');
    sendPaginated(res, profiles, total, page, limit);
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const profile = await BusinessProfile.create({ ...req.body, createdBy: req.user._id });
    sendSuccess(res, profile, 'Created', 201);
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const profile = await BusinessProfile.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!profile) return sendError(res, 'Not found', 404);
    sendSuccess(res, profile, 'Updated');
  } catch (error) { next(error); }
};

exports.remove = async (req, res, next) => {
  try {
    const profile = await BusinessProfile.findByIdAndDelete(req.params.id);
    if (!profile) return sendError(res, 'Not found', 404);
    sendSuccess(res, null, 'Deleted');
  } catch (error) { next(error); }
};

exports.uploadFile = async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 'No file uploaded', 400);
    const url = req.file.path || `/uploads/media/${req.file.filename}`;
    sendSuccess(res, {
      url,
      fileName: req.file.originalname,
      fileSize: req.file.size || 0,
    }, 'File uploaded', 201);
  } catch (error) { next(error); }
};
