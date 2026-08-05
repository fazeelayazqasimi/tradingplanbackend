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
       { key: 'home_stats_students', page: 'home', section: 'stats', type: 'text', value: '300+', label: 'Students', order: 1 },
       { key: 'home_stats_courses', page: 'home', section: 'stats', type: 'text', value: '14', label: 'Courses', order: 2 },
       { key: 'home_stats_signals', page: 'home', section: 'stats', type: 'text', value: '1,000+', label: 'Signals', order: 3 },
       { key: 'home_stats_countries', page: 'home', section: 'stats', type: 'text', value: '5', label: 'Countries', order: 4 },
       { key: 'home_stats_payout', page: 'home', section: 'stats', type: 'text', value: '$5,000+', label: 'Payout', order: 5 },

       // Home - Bottom Stats
       { key: 'home_bottom_students', page: 'home', section: 'bottom_stats', type: 'text', value: '300+', label: 'Students', order: 1 },
       { key: 'home_bottom_courses', page: 'home', section: 'bottom_stats', type: 'text', value: '14', label: 'Courses', order: 2 },
       { key: 'home_bottom_signals', page: 'home', section: 'bottom_stats', type: 'text', value: '1,000+', label: 'Signals', order: 3 },
       { key: 'home_bottom_countries', page: 'home', section: 'bottom_stats', type: 'text', value: '5', label: 'Countries', order: 4 },
       { key: 'home_bottom_payouts', page: 'home', section: 'bottom_stats', type: 'text', value: '$5,000+', label: 'Payout', order: 5 },

       // Home - Pricing
       { key: 'home_price', page: 'home', section: 'pricing', type: 'text', value: '$120', label: 'Price', order: 1 },
       { key: 'home_price_period', page: 'home', section: 'pricing', type: 'text', value: '/ year', label: 'Period', order: 2 },
       { key: 'home_price_subtitle', page: 'home', section: 'pricing', type: 'text', value: 'Less than $10/month', label: 'Subtitle', order: 3 },
       { key: 'home_price_features_text', page: 'home', section: 'pricing', type: 'text', value: 'Education • Signals • Copy Trading • Affiliate Rewards • Profit Sharing', label: 'Features Text', order: 4 },

       // Home - Pricing Features
       { key: 'pf_1', page: 'home', section: 'pricing_features', type: 'text', value: 'Complete Forex Education', order: 1 },
       { key: 'pf_2', page: 'home', section: 'pricing_features', type: 'text', value: 'Physical Classes in Karachi', order: 2 },
       { key: 'pf_3', page: 'home', section: 'pricing_features', type: 'text', value: 'Live Online Classes', order: 3 },
       { key: 'pf_4', page: 'home', section: 'pricing_features', type: 'text', value: 'Daily Trading Signals', order: 4 },
       { key: 'pf_5', page: 'home', section: 'pricing_features', type: 'text', value: 'Copy Trading Access', order: 5 },
       { key: 'pf_6', page: 'home', section: 'pricing_features', type: 'text', value: 'High-Reward Affiliate Program', order: 6 },
       { key: 'pf_7', page: 'home', section: 'pricing_features', type: 'text', value: 'Profit Sharing Opportunities', order: 7 },
       { key: 'pf_8', page: 'home', section: 'pricing_features', type: 'text', value: 'Members Community & Support', order: 8 },

       // About - Stats
       { key: 'about_stats_students', page: 'about', section: 'stats', type: 'text', value: '300+', label: 'Students', order: 1 },
       { key: 'about_stats_courses', page: 'about', section: 'stats', type: 'text', value: '14', label: 'Courses', order: 2 },
       { key: 'about_stats_signals', page: 'about', section: 'stats', type: 'text', value: '1,000+', label: 'Signals', order: 3 },
       { key: 'about_stats_countries', page: 'about', section: 'stats', type: 'text', value: '5', label: 'Countries', order: 4 },
       { key: 'about_stats_payout', page: 'about', section: 'stats', type: 'text', value: '$5,000+', label: 'Payout', order: 5 },

       // Pricing
       { key: 'pricing_price', page: 'pricing', section: 'main', type: 'text', value: '$120', label: 'Price', order: 1 },
       { key: 'pricing_period', page: 'pricing', section: 'main', type: 'text', value: '/ year', label: 'Period', order: 2 },
       { key: 'pricing_subtitle', page: 'pricing', section: 'main', type: 'text', value: 'Less than $10/month', label: 'Subtitle', order: 3 },
       { key: 'pricing_features_text', page: 'pricing', section: 'main', type: 'text', value: 'Education • Signals • Copy Trading • Affiliate Rewards • Profit Sharing', label: 'Features Text', order: 4 },
       { key: 'pricing_pf_1', page: 'pricing', section: 'features', type: 'text', value: 'Complete Forex Education', order: 1 },
       { key: 'pricing_pf_2', page: 'pricing', section: 'features', type: 'text', value: 'Physical Classes in Karachi', order: 2 },
       { key: 'pricing_pf_3', page: 'pricing', section: 'features', type: 'text', value: 'Live Online Classes', order: 3 },
       { key: 'pricing_pf_4', page: 'pricing', section: 'features', type: 'text', value: 'Daily Trading Signals', order: 4 },
       { key: 'pricing_pf_5', page: 'pricing', section: 'features', type: 'text', value: 'Copy Trading Access', order: 5 },
       { key: 'pricing_pf_6', page: 'pricing', section: 'features', type: 'text', value: 'High-Reward Affiliate Program', order: 6 },
       { key: 'pricing_pf_7', page: 'pricing', section: 'features', type: 'text', value: 'Profit Sharing Opportunities', order: 7 },
        { key: 'pricing_pf_8', page: 'pricing', section: 'features', type: 'text', value: 'Members Community & Support', order: 8 },

       // Education Section
       { key: 'education_heading', page: 'home', section: 'education', type: 'text', value: 'EDUCATION', label: 'Heading', order: 1 },
       { key: 'education_title', page: 'home', section: 'education', type: 'text', value: 'Learn Forex the Right Way.', label: 'Title', order: 2 },
       { key: 'education_intro', page: 'home', section: 'education', type: 'text', value: 'The 4X Hub provides structured Forex education through our Educational Partner, Dream Trader Academy.', label: 'Introduction', order: 3 },
       { key: 'education_curriculum', page: 'home', section: 'education', type: 'text', value: 'Beginner to Advanced Forex Curriculum', label: 'Curriculum', order: 4 },
       { key: 'education_live', page: 'home', section: 'education', type: 'text', value: 'Live Classroom Sessions', label: 'Live Sessions', order: 5 },
       { key: 'education_online', page: 'home', section: 'education', type: 'text', value: 'Online Interactive Classes', label: 'Online Classes', order: 6 },
       { key: 'education_analysis', page: 'home', section: 'education', type: 'text', value: 'Practical Market Analysis', label: 'Analysis', order: 7 },
       { key: 'education_psychology', page: 'home', section: 'education', type: 'text', value: 'Trading Psychology', label: 'Psychology', order: 8 },
       { key: 'education_risk', page: 'home', section: 'education', type: 'text', value: 'Risk Management', label: 'Risk Management', order: 9 },
       { key: 'education_qa', page: 'home', section: 'education', type: 'text', value: 'Weekly Q&A Sessions', label: 'Q&A', order: 10 },
       { key: 'education_community', page: 'home', section: 'education', type: 'text', value: 'Lifetime Learning Community', label: 'Community', order: 11 },
       { key: 'education_weekday', page: 'home', section: 'education', type: 'text', value: 'Weekday Batch – Wednesday & Thursday | 7:30 PM – 9:30 PM (PKT)', label: 'Weekday Batch', order: 12 },
       { key: 'education_weekend', page: 'home', section: 'education', type: 'text', value: 'Weekend Batch – Saturday & Sunday | 6:00 PM – 8:00 PM (PKT)', label: 'Weekend Batch', order: 13 },
       { key: 'education_online_batch', page: 'home', section: 'education', type: 'text', value: 'Online Batch – Monday & Tuesday | 8:30 PM – 10:00 PM (PKT)', label: 'Online Batch', order: 14 },
       { key: 'education_member_benefits', page: 'home', section: 'education', type: 'text', value: 'Professional Education, Study Materials, Class Recordings, Mentor Support, Live Q&A Sessions, Trading Signals, Copy Trading Access, Certificates and Community Support.', label: 'Member Benefits', order: 15 },
       { key: 'education_cta', page: 'home', section: 'education', type: 'text', value: 'Start Learning Today', label: 'CTA Button', order: 16 },

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
