const nodemailer = require("nodemailer");
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

// ── SMTP / Gmail configuration ──────────────────────────────────────────────
// Two ways to configure SMTP:
//   1. Gmail shortcut  — set GMAIL_USER + GMAIL_APP_PASSWORD (a Google App
//      Password, not your normal password). Host/port are handled for you.
//   2. Generic SMTP    — set SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER,
//      SMTP_PASS (works for any provider).
const getSmtpSettings = () => {
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return {
      transport: {
        service: "gmail",
        auth: {
          user: process.env.GMAIL_USER,
          // Google shows app passwords with spaces ("abcd efgh ijkl mnop");
          // they must be sent without them.
          pass: String(process.env.GMAIL_APP_PASSWORD).replace(/\s+/g, ""),
        },
      },
      from:
        process.env.SMTP_FROM ||
        process.env.EMAIL_FROM ||
        process.env.GMAIL_USER,
    };
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return {
      transport: {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: String(process.env.SMTP_SECURE || "false") === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      },
      from:
        process.env.SMTP_FROM ||
        process.env.EMAIL_FROM ||
        process.env.SMTP_USER,
    };
  }

  return null;
};

let cachedTransporter = null;
const getTransporter = (settings) => {
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport(settings.transport);
  }
  return cachedTransporter;
};

const isSmtpConfigured = () => Boolean(getSmtpSettings());

const isResendConfigured = () => {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  return Boolean(apiKey && fromEmail && apiKey.startsWith("re_"));
};

const isEmailConfigured = () => isSmtpConfigured() || isResendConfigured();

// ── Email template ──────────────────────────────────────────────────────────
const buildResetEmailHtml = (resetUrl) =>
  `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1)"><tr><td style="padding:40px 30px"><h1 style="margin:0 0 20px;color:#222831;font-size:26px;font-weight:700">Reset Your Password</h1><p style="margin:0 0 24px;color:#393E46;font-size:16px;line-height:1.5">Click the button below to reset your password for AI Accountant.</p><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 0"><a href="${resetUrl}" style="display:inline-block;padding:14px 28px;background:#00ADB5;color:#fff;text-decoration:none;border-radius:6px;font-weight:700;font-size:16px">Reset Password</a></td></tr></table><p style="margin:20px 0 0;color:#666;font-size:13px">Link expires in 60 minutes.</p><p style="margin:20px 0 0;padding-top:20px;border-top:1px solid #eee;color:#999;font-size:12px">Didn't request this? Ignore this email.</p></td></tr><tr><td style="padding:20px;background:#f8f9fa;text-align:center"><p style="margin:0;color:#999;font-size:11px">© 2026 AI Accountant</p></td></tr></table></td></tr></table></body></html>`;

const SUBJECT = "Reset your AI Accountant password";

// ── Providers ───────────────────────────────────────────────────────────────
const sendViaSmtp = async ({ to, html, settings }) => {
  const transporter = getTransporter(settings);
  const info = await transporter.sendMail({
    from: settings.from,
    to,
    subject: SUBJECT,
    html,
  });
  console.log(`✅ Password reset email sent to ${to} via SMTP (ID: ${info.messageId})`);
  return info.messageId;
};

const sendViaResend = async ({ to, html }) => {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  // Resend's free tier only allows sending to the account owner. In dev we can
  // redirect to a verified test address via RESEND_TEST_EMAIL.
  const isDev = process.env.NODE_ENV !== "production";
  const testEmail = process.env.RESEND_TEST_EMAIL;
  const actualRecipient = isDev && testEmail ? testEmail : to;

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: [actualRecipient],
    subject: SUBJECT,
    html,
  });

  if (error) throw new Error(error.message || "Email delivery failed");
  if (!data?.id) throw new Error("Email sending failed");

  const recipientInfo = actualRecipient !== to ? ` (test: ${actualRecipient})` : "";
  console.log(`✅ Password reset email sent to ${to}${recipientInfo} via Resend (ID: ${data.id})`);
  return data.id;
};

const sendPasswordResetEmail = async ({ to, token, origin }) => {
  if (!isEmailConfigured()) {
    const errorMsg =
      "Email service is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD (or SMTP_*, or RESEND_*) in your .env file.";
    console.error(`\n❌ [Email Service] ${errorMsg}\n`);
    throw new Error(errorMsg);
  }

  const frontendBaseUrl =
    normalizeBaseUrl(origin) || normalizeBaseUrl(getFrontendBaseUrl());
  const resetUrl = `${frontendBaseUrl}/reset-password?token=${token}`;
  const html = buildResetEmailHtml(resetUrl);

  if (process.env.NODE_ENV !== "production") {
    console.log("\n📧 [Email Service Debug]");
    console.log("Reset URL:", resetUrl);
  }

  try {
    const settings = getSmtpSettings();
    const messageId = settings
      ? await sendViaSmtp({ to, html, settings })
      : await sendViaResend({ to, html });
    return { delivered: true, resetUrl, messageId };
  } catch (error) {
    console.error(`❌ Email service error:`, error.message);
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }
};

module.exports = {
  sendPasswordResetEmail,
  isEmailConfigured,
  isSmtpConfigured,
  isResendConfigured,
};
