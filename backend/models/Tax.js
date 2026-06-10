const mongoose = require("mongoose");

// A user-defined tax that can be applied to amounts/transactions.
const taxSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["percentage", "flat"], default: "percentage" },
    rate: { type: Number, default: 0 }, // used when type = "percentage"
    amount: { type: Number, default: 0 }, // used when type = "flat"
    order: { type: Number, default: 0 }, // calculation order (ascending)
    compound: { type: Boolean, default: false }, // tax-on-tax when true
    appliesTo: { type: String, enum: ["all", "income", "expense"], default: "all" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Tax", taxSchema);
