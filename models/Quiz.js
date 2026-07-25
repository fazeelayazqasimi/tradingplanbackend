const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: [true, 'Question text is required'],
    trim: true,
    maxlength: [2000, 'Question cannot exceed 2000 characters']
  },
  options: {
    type: [String],
    required: [true, 'Options are required'],
    validate: {
      validator: function (options) {
        return options.length >= 2 && options.length <= 10;
      },
      message: 'A question must have between 2 and 10 options'
    }
  },
  correctAnswer: {
    type: Number,
    required: [true, 'Correct answer index is required'],
    validate: {
      validator: function (index) {
        return index >= 0 && index < this.options.length;
      },
      message: 'Correct answer index must be within the options range'
    }
  },
  explanation: {
    type: String,
    trim: true,
    maxlength: [1000, 'Explanation cannot exceed 1000 characters'],
    default: null
  },
  points: {
    type: Number,
    default: 1,
    min: [1, 'Points must be at least 1']
  }
}, { _id: true });

const attemptSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  answers: [{
    questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    selectedOption: { type: Number, required: true },
    isCorrect: { type: Boolean, default: false }
  }],
  score: {
    type: Number,
    required: [true, 'Score is required'],
    min: [0, 'Score cannot be negative']
  },
  totalPoints: {
    type: Number,
    required: true,
    min: [0, 'Total points cannot be negative']
  },
  percentage: {
    type: Number,
    min: [0, 'Percentage cannot be negative'],
    max: [100, 'Percentage cannot exceed 100']
  },
  passed: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
    default: Date.now
  },
  timeTaken: {
    type: Number,
    default: 0,
    min: [0, 'Time taken cannot be negative']
  }
}, { _id: true });

const quizSchema = new mongoose.Schema({
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
    required: [true, 'Quiz title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  questions: {
    type: [questionSchema],
    validate: {
      validator: function (questions) {
        return questions.length > 0;
      },
      message: 'Quiz must have at least one question'
    }
  },
  timeLimit: {
    type: Number,
    default: 0,
    min: [0, 'Time limit cannot be negative'],
    comment: 'Time limit in minutes, 0 means no limit'
  },
  passingScore: {
    type: Number,
    default: 70,
    min: [0, 'Passing score cannot be negative'],
    max: [100, 'Passing score cannot exceed 100']
  },
  maxAttempts: {
    type: Number,
    default: 3,
    min: [1, 'Maximum attempts must be at least 1']
  },
  attempts: [attemptSchema],
  totalAttempts: {
    type: Number,
    default: 0,
    min: [0, 'Total attempts cannot be negative']
  },
  averageScore: {
    type: Number,
    default: 0,
    min: [0, 'Average score cannot be negative']
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  shuffleQuestions: {
    type: Boolean,
    default: true
  },
  showResults: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

quizSchema.index({ courseId: 1 });
quizSchema.index({ lessonId: 1 });
quizSchema.index({ isPublished: 1 });
quizSchema.index({ 'attempts.userId': 1 });

quizSchema.pre('save', function (next) {
  this.totalAttempts = this.attempts.length;
  if (this.attempts.length > 0) {
    const totalScore = this.attempts.reduce((sum, attempt) => sum + (attempt.percentage || 0), 0);
    this.averageScore = totalScore / this.attempts.length;
  }
  next();
});

module.exports = mongoose.model('Quiz', quizSchema);
