const Media = require('../models/Media');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, sort } = getPaginationOptions(req.query);
    const filter = {};
    if (req.query.isPublished !== undefined) filter.isPublished = req.query.isPublished === 'true';
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
    const items = await Media.find({ isPublished: true }).sort({ createdAt: -1 }).limit(50);
    sendSuccess(res, items);
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const { title } = req.body;
    if (!title) return sendError(res, 'Title is required', 400);
    const imagePaths = (req.files || []).map(f => f.path.replace(/\\/g, '/'));
    if (imagePaths.length === 0) return sendError(res, 'At least one image is required', 400);
    const media = await Media.create({
      title,
      images: imagePaths,
      uploadedBy: req.user._id,
    });
    sendSuccess(res, media, 'Media created', 201);
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) return sendError(res, 'Media not found', 404);
    if (req.body.title) media.title = req.body.title;
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(f => f.path.replace(/\\/g, '/'));
      media.images = media.images.concat(newImages);
    }
    if (req.body.removeImages) {
      const remove = JSON.parse(req.body.removeImages);
      media.images = media.images.filter(img => !remove.includes(img));
    }
    await media.save();
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
