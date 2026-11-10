const router = require('express').Router();
const { getStrategies, getAllStrategies, createStrategy, updateStrategy, deleteStrategy, uploadImage } = require('../controllers/tradingStrategyController');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { body } = require('express-validator');
const { uploadMedia } = require('../middleware/upload');

const strategyValidator = [
  body('name').trim().notEmpty().withMessage('Strategy name is required'),
  body('tag').optional({ values: 'falsy' }).trim().isLength({ max: 30 }).withMessage('Tag cannot exceed 30 characters'),
  body('imageUrl').optional({ values: 'falsy' }).trim().isLength({ max: 500 }),
  body('minAmount').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Minimum amount must be 0 or more'),
  body('maxAmount').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Maximum amount must be 0 or more'),
  body('sortOrder').optional({ values: 'falsy' }).isInt(),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

router.get('/', getStrategies);
router.get('/admin/all', protect, authorize('admin'), getAllStrategies);
router.post('/upload-image', protect, authorize('admin'), uploadMedia.single('image'), uploadImage);
router.post('/', protect, authorize('admin'), validate(strategyValidator), createStrategy);
router.put('/:id', protect, authorize('admin'), updateStrategy);
router.delete('/:id', protect, authorize('admin'), deleteStrategy);

module.exports = router;
