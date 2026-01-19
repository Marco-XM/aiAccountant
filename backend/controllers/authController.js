const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_CONFIG } = require("../config/constants");
const crypto = require("crypto");
const {
  sendPasswordResetEmail,
  isSmtpConfigured,
} = require("../services/emailService");

const isDev = process.env.NODE_ENV !== "production";

// Ensure JWT_SECRET is set
if (!process.env.JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not defined.");
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;

const register = async (req, res) => {
  const { name, email, password, businessType } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      businessType,
    });

    await newUser.save();

    const token = jwt.sign(
      { _id: newUser._id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: JWT_CONFIG.EXPIRES_IN },
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: { id: newUser._id, name: newUser.name, email: newUser.email },
    });
  } catch (error) {
    console.error("Error registering user: ", error);
    res.status(500).json({ error: "error registering user" });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ message: "Invalid email or password" });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(400).json({ message: "Invalid email or password" });
  }

  const token = jwt.sign({ _id: user._id, email: user.email }, JWT_SECRET, {
    expiresIn: JWT_CONFIG.EXPIRES_IN,
  });

  res.status(200).json({
    success: true,
    message: "Login successful",
    token,
    user: { id: user._id, name: user.name, email: user.email },
  });
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const origin = req.get("origin");

  // Generic success message to prevent email enumeration
  const genericResponse = {
    success: true,
    message:
      "If an account exists for that email, a password reset link has been sent.",
  };

  try {
    const user = await User.findOne({ email });

    if (user) {
      const tokenBytes = crypto.randomBytes(32);
      const resetToken = tokenBytes.toString("hex");

      const resetTokenHash = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

      const ttlMinutes = Number(
        process.env.RESET_PASSWORD_TOKEN_TTL_MINUTES || 60,
      );
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

      if (isDev) {
        console.log(
          "[forgotPassword] Reset token generated for user:",
          user.email,
        );
        console.log("[forgotPassword] Expires at:", expiresAt);
      }

      user.resetPasswordTokenHash = resetTokenHash;
      user.resetPasswordExpiresAt = expiresAt;
      await user.save();

      if (isDev) {
        console.log(
          "[forgotPassword] Reset token hash saved for user:",
          user.email,
        );
      }

      // This will throw an error if email sending fails
      const result = await sendPasswordResetEmail({
        to: user.email,
        token: resetToken,
        origin,
      });

      if (!result.delivered) {
        throw new Error("Email delivery failed");
      }

      if (isDev) {
        console.log(
          `[forgotPassword] Password reset email sent to: ${user.email}`,
        );
      }
    } else {
      // Don't reveal that user doesn't exist - still return success
      console.log(
        `⚠️  Password reset requested for non-existent email: ${email}`,
      );
    }

    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error("❌ Error in forgotPassword:", error);

    // Check if it's an email service configuration error
    if (
      error.message &&
      error.message.includes("Email service is not configured")
    ) {
      return res.status(500).json({
        success: false,
        message: "Email service is not configured. Please contact support.",
      });
    }

    // For other errors (email sending failures, network issues, etc.)
    return res.status(500).json({
      success: false,
      message: "Failed to send password reset email. Please try again later.",
    });
  }
};

const resetPassword = async (req, res) => {
  const { token, password } = req.body;

  try {
    if (isDev) {
      console.log("[resetPassword] Attempting password reset");
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(String(token))
      .digest("hex");

    if (isDev) {
      console.log("[resetPassword] Token hash computed");
    }

    const user = await User.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      if (isDev) {
        console.log(
          "[resetPassword] No user found for token (invalid/expired)",
        );
      }

      // Debug: Check if token exists but is expired
      const expiredUser = await User.findOne({
        resetPasswordTokenHash: tokenHash,
      });

      if (expiredUser) {
        if (isDev) {
          console.log("[resetPassword] Token found but expired");
        }
      } else {
        if (isDev) {
          console.log("[resetPassword] No token match found in database");
        }
      }

      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token.",
      });
    }

    if (isDev) {
      console.log("[resetPassword] User found, resetting password");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.passwordChangedAt = new Date();
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpiresAt = undefined;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password updated successfully. You can now log in.",
    });
  } catch (error) {
    console.error("Error in resetPassword:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reset password.",
    });
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
};
