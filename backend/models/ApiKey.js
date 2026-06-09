const mongoose = require("mongoose");

/**
 * ApiKey — developer integration keys.
 *
 * The raw key is shown exactly once at creation time and NEVER stored.
 * Only a SHA-256 hash of the key is persisted so a DB breach cannot
 * expose live secrets.
 *
 * Wire format:  ak_<32-random-hex-bytes>  (68 chars total)
 */
const VALID_SCOPES = [
  "transactions:read",
  "transactions:write",
  "dashboard:read",
  "excel:read",
  "excel:write",
  "chatbot:read",
];

const apiKeySchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    // First 10 chars of the raw key – safe to display in the UI as a hint
    keyPrefix: {
      type: String,
      required: true,
    },
    // SHA-256(rawKey) stored as hex – used for O(1) lookup + constant-time compare
    keyHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    scopes: {
      type: [{ type: String, enum: VALID_SCOPES }],
      default: ["transactions:read", "dashboard:read"],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Virtual: is the key currently expired?
apiKeySchema.virtual("isExpired").get(function () {
  return this.expiresAt ? this.expiresAt < new Date() : false;
});

// Handy safe projection for API responses (never leaks keyHash)
apiKeySchema.methods.toPublic = function () {
  return {
    id: this._id,
    name: this.name,
    keyPrefix: this.keyPrefix,
    scopes: this.scopes,
    isActive: this.isActive,
    lastUsedAt: this.lastUsedAt,
    expiresAt: this.expiresAt,
    createdAt: this.createdAt,
  };
};

const ApiKey = mongoose.model("ApiKey", apiKeySchema);

module.exports = ApiKey;
module.exports.VALID_SCOPES = VALID_SCOPES;
