const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { webinarValidator, idValidator } = require('../validators/generalValidators');
const { getWebinars, getWebinar, createWebinar, updateWebinar, deleteWebinar, register, unregister, getMyRegistrations, getStats } = require('../controllers/webinarController');

router.get('/', getWebinars);
router.get('/stats', getStats);
router.get('/:id', getWebinar);
router.post('/', protect, authorize('admin'), validate(webinarValidator), createWebinar);
router.put('/:id', protect, authorize('admin'), validate(webinarValidator), updateWebinar);
router.delete('/:id', protect, authorize('admin'), idValidator, deleteWebinar);
router.post('/:id/register', protect, register);
router.delete('/:id/unregister', protect, unregister);
router.get('/me/registrations', protect, getMyRegistrations);

module.exports = router;