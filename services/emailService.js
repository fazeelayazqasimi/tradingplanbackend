const nodemailer = require('nodemailer');
const Setting = require('../models/Setting');

const getBrandName = async () => {
  try {
    const name = await Setting.getByKey('institute_name', 'The 4x Hub');
    return name;
  } catch {
    return 'The 4x Hub';
  }
};

const createTransporter = () => {
  const port = parseInt(process.env.EMAIL_PORT, 10) || 587;
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    secure: port === 465,
    requireTLS: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

const logEmail = (level, msg, data) => {
  const prefix = '[EMAIL]';
  if (level === 'error') console.error(`${prefix} ${msg}`, data || '');
  else console.log(`${prefix} ${msg}`, data || '');
};

<<<<<<< HEAD
const buildTemplate = (title, bodyContent, instituteName = 'Trading Institute') => {
=======
const buildTemplate = (title, bodyContent, instituteName = 'The 4x Hub') => {
>>>>>>> d247292 (Change default institute name to The 4x Hub)
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f4f7fa;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7fa;padding:30px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
              <tr>
                <td style="background-color:#3b82f6;padding:24px 30px;text-align:center;">
                  <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;">${instituteName}</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:30px;">
                  ${bodyContent}
                </td>
              </tr>
              <tr>
                <td style="background-color:#f9fafb;padding:20px 30px;text-align:center;border-top:1px solid #e5e7eb;">
                  <p style="margin:0 0 6px 0;font-size:13px;color:#6b7280;">${instituteName}</p>
                  <p style="margin:0;font-size:12px;color:#9ca3af;">This is an automated email. Please do not reply.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

const sendEmail = async ({ to, subject, html, fromName }) => {
  const configStr = `host=${process.env.EMAIL_HOST}:${process.env.EMAIL_PORT || 587} user=${process.env.EMAIL_USER}`;
  try {
    let name = fromName;
    if (!name) {
<<<<<<< HEAD
      try { name = await Setting.getByKey('institute_name', 'Trading Institute'); } catch { name = 'Trading Institute'; }
=======
      try { name = await Setting.getByKey('institute_name', 'The 4x Hub'); } catch { name = 'The 4x Hub'; }
>>>>>>> d247292 (Change default institute name to The 4x Hub)
    }
    const transporter = createTransporter();
    logEmail('info', `Sending to ${to}: "${subject}" via ${configStr}`);
    const info = await transporter.sendMail({
      from: `"${name}" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });
    logEmail('info', `Sent OK to ${to}: messageId=${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logEmail('error', `FAILED to ${to}: "${subject}" via ${configStr} — ${error.message}`);
    return { success: false, error: error.message };
  }
};

const withBrand = (fn) => async (...args) => {
  const name = await getBrandName();
  return fn(name, ...args);
};

const sendWelcomeEmail = async (user) => {
  const name = await getBrandName();
  const html = buildTemplate(`Welcome to ${name}`, `
    <h2 style="margin:0 0 16px 0;color:#1f2937;font-size:20px;">Welcome, ${user.firstName}!</h2>
    <p style="margin:0 0 12px 0;font-size:15px;color:#374151;line-height:1.6;">
      Your account has been created successfully. You now have access to our platform.
    </p>
    <p style="margin:0 0 12px 0;font-size:15px;color:#374151;line-height:1.6;">
      Explore courses, follow signals, and start your trading journey today.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${process.env.FRONTEND_URL}/dashboard" style="background-color:#3b82f6;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;display:inline-block;">Go to Dashboard</a>
    </div>
    <p style="margin:16px 0 0 0;font-size:13px;color:#6b7280;">If you have any questions, feel free to reach out to our support team.</p>
  `, name);

  return sendEmail({
    to: user.email,
    subject: `Welcome to ${name}`,
    html
  });
};

const sendPasswordResetEmail = async (user, resetUrl) => {
  const name = await getBrandName();
  const html = buildTemplate('Password Reset Request', `
    <h2 style="margin:0 0 16px 0;color:#1f2937;font-size:20px;">Password Reset</h2>
    <p style="margin:0 0 12px 0;font-size:15px;color:#374151;line-height:1.6;">
      Hi ${user.firstName}, we received a request to reset your password.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${resetUrl}" style="background-color:#3b82f6;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;display:inline-block;">Reset Password</a>
    </div>
    <p style="margin:0 0 12px 0;font-size:15px;color:#374151;line-height:1.6;">
      This link will expire in 15 minutes. If you did not request this, please ignore this email.
    </p>
  `, name);

  return sendEmail({
    to: user.email,
    subject: `Password Reset Request - ${name}`,
    html
  });
};

const sendPaymentReceivedEmail = async (user, amount) => {
  const name = await getBrandName();
  const html = buildTemplate('Payment Received', `
    <h2 style="margin:0 0 16px 0;color:#1f2937;font-size:20px;">Payment Confirmed</h2>
    <p style="margin:0 0 12px 0;font-size:15px;color:#374151;line-height:1.6;">
      Hi ${user.firstName}, we have received your payment.
    </p>
    <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:16px;margin:16px 0;text-align:center;">
      <p style="margin:0;font-size:14px;color:#6b7280;">Amount Received</p>
      <p style="margin:4px 0 0 0;font-size:28px;font-weight:700;color:#16a34a;">$${Number(amount).toFixed(2)}</p>
    </div>
    <p style="margin:0 0 12px 0;font-size:15px;color:#374151;line-height:1.6;">
      Your subscription is now active. Enjoy full access to the platform.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${process.env.FRONTEND_URL}/dashboard" style="background-color:#3b82f6;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;display:inline-block;">View Dashboard</a>
    </div>
  `, name);

  return sendEmail({
    to: user.email,
    subject: `Payment Received - ${name}`,
    html
  });
};

const sendAccountApprovedEmail = async (user) => {
  const name = await getBrandName();
  const html = buildTemplate('Account Approved', `
    <h2 style="margin:0 0 16px 0;color:#1f2937;font-size:20px;">Your Account Has Been Approved</h2>
    <p style="margin:0 0 12px 0;font-size:15px;color:#374151;line-height:1.6;">
      Hi ${user.firstName}, congratulations! Your account has been approved by our admin team.
    </p>
    <p style="margin:0 0 12px 0;font-size:15px;color:#374151;line-height:1.6;">
      You can now access all features available to your account.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${process.env.FRONTEND_URL}/dashboard" style="background-color:#3b82f6;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;display:inline-block;">Access Your Account</a>
    </div>
  `, name);

  return sendEmail({
    to: user.email,
    subject: `Account Approved - ${name}`,
    html
  });
};

const sendSubscriptionReminderEmail = async (user, daysLeft) => {
  const name = await getBrandName();
  const html = buildTemplate('Subscription Reminder', `
    <h2 style="margin:0 0 16px 0;color:#1f2937;font-size:20px;">Subscription Expiring Soon</h2>
    <p style="margin:0 0 12px 0;font-size:15px;color:#374151;line-height:1.6;">
      Hi ${user.firstName}, your subscription will expire in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>.
    </p>
    <p style="margin:0 0 12px 0;font-size:15px;color:#374151;line-height:1.6;">
      Renew now to continue enjoying uninterrupted access to courses, signals, and copy trading features.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${process.env.FRONTEND_URL}/subscription/renew" style="background-color:#f59e0b;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;display:inline-block;">Renew Subscription</a>
    </div>
  `, name);

  return sendEmail({
    to: user.email,
    subject: `Your Subscription Expires in ${daysLeft} Day${daysLeft !== 1 ? 's' : ''} - ${name}`,
    html
  });
};

const sendCommissionReceivedEmail = async (user, amount) => {
  const name = await getBrandName();
  const html = buildTemplate('Commission Received', `
    <h2 style="margin:0 0 16px 0;color:#1f2937;font-size:20px;">You Earned a Commission!</h2>
    <p style="margin:0 0 12px 0;font-size:15px;color:#374151;line-height:1.6;">
      Hi ${user.firstName}, great news! You have received a referral commission.
    </p>
    <div style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:16px;margin:16px 0;text-align:center;">
      <p style="margin:0;font-size:14px;color:#6b7280;">Commission Amount</p>
      <p style="margin:4px 0 0 0;font-size:28px;font-weight:700;color:#2563eb;">$${Number(amount).toFixed(2)}</p>
    </div>
    <p style="margin:0 0 12px 0;font-size:15px;color:#374151;line-height:1.6;">
      This commission has been credited to your wallet and is available for withdrawal.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${process.env.FRONTEND_URL}/wallet" style="background-color:#3b82f6;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;display:inline-block;">View Wallet</a>
    </div>
  `, name);

  return sendEmail({
    to: user.email,
    subject: `Commission of $${Number(amount).toFixed(2)} Received - ${name}`,
    html
  });
};

const sendWithdrawalApprovedEmail = async (user, amount) => {
  const name = await getBrandName();
  const html = buildTemplate('Withdrawal Approved', `
    <h2 style="margin:0 0 16px 0;color:#1f2937;font-size:20px;">Withdrawal Approved</h2>
    <p style="margin:0 0 12px 0;font-size:15px;color:#374151;line-height:1.6;">
      Hi ${user.firstName}, your withdrawal request has been approved and is being processed.
    </p>
    <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:16px;margin:16px 0;text-align:center;">
      <p style="margin:0;font-size:14px;color:#6b7280;">Withdrawal Amount</p>
      <p style="margin:4px 0 0 0;font-size:28px;font-weight:700;color:#16a34a;">$${Number(amount).toFixed(2)}</p>
    </div>
    <p style="margin:0 0 12px 0;font-size:15px;color:#374151;line-height:1.6;">
      The funds will be transferred to your selected payment method within 1-3 business days.
    </p>
  `, name);

  return sendEmail({
    to: user.email,
    subject: `Withdrawal Approved - ${name}`,
    html
  });
};

const sendRankPromotionEmail = async (user, newRank) => {
  const name = await getBrandName();
  const html = buildTemplate('Rank Promotion', `
    <h2 style="margin:0 0 16px 0;color:#1f2937;font-size:20px;">Congratulations on Your Promotion!</h2>
    <p style="margin:0 0 12px 0;font-size:15px;color:#374151;line-height:1.6;">
      Hi ${user.firstName}, you have been promoted to a new rank!
    </p>
    <div style="background-color:#faf5ff;border:1px solid #e9d5ff;border-radius:6px;padding:16px;margin:16px 0;text-align:center;">
      <p style="margin:0;font-size:14px;color:#6b7280;">New Rank</p>
      <p style="margin:4px 0 0 0;font-size:22px;font-weight:700;color:#9333ea;">${newRank.name}</p>
      ${newRank.badge ? `<p style="margin:4px 0 0 0;font-size:24px;">${newRank.badge}</p>` : ''}
    </div>
    <p style="margin:0 0 12px 0;font-size:15px;color:#374151;line-height:1.6;">
      Your new commission rate is now <strong>${newRank.commissionPercent}%</strong>.
      Keep up the great work and continue growing your network!
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${process.env.FRONTEND_URL}/ranks" style="background-color:#3b82f6;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;display:inline-block;">View Rank Details</a>
    </div>
  `, name);

  return sendEmail({
    to: user.email,
    subject: `You've Been Promoted to ${newRank.name}! - ${name}`,
    html
  });
};

const sendSignalPublishedEmail = async (users, signal) => {
  const name = await getBrandName();
  const signalDetails = `
    <tr>
      <td style="padding:8px 12px;background-color:#f9fafb;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;"><strong>Symbol</strong></td>
      <td style="padding:8px 12px;background-color:#f9fafb;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;">${signal.symbol}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;"><strong>Action</strong></td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:${signal.action === 'BUY' ? '#16a34a' : '#dc2626'};">${signal.action} ${signal.side || ''}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;background-color:#f9fafb;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;"><strong>Open Price</strong></td>
      <td style="padding:8px 12px;background-color:#f9fafb;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;">${signal.openPrice}</td>
    </tr>
    ${signal.stopLoss ? `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;"><strong>Stop Loss</strong></td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#dc2626;">${signal.stopLoss}</td></tr>` : ''}
    ${signal.takeProfit ? `<tr><td style="padding:8px 12px;background-color:#f9fafb;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;"><strong>Take Profit</strong></td><td style="padding:8px 12px;background-color:#f9fafb;border-bottom:1px solid #e5e7eb;font-size:14px;color:#16a34a;">${signal.takeProfit}</td></tr>` : ''}
  `;

  const html = buildTemplate('New Trading Signal Published', `
    <h2 style="margin:0 0 16px 0;color:#1f2937;font-size:20px;">New Signal Alert</h2>
    <p style="margin:0 0 12px 0;font-size:15px;color:#374151;line-height:1.6;">
      A new trading signal has been published. Review the details below:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin:16px 0;">
      ${signalDetails}
    </table>
    ${signal.description ? `<p style="margin:0 0 12px 0;font-size:14px;color:#6b7280;line-height:1.6;font-style:italic;">"${signal.description}"</p>` : ''}
    <div style="text-align:center;margin:24px 0;">
      <a href="${process.env.FRONTEND_URL}/signals" style="background-color:#3b82f6;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;display:inline-block;">View Signal</a>
    </div>
  `, name);

  const userArray = Array.isArray(users) ? users : [users];
  const results = await Promise.allSettled(
    userArray.map((user) => sendEmail({
      to: user.email,
      subject: `New Signal: ${signal.action} ${signal.symbol} at ${signal.openPrice} - ${name}`,
      html
    }))
  );

  return results;
};

const sendAnnouncementEmail = async (users, announcement) => {
  const name = await getBrandName();
  const html = buildTemplate('New Announcement', `
    <h2 style="margin:0 0 16px 0;color:#1f2937;font-size:20px;">${announcement.title}</h2>
    <div style="margin:12px 0 4px 0;">
      <span style="background-color:${announcement.priority === 'urgent' ? '#fef2f2' : announcement.priority === 'high' ? '#fff7ed' : '#eff6ff'};color:${announcement.priority === 'urgent' ? '#dc2626' : announcement.priority === 'high' ? '#ea580c' : '#2563eb'};padding:4px 10px;border-radius:12px;font-size:12px;font-weight:600;text-transform:uppercase;">${announcement.priority || 'medium'} priority</span>
      <span style="background-color:#f3f4f6;color:#6b7280;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:500;margin-left:6px;">${announcement.type}</span>
    </div>
    <div style="margin:16px 0;padding:16px;background-color:#f9fafb;border-radius:6px;border-left:4px solid #3b82f6;">
      <p style="margin:0;font-size:15px;color:#374151;line-height:1.7;white-space:pre-wrap;">${announcement.content}</p>
    </div>
    <div style="text-align:center;margin:24px 0;">
      <a href="${process.env.FRONTEND_URL}/announcements" style="background-color:#3b82f6;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;display:inline-block;">View Announcements</a>
    </div>
  `, name);

  const userArray = Array.isArray(users) ? users : [users];
  const results = await Promise.allSettled(
    userArray.map((user) => sendEmail({
      to: user.email,
      subject: `${announcement.title} - ${name}`,
      html
    }))
  );

  return results;
};

const sendReferralSignupEmail = async (user, referredUser) => {
  const name = await getBrandName();
  const html = buildTemplate('New Referral Signup', `
    <h2 style="margin:0 0 16px 0;color:#1f2937;font-size:20px;">Someone Joined Using Your Referral!</h2>
    <p style="margin:0 0 12px 0;font-size:15px;color:#374151;line-height:1.6;">
      Hi ${user.firstName}, ${referredUser.firstName} ${referredUser.lastName} (${referredUser.email}) has signed up using your referral code.
    </p>
    <p style="margin:0 0 12px 0;font-size:15px;color:#374151;line-height:1.6;">
      When they purchase a course, you will earn a commission automatically!
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${process.env.FRONTEND_URL}/referrals" style="background-color:#3b82f6;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;display:inline-block;">View Referrals</a>
    </div>
  `, name);
  return sendEmail({ to: user.email, subject: `New Referral Signup - ${name}`, html });
};

const sendCourseEnrollmentPendingEmail = async (user, course) => {
  const name = await getBrandName();
  const html = buildTemplate('Course Enrollment Pending', `
    <h2 style="margin:0 0 16px 0;color:#1f2937;font-size:20px;">Enrollment Pending Approval</h2>
    <p style="margin:0 0 12px 0;font-size:15px;color:#374151;line-height:1.6;">
      Hi ${user.firstName}, you have enrolled in <strong>${course.title}</strong>.
    </p>
    <p style="margin:0 0 12px 0;font-size:15px;color:#374151;line-height:1.6;">
      Your enrollment is pending admin approval. You will receive an email once it is approved.
    </p>
    <p style="margin:0 0 12px 0;font-size:15px;color:#6b7280;line-height:1.6;">
      Please wait while the admin reviews your request. This usually takes a short time.
    </p>
  `, name);
  return sendEmail({ to: user.email, subject: `Enrollment Pending - ${course.title} - ${name}`, html });
};

const sendAccountDeactivatedEmail = async (user) => {
  const name = await getBrandName();
  const html = buildTemplate('Account Deactivated', `
    <h2 style="margin:0 0 16px 0;color:#1f2937;font-size:20px;">Account Deactivated</h2>
    <p style="margin:0 0 12px 0;font-size:15px;color:#374151;line-height:1.6;">
      Hi ${user.firstName}, your account has been deactivated by the admin.
    </p>
    <p style="margin:0 0 12px 0;font-size:15px;color:#374151;line-height:1.6;">
      You will not be able to log in or access the platform. If you believe this is a mistake, please contact our support team.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${process.env.FRONTEND_URL}/contact" style="background-color:#3b82f6;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;display:inline-block;">Contact Support</a>
    </div>
  `, name);
  return sendEmail({ to: user.email, subject: `Account Deactivated - ${name}`, html });
};

const sendVerificationEmail = async (user, verificationUrl) => {
  const name = await getBrandName();
  const html = buildTemplate('Verify Your Email', `
    <h2 style="margin:0 0 16px 0;color:#1f2937;font-size:20px;">Verify Your Email Address</h2>
    <p style="margin:0 0 12px 0;font-size:15px;color:#374151;line-height:1.6;">
      Hi ${user.firstName}, thank you for registering at ${name}.
    </p>
    <p style="margin:0 0 12px 0;font-size:15px;color:#374151;line-height:1.6;">
      Please click the button below to verify your email address and activate your account.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${verificationUrl}" style="background-color:#3b82f6;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;display:inline-block;">Verify Email</a>
    </div>
    <p style="margin:0 0 12px 0;font-size:13px;color:#6b7280;line-height:1.6;">
      This link will expire in 24 hours. If you did not create an account, please ignore this email.
    </p>
  `, name);

  return sendEmail({
    to: user.email,
    subject: `Verify Your Email - ${name}`,
    html
  });
};

const sendOTPEmail = async (email, otp) => {
  const name = await getBrandName();
  const html = buildTemplate('Your OTP Code', `
    <h2 style="margin:0 0 16px 0;color:#1f2937;font-size:20px;">Email Verification</h2>
    <p style="margin:0 0 12px 0;font-size:15px;color:#374151;line-height:1.6;">
      Your one-time verification code is:
    </p>
    <div style="text-align:center;margin:24px 0;padding:16px;background-color:#f0f4ff;border:1px solid #bfdbfe;border-radius:8px;">
      <span style="font-size:36px;font-weight:700;color:#2563eb;letter-spacing:8px;">${otp}</span>
    </div>
    <p style="margin:0 0 12px 0;font-size:15px;color:#374151;line-height:1.6;">
      This code will expire in 10 minutes. Please use it to complete your registration.
    </p>
    <p style="margin:0 0 12px 0;font-size:13px;color:#6b7280;line-height:1.6;">
      If you did not request this code, please ignore this email.
    </p>
  `, name);

  return sendEmail({
    to: email,
    subject: `Your OTP Code - ${name}`,
    html
  });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPaymentReceivedEmail,
  sendAccountApprovedEmail,
  sendSubscriptionReminderEmail,
  sendCommissionReceivedEmail,
  sendWithdrawalApprovedEmail,
  sendRankPromotionEmail,
  sendSignalPublishedEmail,
  sendAnnouncementEmail,
  sendReferralSignupEmail,
  sendCourseEnrollmentPendingEmail,
  sendAccountDeactivatedEmail,
  sendOTPEmail
};
