const router = require('express').Router();
const { register, login, getMe, forgotPassword, resetPassword, verifyResetOTP, changePassword, updateProfile, refresh, verifyEmail, resendVerification, bootstrapAdmin, sendOTP, verifyOTP, changeEmail, sendPhoneOTP, verifyPhoneOTP } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { registerValidator, loginValidator, forgotPasswordValidator, resetPasswordValidator, verifyResetOTPValidator, changePasswordValidator } = require('../validators/authValidators');
const rateLimiter = require('../middleware/rateLimiter');
const { uploadAvatar } = require('../middleware/upload');

const authLimiter = rateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });

router.post('/register', validate(registerValidator), register);
router.post('/login', validate(loginValidator), login);
router.post('/refresh', refresh);
router.get('/me', protect, getMe);
router.post('/forgot-password', authLimiter, validate(forgotPasswordValidator), forgotPassword);
router.post('/verify-reset-otp', authLimiter, validate(verifyResetOTPValidator), verifyResetOTP);
router.put('/reset-password', authLimiter, validate(resetPasswordValidator), resetPassword);
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