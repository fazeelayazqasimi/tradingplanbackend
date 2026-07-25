const mongoose = require('mongoose');

const pageContentSchema = new mongoose.Schema({
  key: {
    type: String,
    required: [true, 'Key is required'],
    unique: true,
    trim: true
  },
  page: {
    type: String,
    required: [true, 'Page is required'],
    enum: ['home', 'about', 'pricing', 'courses', 'contact', 'faq', 'global'],
    trim: true
  },
  section: {
    type: String,
    required: [true, 'Section is required'],
    trim: true
  },
  type: {
    type: String,
    enum: ['text', 'richtext', 'image', 'json', 'number', 'boolean'],
    default: 'text'
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'Value is required']
  },
  label: {
    type: String,
    trim: true,
    default: null
  },
  description: {
    type: String,
    trim: true,
    default: null
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

pageContentSchema.index({ page: 1 });
pageContentSchema.index({ section: 1 });
pageContentSchema.index({ key: 1 });
pageContentSchema.index({ page: 1, section: 1, order: 1 });

module.exports = mongoose.model('PageContent', pageContentSchema);
