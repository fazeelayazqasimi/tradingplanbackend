const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema({
  question: {
    type: String,
    required: [true, 'Question is required'],
    trim: true,
    maxlength: [500, 'Question cannot exceed 500 characters']
  },
  answer: {
    type: String,
    required: [true, 'Answer is required'],
    trim: true,
    maxlength: [5000, 'Answer cannot exceed 5000 characters']
  },
  category: {
    type: String,
    enum: ['general', 'trading', 'membership', 'referral', 'technical', 'other'],
    default: 'general',
    trim: true
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

faqSchema.index({ isActive: 1 });
faqSchema.index({ category: 1 });
faqSchema.index({ order: 1 });

module.exports = mongoose.model('FAQ', faqSchema);
