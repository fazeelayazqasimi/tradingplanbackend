const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { zoomSessionValidator, idValidator } = require('../validators/generalValidators');
const { getZoomSessions, getZoomSession, createZoomSession, updateZoomSession, deleteZoomSession, register, unregister, getMyRegistrations, getStats } = require('../controllers/zoomSessionController');

router.get('/', getZoomSessions);
router.get('/stats', getStats);
router.get('/:id', getZoomSession);
router.post('/', protect, authorize('admin'), validate(zoomSessionValidator), createZoomSession);
router.put('/:id', protect, authorize('admin'), validate(zoomSessionValidator), updateZoomSession);
router.delete('/:id', protect, authorize('admin'), idValidator, deleteZoomSession);
router.post('/:id/register', protect, register);
router.delete('/:id/unregister', protect, unregister);
router.get('/me/registrations', protect, getMyRegistrations);

module.exports = router;