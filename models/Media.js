const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['image', 'video', 'document', 'result', 'screenshot', 'gallery'],
    required: true,
  },
  title: { type: String, required: true, maxlength: 200 },
  description: { type: String, maxlength: 1000, default: '' },
  url: { type: String, default: '' },
  filePath: { type: String, default: '' },
  thumbnailUrl: { type: String, default: '' },
  tags: [{ type: String, trim: true, lowercase: true }],
  isPublished: { type: Boolean, default: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

mediaSchema.index({ type: 1 });
mediaSchema.index({ isPublished: 1 });
mediaSchema.index({ tags: 1 });

module.exports = mongoose.model('Media', mediaSchema);
