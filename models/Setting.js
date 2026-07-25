const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  key: {
    type: String,
    required: [true, 'Setting key is required'],
    unique: true,
    trim: true,
    maxlength: [200, 'Key cannot exceed 200 characters']
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'Setting value is required']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
    default: null
  },
  category: {
    type: String,
    enum: {
      values: [
        'general',
        'subscription',
        'referral',
        'rank',
        'trading',
        'withdrawal',
        'smtp',
        'theme',
        'notification',
        'security',
        'payment',
        'api'
      ],
      message: '{VALUE} is not a valid setting category'
    },
    required: [true, 'Setting category is required']
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  isPublic: {
    type: Boolean,
    default: false,
    comment: 'Whether this setting is accessible to non-admin users'
  },
  isEncrypted: {
    type: Boolean,
    default: false,
    comment: 'Whether this setting value is encrypted'
  },
  validationRegex: {
    type: String,
    trim: true,
    default: null
  },
  minValue: {
    type: Number,
    default: null
  },
  maxValue: {
    type: Number,
    default: null
  },
  allowedValues: [{
    type: mongoose.Schema.Types.Mixed
  }],
  lastModifiedAt: {
    type: Date,
    default: Date.now
  },
  previousValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

settingSchema.index({ category: 1 });
settingSchema.index({ isPublic: 1 });
settingSchema.index({ category: 1, key: 1 });

settingSchema.pre('save', function (next) {
  this.lastModifiedAt = new Date();
  next();
});

settingSchema.statics.getByKey = function (key, defaultValue = null) {
  return this.findOne({ key }).then(setting => {
    if (!setting) return defaultValue;
    return setting.value;
  });
};

settingSchema.statics.getByCategory = function (category) {
  return this.find({ category }).sort({ key: 1 });
};

settingSchema.statics.setByKey = async function (key, value, updatedBy = null) {
  const setting = await this.findOneAndUpdate(
    { key },
    { value, updatedBy, lastModifiedAt: new Date() },
    { upsert: true, new: true, runValidators: true }
  );
  return setting;
};

module.exports = mongoose.model('Setting', settingSchema);
