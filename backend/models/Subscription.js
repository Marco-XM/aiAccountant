const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    status: {
      type: String,
      enum: ["paid", "failed", "pending"],
      default: "paid",
    },
    plan: { type: String },
    billingCycle: { type: String, enum: ["monthly", "annual"] },
    paidAt: { type: Date, default: Date.now },
    description: { type: String },
  },
  { _id: true }
);

const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    plan: {
      type: String,
      enum: ["free", "pro", "business"],
      default: "free",
    },
    status: {
      type: String,
      enum: ["active", "cancelled", "past_due"],
      default: "active",
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "annual"],
      default: "monthly",
    },
    currentPeriodStart: { type: Date, default: Date.now },
    currentPeriodEnd: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    paymentMethod: {
      last4: { type: String },
      brand: { type: String },
      expiryMonth: { type: String },
      expiryYear: { type: String },
      cardholderName: { type: String },
    },
    invoices: [invoiceSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subscription", subscriptionSchema);
