const Course = require('../models/Course');
const UserProgress = require('../models/UserProgress');
const Certificate = require('../models/Certificate');
const { sendSuccess, sendError, sendPaginated } = require('../helpers/response');
const { getPaginationOptions, buildPaginationMeta } = require('../helpers/pagination');
const { notifyStudentActivity } = require('../services/studentActivityService');

exports.getCourses = async (req, res, next) => {
  try {
    const { page, limit, sort } = getPaginationOptions(req.query);
    const search = req.query.search;
    const level = req.query.level;
    const category = req.query.category;
    const filter = { isPublished: true };
    if (req.user?.role === 'admin') delete filter.isPublished;
    if (search) filter.$or = [{ title: { $regex: search, $options: 'i' } }, { description: { $regex: search, $options: 'i' } }];
    if (level) filter.level = level;
    if (category) filter.category = category;

    const total = await Course.countDocuments(filter);
    const courses = await Course.find(filter).select('-lessons.content -lessons.quiz').sort(sort || { order: 1 }).skip((page - 1) * limit).limit(limit).populate('instructorId', 'firstName lastName email avatar');
    sendPaginated(res, courses, total, page, limit);
  } catch (error) {
    next(error);
  }
};

exports.getCourse = async (req, res, next) => {
  try {
    const course = await Course.findOne({ slug: req.params.slug }).populate('instructorId', 'firstName lastName email avatar');
    if (!course) return sendError(res, 'Course not found', 404);
    if (!course.isPublished && req.user?.role !== 'admin') return sendError(res, 'Course not found', 404);
    let progress = null;
    if (req.user) {
      progress = await UserProgress.findOne({ userId: req.user._id, courseId: course._id });
    }
    sendSuccess(res, { course, progress });
  } catch (error) {
    next(error);
  }
};

exports.createCourse = async (req, res, next) => {
  try {
    const { title, description, level, category, tags, isPublished, price } = req.body;

    const courseData = { title, description, level, category, instructorId: req.user._id, isPublished: isPublished !== undefined ? isPublished : true, price: price || 0 };
    if (tags) courseData.tags = typeof tags === 'string' ? JSON.parse(tags) : tags;
    if (req.file) courseData.thumbnail = `/uploads/courses/${req.file.filename}`;

    const course = await Course.create(courseData);
    sendSuccess(res, course, 'Course created', 201);
  } catch (error) {
    next(error);
  }
};

exports.updateCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return sendError(res, 'Course not found', 404);
    const { title, description, level, category, tags, isPublished, isFeatured, order } = req.body;
    if (title !== undefined) {
      course.title = title;
    }
    if (description !== undefined) course.description = description;
    if (level !== undefined) course.level = level;
    if (category !== undefined) course.category = category;
    if (tags !== undefined) course.tags = typeof tags === 'string' ? JSON.parse(tags) : tags;
    if (isPublished !== undefined) course.isPublished = isPublished;
    if (isFeatured !== undefined) course.isFeatured = isFeatured;
    if (req.body.price !== undefined) course.price = req.body.price;
    if (order !== undefined) course.order = order;
    if (req.file) course.thumbnail = `/uploads/courses/${req.file.filename}`;
    await course.save();
    sendSuccess(res, course, 'Course updated');
  } catch (error) {
    next(error);
  }
};

exports.deleteCourse = async (req, res, next) => {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) return sendError(res, 'Course not found', 404);
    sendSuccess(res, null, 'Course deleted');
  } catch (error) {
    next(error);
  }
};

exports.addLesson = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return sendError(res, 'Course not found', 404);
    const { title, type, content, videoUrl, videoDuration, isFree } = req.body;
    course.lessons.push({ title, type, content, videoUrl, videoDuration, isFree: isFree === 'true' || isFree === true, order: course.lessons.length + 1 });
    course.totalLessons = course.lessons.length;
    await course.save();
    sendSuccess(res, course, 'Lesson added', 201);
  } catch (error) {
    next(error);
  }
};

exports.updateLesson = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return sendError(res, 'Course not found', 404);
    const lesson = course.lessons.id(req.params.lessonId);
    if (!lesson) return sendError(res, 'Lesson not found', 404);
    Object.assign(lesson, req.body);
    await course.save();
    sendSuccess(res, course, 'Lesson updated');
  } catch (error) {
    next(error);
  }
};

exports.deleteLesson = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return sendError(res, 'Course not found', 404);
    course.lessons = course.lessons.filter(l => l._id.toString() !== req.params.lessonId);
    course.totalLessons = course.lessons.length;
    await course.save();
    sendSuccess(res, course, 'Lesson deleted');
  } catch (error) {
    next(error);
  }
};

exports.enrollCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return sendError(res, 'Course not found', 404);
    const existing = await UserProgress.findOne({ userId: req.user._id, courseId: course._id });
    if (existing) return sendError(res, 'Already enrolled', 400);
    await UserProgress.create({ userId: req.user._id, courseId: course._id, completedLessons: [], progress: 0 });
    await Course.findByIdAndUpdate(course._id, { $inc: { totalStudents: 1 } });
    sendSuccess(res, null, 'Enrolled successfully');
  } catch (error) {
    next(error);
  }
};

exports.getCourseProgress = async (req, res, next) => {
  try {
    const progress = await UserProgress.findOne({ userId: req.user._id, courseId: req.params.id });
    if (!progress) return sendError(res, 'Not enrolled', 404);
    sendSuccess(res, progress);
  } catch (error) {
    next(error);
  }
};

exports.updateProgress = async (req, res, next) => {
  try {
    const { lessonId } = req.body;
    const course = await Course.findById(req.params.id);
    if (!course) return sendError(res, 'Course not found', 404);

    let progress = await UserProgress.findOne({ userId: req.user._id, courseId: course._id });
    if (!progress) {
      progress = await UserProgress.create({ userId: req.user._id, courseId: course._id, completedLessons: [lessonId], progress: 0 });
    }

    if (!progress.completedLessons.includes(lessonId)) {
      progress.completedLessons.push(lessonId);
    }

    const totalLessons = course.lessons.length;
    if (totalLessons === 0) {
      return sendError(res, 'Course has no lessons to complete', 400);
    }
    progress.progress = Math.round((progress.completedLessons.length / totalLessons) * 100);
    if (progress.progress >= 100) {
      progress.isCompleted = true;
      progress.completedAt = new Date();
      const existingCert = await Certificate.findOne({ userId: req.user._id, courseId: course._id });
      if (!existingCert) {
        await Certificate.create({
          userId: req.user._id,
          courseId: course._id,
          completionDate: new Date(),
          grade: 'Pass',
          percentage: 100,
        });
      }
    }
    await progress.save();

    const lesson = course.lessons.find((l) => l._id.toString() === String(lessonId));
    notifyStudentActivity({
      user: req.user,
      action: 'lesson_completed',
      details: { course: course.title, lesson: lesson?.title || String(lessonId), progress: `${progress.progress}%` }
    });
    if (progress.isCompleted) {
      notifyStudentActivity({
        user: req.user,
        action: 'course_completed',
        details: { course: course.title, progress: '100%' }
      });
    }

    sendSuccess(res, progress, 'Progress updated');
  } catch (error) {
    next(error);
  }
};

exports.getEnrolledCourses = async (req, res, next) => {
  try {
    const enrollments = await UserProgress.find({ userId: req.user._id }).populate({ path: 'courseId', select: 'title slug thumbnail level category totalLessons' });
    sendSuccess(res, enrollments);
  } catch (error) {
    next(error);
  }
};
