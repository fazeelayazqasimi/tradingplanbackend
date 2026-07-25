require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  
  // Make admin@dreamtrader.com an admin
  const result = await User.updateOne(
    { email: 'admin@dreamtrader.com' },
    { $set: { role: 'admin', isEmailVerified: true } }
  );
  
  if (result.modifiedCount > 0) {
    console.log('Admin user created successfully!');
  } else {
    console.log('No user found with that email. Register first at /register');
  }
  
  await mongoose.disconnect();
}

seed().catch(console.error);
