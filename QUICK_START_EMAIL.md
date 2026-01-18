# 🚨 URGENT: Email Not Sending - Quick Fix

## Why Emails Aren't Sending

Your SMTP credentials are not configured. The `.env` file has placeholder values that need to be replaced with real credentials.

## Quick Fix (5 Minutes)

### Step 1: Get Gmail App Password

1. Go to: https://myaccount.google.com/apppasswords
2. You'll need 2-Step Verification enabled first: https://myaccount.google.com/security
3. Create App Password:
   - Select app: **Mail**
   - Select device: **Other** → Type "AI Accountant"
   - Click **Generate**
   - Copy the 16-character code (e.g., `xyzabcdefghijklm`)

### Step 2: Update backend/.env

Open `backend/.env` and find these lines:

```env
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password-here
```

**Replace with your real credentials:**

```env
SMTP_USER=yourname@gmail.com
SMTP_PASS=xyzabcdefghijklm
```

**⚠️ CRITICAL:** Remove ALL placeholder text! No "your-email", no "your-app-password".

### Step 3: Restart Backend

**MUST restart the server for changes to take effect!**

```bash
# Stop the current backend (Ctrl+C)
cd backend
npm start
```

### Step 4: Test

1. Go to http://localhost:5173/forgot-password
2. Enter a registered email address
3. Click "Send Reset Link"

**Expected Results:**

✅ **Success (SMTP configured):**

- Toast: "If an account exists for that email, a password reset link has been sent."
- Backend console: `✅ Email sent successfully to user@example.com`
- Email arrives in inbox within 1-2 minutes

❌ **Error (SMTP NOT configured):**

- Toast: "Email service is not configured. Please contact support."
- Backend console: `❌ SMTP credentials are not configured`

## What Changed?

### Before (Your Current Issue):

- Backend always returned success, even when email wasn't sent
- No error shown to user
- SMTP credentials not validated

### After (Fixed):

- Backend checks if SMTP is actually configured
- Shows clear error if credentials are missing/invalid
- Only shows success when email is ACTUALLY sent
- Proper error handling for email delivery failures

## Error Messages Explained

| Error Message                         | Meaning                                   | Solution                               |
| ------------------------------------- | ----------------------------------------- | -------------------------------------- |
| "Email service is not configured"     | SMTP credentials are placeholder values   | Update `.env` with real credentials    |
| "Failed to send password reset email" | Email sending failed (auth/network error) | Check credentials, internet connection |
| "If an account exists..."             | Success! Email sent                       | Check inbox/spam folder                |

## Quick Test Command

Test SMTP without the UI:

```bash
cd backend
node -e "const {sendPasswordResetEmail} = require('./services/emailService'); sendPasswordResetEmail({to:'YOUR_EMAIL@gmail.com', token:'test', origin:'http://localhost:5173'}).then(() => console.log('✅ SUCCESS')).catch(e => console.error('❌ ERROR:', e.message));"
```

Replace `YOUR_EMAIL@gmail.com` with your actual email.

## Still Not Working?

### Check These:

1. **2FA Enabled?** App Passwords require 2-Step Verification
2. **Correct Password Type?** Must use App Password, NOT regular Gmail password
3. **No Spaces in Password?** Remove spaces: `abcd efgh ijkl mnop` → `abcdefghijklmnop`
4. **Backend Restarted?** Environment variables load on startup only
5. **Correct Email?** Make sure the email is registered in your database

### View Backend Logs:

The backend console will show exactly what's happening:

```
✅ Email sent successfully to user@example.com (Message ID: <...>)
❌ [Email Service] SMTP credentials are not configured...
❌ Failed to send email to user@example.com: Invalid login
```

## Why This Matters

**Security + User Experience:**

- Users should only see success when email is ACTUALLY sent
- Clear error messages help users understand what's wrong
- Prevents confusion ("It says success but I got no email!")
- Maintains security (doesn't reveal if email exists in database, unless SMTP fails)

## Files Modified

1. [backend/controllers/authController.js](backend/controllers/authController.js) - Now properly handles email errors
2. [backend/services/emailService.js](backend/services/emailService.js) - Validates SMTP config and throws errors
3. [backend/.env](backend/.env) - YOU need to update this with real credentials!

---

**Next Step:** Follow Step 1-3 above to configure SMTP, then test!
