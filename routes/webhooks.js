const express = require('express');
const router = express.Router();
const { handleCoinPaymentsIPN } = require('../controllers/webhookController');

router.post('/coinpayments', (req, res, next) => {
  req.bodyRaw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : (typeof req.body === 'string' ? req.body : '');
  next();
}, handleCoinPaymentsIPN);

module.exports = router;