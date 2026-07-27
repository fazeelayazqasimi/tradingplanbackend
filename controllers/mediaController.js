const Media = require('../models/Media');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, sort } = getPaginationOptions(req.query);
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.isPublished !== undefined) filter.isPublished = req.query.isPublished === 'true';
    if (req.query.tag) filter.tags = req.query.tag;
    const total = await Media.countDocuments(filter);
    const items = await Media.find(filter)
      .populate('uploadedBy', 'firstName lastName')
      .sort(sort || { createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    sendPaginated(res, items, total, page, limit);
  } catch (error) { next(error); }
};

exports.getPublished = async (req, res, next) => {
  try {
    const filter = { isPublished: true };
    if (req.query.type) filter.type = req.query.type;
    const items = await Media.find(filter).sort({ createdAt: -1 }).limit(50);
    sendSuccess(res, items);
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const { type, title, description, url, tags, thumbnailUrl } = req.body;
    const media = await Media.create({
      type, title, description, url, tags, thumbnailUrl,
      uploadedBy: req.user._id,
    });
    sendSuccess(res, media, 'Media created', 201);
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const media = await Media.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!media) return sendError(res, 'Media not found', 404);
    sendSuccess(res, media, 'Media updated');
  } catch (error) { next(error); }
};

exports.remove = async (req, res, next) => {
  try {
    const media = await Media.findByIdAndDelete(req.params.id);
    if (!media) return sendError(res, 'Media not found', 404);
    sendSuccess(res, null, 'Media deleted');
  } catch (error) { next(error); }
};
