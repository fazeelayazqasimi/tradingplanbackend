const router = require('express').Router();
const { getClasses, getClass, createClass, updateClass, deleteClass, enrollInClass } = require('../controllers/classController');
const { protect, authorize } = require('../middleware/auth');
const { uploadVideo } = require('../middleware/upload');

router.get('/', protect, getClasses);
router.get('/:id', protect, getClass);
router.post('/', protect, authorize('admin'), uploadVideo.single('video'), createClass);
router.post('/:id/enroll', protect, enrollInClass);
router.put('/:id', protect, authorize('admin'), uploadVideo.single('video'), updateClass);
router.delete('/:id', protect, authorize('admin'), deleteClass);

module.exports = router;