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

    // Password reset (store only a hash of the reset token)
    resetPasswordTokenHash: { type: String },
    resetPasswordExpiresAt: { type: Date },
    passwordChangedAt: { type: Date },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

module.exports = User;
