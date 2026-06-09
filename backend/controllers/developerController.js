const crypto = require("crypto");
const mongoose = require("mongoose");
const ApiKey = require("../models/ApiKey");
const { VALID_SCOPES } = require("../models/ApiKey");

// ── helpers ──────────────────────────────────────────────────────────────────

const generateRawKey = () => `ak_${crypto.randomBytes(32).toString("hex")}`;

const hashKey = (raw) =>
  crypto.createHash("sha256").update(raw).digest("hex");

const isDatabaseReady = () => mongoose.connection.readyState === 1;

// ── controllers ──────────────────────────────────────────────────────────────

const DB_UNAVAILABLE = (res) =>
  res.status(503).json({
    message: "Database not connected. API key management requires MongoDB.",
  });

/**
 * POST /api/developer/keys
 * Create a new API key. Returns the raw key ONCE – never stored.
 */
const createApiKey = async (req, res) => {
  if (!isDatabaseReady()) return DB_UNAVAILABLE(res);
  const userId = String(req.user._id || req.user.id);
  const { name, scopes, expiresAt } = req.body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ message: "A key name is required." });
  }

  // Validate scopes
  const requestedScopes = Array.isArray(scopes) ? scopes : [];
  const invalidScopes = requestedScopes.filter((s) => !VALID_SCOPES.includes(s));
  if (invalidScopes.length > 0) {
    return res
      .status(400)
      .json({ message: `Invalid scopes: ${invalidScopes.join(", ")}` });
  }

  // Enforce per-user key limit (prevent abuse)
  const existingCount = await ApiKey.countDocuments({ userId, isActive: true });
  if (existingCount >= 20) {
    return res
      .status(429)
      .json({ message: "Maximum of 20 active API keys reached." });
  }

  const rawKey = generateRawKey();
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 10);

  const expiry =
    expiresAt && !isNaN(Date.parse(expiresAt)) ? new Date(expiresAt) : null;

  const apiKey = await ApiKey.create({
    userId,
    name: name.trim(),
    keyPrefix,
    keyHash,
    scopes: requestedScopes.length > 0 ? requestedScopes : undefined,
    expiresAt: expiry,
  });

  return res.status(201).json({
    message: "API key created. Save the key now — it will not be shown again.",
    key: rawKey, // shown exactly once
    apiKey: apiKey.toPublic(),
  });
};

/**
 * GET /api/developer/keys
 * List all API keys for the authenticated user (no raw keys, no hashes).
 */
const listApiKeys = async (req, res) => {
  if (!isDatabaseReady()) return DB_UNAVAILABLE(res);
  const userId = String(req.user._id || req.user.id);

  const keys = await ApiKey.find({ userId }).sort({ createdAt: -1 });
  return res.json({ apiKeys: keys.map((k) => k.toPublic()) });
};

/**
 * DELETE /api/developer/keys/:id
 * Revoke (soft-delete) an API key.
 */
const revokeApiKey = async (req, res) => {
  if (!isDatabaseReady()) return DB_UNAVAILABLE(res);
  const userId = String(req.user._id || req.user.id);
  const { id } = req.params;

  const apiKey = await ApiKey.findOne({ _id: id, userId });
  if (!apiKey) {
    return res.status(404).json({ message: "API key not found." });
  }

  apiKey.isActive = false;
  await apiKey.save();

  return res.json({ message: "API key revoked.", apiKey: apiKey.toPublic() });
};

/**
 * PATCH /api/developer/keys/:id
 * Update key name or scopes.
 */
const updateApiKey = async (req, res) => {
  if (!isDatabaseReady()) return DB_UNAVAILABLE(res);
  const userId = String(req.user._id || req.user.id);
  const { id } = req.params;
  const { name, scopes } = req.body;

  const apiKey = await ApiKey.findOne({ _id: id, userId });
  if (!apiKey) {
    return res.status(404).json({ message: "API key not found." });
  }

  if (name && typeof name === "string" && name.trim().length > 0) {
    apiKey.name = name.trim();
  }

  if (Array.isArray(scopes)) {
    const invalid = scopes.filter((s) => !VALID_SCOPES.includes(s));
    if (invalid.length > 0) {
      return res
        .status(400)
        .json({ message: `Invalid scopes: ${invalid.join(", ")}` });
    }
    apiKey.scopes = scopes;
  }

  await apiKey.save();
  return res.json({ apiKey: apiKey.toPublic() });
};

/**
 * GET /api/developer/scopes
 * Return the list of available scopes so the frontend can render checkboxes.
 */
const listScopes = async (_req, res) => {
  const descriptions = {
    "transactions:read": "Read transactions",
    "transactions:write": "Create / update transactions",
    "dashboard:read": "Read dashboard summary & KPIs",
    "excel:read": "Download Excel exports",
    "excel:write": "Upload & process Excel files",
    "chatbot:read": "Send messages to the AI chatbot",
  };

  return res.json({
    scopes: VALID_SCOPES.map((s) => ({ scope: s, description: descriptions[s] })),
  });
};

module.exports = { createApiKey, listApiKeys, revokeApiKey, updateApiKey, listScopes };
