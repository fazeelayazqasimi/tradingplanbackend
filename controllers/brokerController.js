const TradingBroker = require('../models/TradingBroker');
const TradingAccount = require('../models/TradingAccount');
const { sendSuccess, sendError } = require('../helpers/response');

const getFileUrl = (file) => {
  if (!file) return null;
  if (file.secure_url) return file.secure_url;
  if (file.path && /^https?:\/\//.test(file.path)) return file.path;
  return `/uploads/media/${file.filename}`;
};

exports.uploadBrokerLogo = async (req, res, next) => {
  try {
    const broker = await TradingBroker.findById(req.params.id);
    if (!broker) return sendError(res, 'Broker not found', 404);
    if (!req.file) return sendError(res, 'No logo file uploaded', 400);
    broker.logo = getFileUrl(req.file);
    await broker.save();
    sendSuccess(res, broker, 'Broker logo uploaded');
  } catch (error) { next(error); }
};

exports.getBrokers = async (req, res, next) => {
  try {
    const brokers = await TradingBroker.find({ isActive: true }).sort({ order: 1 });
    const result = [];
    for (const broker of brokers) {
      const accounts = await TradingAccount.find({ brokerId: broker._id, isActive: true }).sort({ order: 1 });
      result.push({ ...broker.toObject(), accounts });
    }
    sendSuccess(res, result);
  } catch (error) { next(error); }
};

exports.getAllBrokers = async (req, res, next) => {
  try {
    const brokers = await TradingBroker.find().sort({ order: 1 });
    const result = [];
    for (const broker of brokers) {
      const accounts = await TradingAccount.find({ brokerId: broker._id }).sort({ order: 1 });
      result.push({ ...broker.toObject(), accounts });
    }
    sendSuccess(res, result);
  } catch (error) { next(error); }
};

exports.createBroker = async (req, res, next) => {
  try {
    const broker = await TradingBroker.create({ ...req.body, createdBy: req.user._id });
    sendSuccess(res, broker, 'Broker created', 201);
  } catch (error) {
    if (error.code === 11000) return sendError(res, 'A broker with this name already exists', 400);
    next(error);
  }
};

exports.updateBroker = async (req, res, next) => {
  try {
    const broker = await TradingBroker.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!broker) return sendError(res, 'Broker not found', 404);
    sendSuccess(res, broker, 'Broker updated');
  } catch (error) {
    if (error.code === 11000) return sendError(res, 'A broker with this name already exists', 400);
    next(error);
  }
};

exports.deleteBroker = async (req, res, next) => {
  try {
    const broker = await TradingBroker.findByIdAndDelete(req.params.id);
    if (!broker) return sendError(res, 'Broker not found', 404);
    await TradingAccount.deleteMany({ brokerId: req.params.id });
    sendSuccess(res, null, 'Broker deleted');
  } catch (error) { next(error); }
};

exports.getAccounts = async (req, res, next) => {
  try {
    const filter = { brokerId: req.params.brokerId };
    if (!req.query.all) filter.isActive = true;
    const accounts = await TradingAccount.find(filter).sort({ order: 1 });
    sendSuccess(res, accounts);
  } catch (error) { next(error); }
};

exports.createAccount = async (req, res, next) => {
  try {
    const broker = await TradingBroker.findById(req.params.brokerId);
    if (!broker) return sendError(res, 'Broker not found', 404);
    const account = await TradingAccount.create({ ...req.body, brokerId: req.params.brokerId, createdBy: req.user._id });
    sendSuccess(res, account, 'Account created', 201);
  } catch (error) { next(error); }
};

exports.updateAccount = async (req, res, next) => {
  try {
    const account = await TradingAccount.findByIdAndUpdate(req.params.accountId, req.body, { new: true, runValidators: true });
    if (!account) return sendError(res, 'Account not found', 404);
    sendSuccess(res, account, 'Account updated');
  } catch (error) { next(error); }
};

exports.deleteAccount = async (req, res, next) => {
  try {
    const account = await TradingAccount.findByIdAndDelete(req.params.accountId);
    if (!account) return sendError(res, 'Account not found', 404);
    sendSuccess(res, null, 'Account deleted');
  } catch (error) { next(error); }
};
