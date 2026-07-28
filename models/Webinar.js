const mongoose = require('mongoose');

const webinarSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Webinar title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [5000, 'Description cannot exceed 5000 characters'],
    default: null,
  },
  webinarUrl: {
    type: String,
    trim: true,
    default: null,
  },
  date: {
    type: Date,
    required: [true, 'Webinar date is required'],
  },
  duration: {
    type: Number,
    default: 60,
    min: [1, 'Duration must be at least 1 minute'],
    max: [480, 'Duration cannot exceed 480 minutes'],
  },
  instructorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Instructor ID is required'],
  },
  instructorName: {
    type: String,
    trim: true,
    default: null,
  },
  maxParticipants: {
    type: Number,
    default: 100,
    min: [1, 'Max participants must be at least 1'],
  },
  registeredCount: {
    type: Number,
    default: 0,
  },
  isPublished: {
    type: Boolean,
    default: false,
  },
  isFree: {
    type: Boolean,
    default: true,
  },
  targetRoles: {
    type: [String],
    enum: {
      values: ['admin', 'student'],
      message: '{VALUE} is not a valid target role',
    },
    default: ['student'],
  },
  category: {
    type: String,
    enum: {
      values: ['free-webinar', 'premium-webinar', 'zoom-session', 'market-update'],
      message: '{VALUE} is not a valid webinar category',
    },
    default: 'free-webinar',
  },
  thumbnail: {
    type: String,
    default: null,
  },
  recordedUrl: {
    type: String,
    default: null,
  },
  tags: [
    {
      type: String,
      trim: true,
      lowercase: true,
    },
  ],
  registrations: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      registeredAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator ID is required'],
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

webinarSchema.index({ date: 1 });
webinarSchema.index({ category: 1 });
webinarSchema.index({ isPublished: 1 });
webinarSchema.index({ isFree: 1 });
webinarSchema.index({ instructorId: 1 });
webinarSchema.index({ createdAt: -1 });

webinarSchema.virtual('isUpcoming').get(function () {
  return this.date > new Date() && this.isPublished;
});

webinarSchema.virtual('isCompleted').get(function () {
  return this.date < new Date() && this.isPublished;
});

module.exports = mongoose.model('Webinar', webinarSchema);