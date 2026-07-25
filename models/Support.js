const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender ID is required']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [5000, 'Message cannot exceed 5000 characters']
  },
  attachments: [{
    fileName: { type: String, trim: true },
    fileUrl: { type: String, trim: true },
    fileSize: { type: Number, min: 0 }
  }],
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const supportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  ticketNumber: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    maxlength: [200, 'Subject cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [5000, 'Message cannot exceed 5000 characters']
  },
  category: {
    type: String,
    enum: {
      values: ['general', 'technical', 'billing', 'other'],
      message: '{VALUE} is not a valid category'
    },
    required: [true, 'Category is required']
  },
  status: {
    type: String,
    enum: {
      values: ['open', 'in_progress', 'resolved', 'closed'],
      message: '{VALUE} is not a valid status'
    },
    default: 'open'
  },
  priority: {
    type: String,
    enum: {
      values: ['low', 'medium', 'high', 'urgent'],
      message: '{VALUE} is not a valid priority'
    },
    default: 'medium'
  },
  messages: [messageSchema],
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  closedAt: {
    type: Date,
    default: null
  },
  lastResponseAt: {
    type: Date,
    default: null
  },
  responseTime: {
    type: Number,
    default: null,
    comment: 'Response time in minutes'
  },
  satisfactionRating: {
    type: Number,
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5'],
    default: null
  },
  satisfactionComment: {
    type: String,
    trim: true,
    maxlength: [500, 'Comment cannot exceed 500 characters'],
    default: null
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  relatedCourseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    default: null
  },
  internalNotes: [{
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

supportSchema.index({ userId: 1 });
supportSchema.index({ status: 1 });
supportSchema.index({ priority: 1 });
supportSchema.index({ category: 1 });
supportSchema.index({ assignedTo: 1 });
supportSchema.index({ createdAt: -1 });
supportSchema.index({ lastResponseAt: -1 });
supportSchema.index({ tags: 1 });

supportSchema.pre('save', async function (next) {
  if (!this.ticketNumber && this.isNew) {
    const prefix = 'TKT';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.ticketNumber = `${prefix}-${timestamp}-${random}`;
  }

  if (this.isModified('messages') && this.messages.length > 0) {
    const lastMessage = this.messages[this.messages.length - 1];
    this.lastResponseAt = lastMessage.createdAt;
  }

  next();
});

module.exports = mongoose.model('Support', supportSchema);
