const mongoose = require('mongoose');

const crmSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  instructorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  schedule: {
    days: [{
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    }],
    startTime: { type: String, default: '09:00' },
    endTime: { type: String, default: '10:00' },
    timezone: { type: String, default: 'UTC' },
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'completed'],
    default: 'active',
  },
  notes: { type: String, maxlength: 1000, default: '' },
  emailSent: { type: Boolean, default: false },
}, { timestamps: true });

crmSchema.index({ studentId: 1 });
crmSchema.index({ instructorId: 1 });

module.exports = mongoose.model('StudentCRM', crmSchema);
