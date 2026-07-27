const router = require('express').Router();
const { getAll, getPublished, create, update, remove } = require('../controllers/mediaController');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.get('/', protect, authorize('admin'), getAll);
router.get('/published', getPublished);
router.post('/', protect, authorize('admin'), create);
router.put('/:id', protect, authorize('admin'), update);
router.delete('/:id', protect, authorize('admin'), remove);

module.exports = router;
