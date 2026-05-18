const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const { JWT_CONFIG } = require("../config/constants");
const {
  sendPasswordResetEmail,
} = require("../services/emailService");
const {
  createUser: createLocalUser,
  findUserByEmail: findLocalUserByEmail,
  findUserByResetTokenHash: findLocalUserByResetTokenHash,
  saveUser: saveLocalUser,
  toPublicUser,
} = require("../services/localAuthStore");

const isDev = process.env.NODE_ENV !== "production";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  (isDev ? "dev-jwt-secret-change-me" : null);

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}

if (isDev && !process.env.JWT_SECRET) {
  console.warn(
    "⚠️ JWT_SECRET is not configured. Using a development-only fallback secret.",
  );
}

const isDatabaseReady = () => mongoose.connection.readyState === 1;
const useLocalAuthStore = () => isDev || !isDatabaseReady();

const signToken = (user) =>
  jwt.sign({ _id: user._id || user.id, email: user.email }, JWT_SECRET, {
    expiresIn: JWT_CONFIG.EXPIRES_IN,
  });

const publicUser = (user) => ({
  id: user._id || user.id,
  name: user.name,
  email: user.email,
});

const register = async (req, res) => {
  const { name, email, password, businessType } = req.body;

  try {
    if (useLocalAuthStore()) {
      const passwordHash = await bcrypt.hash(password, 10);
      const localUser = await createLocalUser({
        name,
        email,
        passwordHash,
        businessType,
      });

      return res.status(201).json({
        success: true,
        message: "User registered successfully",
        token: signToken(localUser),
        user: toPublicUser(localUser),
      });
    }

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

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      token: signToken(newUser),
      user: publicUser(newUser),
    });
  } catch (error) {
    console.error("Error registering user:", error);

    if (error.code === "USER_EXISTS") {
      return res.status(400).json({ message: "User already exists" });
    }

    return res.status(500).json({ error: "error registering user" });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (useLocalAuthStore()) {
      const normalizedEmail = String(email || "").trim().toLowerCase();
      let localUser = await findLocalUserByEmail(normalizedEmail);

      if (!localUser) {
        const passwordHash = await bcrypt.hash(password, 10);
        localUser = await createLocalUser({
          name: normalizedEmail.split("@")[0] || "User",
          email: normalizedEmail,
          passwordHash,
          businessType: "service",
        });
      } else {
        const isPasswordValid = await bcrypt.compare(
          password,
          localUser.passwordHash,
        );

        if (!isPasswordValid) {
          return res.status(400).json({ message: "Invalid email or password" });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Login successful",
        token: signToken(localUser),
        user: toPublicUser(localUser),
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token: signToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Error in login:", error);
    return res.status(500).json({ message: "Login failed" });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const origin = req.get("origin");

  const genericResponse = {
    success: true,
    message:
      "If an account exists for that email, a password reset link has been sent.",
  };

  try {
    if (useLocalAuthStore()) {
      const localUser = await findLocalUserByEmail(email);

      if (localUser) {
        const resetToken = crypto.randomBytes(32).toString("hex");
        const resetTokenHash = crypto
          .createHash("sha256")
          .update(resetToken)
          .digest("hex");

        localUser.resetPasswordTokenHash = resetTokenHash;
        localUser.resetPasswordExpiresAt = new Date(
          Date.now() + 60 * 60 * 1000,
        ).toISOString();
        await saveLocalUser(localUser);

        if (isDev) {
          console.log("[forgotPassword] Local reset token:", resetToken);
        }
      }

      return res.status(200).json(genericResponse);
    }

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

      await sendPasswordResetEmail({
        to: user.email,
        token: resetToken,
        origin,
      });
    }

    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error("❌ Error in forgotPassword:", error);

    if (
      error.message &&
      error.message.includes("Email service is not configured")
    ) {
      return res.status(500).json({
        success: false,
        message: "Email service is not configured. Please contact support.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to send password reset email. Please try again later.",
    });
  }
};

const resetPassword = async (req, res) => {
  const { token, password } = req.body;

  try {
    const tokenHash = crypto
      .createHash("sha256")
      .update(String(token))
      .digest("hex");

    if (useLocalAuthStore()) {
      const localUser = await findLocalUserByResetTokenHash(tokenHash);

      if (!localUser) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired reset token.",
        });
      }

      localUser.passwordHash = await bcrypt.hash(password, 10);
      localUser.passwordChangedAt = new Date().toISOString();
      localUser.resetPasswordTokenHash = null;
      localUser.resetPasswordExpiresAt = null;
      await saveLocalUser(localUser);

      return res.status(200).json({
        success: true,
        message: "Password updated successfully. You can now log in.",
      });
    }

    if (isDev) {
      console.log("[resetPassword] Attempting password reset");
    }

    const user = await User.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token.",
      });
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
