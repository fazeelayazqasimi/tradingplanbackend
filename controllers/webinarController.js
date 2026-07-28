const Webinar = require('../models/Webinar');
const User = require('../models/User');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');

exports.getWebinars = async (req, res, next) => {
  try {
    const { page, limit, sort } = getPaginationOptions(req.query);
    const filter = { isPublished: true };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.isFree !== undefined) filter.isFree = req.query.isFree === 'true';
    if (req.query.dateFrom) filter.date = { $gte: new Date(req.query.dateFrom) };
    if (req.query.dateTo) filter.date = { ...filter.date, $lte: new Date(req.query.dateTo) };
    const total = await Webinar.countDocuments(filter);
    const webinars = await Webinar.find(filter)
      .sort(sort || { date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('instructorId', 'firstName lastName')
      .populate('createdBy', 'firstName lastName')
      .lean();
    sendPaginated(res, webinars, total, page, limit);
  } catch (error) { next(error); }
};

exports.getWebinar = async (req, res, next) => {
  try {
    const webinar = await Webinar.findById(req.params.id)
      .populate('instructorId', 'firstName lastName')
      .populate('createdBy', 'firstName lastName')
      .lean();
    if (!webinar || !webinar.isPublished) return sendError(res, 'Not found', 404);
    sendSuccess(res, webinar);
  } catch (error) { next(error); }
};

exports.createWebinar = async (req, res, next) => {
  try {
    const data = { ...req.body, createdBy: req.user._id };
    if (!data.instructorName && data.instructorId) {
      const instructor = await User.findById(data.instructorId).select('firstName lastName');
      if (instructor) data.instructorName = `${instructor.firstName} ${instructor.lastName}`;
    }
    const webinar = await Webinar.create(data);
    sendSuccess(res, webinar, 'Created', 201);
  } catch (error) { next(error); }
};

exports.updateWebinar = async (req, res, next) => {
  try {
    const webinar = await Webinar.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!webinar) return sendError(res, 'Not found', 404);
    sendSuccess(res, webinar, 'Updated');
  } catch (error) { next(error); }
};

exports.deleteWebinar = async (req, res, next) => {
  try {
    await Webinar.findByIdAndDelete(req.params.id);
    sendSuccess(res, null, 'Deleted');
  } catch (error) { next(error); }
};

exports.register = async (req, res, next) => {
  try {
    const webinar = await Webinar.findById(req.params.id);
    if (!webinar) return sendError(res, 'Not found', 404);
    if (webinar.registeredCount >= webinar.maxParticipants) {
      return sendError(res, 'Registration is full', 400);
    }
    const alreadyRegistered = webinar.registrations.some(r => r.userId.toString() === req.user._id.toString());
    if (alreadyRegistered) return sendError(res, 'Already registered', 400);
    webinar.registrations.push({ userId: req.user._id });
    webinar.registeredCount = webinar.registrations.length;
    await webinar.save();
    sendSuccess(res, webinar, 'Registered successfully');
  } catch (error) { next(error); }
};

exports.unregister = async (req, res, next) => {
  try {
    const webinar = await Webinar.findById(req.params.id);
    if (!webinar) return sendError(res, 'Not found', 404);
    webinar.registrations = webinar.registrations.filter(r => r.userId.toString() !== req.user._id.toString());
    webinar.registeredCount = webinar.registrations.length;
    await webinar.save();
    sendSuccess(res, webinar, 'Unregistered successfully');
  } catch (error) { next(error); }
};

exports.getMyRegistrations = async (req, res, next) => {
  try {
    const webinars = await Webinar.find({ registrations: { $elemMatch: { userId: req.user._id } } })
      .sort({ date: -1 })
      .limit(20)
      .lean();
    sendSuccess(res, webinars);
  } catch (error) { next(error); }
};

exports.getStats = async (req, res, next) => {
  try {
    const total = await Webinar.countDocuments();
    const published = await Webinar.countDocuments({ isPublished: true });
    const free = await Webinar.countDocuments({ isFree: true, isPublished: true });
    const upcoming = await Webinar.countDocuments({ date: { $gt: new Date() }, isPublished: true });
    const totalRegistrations = await Webinar.aggregate([{ $group: { _id: null, total: { $sum: '$registeredCount' } } }]);
    sendSuccess(res, { total, published, free, upcoming, totalRegistrations: totalRegistrations[0]?.total || 0 });
  } catch (error) { next(error); }
};