const mongoose = require('mongoose');

const emailJobSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  subject: { type: String, required: true },
  html: { type: String, required: true },
  type: {
    type: String,
    enum: ['announcement', 'signal_published', 'signal_tp', 'signal_sl', 'signal_closed', 'class', 'broadcast'],
    default: 'broadcast'
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'sent', 'failed'],
    default: 'pending',
    index: true
  },
  attempts: { type: Number, default: 0 },
  lastError: { type: String, default: null },
  broadcastId: { type: String, required: true },
  processedAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null }
}, { timestamps: true });

emailJobSchema.index({ broadcastId: 1, email: 1 }, { unique: true });
emailJobSchema.index({ status: 1, createdAt: 1 });
emailJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('EmailJob', emailJobSchema);