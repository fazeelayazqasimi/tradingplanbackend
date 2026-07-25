const nodemailer = require('nodemailer');
const emailTemplate = require('./template');

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
};

const sendEmail = async ({ to, subject, html }) => {
  try {
    const transporter = createTransporter();
    await transporter.sendMail({ from: `"Dream Trader" <${process.env.EMAIL_USER}>`, to, subject, html });
  } catch (error) {
    console.error('Email send error:', error.message);
  }
};

const sendWelcomeEmail = async (user) => {
  await sendEmail({
    to: user.email,
    subject: 'Welcome to Dream Trader!',
    html: emailTemplate('Welcome Aboard!', `
      <p>Hi <strong>${user.firstName}</strong>,</p>
      <p>Welcome to Dream Trader! Your account has been created successfully.</p>
      <p>Your unique referral code: <strong style="color:#3b82f6;">${user.referralCode}</strong></p>
      <p>Share it with friends and earn commissions!</p>
      <p style="margin-top:24px;"><a href="${process.env.FRONTEND_URL}/login" style="background-color:#3b82f6;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Get Started</a></p>
    `),
  });
};

const sendPasswordResetEmail = async (user, resetUrl) => {
  await sendEmail({
    to: user.email,
    subject: 'Password Reset Request',
    html: emailTemplate('Reset Your Password', `
      <p>Hi <strong>${user.firstName}</strong>,</p>
      <p>You requested a password reset. Click the button below to reset your password:</p>
      <p style="margin-top:24px;"><a href="${resetUrl}" style="background-color:#3b82f6;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Reset Password</a></p>
      <p style="margin-top:16px;color:#94a3b8;font-size:13px;">This link expires in 10 minutes. If you didn't request this, please ignore this email.</p>
    `),
  });
};

const sendAccountApprovedEmail = async (user) => {
  await sendEmail({
    to: user.email,
    subject: 'Account Approved!',
    html: emailTemplate('Your Account is Approved!', `
      <p>Hi <strong>${user.firstName}</strong>,</p>
      <p>Great news! Your account has been approved. You now have full access to the student portal.</p>
      <p>Start learning, follow signals, and grow your trading skills!</p>
      <p style="margin-top:24px;"><a href="${process.env.FRONTEND_URL}/student/dashboard" style="background-color:#3b82f6;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Go to Dashboard</a></p>
    `),
  });
};

const sendPaymentReceivedEmail = async (user, amount) => {
  await sendEmail({
    to: user.email,
    subject: 'Payment Received',
    html: emailTemplate('Payment Confirmation', `
      <p>Hi <strong>${user.firstName}</strong>,</p>
      <p>We've received your payment of <strong>$${amount}</strong>.</p>
      <p>Your subscription is pending admin approval. You'll receive another email once it's activated.</p>
    `),
  });
};

const sendWithdrawalApprovedEmail = async (user, amount) => {
  await sendEmail({
    to: user.email,
    subject: 'Withdrawal Approved',
    html: emailTemplate('Withdrawal Approved', `
      <p>Hi <strong>${user.firstName}</strong>,</p>
      <p>Your withdrawal request of <strong>$${amount}</strong> has been approved and will be processed shortly.</p>
    `),
  });
};

const sendCommissionReceivedEmail = async (user, amount) => {
  await sendEmail({
    to: user.email,
    subject: 'Commission Received!',
    html: emailTemplate('Commission Earned!', `
      <p>Hi <strong>${user.firstName}</strong>,</p>
      <p>Congratulations! You've earned a commission of <strong>$${amount}</strong> from your referral network.</p>
      <p>Check your wallet for details.</p>
    `),
  });
};

const sendRankPromotionEmail = async (user, newRank) => {
  const rankName = typeof newRank === 'string' ? newRank : newRank.name;
  await sendEmail({
    to: user.email,
    subject: 'Rank Promotion!',
    html: emailTemplate('Congratulations on Your Promotion!', `
      <p>Hi <strong>${user.firstName}</strong>,</p>
      <p>You've been promoted to <strong style="color:#3b82f6;">${rankName}</strong>!</p>
      <p>This means higher commissions and better benefits. Keep up the great work!</p>
    `),
  });
};

const sendSubscriptionReminderEmail = async (user, daysLeft) => {
  await sendEmail({
    to: user.email,
    subject: 'Subscription Expiring Soon',
    html: emailTemplate('Subscription Reminder', `
      <p>Hi <strong>${user.firstName}</strong>,</p>
      <p>Your subscription will expire in <strong>${daysLeft} days</strong>.</p>
      <p>Please renew to continue accessing all features.</p>
      <p style="margin-top:24px;"><a href="${process.env.FRONTEND_URL}/student/wallet" style="background-color:#3b82f6;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Renew Now</a></p>
    `),
  });
};

const sendSignalPublishedEmail = async (user, signal) => {
  await sendEmail({
    to: user.email,
    subject: `New Signal: ${signal.symbol} ${signal.action}`,
    html: emailTemplate('New Trading Signal', `
      <p>Hi <strong>${user.firstName}</strong>,</p>
      <p>A new trading signal has been published:</p>
      <div style="background:#f8fafc;padding:16px;border-radius:8px;margin:16px 0;">
        <p style="margin:4px 0;"><strong>Symbol:</strong> ${signal.symbol}</p>
        <p style="margin:4px 0;"><strong>Action:</strong> ${signal.action}</p>
        <p style="margin:4px 0;"><strong>Price:</strong> ${signal.openPrice}</p>
      </div>
    `),
  });
};

const sendAnnouncementEmail = async (user, announcement) => {
  await sendEmail({
    to: user.email,
    subject: announcement.title,
    html: emailTemplate(announcement.title, `<p>${announcement.content}</p>`),
  });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendAccountApprovedEmail,
  sendPaymentReceivedEmail,
  sendWithdrawalApprovedEmail,
  sendCommissionReceivedEmail,
  sendRankPromotionEmail,
  sendSubscriptionReminderEmail,
  sendSignalPublishedEmail,
  sendAnnouncementEmail,
};
