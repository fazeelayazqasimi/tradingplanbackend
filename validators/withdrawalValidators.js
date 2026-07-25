const { body } = require('express-validator');

const requestWithdrawalValidator = [
  body('amount')
    .isNumeric()
    .withMessage('Amount must be a number')
    .custom((value) => {
      if (parseFloat(value) < 1) {
        throw new Error('Amount must be at least 1');
      }
      return true;
    }),
  body('paymentMethod')
    .trim()
    .notEmpty()
    .withMessage('Payment method is required'),
  body('accountNumber')
    .trim()
    .notEmpty()
    .withMessage('Account number is required'),
  body('accountName')
    .trim()
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
