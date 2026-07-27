const Class = require('../models/Class');
const User = require('../models/User');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');
const { sendClassPublishedEmail } = require('../services/emailService');

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
      if (req.file) {
        classData.videoUrl = `/uploads/videos/${req.file.filename}`;
      }
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
      cls.videoUrl = `/uploads/videos/${req.file.filename}`;
    }
    await cls.save();
    sendSuccess(res, cls, 'Class updated');
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