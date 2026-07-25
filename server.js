require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const app = require('./app');
const { connectToDatabase } = require('./app');

const PORT = process.env.PORT || 5000;

(async () => {
  await connectToDatabase();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
})();

