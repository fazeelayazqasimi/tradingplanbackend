const ChartDrawing = require('../models/ChartDrawing');
const { sendSuccess, sendError } = require('../helpers/response');

exports.getDrawing = async (req, res, next) => {
  try {
    const drawing = await ChartDrawing.findOne({ user: req.user.id, symbol: req.query.symbol || 'OANDA:XAUUSD' });
    sendSuccess(res, drawing ? drawing.data : null);
  } catch (error) { next(error); }
};

exports.saveDrawing = async (req, res, next) => {
  try {
    const { symbol, data } = req.body;
    await ChartDrawing.findOneAndUpdate(
      { user: req.user.id, symbol: symbol || 'OANDA:XAUUSD' },
      { data, symbol: symbol || 'OANDA:XAUUSD' },
      { upsert: true, new: true }
    );
    sendSuccess(res, null, 'Drawing saved');
  } catch (error) { next(error); }
};

exports.deleteDrawing = async (req, res, next) => {
  try {
    await ChartDrawing.findOneAndDelete({ user: req.user.id, symbol: req.body.symbol || 'OANDA:XAUUSD' });
    sendSuccess(res, null, 'Drawing deleted');
  } catch (error) { next(error); }
};
