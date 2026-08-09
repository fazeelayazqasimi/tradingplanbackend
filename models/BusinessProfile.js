const mongoose = require('mongoose');

const businessProfileSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters'],
    default: ''
  },
  fileUrl: {
    type: String,
    trim: true,
    required: [true, 'PDF file is required']
  },
  fileName: {
    type: String,
    trim: true,
    default: ''
  },
  fileSize: {
    type: Number,
    default: 0
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

businessProfileSchema.index({ isPublished: 1, order: 1 });

module.exports = mongoose.model('BusinessProfile', businessProfileSchema);
