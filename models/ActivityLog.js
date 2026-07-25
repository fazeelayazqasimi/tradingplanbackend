const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  action: {
    type: String,
    required: [true, 'Action is required'],
    trim: true,
    maxlength: [200, 'Action cannot exceed 200 characters']
  },
  entity: {
    type: String,
    required: [true, 'Entity is required'],
    trim: true,
    maxlength: [100, 'Entity cannot exceed 100 characters']
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'Entity ID is required']
  },
  changes: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  ipAddress: {
    type: String,
    trim: true,
    maxlength: [50, 'IP address cannot exceed 50 characters'],
    default: null
  },
  userAgent: {
    type: String,
    trim: true,
    maxlength: [500, 'User agent cannot exceed 500 characters'],
    default: null
  },
  status: {
    type: String,
    enum: {
      values: ['success', 'failure', 'warning'],
      message: '{VALUE} is not a valid status'
    },
    default: 'success'
  },
  errorMessage: {
    type: String,
    trim: true,
    maxlength: [2000, 'Error message cannot exceed 2000 characters'],
    default: null
  },
  duration: {
    type: Number,
    default: null,
    comment: 'Duration in milliseconds'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  sessionId: {
    type: String,
    trim: true,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

activityLogSchema.index({ userId: 1 });
activityLogSchema.index({ action: 1 });
activityLogSchema.index({ entity: 1 });
activityLogSchema.index({ entityId: 1 });
activityLogSchema.index({ status: 1 });
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ entity: 1, entityId: 1 });
activityLogSchema.index({ action: 1, entity: 1 });

activityLogSchema.pre('save', function (next) {
  if (this.isModified('changes') && this.changes) {
    if (typeof this.changes === 'object') {
      this.changes = JSON.parse(JSON.stringify(this.changes));
    }
  }
  next();
});

activityLogSchema.statics.logActivity = function (data) {
  return this.create({
    userId: data.userId,
    action: data.action,
    entity: data.entity,
    entityId: data.entityId,
    changes: data.changes || null,
    ipAddress: data.ipAddress || null,
    userAgent: data.userAgent || null,
    status: data.status || 'success',
    errorMessage: data.errorMessage || null,
    duration: data.duration || null,
    metadata: data.metadata || null,
    sessionId: data.sessionId || null
  });
};

module.exports = mongoose.model('ActivityLog', activityLogSchema);
