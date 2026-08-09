const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Announcement title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  content: {
    type: String,
    required: [true, 'Announcement content is required'],
    trim: true,
    maxlength: [10000, 'Content cannot exceed 10000 characters']
  },
  image: {
    type: String,
    trim: true,
    default: null
  },
  type: {
    type: String,
    enum: {
      values: ['general', 'course', 'signal', 'system'],
      message: '{VALUE} is not a valid announcement type'
    },
    required: [true, 'Announcement type is required']
  },
  targetRoles: [{
    type: String,
    enum: {
      values: ['admin', 'student'],
      message: '{VALUE} is not a valid target role'
    }
  }],
  targetUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isPublished: {
    type: Boolean,
    default: false
  },
  publishedAt: {
    type: Date,
    default: null
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Author ID is required']
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    default: null
  },
  priority: {
    type: String,
    enum: {
      values: ['low', 'medium', 'high', 'urgent'],
      message: '{VALUE} is not a valid priority'
    },
    default: 'medium'
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    default: null
  },
  readBy: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    readAt: { type: Date, default: Date.now }
  }],
  attachments: [{
    fileName: { type: String, trim: true },
    fileUrl: { type: String, trim: true },
    fileSize: { type: Number, min: 0 }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

announcementSchema.index({ type: 1 });
announcementSchema.index({ isPublished: 1 });
announcementSchema.index({ publishedAt: -1 });
announcementSchema.index({ authorId: 1 });
announcementSchema.index({ targetRoles: 1 });
announcementSchema.index({ targetUsers: 1 });
announcementSchema.index({ courseId: 1 });
announcementSchema.index({ isPinned: 1 });
announcementSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Announcement', announcementSchema);
