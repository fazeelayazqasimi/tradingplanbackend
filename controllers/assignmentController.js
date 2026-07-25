const Assignment = require('../models/Assignment');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');

exports.getAssignments = async (req, res, next) => {
  try {
    const { page, limit } = getPaginationOptions(req.query);
    const filter = {};
    if (req.query.courseId) filter.courseId = req.query.courseId;
    if (req.query.lessonId) filter.lessonId = req.query.lessonId;
    const total = await Assignment.countDocuments(filter);
    const assignments = await Assignment.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('courseId', 'title');
    sendPaginated(res, assignments, total, page, limit);
  } catch (error) { next(error); }
};

exports.getAssignment = async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id).populate('courseId', 'title');
    if (!assignment) return sendError(res, 'Not found', 404);
    sendSuccess(res, assignment);
  } catch (error) { next(error); }
};

exports.submitAssignment = async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return sendError(res, 'Not found', 404);
    const existing = assignment.submissions.find(s => s.userId.toString() === req.user._id.toString());
    if (existing) return sendError(res, 'Already submitted', 400);
    assignment.submissions.push({ userId: req.user._id, fileUrl: req.file ? `/uploads/resources/${req.file.filename}` : null, submittedAt: new Date() });
    await assignment.save();
    sendSuccess(res, assignment, 'Submitted');
  } catch (error) { next(error); }
};

exports.gradeAssignment = async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return sendError(res, 'Not found', 404);
    const submission = assignment.submissions.id(req.params.submissionId);
    if (!submission) return sendError(res, 'Submission not found', 404);
    submission.grade = req.body.grade;
    submission.feedback = req.body.feedback;
    submission.gradedBy = req.user._id;
    submission.gradedAt = new Date();
    await assignment.save();
    sendSuccess(res, assignment, 'Graded');
  } catch (error) { next(error); }
};

exports.createAssignment = async (req, res, next) => {
  try {
    const assignment = await Assignment.create({ ...req.body, createdBy: req.user._id });
    sendSuccess(res, assignment, 'Created', 201);
  } catch (error) { next(error); }
};

exports.deleteAssignment = async (req, res, next) => {
  try {
    await Assignment.findByIdAndDelete(req.params.id);
    sendSuccess(res, null, 'Deleted');
  } catch (error) { next(error); }
};
