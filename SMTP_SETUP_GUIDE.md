# SMTP Configuration Guide for Password Reset

## Overview

The password reset flow has been configured to work like a production application:

- ✅ No dev messages or debug info exposed to users
- ✅ No Ethereal preview URLs in the UI
- ✅ Clean, professional user experience
- ✅ Real email sending via SMTP

## Quick Setup (Gmail)

### Step 1: Generate Gmail App Password

1. Go to your Google Account: https://myaccount.google.com
2. Navigate to **Security** → **2-Step Verification** (enable it if not already)
3. Scroll down to **App passwords**: https://myaccount.google.com/apppasswords
4. Select app: **Mail**
5. Select device: **Other (Custom name)** → Enter "AI Accountant"
6. Click **Generate**
7. Copy the 16-character password (e.g., `abcd efgh ijkl mnop`)

### Step 2: Update Backend .env File

Edit `backend/.env` and update these values:

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-actual-email@gmail.com
SMTP_PASS=abcd efgh ijkl mnop
SMTP_FROM=AI Accountant <your-actual-email@gmail.com>

# Frontend URL (for reset links)
FRONTEND_URL=http://localhost:5173
```

**Replace:**

- `your-actual-email@gmail.com` with your Gmail address
- `abcd efgh ijkl mnop` with your generated App Password (keep the spaces or remove them, both work)

### Step 3: Restart Backend Server

```bash
cd backend
npm start
```

## Testing the Flow

1. **Frontend:** Go to http://localhost:5173/forgot-password
2. **Enter email:** Type your registered email address
3. **Submit:** Click "Send Reset Link"
4. **Success Message:** You'll see:

   - ✅ "If an account exists for that email, a password reset link has been sent."
   - ✅ Clean success UI with email icon
   - ❌ NO dev hints or Ethereal previews

5. **Check Email:**

   - Open your email inbox
   - Look for email from "AI Accountant"
   - Subject: "Reset your AI Accountant password"
   - Check spam/junk if not in inbox

6. **Click Reset Link:** Opens http://localhost:5173/reset-password?token=...

7. **Set New Password:**

   - Must be 8+ characters
   - Include uppercase, lowercase, number, and special character
   - Confirm password

8. **Success:** Redirected to login page

## Alternative SMTP Providers

### SendGrid

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM=AI Accountant <no-reply@yourdomain.com>
```

### Mailgun

```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@yourdomain.mailgun.org
SMTP_PASS=your-mailgun-smtp-password
SMTP_FROM=AI Accountant <no-reply@yourdomain.com>
```

### AWS SES

```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
SMTP_FROM=AI Accountant <verified-email@yourdomain.com>
```

### Office 365 / Outlook

```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
SMTP_FROM=AI Accountant <your-email@outlook.com>
```

## Security Features

1. **Email Enumeration Prevention:** Always returns success message, even if email doesn't exist
2. **Token Security:** SHA-256 hashed tokens stored in database
3. **Token Expiration:** Configurable via `RESET_PASSWORD_TOKEN_TTL_MINUTES` (default: 60 minutes)
4. **One-time Use:** Tokens are deleted after successful password reset
5. **Password Requirements:** Strong password validation (8+ chars, mixed case, number, special char)

## Troubleshooting

### Email Not Received?

1. **Check Backend Logs:**

   ```
   ✅ Password reset email sent to: user@example.com
   ```

2. **Check Spam/Junk folder**

3. **Verify SMTP credentials:**

   - Correct email and app password
   - App password, not regular password (for Gmail)
   - 2FA enabled on Gmail account

4. **Test SMTP connection:**
   ```bash
   # In backend directory
   node -e "require('./services/emailService').sendPasswordResetEmail({to:'test@example.com',token:'test123',origin:'http://localhost:5173'})"
   ```

### Gmail "Less Secure App" Error

Use **App Passwords**, not your regular Gmail password. Regular passwords won't work even with "Allow less secure apps" enabled.

### Port Issues

If port 587 doesn't work, try:

- Port 465 with `SMTP_SECURE=true`
- Port 25 (usually blocked by ISPs)

## Production Deployment

For production, update:

```env
# Production frontend URL
FRONTEND_URL=https://yourdomain.com

# Production SMTP (use professional service)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-api-key
SMTP_FROM=AI Accountant <no-reply@yourdomain.com>

# Set Node environment
NODE_ENV=production
```

## Email Template

The sent email includes:

- Professional HTML formatting
- Clear call-to-action button
- Expiration warning
- Security note ("If you didn't request this...")
- Branded "AI Accountant" styling

## Changes Made

### Backend (`authController.js`)

- ✅ Removed all debug/dev response payloads
- ✅ Always returns generic success message
- ✅ Logs to console instead of exposing to frontend
- ✅ Simplified email sending logic

### Frontend (`ForgotPassword.jsx`)

- ✅ Removed `devHint` and `devPreviewUrl` state
- ✅ Removed Ethereal preview UI section
- ✅ Improved success message with email icon
- ✅ Professional, clean design
- ✅ No dev-specific logic or messages

### Configuration (`.env`)

- ✅ Added complete SMTP configuration template
- ✅ Added helpful comments
- ✅ Added FRONTEND_URL for reset links

## Support

If emails still don't work after following this guide:

1. Check backend console for error messages
2. Verify all .env variables are set correctly
3. Test with a simple email first
4. Consider using a dedicated email service (SendGrid, Mailgun) for production
