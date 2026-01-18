const { Resend } = require("resend");

const getFrontendBaseUrl = () => {
  return (
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    process.env.CLIENT ||
    "http://localhost:5173"
  );
};

const normalizeBaseUrl = (value) => {
  if (!value) return "";
  const str = String(value).trim();
  if (!str) return "";
  return str.replace(/\/$/, "");
};

const isResendConfigured = () => {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  return Boolean(apiKey && fromEmail && apiKey.startsWith("re_"));
};

const sendPasswordResetEmail = async ({ to, token, origin }) => {
  // Validate Resend configuration
  if (!isResendConfigured()) {
    const errorMsg =
      "Email service is not configured. Please set RESEND_API_KEY and RESEND_FROM_EMAIL in .env file.";
    console.error(`\n❌ [Email Service] ${errorMsg}\n`);
    throw new Error(errorMsg);
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const frontendBaseUrl =
    normalizeBaseUrl(origin) || normalizeBaseUrl(getFrontendBaseUrl());

  // Hex tokens don't need URL encoding
  const resetUrl = `${frontendBaseUrl}/reset-password?token=${token}`;

  console.log("\n📧 [Email Service Debug]");
  console.log("Reset token (plain):", token);
  console.log("Reset URL:", resetUrl);

  const fromEmail = process.env.RESEND_FROM_EMAIL;

  // For testing: Resend free tier only allows sending to the account owner's email
  // Use test email if in development or if recipient email doesn't match owner
  const isDev = process.env.NODE_ENV !== "production";
  const testEmail = process.env.RESEND_TEST_EMAIL;
  const actualRecipient = isDev && testEmail ? testEmail : to;

  try {
    // Optimized, minified HTML template for faster delivery
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1)"><tr><td style="padding:40px 30px"><h1 style="margin:0 0 20px;color:#222831;font-size:26px;font-weight:700">Reset Your Password</h1><p style="margin:0 0 24px;color:#393E46;font-size:16px;line-height:1.5">Click the button below to reset your password for AI Accountant.</p><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 0"><a href="${resetUrl}" style="display:inline-block;padding:14px 28px;background:#00ADB5;color:#fff;text-decoration:none;border-radius:6px;font-weight:700;font-size:16px">Reset Password</a></td></tr></table><p style="margin:20px 0 0;color:#666;font-size:13px">Link expires in 60 minutes.</p><p style="margin:20px 0 0;padding-top:20px;border-top:1px solid #eee;color:#999;font-size:12px">Didn't request this? Ignore this email.</p></td></tr><tr><td style="padding:20px;background:#f8f9fa;text-align:center"><p style="margin:0;color:#999;font-size:11px">© 2026 AI Accountant</p></td></tr></table></td></tr></table></body></html>`;

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [actualRecipient],
      subject: "Reset your AI Accountant password",
      html,
    });

    if (error) {
      throw new Error(error.message || "Email delivery failed");
    }

    if (!data?.id) {
      throw new Error("Email sending failed");
    }

    const recipientInfo =
      actualRecipient !== to ? ` (test: ${actualRecipient})` : "";
    console.log(`✅ Email sent to ${to}${recipientInfo} (ID: ${data.id})`);
    return { delivered: true, resetUrl, messageId: data.id };
  } catch (error) {
    console.error(`❌ Email service error:`, error.message);
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }
};

module.exports = {
  sendPasswordResetEmail,
  isResendConfigured,
};
