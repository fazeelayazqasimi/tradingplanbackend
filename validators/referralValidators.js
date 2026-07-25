const { body } = require('express-validator');

const applyReferralValidator = [
  body('referralCode')
    .trim()
    .notEmpty()
    .withMessage('Referral code is required')
    .isLength({ min: 3, max: 20 })
    .withMessage('Referral code must be between 3 and 20 characters'),
];

module.exports = {
  applyReferralValidator,
};
