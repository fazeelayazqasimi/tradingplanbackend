const router = require('express').Router();
const { getMyBotAccounts, createBotAccount, deleteBotAccount, getConnectFeeInfo } = require('../controllers/botAccountController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { botAccountValidator } = require('../validators/userValidators');

router.use(protect);
router.get('/', getMyBotAccounts);
router.get('/fee-info', getConnectFeeInfo);
router.post('/', validate(botAccountValidator), createBotAccount);
router.delete('/:id', deleteBotAccount);

module.exports = router;
