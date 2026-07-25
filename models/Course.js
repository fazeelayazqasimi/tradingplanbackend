const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Lesson title is required'],
    trim: true,
    maxlength: [200, 'Lesson title cannot exceed 200 characters']
  },
  slug: {
    type: String,
    trim: true,
    lowercase: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Lesson description cannot exceed 1000 characters']
  },
  type: {
    type: String,
    enum: {
      values: ['video', 'text', 'quiz', 'exercise'],
      message: '{VALUE} is not a valid lesson type'
    },
    required: [true, 'Lesson type is required']
  },
  content: {
    type: String,
    default: null
  },
  videoUrl: {
    type: String,
    default: null
  },
  videoDuration: {
    type: Number,
    default: 0,
    min: [0, 'Video duration cannot be negative']
  },
  order: {
    type: Number,
    required: [true, 'Lesson order is required'],
    min: [0, 'Lesson order cannot be negative']
  },
  isFree: {
    type: Boolean,
    default: false
  },
  quiz: {
    questions: [{
      question: { type: String, trim: true },
      options: [{ type: String, trim: true }],
      correctAnswer: { type: Number, min: 0 },
      explanation: { type: String, trim: true }
    }],
    timeLimit: { type: Number, default: 0 },
    passingScore: { type: Number, default: 70, min: 0, max: 100 }
  }
}, { _id: true });

const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Course title is required'],
    trim: true,
    maxlength: [200, 'Course title cannot exceed 200 characters']
  },
  slug: {
    type: String,
    unique: true,
    trim: true,
    lowercase: true
  },
  description: {
    type: String,
    required: [true, 'Course description is required'],
    trim: true,
    maxlength: [5000, 'Course description cannot exceed 5000 characters']
  },
  thumbnail: {
    type: String,
    default: null
  },
  level: {
    type: String,
    enum: {
      values: ['beginner', 'intermediate', 'advanced'],
      message: '{VALUE} is not a valid course level'
    },
    required: [true, 'Course level is required']
  },
  category: {
    type: String,
    required: [true, 'Course category is required'],
    trim: true
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  instructorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Instructor is required']
  },
  lessons: [lessonSchema],
  totalDuration: {
    type: Number,
    default: 0,
    min: [0, 'Total duration cannot be negative']
  },
  totalLessons: {
    type: Number,
    default: 0,
    min: [0, 'Total lessons cannot be negative']
  },
  totalStudents: {
    type: Number,
    default: 0,
    min: [0, 'Total students cannot be negative']
  },
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0, min: 0 }
  },
  price: {
    type: Number,
    default: 0,
    min: [0, 'Price cannot be negative']
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0,
    min: [0, 'Order cannot be negative']
  },
  prerequisites: [{
    type: String,
    trim: true
  }],
  learningObjectives: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

courseSchema.index({ instructorId: 1 });
courseSchema.index({ level: 1 });
courseSchema.index({ category: 1 });
courseSchema.index({ isPublished: 1 });
courseSchema.index({ isFeatured: 1 });
courseSchema.index({ order: 1 });
courseSchema.index({ tags: 1 });
courseSchema.index({ title: 'text', description: 'text', tags: 'text' });

courseSchema.pre('save', async function (next) {
  try {
    if (this.isModified('title') || (this.isNew && !this.slug)) {
      let baseSlug = this.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      let slug = baseSlug;
      let counter = 1;
      while (await mongoose.models.Course.findOne({ slug, _id: { $ne: this._id } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      this.slug = slug;
    }

    this.lessons.forEach((lesson, index) => {
      if (lesson.isModified('title') || lesson.isNew) {
        lesson.slug = lesson.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + (index + 1);
      }
    });

    this.totalLessons = this.lessons.length;
    this.totalDuration = this.lessons.reduce((sum, lesson) => sum + (lesson.videoDuration || 0), 0);

    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Course', courseSchema);
