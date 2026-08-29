const Class = require('../models/Class');
const User = require('../models/User');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');
const { sendClassPublishedEmail } = require('../services/emailService');

const ALLOWED_SLOTS = ['Morning', 'Evening', 'Weekend'];
const ALLOWED_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const resolveVideoUrl = (file, folder) => {
  if (!file) return null;
  return (file.path && /^https?:\/\//.test(file.path))
    ? file.path
    : `/uploads/${folder}/${file.filename}`;
};

exports.getClasses = async (req, res, next) => {
  try {
    const { page, limit, sort } = getPaginationOptions(req.query);
    const filter = {};
    if (req.user?.role !== 'admin') filter.isActive = true;
    const total = await Class.countDocuments(filter);
    const classes = await Class.find(filter)
      .sort(sort || { date: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    sendPaginated(res, classes, total, page, limit);
  } catch (error) {
    next(error);
  }
};

exports.getClass = async (req, res, next) => {
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) return sendError(res, 'Class not found', 404);
    if (!cls.isActive && req.user?.role !== 'admin') return sendError(res, 'Class not found', 404);
    sendSuccess(res, cls);
  } catch (error) {
    next(error);
  }
};

exports.createClass = async (req, res, next) => {
  try {
    const { title, description, type, date, time, meetLink, instructor } = req.body;
    const classData = {
      title,
      description,
      type,
      date,
      time,
      instructor,
      isActive: true,
    };
    if (type === 'online') {
      classData.meetLink = meetLink;
      classData.videoUrl = null;
    }
    if (type === 'physical') {
      classData.meetLink = null;
      classData.videoUrl = resolveVideoUrl(req.file, 'videos');
    }
    const cls = await Class.create(classData);
    try {
      const students = await User.find({ role: 'student' }).select('email firstName').lean();
      if (students.length > 0) {
        await sendClassPublishedEmail(students, cls);
      }
    } catch (emailErr) {
      console.error('[CLASS] Failed to send notification email:', emailErr.message);
    }
    sendSuccess(res, cls, 'Class created', 201);
  } catch (error) {
    next(error);
  }
};

exports.updateClass = async (req, res, next) => {
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) return sendError(res, 'Class not found', 404);
    const { title, description, type, date, time, meetLink, instructor, isActive } = req.body;
    if (title !== undefined) cls.title = title;
    if (description !== undefined) cls.description = description;
    if (type !== undefined) {
      cls.type = type;
      if (type === 'online') {
        cls.videoUrl = null;
        cls.meetLink = meetLink || cls.meetLink;
      }
      if (type === 'physical') {
        cls.meetLink = null;
      }
    }
    if (date !== undefined) cls.date = date;
    if (time !== undefined) cls.time = time;
    if (meetLink !== undefined && cls.type === 'online') cls.meetLink = meetLink;
    if (instructor !== undefined) cls.instructor = instructor;
    if (isActive !== undefined) cls.isActive = isActive;
    if (req.file && cls.type === 'physical') {
      cls.videoUrl = resolveVideoUrl(req.file, 'videos');
    }
    await cls.save();
    sendSuccess(res, cls, 'Class updated');
  } catch (error) {
    next(error);
  }
};

exports.enrollInClass = async (req, res, next) => {
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) return sendError(res, 'Class not found', 404);
    if (!cls.isActive) return sendError(res, 'Class is not open for enrollment', 400);

    const user = req.user;
    const studentName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    const studentEmail = user.email || '';

    let preferredSlot = req.body.preferredSlot || 'Morning';
    if (!ALLOWED_SLOTS.includes(preferredSlot)) preferredSlot = 'Morning';
    let preferredDays = Array.isArray(req.body.preferredDays) ? req.body.preferredDays : [];
    preferredDays = preferredDays.filter(d => ALLOWED_DAYS.includes(d));

    const existing = cls.enrollments.find(e => e.userId && e.userId.toString() === user._id.toString());
    if (existing) {
      existing.studentName = studentName;
      existing.studentEmail = studentEmail;
      existing.preferredSlot = preferredSlot;
      existing.preferredDays = preferredDays;
      existing.createdAt = Date.now();
    } else {
      cls.enrollments.push({
        userId: user._id,
        studentName,
        studentEmail,
        preferredSlot,
        preferredDays,
      });
    }

    await cls.save();
    sendSuccess(res, cls, existing ? 'Enrollment updated' : 'Enrolled successfully', 201);
  } catch (error) {
    next(error);
  }
};

exports.deleteClass = async (req, res, next) => {
  try {
    const cls = await Class.findByIdAndDelete(req.params.id);
    if (!cls) return sendError(res, 'Class not found', 404);
    sendSuccess(res, null, 'Class deleted');
  } catch (error) {
    next(error);
  }
};