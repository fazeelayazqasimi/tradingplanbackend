const router = require('express').Router();
const { getAll, getPublished, create, update, remove } = require('../controllers/mediaController');
const { protect, authorize } = require('../middleware/auth');
const { uploadMedia } = require('../middleware/upload');

router.get('/', protect, authorize('admin'), getAll);
router.get('/published', getPublished);
router.post('/', protect, authorize('admin'), uploadMedia.array('images', 10), create);
router.put('/:id', protect, authorize('admin'), uploadMedia.array('images', 10), update);
router.delete('/:id', protect, authorize('admin'), remove);

module.exports = router;
