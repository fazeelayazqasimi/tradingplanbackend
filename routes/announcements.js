const router = require('express').Router();
const { getAnnouncements, getAnnouncement, createAnnouncement, updateAnnouncement, deleteAnnouncement, uploadImage, uploadPdf, uploadVideo } = require('../controllers/announcementController');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { announcementValidator } = require('../validators/generalValidators');
const { uploadMedia, uploadDocument, uploadVideo: uploadVideoMiddleware } = require('../middleware/upload');

router.get('/', getAnnouncements);
router.get('/:id', getAnnouncement);
router.post('/upload-image', protect, authorize('admin'), uploadMedia.single('image'), uploadImage);
router.post('/upload-pdf', protect, authorize('admin'), uploadDocument.single('file'), uploadPdf);
router.post('/upload-video', protect, authorize('admin'), uploadVideoMiddleware.single('file'), uploadVideo);
router.post('/', protect, authorize('admin'), validate(announcementValidator), createAnnouncement);
router.put('/:id', protect, authorize('admin'), updateAnnouncement);
router.delete('/:id', protect, authorize('admin'), deleteAnnouncement);

module.exports = router;
