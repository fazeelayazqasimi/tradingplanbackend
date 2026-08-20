const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 200 },
  images: [{ type: String }],
  videos: [{ type: String }],
  documents: [{ type: String }],
  isPublished: { type: Boolean, default: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

mediaSchema.index({ isPublished: 1 });

module.exports = mongoose.model('Media', mediaSchema);
