const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender ID is required']
  },
  message: {
    type: String,
    trim: true,
    maxlength: [5000, 'Message cannot exceed 5000 characters'],
    default: ''
  },
  attachments: [{
    url: { type: String, required: true },
    type: {
      type: String,
      enum: ['image', 'video', 'document'],
      default: 'image'
    },
    name: { type: String }
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

const chatSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    unique: true
  },
  messages: [chatMessageSchema],
  lastMessageAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

chatSchema.index({ userId: 1 });
chatSchema.index({ lastMessageAt: -1 });
chatSchema.index({ updatedAt: -1 });

chatSchema.virtual('unreadCount').get(function () {
  return this.messages.filter(m => !m.isRead && String(m.sender) !== String(this.userId)).length;
});

module.exports = mongoose.model('Chat', chatSchema);
