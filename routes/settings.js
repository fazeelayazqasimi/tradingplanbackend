const router = require('express').Router();
const { getPublicSettings, getAllSettings, updateSetting, bulkUpdateSettings, uploadBranding } = require('../controllers/settingController');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { settingValidator } = require('../validators/generalValidators');
const { uploadBranding: uploadBrandingMiddleware } = require('../middleware/upload');

router.get('/public', getPublicSettings);
router.get('/', protect, authorize('admin'), getAllSettings);
router.put('/', protect, authorize('admin'), validate(settingValidator), updateSetting);
router.put('/bulk', protect, authorize('admin'), bulkUpdateSettings);
router.post('/upload-logo', protect, authorize('admin'), uploadBrandingMiddleware.single('logo'), uploadBranding);

module.exports = router;
