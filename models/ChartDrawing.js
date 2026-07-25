const mongoose = require('mongoose');

const chartDrawingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  symbol: {
    type: String,
    default: 'OANDA:XAUUSD',
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
}, { timestamps: true });

chartDrawingSchema.index({ user: 1, symbol: 1 }, { unique: true });

module.exports = mongoose.model('ChartDrawing', chartDrawingSchema);
