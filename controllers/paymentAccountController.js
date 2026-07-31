const PaymentAccount = require('../models/PaymentAccount');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');

exports.getAccounts = async (req, res, next) => {
  try {
    const filter = {};
    if (req.user.role !== 'admin') filter.isActive = true;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    const accounts = await PaymentAccount.find(filter).sort({ order: 1, createdAt: -1 });
    sendSuccess(res, accounts);
  } catch (error) { next(error); }
};

exports.getAccount = async (req, res, next) => {
  try {
    const account = await PaymentAccount.findById(req.params.id);
    if (!account) return sendError(res, 'Payment account not found', 404);
    sendSuccess(res, account);
  } catch (error) { next(error); }
};

exports.createAccount = async (req, res, next) => {
  try {
    const account = await PaymentAccount.create(req.body);
    sendSuccess(res, account, 'Payment account created', 201);
  } catch (error) { next(error); }
};

exports.updateAccount = async (req, res, next) => {
  try {
    const account = await PaymentAccount.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!account) return sendError(res, 'Payment account not found', 404);
    sendSuccess(res, account, 'Payment account updated');
  } catch (error) { next(error); }
};

exports.uploadQr = async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 'QR image file is required', 400);
    sendSuccess(res, { url: `/uploads/media/${req.file.filename}` }, 'QR code uploaded', 201);
  } catch (error) { next(error); }
};

exports.deleteAccount = async (req, res, next) => {
  try {
    const account = await PaymentAccount.findByIdAndDelete(req.params.id);
    if (!account) return sendError(res, 'Payment account not found', 404);
    sendSuccess(res, null, 'Payment account deleted');
  } catch (error) { next(error); }
};
