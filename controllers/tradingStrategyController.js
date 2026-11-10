const TradingStrategy = require('../models/TradingStrategy');
const { sendSuccess, sendError } = require('../helpers/response');

const toPublicUrl = (file, folder) => {
  const p = file && file.path;
  if (p && /^https?:\/\//.test(p)) return p;
  if (p && p.startsWith('/uploads')) return p;
  return `/uploads/${folder}/${file.filename}`;
};

exports.getStrategies = async (req, res, next) => {
  try {
    const strategies = await TradingStrategy.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1 });
    sendSuccess(res, strategies, 'Strategies fetched');
  } catch (error) {
    next(error);
  }
};

exports.getAllStrategies = async (req, res, next) => {
  try {
    const strategies = await TradingStrategy.find({}).sort({ sortOrder: 1, createdAt: 1 });
    sendSuccess(res, strategies, 'Strategies fetched');
  } catch (error) {
    next(error);
  }
};

exports.createStrategy = async (req, res, next) => {
  try {
    const { name, tag, imageUrl, minAmount, maxAmount, sortOrder, isActive } = req.body;
    const strategy = await TradingStrategy.create({
      name,
      tag,
      imageUrl,
      minAmount,
      maxAmount,
      sortOrder,
      isActive,
    });
    sendSuccess(res, strategy, 'Strategy created', 201);
  } catch (error) {
    next(error);
  }
};

exports.updateStrategy = async (req, res, next) => {
  try {
    const strategy = await TradingStrategy.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!strategy) return sendError(res, 'Strategy not found', 404);
    sendSuccess(res, strategy, 'Strategy updated');
  } catch (error) {
    next(error);
  }
};

exports.deleteStrategy = async (req, res, next) => {
  try {
    const strategy = await TradingStrategy.findByIdAndDelete(req.params.id);
    if (!strategy) return sendError(res, 'Strategy not found', 404);
    sendSuccess(res, null, 'Strategy deleted');
  } catch (error) {
    next(error);
  }
};

exports.uploadImage = async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 'No image uploaded', 400);
    const url = toPublicUrl(req.file, 'media');
    sendSuccess(res, { url }, 'Image uploaded', 201);
  } catch (error) {
    next(error);
  }
};
