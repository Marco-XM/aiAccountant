const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    businessType: {
      type: String,
      enum: ["retail", "wholesale", "service"],
      required: true,
    },

    // Admin access. A user is an admin if this flag is set OR their email is in
    // the ADMIN_EMAILS env list (see authController.isAdminEmail).
    isAdmin: { type: Boolean, default: false },

    // Password reset (store only a hash of the reset token)
    resetPasswordTokenHash: { type: String },
    resetPasswordExpiresAt: { type: Date },
    passwordChangedAt: { type: Date },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

module.exports = User;
