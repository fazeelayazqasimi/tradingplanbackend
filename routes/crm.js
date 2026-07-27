const router = require('express').Router();
const { getAll, getMine, create, update, sendScheduleEmail, remove } = require('../controllers/crmController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, authorize('admin'), getAll);
router.get('/mine', protect, getMine);
router.post('/', protect, authorize('admin'), create);
router.put('/:id', protect, authorize('admin'), update);
router.post('/:id/send-email', protect, authorize('admin'), sendScheduleEmail);
router.delete('/:id', protect, authorize('admin'), remove);

module.exports = router;
