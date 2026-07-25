const mongoose = require('mongoose');
const crypto = require('crypto');

const certificateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'Course ID is required']
  },
  certificateNumber: {
    type: String,
    unique: true,
    required: [true, 'Certificate number is required'],
    trim: true
  },
  issueDate: {
    type: Date,
    default: Date.now
  },
  completionDate: {
    type: Date,
    required: [true, 'Completion date is required']
  },
  grade: {
    type: String,
    enum: {
      values: ['A', 'B', 'C', 'D', 'F', 'Pass', 'Fail'],
      message: '{VALUE} is not a valid grade'
    },
    required: [true, 'Grade is required']
  },
  percentage: {
    type: Number,
    min: [0, 'Percentage cannot be negative'],
    max: [100, 'Percentage cannot exceed 100']
  },
  totalScore: {
    type: Number,
    min: [0, 'Total score cannot be negative']
  },
  maxScore: {
    type: Number,
    min: [1, 'Max score must be at least 1']
  },
  status: {
    type: String,
    enum: {
      values: ['active', 'revoked', 'expired'],
      message: '{VALUE} is not a valid certificate status'
    },
    default: 'active'
  },
  revokedAt: {
    type: Date,
    default: null
  },
  revokedReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Revoked reason cannot exceed 500 characters'],
    default: null
  },
  verificationUrl: {
    type: String,
    default: null
  },
  pdfUrl: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

certificateSchema.index({ userId: 1 });
certificateSchema.index({ courseId: 1 });
certificateSchema.index({ status: 1 });
certificateSchema.index({ userId: 1, courseId: 1 }, { unique: true });

certificateSchema.pre('save', async function (next) {
  if (!this.certificateNumber) {
    const prefix = 'CERT';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    this.certificateNumber = `${prefix}-${timestamp}-${random}`;
  }
  next();
});

module.exports = mongoose.model('Certificate', certificateSchema);
