const { body } = require('express-validator');

const VALID_ACTIONS = ['BUY', 'SELL', 'BUY LIMIT', 'SELL LIMIT', 'BUY STOP', 'SELL STOP', 'CLOSE', 'MODIFY'];

const createSignalValidator = [
  body('symbol')
    .trim()
    .notEmpty()
    .withMessage('Symbol is required'),
  body('action')
    .isIn(VALID_ACTIONS)
    .withMessage(`Action must be one of: ${VALID_ACTIONS.join(', ')}`),
  body('side')
    .isIn(['LONG', 'SHORT'])
    .withMessage('Side must be LONG or SHORT'),
  body('volume')
    .isNumeric()
    .withMessage('Volume must be a number')
    .custom((value) => {
      if (parseFloat(value) < 0.01) {
        throw new Error('Volume must be at least 0.01');
      }
      return true;
    }),
  body('openPrice')
    .isNumeric()
    .withMessage('Open price must be a number'),
  body('openPrices')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Open prices must be an array of numbers')
    .custom((value) => value.every((p) => !isNaN(parseFloat(p))))
    .withMessage('Open prices must contain only numbers'),
  body('stopLoss')
    .optional()
    .isNumeric()
    .withMessage('Stop loss must be a number'),
  body('takeProfit')
    .optional()
    .isNumeric()
    .withMessage('Take profit must be a number'),
  body('takeProfits')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Take profits must be an array')
    .custom((value) => value.every((tp) => !isNaN(parseFloat(tp && tp.price !== undefined ? tp.price : tp))))
    .withMessage('Take profits must contain valid price levels'),
  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string')
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters'),
];

const updateSignalValidator = [
  body('symbol')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Symbol cannot be empty'),
  body('action')
    .optional()
    .isIn(VALID_ACTIONS)
    .withMessage(`Action must be one of: ${VALID_ACTIONS.join(', ')}`),
  body('side')
    .optional()
    .isIn(['LONG', 'SHORT'])
    .withMessage('Side must be LONG or SHORT'),
  body('volume')
    .optional()
    .isNumeric()
    .withMessage('Volume must be a number')
    .custom((value) => {
      if (parseFloat(value) < 0.01) {
        throw new Error('Volume must be at least 0.01');
      }
      return true;
    }),
  body('openPrice')
    .optional()
    .isNumeric()
    .withMessage('Open price must be a number'),
  body('openPrices')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Open prices must be an array of numbers')
    .custom((value) => value.every((p) => !isNaN(parseFloat(p))))
    .withMessage('Open prices must contain only numbers'),
  body('stopLoss')
    .optional()
    .isNumeric()
    .withMessage('Stop loss must be a number'),
  body('takeProfit')
    .optional()
    .isNumeric()
    .withMessage('Take profit must be a number'),
  body('takeProfits')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Take profits must be an array')
    .custom((value) => value.every((tp) => !isNaN(parseFloat(tp && tp.price !== undefined ? tp.price : tp))))
    .withMessage('Take profits must contain valid price levels'),
  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string')
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters'),
];

module.exports = {
  createSignalValidator,
  updateSignalValidator,
};
