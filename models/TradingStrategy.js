const mongoose = require('mongoose');

const tradingStrategySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Strategy name is required'],
    trim: true,
    maxlength: [60, 'Name cannot exceed 60 characters'],
  },
  tag: {
    type: String,
    trim: true,
    maxlength: [30, 'Tag cannot exceed 30 characters'],
    default: null,
  },
  imageUrl: {
    type: String,
    trim: true,
    default: null,
  },
  minAmount: {
    type: Number,
    default: 250,
    min: [0, 'Minimum amount cannot be negative'],
  },
  maxAmount: {
    type: Number,
    default: 5000,
    min: [0, 'Maximum amount cannot be negative'],
  },
  sortOrder: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

tradingStrategySchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('TradingStrategy', tradingStrategySchema);
