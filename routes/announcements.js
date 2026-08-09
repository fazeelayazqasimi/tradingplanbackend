const router = require('express').Router();
const { getAnnouncements, getAnnouncement, createAnnouncement, updateAnnouncement, deleteAnnouncement, uploadImage } = require('../controllers/announcementController');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { announcementValidator } = require('../validators/generalValidators');
const { uploadMedia } = require('../middleware/upload');

router.get('/', getAnnouncements);
router.get('/:id', getAnnouncement);
router.post('/upload-image', protect, authorize('admin'), uploadMedia.single('image'), uploadImage);
router.post('/', protect, authorize('admin'), validate(announcementValidator), createAnnouncement);
router.put('/:id', protect, authorize('admin'), updateAnnouncement);
router.delete('/:id', protect, authorize('admin'), deleteAnnouncement);

module.exports = router;
