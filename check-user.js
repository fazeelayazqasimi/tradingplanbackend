const mongoose = require('mongoose');
const User = require('./models/User');
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/trading_institute')
  .then(() => User.findOne({ role: 'student' }))
  .then(user => {
    console.log('User:', user ? user.email : 'none');
    console.log('referralCode:', user ? user.referralCode : 'N/A');
    console.log('role:', user ? user.role : 'N/A');
    if (user) {
      console.log('Full user:', user);
    }
    mongoose.disconnect();
  })
  .catch(err => { console.error(err); mongoose.disconnect(); });