const crypto = require("crypto");
const mongoose = require("mongoose");
const ApiKey = require("../models/ApiKey");
const User = require("../models/User");

const isDatabaseReady = () => mongoose.connection.readyState === 1;
const isMongoObjectId = (v) => mongoose.isValidObjectId(v);

/**
 * apiKeyAuth — middleware that authenticates requests using an API key.
 *
 * Accepted formats:
 *   Authorization: Bearer ak_<hex>
 *   X-API-Key: ak_<hex>
 *
 * On success it attaches:
 *   req.user   — the owner's user document (subset)
 *   req.apiKey — the ApiKey document (so downstream can check scopes)
 *
 * @param {string|string[]} [requiredScopes] - scope(s) that must be present on the key.
 */
const apiKeyAuth =
  (requiredScopes = []) =>
  async (req, res, next) => {
    try {
      // ── 1. Extract raw key from headers ───────────────────────────────────
      let rawKey = null;

      const xApiKey = req.headers["x-api-key"];
      if (xApiKey) {
        rawKey = xApiKey.trim();
      } else {
        const authHeader = req.headers["authorization"] || "";
        if (authHeader.startsWith("Bearer ")) {
          const candidate = authHeader.slice(7).trim();
          if (candidate.startsWith("ak_")) rawKey = candidate;
        }
      }

      if (!rawKey) {
        return res.status(401).json({
          message:
            "API key required. Provide it via the X-API-Key header or Authorization: Bearer <key>.",
        });
      }

      // Basic format guard (prefix + 64 hex chars = 67 chars)
      if (!/^ak_[0-9a-f]{64}$/.test(rawKey)) {
        return res.status(401).json({ message: "Invalid API key format." });
      }

      // ── 2. Hash and look up ────────────────────────────────────────────────
      const keyHash = crypto
        .createHash("sha256")
        .update(rawKey)
        .digest("hex");

      const apiKey = await ApiKey.findOne({ keyHash }).lean();

      if (!apiKey) {
        return res.status(401).json({ message: "Invalid API key." });
      }

      // ── 3. Validate key state ──────────────────────────────────────────────
      if (!apiKey.isActive) {
        return res.status(403).json({ message: "This API key has been revoked." });
      }

      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        return res.status(403).json({ message: "This API key has expired." });
      }

      // ── 4. Scope check ────────────────────────────────────────────────────
      const required = Array.isArray(requiredScopes)
        ? requiredScopes
        : [requiredScopes];

      const missing = required.filter((s) => !apiKey.scopes.includes(s));
      if (missing.length > 0) {
        return res.status(403).json({
          message: `Insufficient permissions. Required scope(s): ${missing.join(", ")}`,
        });
      }

      // ── 5. Load owner user ────────────────────────────────────────────────
      let user = null;
      if (isDatabaseReady() && isMongoObjectId(apiKey.userId)) {
        user = await User.findById(apiKey.userId).lean();
      }
      // In dev / local-auth mode the userId is a non-ObjectId string;
      // trust the stored value and skip the DB lookup.
      if (!user) {
        user = { _id: apiKey.userId, email: "" };
      }

      // ── 6. Attach to request & update lastUsedAt (fire-and-forget) ───────
      req.user = { _id: user._id, id: user._id, email: user.email };
      req.apiKey = apiKey;

      // Non-blocking update so it doesn't slow the request
      ApiKey.updateOne({ _id: apiKey._id }, { lastUsedAt: new Date() }).catch(
        () => {}
      );

      next();
    } catch (err) {
      console.error("[apiKeyAuth] error:", err.message);
      return res.status(500).json({ message: "Authentication error." });
    }
  };

module.exports = apiKeyAuth;
