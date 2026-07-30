const PageContent = require('../models/PageContent');
const { sendSuccess, sendError } = require('../helpers/response');

exports.getPublicContent = async (req, res, next) => {
  try {
    const { page } = req.query;
    const filter = { isActive: true };
    if (page) filter.page = page;
    const content = await PageContent.find(filter).sort({ section: 1, order: 1 });
    const grouped = {};
    content.forEach(item => {
      if (!grouped[item.section]) grouped[item.section] = [];
      grouped[item.section].push(item);
    });
    sendSuccess(res, grouped);
  } catch (error) { next(error); }
};

exports.getPageContent = async (req, res, next) => {
  try {
    const { page } = req.params;
    const content = await PageContent.find({ page }).sort({ section: 1, order: 1 });
    sendSuccess(res, content);
  } catch (error) { next(error); }
};

exports.getAllContent = async (req, res, next) => {
  try {
    const content = await PageContent.find().sort({ page: 1, section: 1, order: 1 });
    sendSuccess(res, content);
  } catch (error) { next(error); }
};

exports.createContent = async (req, res, next) => {
  try {
    const content = await PageContent.create(req.body);
    sendSuccess(res, content, 'Content created', 201);
  } catch (error) { next(error); }
};

exports.updateContent = async (req, res, next) => {
  try {
    const content = await PageContent.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!content) return sendError(res, 'Content not found', 404);
    sendSuccess(res, content, 'Content updated');
  } catch (error) { next(error); }
};

exports.deleteContent = async (req, res, next) => {
  try {
    const content = await PageContent.findByIdAndDelete(req.params.id);
    if (!content) return sendError(res, 'Content not found', 404);
    sendSuccess(res, null, 'Content deleted');
  } catch (error) { next(error); }
};

exports.bulkUpdateContent = async (req, res, next) => {
  try {
    const { items } = req.body;
    const ops = items.map(item => ({
      updateOne: {
        filter: { key: item.key },
        update: item,
        upsert: true
      }
    }));
    await PageContent.bulkWrite(ops);
    sendSuccess(res, null, 'Content bulk updated');
  } catch (error) { next(error); }
};

exports.seedContent = async (req, res, next) => {
  try {
    const defaultContent = [
      // Home - Stats
      { key: 'home_stats_students', page: 'home', section: 'stats', type: 'text', value: '18,400+', label: 'Students Trained', order: 1 },
      { key: 'home_stats_countries', page: 'home', section: 'stats', type: 'text', value: '42', label: 'Countries Represented', order: 2 },
      { key: 'home_stats_accuracy', page: 'home', section: 'stats', type: 'text', value: '91%', label: 'Signal Accuracy Tracked', order: 3 },
      { key: 'home_stats_community', page: 'home', section: 'stats', type: 'text', value: '6,200+', label: 'Active Community Members', order: 4 },

      // Home - Bottom Stats
      { key: 'home_bottom_students', page: 'home', section: 'bottom_stats', type: 'text', value: '18,400', label: 'Students', order: 1 },
      { key: 'home_bottom_courses', page: 'home', section: 'bottom_stats', type: 'text', value: '64', label: 'Courses', order: 2 },
      { key: 'home_bottom_signals', page: 'home', section: 'bottom_stats', type: 'text', value: '52,000', label: 'Signals', order: 3 },
      { key: 'home_bottom_countries', page: 'home', section: 'bottom_stats', type: 'text', value: '42', label: 'Countries', order: 4 },
      { key: 'home_bottom_payouts', page: 'home', section: 'bottom_stats', type: 'text', value: '$890K', label: 'Referral Payouts', order: 5 },

      // Home - Pricing
      { key: 'home_price', page: 'home', section: 'pricing', type: 'text', value: '$120', label: 'Price', order: 1 },
      { key: 'home_price_period', page: 'home', section: 'pricing', type: 'text', value: '/ year', label: 'Period', order: 2 },
      { key: 'home_price_subtitle', page: 'home', section: 'pricing', type: 'text', value: 'Less than $9/month', label: 'Subtitle', order: 3 },
      { key: 'home_price_guarantee', page: 'home', section: 'pricing', type: 'text', value: '14-day money-back guarantee, no questions asked.', label: 'Guarantee', order: 4 },

      // Home - Pricing Features
      { key: 'pf_1', page: 'home', section: 'pricing_features', type: 'text', value: 'Full Online Education Library', order: 1 },
      { key: 'pf_2', page: 'home', section: 'pricing_features', type: 'text', value: 'Quarterly Onsite Training Access', order: 2 },
      { key: 'pf_3', page: 'home', section: 'pricing_features', type: 'text', value: 'Daily Trading Signals', order: 3 },
      { key: 'pf_4', page: 'home', section: 'pricing_features', type: 'text', value: 'Copy Trading Access', order: 4 },
      { key: 'pf_5', page: 'home', section: 'pricing_features', type: 'text', value: 'Referral Program & Rank Progression', order: 5 },
      { key: 'pf_6', page: 'home', section: 'pricing_features', type: 'text', value: 'Priority Mentor Support', order: 6 },
      { key: 'pf_7', page: 'home', section: 'pricing_features', type: 'text', value: 'Resource Library & Templates', order: 7 },
      { key: 'pf_8', page: 'home', section: 'pricing_features', type: 'text', value: 'Completion Certificates', order: 8 },

      // About - Stats
      { key: 'about_stats_years', page: 'about', section: 'stats', type: 'text', value: '9+', label: 'Years Experience', order: 1 },
      { key: 'about_stats_students', page: 'about', section: 'stats', type: 'text', value: '18,400+', label: 'Students Trained', order: 2 },
      { key: 'about_stats_courses', page: 'about', section: 'stats', type: 'text', value: '64', label: 'Courses Delivered', order: 3 },
      { key: 'about_stats_signals', page: 'about', section: 'stats', type: 'text', value: '52,000+', label: 'Signals Delivered', order: 4 },

      // Pricing
      { key: 'pricing_price', page: 'pricing', section: 'main', type: 'text', value: '$120', label: 'Price', order: 1 },
      { key: 'pricing_period', page: 'pricing', section: 'main', type: 'text', value: '/ year', label: 'Period', order: 2 },
      { key: 'pricing_subtitle', page: 'pricing', section: 'main', type: 'text', value: 'Less than $9/month', label: 'Subtitle', order: 3 },
      { key: 'pricing_guarantee', page: 'pricing', section: 'main', type: 'text', value: '14-day money-back guarantee, no questions asked.', label: 'Guarantee', order: 4 },

      // Contact
      { key: 'contact_email', page: 'contact', section: 'info', type: 'text', value: 'support@dreamtrader.edu', label: 'Email', order: 1 },
      { key: 'contact_phone', page: 'contact', section: 'info', type: 'text', value: '+92 300 1234567', label: 'Phone', order: 2 },
      { key: 'contact_address', page: 'contact', section: 'info', type: 'text', value: 'Clifton Block 5, Karachi, Pakistan', label: 'Address', order: 3 },
    ];

    const ops = defaultContent.map(item => ({
      updateOne: { filter: { key: item.key }, update: item, upsert: true }
    }));
    await PageContent.bulkWrite(ops);
    sendSuccess(res, null, 'Default content seeded');
  } catch (error) { next(error); }
};
