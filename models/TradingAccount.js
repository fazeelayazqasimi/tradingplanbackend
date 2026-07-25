const mongoose = require('mongoose');

const tradingAccountSchema = new mongoose.Schema({
  brokerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TradingBroker',
    required: [true, 'Broker ID is required']
  },
  name: {
    type: String,
    required: [true, 'Account name is required'],
    trim: true,
    maxlength: [200, 'Name cannot exceed 200 characters']
  },
  externalLink: {
    type: String,
    required: [true, 'External link is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

tradingAccountSchema.index({ brokerId: 1 });

module.exports = mongoose.model('TradingAccount', tradingAccountSchema);
