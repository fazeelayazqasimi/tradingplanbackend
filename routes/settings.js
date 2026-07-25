const router = require('express').Router();
const { getPublicSettings, getAllSettings, updateSetting, bulkUpdateSettings, uploadLogoSetting } = require('../controllers/settingController');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { settingValidator } = require('../validators/generalValidators');
const { uploadLogo } = require('../middleware/upload');

router.get('/public', getPublicSettings);
router.get('/', protect, authorize('admin'), getAllSettings);
router.put('/', protect, authorize('admin'), validate(settingValidator), updateSetting);
router.put('/bulk', protect, authorize('admin'), bulkUpdateSettings);
router.post('/upload-logo', protect, authorize('admin'), uploadLogo.single('logo'), uploadLogoSetting);

module.exports = router;
