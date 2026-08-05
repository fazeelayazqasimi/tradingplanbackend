const { body } = require('express-validator');

const requestWithdrawalValidator = [
  body('amount')
    .isNumeric()
    .withMessage('Amount must be a number')
    .custom((value) => {
      if (parseFloat(value) < 30) {
        throw new Error('Amount must be at least 30');
      }
      return true;
    }),
  body('paymentMethod')
    .optional({ values: 'falsy' })
    .trim()
    .isIn(['bank_transfer', 'paypal', 'crypto', 'usdt_bep20', 'mobile_money', 'other'])
    .withMessage('Invalid payment method'),
  body('walletAddress')
    .if((value, { req }) => !req.body.paymentMethod || req.body.paymentMethod === 'crypto' || req.body.paymentMethod === 'usdt_bep20')
    .notEmpty()
    .withMessage('Wallet address is required for crypto withdrawals'),
  body('accountNumber')
    .if((value, { req }) => req.body.paymentMethod && !['crypto', 'usdt_bep20'].includes(req.body.paymentMethod))
    .notEmpty()
    .withMessage('Account number is required'),
  body('accountName')
    .if((value, { req }) => req.body.paymentMethod && !['crypto', 'usdt_bep20'].includes(req.body.paymentMethod))
    .notEmpty()
    .withMessage('Account name is required'),
];

const adminWithdrawalValidator = [
  body('status')
    .isIn(['approved', 'rejected', 'paid'])
    .withMessage('Status must be approved, rejected, or paid'),
  body('adminNote')
    .optional()
    .isString()
    .withMessage('Admin note must be a string'),
];

module.exports = {
  requestWithdrawalValidator,
  adminWithdrawalValidator,
};
