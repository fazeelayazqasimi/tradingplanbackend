const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Class title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters'],
  },
  type: {
    type: String,
    enum: ['physical', 'online'],
    required: [true, 'Class type is required'],
  },
  date: {
    type: Date,
    required: [true, 'Class date is required'],
  },
  time: {
    type: String,
    default: '',
  },
  videoUrl: {
    type: String,
    default: null,
  },
  meetLink: {
    type: String,
    default: null,
  },
  instructor: {
    type: String,
    trim: true,
    default: '',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  // Admin-managed available time slots shown to students in the enrollment form
  slots: [
    {
      label: {
        type: String,
        required: [true, 'Slot label is required'],
        trim: true,
      },
      day: {
        type: String,
        trim: true,
        default: '',
      },
      time: {
        type: String,
        trim: true,
        default: '',
      },
      capacity: {
        type: Number,
        default: 0,
        min: [0, 'Capacity cannot be negative'],
      },
    },
  ],
  enrollments: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      studentName: {
        type: String,
        trim: true,
        default: '',
      },
      studentEmail: {
        type: String,
        trim: true,
        default: '',
      },
      slotId: {
        type: mongoose.Schema.Types.ObjectId,
      },
      slotLabel: {
        type: String,
        trim: true,
        default: '',
      },
      preferredDays: {
        type: [String],
        default: [],
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
}, {
  timestamps: true,
});

classSchema.index({ date: -1 });
classSchema.index({ isActive: 1, date: -1 });

module.exports = mongoose.model('Class', classSchema);