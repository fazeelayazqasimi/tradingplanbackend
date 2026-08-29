const router = require('express').Router();
const {
  getPublished,
  getAll,
  create,
  update,
  remove,
  uploadFile,
  uploadVideo: uploadVideoController,
} = require('../controllers/businessProfileController');
const { protect, authorize } = require('../middleware/auth');
const { uploadDocument, uploadVideo: uploadVideoMiddleware } = require('../middleware/upload');

router.get('/published', getPublished);
router.get('/', protect, authorize('admin'), getAll);
router.post('/upload', protect, authorize('admin'), uploadDocument.single('document'), uploadFile);
router.post('/upload-video', protect, authorize('admin'), uploadVideoMiddleware.single('video'), uploadVideoController);
router.post('/', protect, authorize('admin'), create);
router.put('/:id', protect, authorize('admin'), update);
router.delete('/:id', protect, authorize('admin'), remove);

module.exports = router;
