const mongoose = require('mongoose');

const zoomSessionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Session title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [5000, 'Description cannot exceed 5000 characters'],
    default: null,
  },
  zoomLink: {
    type: String,
    trim: true,
    default: null,
  },
  date: {
    type: Date,
    required: [true, 'Session date is required'],
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
    default: 50,
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
  isRecurring: {
    type: Boolean,
    default: false,
  },
  recurrencePattern: {
    type: String,
    enum: {
      values: ['daily', 'weekly', 'monthly'],
      message: '{VALUE} is not a valid recurrence pattern',
    },
    default: null,
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
      values: ['free-zoom', 'premium-zoom'],
      message: '{VALUE} is not a valid session category',
    },
    default: 'free-zoom',
  },
  thumbnail: {
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

zoomSessionSchema.index({ date: 1 });
zoomSessionSchema.index({ category: 1 });
zoomSessionSchema.index({ isPublished: 1 });
zoomSessionSchema.index({ isRecurring: 1 });
zoomSessionSchema.index({ instructorId: 1 });
zoomSessionSchema.index({ createdAt: -1 });

zoomSessionSchema.virtual('isUpcoming').get(function () {
  return this.date > new Date() && this.isPublished;
});

zoomSessionSchema.virtual('isCompleted').get(function () {
  return this.date < new Date() && this.isPublished;
});

module.exports = mongoose.model('ZoomSession', zoomSessionSchema);