const PaymentAccount = require('../models/PaymentAccount');
const QRCode = require('qrcode');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');

const toAccountJson = async (account) => {
  const json = account.toObject ? account.toObject() : account;
  if (json.paymentType === 'crypto' && json.walletAddress && !json.qrCodeUrl) {
    try {
      json.qrDataUrl = await QRCode.toDataURL(json.walletAddress, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 256
      });
    } catch (e) {
      json.qrDataUrl = null;
    }
  }
  return json;
};

exports.getAccounts = async (req, res, next) => {
  try {
    const filter = {};
    if (req.user.role !== 'admin') filter.isActive = true;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    const accounts = await PaymentAccount.find(filter).sort({ order: 1, createdAt: -1 });
    const result = await Promise.all(accounts.map(toAccountJson));
    sendSuccess(res, result);
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
    const account = await PaymentAccount.findById(req.params.id);
    if (!account) return sendError(res, 'Payment account not found', 404);
    Object.assign(account, req.body);
    await account.save();
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
