const mongoose = require("mongoose");

// Per-user, per-billing-period feature usage counters.
// One document per (userId, period) where period is "YYYY-MM" (UTC).
const usageSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    period: { type: String, required: true }, // YYYY-MM (UTC)
    transactions: { type: Number, default: 0 },
    excelUploads: { type: Number, default: 0 },
    aiChartGenerations: { type: Number, default: 0 },
    aiChatMessages: { type: Number, default: 0 },
    aiExcelGenerations: { type: Number, default: 0 },
  },
  { timestamps: true }
);

usageSchema.index({ userId: 1, period: 1 }, { unique: true });

module.exports = mongoose.model("Usage", usageSchema);
