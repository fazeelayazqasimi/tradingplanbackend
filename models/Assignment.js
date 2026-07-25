const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  fileUrl: {
    type: String,
    required: [true, 'File URL is required'],
    trim: true
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  grade: {
    type: Number,
    min: [0, 'Grade cannot be negative'],
    max: [100, 'Grade cannot exceed 100'],
    default: null
  },
  feedback: {
    type: String,
    trim: true,
    maxlength: [2000, 'Feedback cannot exceed 2000 characters'],
    default: null
  },
  gradedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  gradedAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: {
      values: ['submitted', 'graded', 'returned'],
      message: '{VALUE} is not a valid submission status'
    },
    default: 'submitted'
  }
}, { _id: true });

const assignmentSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'Course ID is required']
  },
  lessonId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  title: {
    type: String,
    required: [true, 'Assignment title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Assignment description is required'],
    trim: true,
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required'],
    validate: {
      validator: function (value) {
        if (!this.isNew) return true;
        return value > new Date();
      },
      message: 'Due date must be in the future'
    }
  },
  maxScore: {
    type: Number,
    required: [true, 'Maximum score is required'],
    min: [1, 'Maximum score must be at least 1']
  },
  submissions: [submissionSchema],
  totalSubmissions: {
    type: Number,
    default: 0,
    min: [0, 'Total submissions cannot be negative']
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  allowLateSubmission: {
    type: Boolean,
    default: false
  },
  latePenaltyPercent: {
    type: Number,
    default: 0,
    min: [0, 'Late penalty cannot be negative'],
    max: [100, 'Late penalty cannot exceed 100%']
  },
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

assignmentSchema.index({ courseId: 1 });
assignmentSchema.index({ lessonId: 1 });
assignmentSchema.index({ dueDate: 1 });
assignmentSchema.index({ isPublished: 1 });
assignmentSchema.index({ 'submissions.userId': 1 });

assignmentSchema.pre('save', function (next) {
  this.totalSubmissions = this.submissions.length;
  next();
});

module.exports = mongoose.model('Assignment', assignmentSchema);
