const twilio = require('twilio');

const logSMS = (level, msg, data) => {
  const prefix = '[SMS]';
  if (level === 'error') console.error(`${prefix} ${msg}`, data || '');
  else console.log(`${prefix} ${msg}`, data || '');
};

const sendSMS = async (to, body) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    logSMS('warn', `Twilio not configured. SMS not sent to ${to}. Body: ${body}`);
    return { success: false, method: 'log', to, body };
  }

  try {
    const client = twilio(accountSid, authToken);
    const message = await client.messages.create({
      body,
      from: fromNumber,
      to,
    });
    logSMS('info', `SMS sent to ${to}: SID ${message.sid}`);
    return { success: true, sid: message.sid, to };
  } catch (error) {
    logSMS('error', `Failed to send SMS to ${to}:`, error.message);
    return { success: false, error: error.message, to };
  }
};

module.exports = { sendSMS };
