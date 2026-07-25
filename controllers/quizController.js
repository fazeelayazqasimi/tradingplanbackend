const Quiz = require('../models/Quiz');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions } = require('../helpers/pagination');

exports.getQuizzes = async (req, res, next) => {
  try {
    const { page, limit } = getPaginationOptions(req.query);
    const filter = {};
    if (req.query.courseId) filter.courseId = req.query.courseId;
    if (req.query.lessonId) filter.lessonId = req.query.lessonId;
    const total = await Quiz.countDocuments(filter);
    const quizzes = await Quiz.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select('-questions.correctAnswer -questions.explanation');
    sendPaginated(res, quizzes, total, page, limit);
  } catch (error) { next(error); }
};

exports.getQuiz = async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id).populate('courseId', 'title');
    if (!quiz) return sendError(res, 'Not found', 404);
    const data = quiz.toObject();
    if (req.user?.role !== 'admin') {
      data.questions = data.questions.map(q => { const { correctAnswer, explanation, ...rest } = q; return rest; });
    }
    sendSuccess(res, data);
  } catch (error) { next(error); }
};

exports.submitQuiz = async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return sendError(res, 'Not found', 404);
    const { answers } = req.body;
    let score = 0;
    quiz.questions.forEach((q, i) => { if (answers[i] === q.correctAnswer) score++; });
    const percentage = Math.round((score / quiz.questions.length) * 100);
    quiz.attempts.push({ userId: req.user._id, answers, score: percentage, completedAt: new Date() });
    await quiz.save();
    sendSuccess(res, { score: percentage, total: quiz.questions.length, passed: percentage >= quiz.passingScore, answers: quiz.questions.map(q => ({ correctAnswer: q.correctAnswer, explanation: q.explanation })) });
  } catch (error) { next(error); }
};

exports.createQuiz = async (req, res, next) => {
  try {
    const quiz = await Quiz.create({ ...req.body, createdBy: req.user._id });
    sendSuccess(res, quiz, 'Created', 201);
  } catch (error) { next(error); }
};

exports.updateQuiz = async (req, res, next) => {
  try {
    const quiz = await Quiz.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!quiz) return sendError(res, 'Not found', 404);
    sendSuccess(res, quiz, 'Updated');
  } catch (error) { next(error); }
};

exports.deleteQuiz = async (req, res, next) => {
  try {
    await Quiz.findByIdAndDelete(req.params.id);
    sendSuccess(res, null, 'Deleted');
  } catch (error) { next(error); }
};
