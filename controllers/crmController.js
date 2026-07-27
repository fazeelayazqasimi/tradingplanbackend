const StudentCRM = require('../models/StudentCRM');
const User = require('../models/User');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');
const { sendScheduleEmail } = require('../services/emailService');

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, sort } = getPaginationOptions(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.studentId) filter.studentId = req.query.studentId;
    const total = await StudentCRM.countDocuments(filter);
    const records = await StudentCRM.find(filter)
      .populate('studentId', 'firstName lastName email phone')
      .populate('instructorId', 'firstName lastName email')
      .sort(sort || { createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    sendPaginated(res, records, total, page, limit);
  } catch (error) { next(error); }
};

exports.getMine = async (req, res, next) => {
  try {
    const record = await StudentCRM.findOne({ studentId: req.user._id })
      .populate('instructorId', 'firstName lastName email');
    sendSuccess(res, record || {});
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const { studentId, schedule, notes } = req.body;
    const existing = await StudentCRM.findOne({ studentId });
    if (existing) return sendError(res, 'CRM record already exists for this student', 400);
    const record = await StudentCRM.create({
      studentId,
      instructorId: req.user._id,
      schedule,
      notes,
    });
    const populated = await StudentCRM.findById(record._id)
      .populate('studentId', 'firstName lastName email phone')
      .populate('instructorId', 'firstName lastName email');
    sendSuccess(res, populated, 'CRM record created', 201);
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const { schedule, notes, status } = req.body;
    const record = await StudentCRM.findById(req.params.id);
    if (!record) return sendError(res, 'Record not found', 404);
    if (schedule) record.schedule = schedule;
    if (notes !== undefined) record.notes = notes;
    if (status) record.status = status;
    record.emailSent = false;
    await record.save();
    const populated = await StudentCRM.findById(record._id)
      .populate('studentId', 'firstName lastName email phone')
      .populate('instructorId', 'firstName lastName email');
    sendSuccess(res, populated, 'CRM record updated');
  } catch (error) { next(error); }
};

exports.sendScheduleEmail = async (req, res, next) => {
  try {
    const record = await StudentCRM.findById(req.params.id)
      .populate('studentId', 'firstName lastName email')
      .populate('instructorId', 'firstName lastName email');
    if (!record) return sendError(res, 'Record not found', 404);
    if (!record.studentId?.email) return sendError(res, 'Student has no email', 400);
    try {
      await sendScheduleEmail(record.studentId, record);
      record.emailSent = true;
      await record.save();
      sendSuccess(res, { emailSent: true }, 'Schedule email sent successfully');
    } catch (e) {
      sendError(res, 'Failed to send email: ' + e.message, 500);
    }
  } catch (error) { next(error); }
};

exports.remove = async (req, res, next) => {
  try {
    const record = await StudentCRM.findByIdAndDelete(req.params.id);
    if (!record) return sendError(res, 'Record not found', 404);
    sendSuccess(res, null, 'CRM record deleted');
  } catch (error) { next(error); }
};
