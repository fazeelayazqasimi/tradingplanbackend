const router = require('express').Router();
const { getPublicFAQs, getAllFAQs, createFAQ, updateFAQ, deleteFAQ, toggleFAQ } = require('../controllers/faqController');
const { protect, authorize } = require('../middleware/auth');

router.get('/public', getPublicFAQs);
router.get('/', protect, authorize('admin'), getAllFAQs);
router.post('/', protect, authorize('admin'), createFAQ);
router.put('/:id', protect, authorize('admin'), updateFAQ);
router.delete('/:id', protect, authorize('admin'), deleteFAQ);
router.put('/:id/toggle', protect, authorize('admin'), toggleFAQ);

module.exports = router;
