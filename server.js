require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const app = require('./app');
const { connectToDatabase } = require('./app');
const { checkOpenSignals } = require('./services/signalResultService');

const PORT = process.env.PORT || 5000;
const SIGNAL_CHECK_INTERVAL_MS = 5 * 60 * 1000;

(async () => {
  await connectToDatabase();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });

  if (process.env.SIGNAL_AUTO_CHECK !== 'false') {
    const run = () => checkOpenSignals().then((resolved) => {
      if (resolved.length > 0) {
        console.log(`[SIGNAL RESULT] Auto-check resolved ${resolved.length} signal(s)`);
      }
    });
    setTimeout(run, 30 * 1000);
    setInterval(run, SIGNAL_CHECK_INTERVAL_MS);
    console.log(`[SIGNAL RESULT] Auto TP/SL check enabled (every ${SIGNAL_CHECK_INTERVAL_MS / 60000} min)`);
  }
})();
