const mongoose = require('mongoose');
const { sendSuccess, sendError } = require('../helpers/response');

const models = {};
const modelNames = [
  'User', 'Wallet', 'WalletTransaction', 'Subscription', 'CoursePurchase',
  'Course', 'Assignment', 'Quiz', 'Certificate', 'Signal', 'Announcement',
  'FAQ', 'PageContent', 'Contact', 'Support', 'Referral', 'Rank', 'UserRank',
  'Deposit', 'Withdrawal', 'Coupon', 'PaymentAccount', 'Setting', 'ActivityLog',
  'Notification', 'MarketOverview', 'MarketUpdate', 'Webinar', 'ZoomSession',
  'CopyTrading', 'Media', 'Class', 'StudentCRM', 'TradingAccount', 'TradingBroker',
  'UserProgress', 'TempOTP', 'ChartDrawing'
];

modelNames.forEach((name) => {
  try {
    models[name] = require(`../models/${name}`);
  } catch (e) {
    console.error(`[Backup] Could not load model: ${name}`, e.message);
  }
});

const PROTECTED_SETTINGS = [
  'platform_name', 'platform_logo', 'platform_favicon', 'site_title',
  'footer_text', 'copyright_text'
];

const COLLECTION_TO_MODEL = {};
modelNames.forEach((name) => {
  const Model = models[name];
  if (!Model) return;
  const collectionName = Model.collection.name;
  COLLECTION_TO_MODEL[collectionName] = Model;
});

exports.backup = async (req, res, next) => {
  try {
    const backup = {};
    const timestamp = new Date().toISOString();

    for (const [colName, Model] of Object.entries(COLLECTION_TO_MODEL)) {
      try {
        const docs = await Model.find({}).lean();
        backup[colName] = docs;
      } catch (e) {
        console.error(`[Backup] Error backing up ${colName}:`, e.message);
      }
    }

    const output = {
      version: '1.0',
      exportedAt: timestamp,
      database: mongoose.connection.name,
      collections: backup,
    };

    const json = JSON.stringify(output, null, 2);
    const fileName = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(json);
  } catch (error) {
    next(error);
  }
};

exports.importBackup = async (req, res, next) => {
  try {
    const data = req.body;
    if (!data || !data.collections) {
      return sendError(res, 'Invalid backup format. Expected { collections: {...} }', 400);
    }

    const collections = data.collections;
    const results = { imported: 0, errors: [] };

    for (const [colName, Model] of Object.entries(COLLECTION_TO_MODEL)) {
      const docs = collections[colName];
      if (!docs || !Array.isArray(docs) || docs.length === 0) continue;

      try {
        await Model.deleteMany({});
        const inserted = await Model.insertMany(docs);
        results.imported += inserted.length;
      } catch (err) {
        results.errors.push({ collection: colName, model: Model.modelName, error: err.message });
      }
    }

    sendSuccess(res, results, `Backup imported: ${results.imported} records`);
  } catch (error) {
    next(error);
  }
};

exports.deleteAll = async (req, res, next) => {
  try {
    const deleteOrder = [
      'WalletTransaction', 'UserProgress', 'ChartDrawing', 'TempOTP',
      'Notification', 'ActivityLog', 'StudentCRM', 'TradingAccount', 'TradingBroker',
      'PaymentAccount', 'Coupon', 'Withdrawal', 'Deposit', 'UserRank', 'Referral',
      'Support', 'Contact', 'PageContent', 'FAQ', 'Announcement', 'Signal',
      'Certificate', 'Quiz', 'Assignment', 'CoursePurchase', 'Subscription',
      'Wallet', 'User', 'Course', 'Class', 'Media', 'MarketOverview', 'MarketUpdate',
      'Webinar', 'ZoomSession', 'CopyTrading', 'Rank'
    ];

    const results = {};
    for (const modelName of deleteOrder) {
      const Model = models[modelName];
      if (!Model) continue;
      const result = await Model.deleteMany({});
      results[modelName] = result.deletedCount;
    }

    const settingsToKeep = PROTECTED_SETTINGS;
    const allSettings = await models.Setting.find({});
    const protectedIds = allSettings
      .filter((s) => settingsToKeep.includes(s.key))
      .map((s) => s._id);

    if (protectedIds.length > 0) {
      await models.Setting.deleteMany({ _id: { $nin: protectedIds } });
    }
    results.Setting = protectedIds.length;

    sendSuccess(res, results, 'All data deleted except protected settings');
  } catch (error) {
    next(error);
  }
};

exports.getStats = async (req, res, next) => {
  try {
    const stats = {};
    for (const modelName of modelNames) {
      const Model = models[modelName];
      if (!Model) continue;
      try {
        const count = await Model.countDocuments();
        stats[modelName] = count;
      } catch (e) {
        stats[modelName] = 0;
      }
    }
    sendSuccess(res, stats, 'Database stats');
  } catch (error) {
    next(error);
  }
};
