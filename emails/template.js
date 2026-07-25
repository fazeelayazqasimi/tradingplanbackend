const emailTemplate = (title, content) => {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'SF Pro Display',Inter,system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
<tr><td style="background:linear-gradient(135deg,#3b82f6,#1d4ed8);padding:32px 40px;text-align:center;">
<h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0;letter-spacing:-0.5px;">Dream Trader</h1>
</td></tr>
<tr><td style="padding:40px;">
<h2 style="color:#1e293b;font-size:20px;font-weight:600;margin:0 0 16px 0;">${title}</h2>
<div style="color:#475569;font-size:15px;line-height:1.7;">${content}</div>
</td></tr>
<tr><td style="background-color:#f8fafc;padding:24px 40px;text-align:center;">
<p style="color:#94a3b8;font-size:12px;margin:0;">© ${new Date().getFullYear()} Dream Trader. All rights reserved.</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
};

module.exports = emailTemplate;
