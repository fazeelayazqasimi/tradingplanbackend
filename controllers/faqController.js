const FAQ = require('../models/FAQ');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');

exports.getPublicFAQs = async (req, res, next) => {
  try {
    const { category } = req.query;
    const filter = { isActive: true };
    if (category) filter.category = category;
    const faqs = await FAQ.find(filter).sort({ order: 1, createdAt: -1 });
    sendSuccess(res, faqs);
  } catch (error) { next(error); }
};

exports.getAllFAQs = async (req, res, next) => {
  try {
    const { page, limit, sort } = getPaginationOptions(req.query);
    const total = await FAQ.countDocuments();
    const faqs = await FAQ.find().sort(sort || { order: 1 }).skip((page - 1) * limit).limit(limit);
    sendPaginated(res, faqs, total, page, limit);
  } catch (error) { next(error); }
};

exports.createFAQ = async (req, res, next) => {
  try {
    const faq = await FAQ.create(req.body);
    sendSuccess(res, faq, 'FAQ created', 201);
  } catch (error) { next(error); }
};

exports.updateFAQ = async (req, res, next) => {
  try {
    const faq = await FAQ.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!faq) return sendError(res, 'FAQ not found', 404);
    sendSuccess(res, faq, 'FAQ updated');
  } catch (error) { next(error); }
};

exports.deleteFAQ = async (req, res, next) => {
  try {
    const faq = await FAQ.findByIdAndDelete(req.params.id);
    if (!faq) return sendError(res, 'FAQ not found', 404);
    sendSuccess(res, null, 'FAQ deleted');
  } catch (error) { next(error); }
};

exports.toggleFAQ = async (req, res, next) => {
  try {
    const faq = await FAQ.findById(req.params.id);
    if (!faq) return sendError(res, 'FAQ not found', 404);
    faq.isActive = !faq.isActive;
    await faq.save();
    sendSuccess(res, faq, 'FAQ toggled');
  } catch (error) { next(error); }
};
