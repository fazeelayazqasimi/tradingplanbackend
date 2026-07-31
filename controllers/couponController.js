const crypto = require('crypto');
const Coupon = require('../models/Coupon');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');

exports.getCoupons = async (req, res, next) => {
  try {
    const { page, limit, sort } = getPaginationOptions(req.query);
    const filter = {};
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    if (req.query.type) filter.type = req.query.type;
    if (req.query.search) {
      filter.$or = [
        { code: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    const total = await Coupon.countDocuments(filter);
    const coupons = await Coupon.find(filter)
      .sort(sort || { createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    sendPaginated(res, coupons, total, page, limit);
  } catch (error) { next(error); }
};

exports.getCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return sendError(res, 'Coupon not found', 404);
    sendSuccess(res, coupon);
  } catch (error) { next(error); }
};

exports.createCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.create({ ...req.body, createdBy: req.user._id });
    sendSuccess(res, coupon, 'Coupon created', 201);
  } catch (error) {
    if (error.code === 11000) {
      return sendError(res, 'A coupon with this code already exists', 400);
    }
    next(error);
  }
};

exports.updateCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!coupon) return sendError(res, 'Coupon not found', 404);
    sendSuccess(res, coupon, 'Coupon updated');
  } catch (error) {
    if (error.code === 11000) {
      return sendError(res, 'A coupon with this code already exists', 400);
    }
    next(error);
  }
};

exports.deleteCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return sendError(res, 'Coupon not found', 404);
    sendSuccess(res, null, 'Coupon deleted');
  } catch (error) { next(error); }
};

const generateCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();

exports.generateCoupons = async (req, res, next) => {
  try {
    const { count, commission, value, description } = req.body;
    const num = Math.min(Math.max(parseInt(count) || 1, 1), 10);
    const couponValue = Math.max(parseFloat(value) || 0, 0);

    const codes = [];
    for (let i = 0; i < num; i++) {
      const code = generateCode();
      const coupon = await Coupon.create({
        code,
        type: 'pin',
        value: couponValue,
        noCommission: commission === false,
        description: description || (commission === false ? 'No commission PIN' : 'With commission PIN'),
        isActive: true,
        usageLimit: 1,
        createdBy: req.user._id
      });
      codes.push(coupon);
    }
    sendSuccess(res, codes, `${num} coupon(s) generated`, 201);
  } catch (error) { next(error); }
};

exports.validateCoupon = async (req, res, next) => {
  try {
    const { code, amount } = req.body;
    if (!code) return sendError(res, 'Coupon code is required', 400);
    if (!amount || amount <= 0) return sendError(res, 'Valid amount is required', 400);

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (!coupon) return sendError(res, 'Invalid coupon code', 404);

    const validation = await coupon.isValid(req.user._id, amount);
    if (!validation.valid) return sendError(res, validation.reason, 400);

    const discount = coupon.calculateDiscount(amount);
    sendSuccess(res, {
      coupon: {
        _id: coupon._id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        description: coupon.description,
      },
      originalAmount: amount,
      discount,
      finalAmount: Math.max(0, amount - discount),
    }, 'Coupon is valid');
  } catch (error) { next(error); }
};

exports.applyCoupon = async (req, res, next) => {
  try {
    const { code, purchaseAmount } = req.body;
    if (!code) return sendError(res, 'Coupon code is required', 400);

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (!coupon) return sendError(res, 'Invalid coupon code', 404);

    const amount = purchaseAmount || 0;
    const validation = await coupon.isValid(req.user._id, amount);
    if (!validation.valid) return sendError(res, validation.reason, 400);

    coupon.usedCount += 1;
    coupon.usedBy.push(req.user._id);
    await coupon.save();

    sendSuccess(res, { coupon: { _id: coupon._id, code: coupon.code } }, 'Coupon applied');
  } catch (error) { next(error); }
};
