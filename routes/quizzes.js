const router = require('express').Router();
const { getQuizzes, getQuiz, submitQuiz, createQuiz, updateQuiz, deleteQuiz } = require('../controllers/quizController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', getQuizzes);
router.get('/:id', protect, getQuiz);
router.post('/', protect, authorize('admin'), createQuiz);
router.post('/:id/submit', protect, submitQuiz);
router.put('/:id', protect, authorize('admin'), updateQuiz);
router.delete('/:id', protect, authorize('admin'), deleteQuiz);

module.exports = router;
