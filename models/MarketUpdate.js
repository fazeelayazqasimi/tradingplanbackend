const mongoose = require('mongoose');

const marketUpdateSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Update title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
    trim: true,
  },
  category: {
    type: String,
    enum: {
      values: ['market-update', 'free-training', 'basic-training', 'basic-lesson'],
      message: '{VALUE} is not a valid update category',
    },
    default: 'market-update',
  },
  type: {
    type: String,
    enum: {
      values: ['text', 'video', 'pdf', 'link'],
      message: '{VALUE} is not a valid content type',
    },
    default: 'text',
  },
  contentUrl: {
    type: String,
    trim: true,
    default: null,
  },
  thumbnail: {
    type: String,
    default: null,
  },
  summary: {
    type: String,
    trim: true,
    maxlength: [500, 'Summary cannot exceed 500 characters'],
    default: null,
  },
  isPublished: {
    type: Boolean,
    default: false,
  },
  targetRoles: {
    type: [String],
    enum: {
      values: ['admin', 'student'],
      message: '{VALUE} is not a valid target role',
    },
    default: ['student'],
  },
  pinned: {
    type: Boolean,
    default: false,
  },
  publishedAt: {
    type: Date,
    default: null,
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Author ID is required'],
  },
  tags: [
    {
      type: String,
      trim: true,
      lowercase: true,
    },
  ],
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

marketUpdateSchema.index({ category: 1 });
marketUpdateSchema.index({ isPublished: 1 });
marketUpdateSchema.index({ publishedAt: -1 });
marketUpdateSchema.index({ authorId: 1 });
marketUpdateSchema.index({ pinned: -1 });
marketUpdateSchema.index({ category: 1, isPublished: 1 });

module.exports = mongoose.model('MarketUpdate', marketUpdateSchema);