/**
 * studentActivityService — centralized student activity notifications.
 *
 * Whenever a student performs any activity (login, registration, activation,
 * course purchase, lesson completion, quiz submission, withdrawal request,
 * etc.), the activity is:
 *   1. logged into the ActivityLog collection, and
 *   2. reported by email to the admin inbox (the4xhub@gmail.com by default,
 *      overridable via the `admin_notification_email` setting).
 *
 * High-frequency actions (e.g. login) are throttled so the admin inbox is
 * not flooded when a user refreshes pages repeatedly.
 */
const ActivityLog = require('../models/ActivityLog');
const { sendAdminActivityEmail } = require('./emailService');

const ACTION_LABELS = {
  registration: 'Registered',
  login: 'Logged In',
  password_changed: 'Changed Password',
  profile_updated: 'Updated Profile',
  email_changed: 'Changed Email',
  account_activated: 'Account Activated',
  course_enrollment_pending: 'Requested Course Enrollment',
  course_purchased: 'Purchased Course',
  lesson_completed: 'Completed Lesson',
  course_completed: 'Completed Course',
  quiz_submitted: 'Submitted Quiz',
  certificate_issued: 'Earned Certificate',
  withdrawal_requested: 'Requested Withdrawal',
  deposit_requested: 'Requested Deposit',
  assignment_submitted: 'Submitted Assignment'
};

const THROTTLE_SECONDS = {
  login: 300,
  logout: 60,
  default: 0
};

/**
 * @param {Object}   opts
 * @param {Object}   opts.user                 - { _id, firstName, lastName, email }
 * @param {string}   opts.action               - activity key (see ACTION_LABELS)
 * @param {Object}   [opts.details]            - extra info shown in the email
 * @param {string}   [opts.entity='Student']   - ActivityLog entity
 * @param {ObjectId} [opts.entityId]           - ActivityLog entity id (defaults to user id)
 * @param {number}   [opts.throttleSeconds]    - override the throttle for this action
 *
 * Never throws — all failures are logged and swallowed so the caller flow
 * is never affected.
 */
const notifyStudentActivity = async ({ user, action, details = null, entity = 'Student', entityId = null, throttleSeconds = null }) => {
  try {
    if (!user || !user._id || !user.email) return;

    const interval = throttleSeconds !== null
      ? throttleSeconds
      : (THROTTLE_SECONDS[action] !== undefined ? THROTTLE_SECONDS[action] : THROTTLE_SECONDS.default);

    let shouldEmail = true;
    if (interval > 0) {
      const since = new Date(Date.now() - interval * 1000);
      const recent = await ActivityLog.findOne({
        userId: user._id,
        action,
        'metadata.adminNotified': true,
        createdAt: { $gte: since }
      }).lean();
      if (recent) shouldEmail = false;
    }

    await ActivityLog.logActivity({
      userId: user._id,
      action,
      entity,
      entityId: entityId || user._id,
      changes: details ? { ...details } : null,
      metadata: { adminNotified: shouldEmail, source: 'student_activity' }
    });

    if (shouldEmail) {
      sendAdminActivityEmail(user, {
        action,
        label: ACTION_LABELS[action] || action,
        details
      }).catch((e) => console.error('[EMAIL] sendAdminActivityEmail:', e.message));
    }
  } catch (e) {
    console.error('[STUDENT ACTIVITY]', e.message);
  }
};

module.exports = { notifyStudentActivity, ACTION_LABELS };
