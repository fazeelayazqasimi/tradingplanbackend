const mongoose = require('mongoose');

const userProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },
  completedLessons: [{
    type: String,
  }],
  currentLessonId: {
    type: String,
    default: null,
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
  quizScores: [{
    lessonId: String,
    score: Number,
    completedAt: Date,
  }],
  enrolledAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

userProgressSchema.index({ userId: 1, courseId: 1 }, { unique: true });

module.exports = mongoose.model('UserProgress', userProgressSchema);
