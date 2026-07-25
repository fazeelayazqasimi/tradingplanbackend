const router = require('express').Router();
const { register, login, getMe, forgotPassword, resetPassword, changePassword, updateProfile, refresh, verifyEmail, resendVerification, bootstrapAdmin, sendOTP, verifyOTP, changeEmail, sendPhoneOTP, verifyPhoneOTP } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { registerValidator, loginValidator, forgotPasswordValidator, resetPasswordValidator, changePasswordValidator } = require('../validators/authValidators');
const { uploadAvatar } = require('../middleware/upload');

router.post('/register', validate(registerValidator), register);
router.post('/login', validate(loginValidator), login);
router.post('/refresh', refresh);
router.get('/me', protect, getMe);
router.post('/forgot-password', validate(forgotPasswordValidator), forgotPassword);
router.put('/reset-password/:token', validate(resetPasswordValidator), resetPassword);
router.put('/change-password', protect, validate(changePasswordValidator), changePassword);
router.put('/profile', protect, uploadAvatar.single('avatar'), updateProfile);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', protect, resendVerification);
router.post('/bootstrap-admin', bootstrapAdmin);
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/send-otp-phone', protect, sendPhoneOTP);
router.post('/verify-otp-phone', protect, verifyPhoneOTP);
router.post('/change-email', protect, changeEmail);

module.exports = router;
