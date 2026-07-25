const router = require('express').Router();
const { getAnnouncements, getAnnouncement, createAnnouncement, updateAnnouncement, deleteAnnouncement } = require('../controllers/announcementController');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { announcementValidator } = require('../validators/generalValidators');

router.get('/', getAnnouncements);
router.get('/:id', getAnnouncement);
router.post('/', protect, authorize('admin'), validate(announcementValidator), createAnnouncement);
router.put('/:id', protect, authorize('admin'), updateAnnouncement);
router.delete('/:id', protect, authorize('admin'), deleteAnnouncement);

module.exports = router;
