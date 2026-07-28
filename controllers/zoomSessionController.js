const ZoomSession = require('../models/ZoomSession');
const User = require('../models/User');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');

exports.getZoomSessions = async (req, res, next) => {
  try {
    const { page, limit, sort } = getPaginationOptions(req.query);
    const filter = { isPublished: true };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.isRecurring !== undefined) filter.isRecurring = req.query.isRecurring === 'true';
    if (req.query.dateFrom) filter.date = { $gte: new Date(req.query.dateFrom) };
    if (req.query.dateTo) filter.date = { ...filter.date, $lte: new Date(req.query.dateTo) };
    const total = await ZoomSession.countDocuments(filter);
    const sessions = await ZoomSession.find(filter)
      .sort(sort || { date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('instructorId', 'firstName lastName')
      .populate('createdBy', 'firstName lastName')
      .lean();
    sendPaginated(res, sessions, total, page, limit);
  } catch (error) { next(error); }
};

exports.getZoomSession = async (req, res, next) => {
  try {
    const session = await ZoomSession.findById(req.params.id)
      .populate('instructorId', 'firstName lastName')
      .populate('createdBy', 'firstName lastName')
      .lean();
    if (!session || !session.isPublished) return sendError(res, 'Not found', 404);
    sendSuccess(res, session);
  } catch (error) { next(error); }
};

exports.createZoomSession = async (req, res, next) => {
  try {
    const data = { ...req.body, createdBy: req.user._id };
    if (!data.instructorName && data.instructorId) {
      const instructor = await User.findById(data.instructorId).select('firstName lastName');
      if (instructor) data.instructorName = `${instructor.firstName} ${instructor.lastName}`;
    }
    const session = await ZoomSession.create(data);
    sendSuccess(res, session, 'Created', 201);
  } catch (error) { next(error); }
};

exports.updateZoomSession = async (req, res, next) => {
  try {
    const session = await ZoomSession.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!session) return sendError(res, 'Not found', 404);
    sendSuccess(res, session, 'Updated');
  } catch (error) { next(error); }
};

exports.deleteZoomSession = async (req, res, next) => {
  try {
    await ZoomSession.findByIdAndDelete(req.params.id);
    sendSuccess(res, null, 'Deleted');
  } catch (error) { next(error); }
};

exports.register = async (req, res, next) => {
  try {
    const session = await ZoomSession.findById(req.params.id);
    if (!session) return sendError(res, 'Not found', 404);
    if (session.registeredCount >= session.maxParticipants) {
      return sendError(res, 'Registration is full', 400);
    }
    const alreadyRegistered = session.registrations.some(r => r.userId.toString() === req.user._id.toString());
    if (alreadyRegistered) return sendError(res, 'Already registered', 400);
    session.registrations.push({ userId: req.user._id });
    session.registeredCount = session.registrations.length;
    await session.save();
    sendSuccess(res, session, 'Registered successfully');
  } catch (error) { next(error); }
};

exports.unregister = async (req, res, next) => {
  try {
    const session = await ZoomSession.findById(req.params.id);
    if (!session) return sendError(res, 'Not found', 404);
    session.registrations = session.registrations.filter(r => r.userId.toString() !== req.user._id.toString());
    session.registeredCount = session.registrations.length;
    await session.save();
    sendSuccess(res, session, 'Unregistered successfully');
  } catch (error) { next(error); }
};

exports.getMyRegistrations = async (req, res, next) => {
  try {
    const sessions = await ZoomSession.find({ registrations: { $elemMatch: { userId: req.user._id } } })
      .sort({ date: -1 })
      .limit(20)
      .lean();
    sendSuccess(res, sessions);
  } catch (error) { next(error); }
};

exports.getStats = async (req, res, next) => {
  try {
    const total = await ZoomSession.countDocuments();
    const published = await ZoomSession.countDocuments({ isPublished: true });
    const free = await ZoomSession.countDocuments({ category: 'free-zoom', isPublished: true });
    const upcoming = await ZoomSession.countDocuments({ date: { $gt: new Date() }, isPublished: true });
    const totalRegistrations = await ZoomSession.aggregate([{ $group: { _id: null, total: { $sum: '$registeredCount' } } }]);
    sendSuccess(res, { total, published, free, upcoming, totalRegistrations: totalRegistrations[0]?.total || 0 });
  } catch (error) { next(error); }
};