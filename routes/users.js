const router = require('express').Router();
const { getUsers, getUser, adminUpdateUser, connectMT, disconnectMT, markWhatsappClick, deleteUser, getStudentDashboard } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { updateProfileValidator, connectMTValidator, adminUpdateUserValidator } = require('../validators/userValidators');

router.use(protect);
router.get('/', authorize('admin'), getUsers);
router.get('/:id', authorize('admin'), getUser);
router.put('/:id', authorize('admin'), validate(adminUpdateUserValidator), adminUpdateUser);
router.delete('/:id', authorize('admin'), deleteUser);
router.post('/connect-mt', validate(connectMTValidator), connectMT);
router.delete('/disconnect-mt', disconnectMT);
router.post('/whatsapp-click', markWhatsappClick);
router.get('/student/dashboard', getStudentDashboard);

module.exports = router;
