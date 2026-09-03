const mongoose = require('mongoose');
const User = require('./models/User');
const Referral = require('./models/Referral');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/trading_institute')
  .then(async () => {
    // Find a student user
    const user = await User.findOne({ role: 'student' }).select('referralCode _id firstName lastName');
    console.log('Student user:', user ? user.email : 'none');
    console.log('referralCode:', user ? user.referralCode : 'N/A');
    
    if (user) {
      // Check referral records
      const referrals = await Referral.find({ referrerId: user._id }).lean();
      console.log('Referral records count:', referrals.length);
      console.log('Referrals:', referrals.slice(0, 5));
      
      // Check tree
      const tree = await Referral.find({ referrerId: user._id }).limit(5).lean();
      console.log('Tree referrals:', tree.length);
    }
    
    mongoose.disconnect();
  })
  .catch(err => { console.error(err); mongoose.disconnect(); });