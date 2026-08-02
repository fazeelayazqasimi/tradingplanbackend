const Certificate = require('../models/Certificate');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');
const { notifyStudentActivity } = require('../services/studentActivityService');

exports.getMyCertificates = async (req, res, next) => {
  try {
    const certs = await Certificate.find({ userId: req.user._id }).populate('courseId', 'title');
    sendSuccess(res, certs);
  } catch (error) { next(error); }
};

exports.getCertificate = async (req, res, next) => {
  try {
    const cert = await Certificate.findById(req.params.id).populate('courseId', 'title').populate('userId', 'firstName lastName email');
    if (!cert) return sendError(res, 'Certificate not found', 404);
    sendSuccess(res, cert);
  } catch (error) { next(error); }
};

exports.verifyCertificate = async (req, res, next) => {
  try {
    const cert = await Certificate.findOne({ certificateNumber: req.params.number }).populate('courseId', 'title').populate('userId', 'firstName lastName');
    if (!cert) return sendError(res, 'Certificate not found', 404);
    sendSuccess(res, { valid: true, certificate: cert });
  } catch (error) { next(error); }
};

exports.getAllCertificates = async (req, res, next) => {
  try {
    const { page, limit } = getPaginationOptions(req.query);
    const filter = {};
    if (req.query.courseId) filter.courseId = req.query.courseId;
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.search) {
      const users = await require('../models/User').find({
        $or: [
          { firstName: { $regex: req.query.search, $options: 'i' } },
          { lastName: { $regex: req.query.search, $options: 'i' } },
          { email: { $regex: req.query.search, $options: 'i' } },
        ],
      }).select('_id');
      filter.userId = { $in: users.map(u => u._id) };
    }
    const total = await Certificate.countDocuments(filter);
    const certs = await Certificate.find(filter)
      .populate('userId', 'firstName lastName email')
      .populate('courseId', 'title')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    sendPaginated(res, certs, total, page, limit);
  } catch (error) { next(error); }
};

exports.createCertificate = async (req, res, next) => {
  try {
    const { userId, courseId, grade, percentage, totalScore, maxScore, certificateNumber } = req.body;
    if (!grade) return sendError(res, 'Grade is required (A, B, C, D, F, Pass, Fail)', 400);
    const cert = await Certificate.create({
      userId,
      courseId,
      grade,
      percentage,
      totalScore,
      maxScore,
      certificateNumber: certificateNumber || `CERT-${Date.now().toString(36).toUpperCase()}`,
      issuedAt: new Date(),
    });
    const student = await require('../models/User').findById(userId).select('firstName lastName email');
    if (student) {
      notifyStudentActivity({
        user: student,
        action: 'certificate_issued',
        details: { certificate: cert.certificateNumber, grade, percentage: percentage ? `${percentage}%` : 'N/A' }
      });
    }
    sendSuccess(res, cert, 'Certificate issued', 201);
  } catch (error) { next(error); }
};

exports.deleteCertificate = async (req, res, next) => {
  try {
    const cert = await Certificate.findByIdAndDelete(req.params.id);
    if (!cert) return sendError(res, 'Certificate not found', 404);
    sendSuccess(res, null, 'Certificate deleted');
  } catch (error) { next(error); }
};
