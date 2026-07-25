const { body } = require('express-validator');

const createSubscriptionValidator = [
  body('plan')
    .isIn(['monthly', 'yearly', 'lifetime'])
    .withMessage('Plan must be monthly, yearly, or lifetime'),
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
  body('transactionRef')
    .trim()
    .notEmpty()
    .withMessage('Transaction reference is required'),
];

const adminApprovalValidator = [
  body('status')
    .isIn(['approved', 'rejected'])
    .withMessage('Status must be approved or rejected'),
  body('adminNote')
    .optional()
    .isString()
    .withMessage('Admin note must be a string'),
];

module.exports = {
  createSubscriptionValidator,
  adminApprovalValidator,
};
