const Setting = require('../models/Setting');
const { sendSuccess, sendError } = require('../helpers/response');

exports.getPublicSettings = async (req, res, next) => {
  try {
    const settings = await Setting.find({ category: { $in: ['general', 'subscription'] } }).select('key value');
    const obj = settings.reduce((a, s) => { a[s.key] = s.value; return a; }, {});
    sendSuccess(res, obj);
  } catch (error) { next(error); }
};

exports.getAllSettings = async (req, res, next) => {
  try {
    const settings = await Setting.find().sort('category key');
    sendSuccess(res, settings);
  } catch (error) { next(error); }
};

exports.updateSetting = async (req, res, next) => {
  try {
    const { key, value, description, category } = req.body;
    const setting = await Setting.findOneAndUpdate({ key }, { value, description, category, updatedBy: req.user._id }, { new: true, upsert: true });
    sendSuccess(res, setting, 'Setting updated');
  } catch (error) { next(error); }
};

exports.bulkUpdateSettings = async (req, res, next) => {
  try {
    const { settings } = req.body;
    const ops = settings.map(s => ({ updateOne: { filter: { key: s.key }, update: { ...s, updatedBy: req.user._id }, upsert: true } }));
    await Setting.bulkWrite(ops);
    sendSuccess(res, null, 'Settings updated');
  } catch (error) { next(error); }
};

exports.uploadLogoSetting = async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 'No file uploaded', 400);
    const logoUrl = `/uploads/branding/${req.file.filename}`;
    await Setting.findOneAndUpdate(
      { key: 'institute_logo' },
      { value: logoUrl, category: 'general', description: 'Institute logo URL' },
      { new: true, upsert: true }
    );
    sendSuccess(res, { url: logoUrl, key: 'institute_logo' }, 'Logo uploaded successfully');
  } catch (error) { next(error); }
};
