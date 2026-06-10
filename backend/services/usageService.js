/**
 * Per-user, per-billing-period usage counters.
 *
 * Storage:
 *   - When MongoDB is connected (production / serverless), counters are stored in
 *     the `Usage` collection so they persist across stateless function invocations.
 *   - Otherwise (local dev with no DB), they fall back to a JSON file under
 *     uploads/usage/store.json.
 *
 * IMPORTANT: on Vercel the filesystem (/tmp) is ephemeral and per-instance, so the
 * file store does NOT persist — the Mongo path is required in production.
 *
 * Call increment(userId, feature) after a successful action.
 * Call getUsage(userId) to read current-month counts.
 */
const fs = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");
const Usage = require("../models/Usage");

const STORE_DIR  = process.env.VERCEL === "1" ? path.join("/tmp", "usage") : path.join(__dirname, "..", "uploads", "usage");
const STORE_FILE = path.join(STORE_DIR, "store.json");

const FEATURES = [
  "transactions",
  "excelUploads",
  "aiChartGenerations",
  "aiChatMessages",
  "aiExcelGenerations",
];

const dbReady = () => mongoose.connection.readyState === 1;

const monthKey = () => {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

const bucketKey = (userId) => `${String(userId)}_${monthKey()}`;

const emptyUsage = () => {
  const result = {};
  for (const f of FEATURES) result[f] = 0;
  return result;
};

// ── file helpers (fallback for local dev without a database) ──────────────────
const ensureStore = async () => {
  await fs.mkdir(STORE_DIR, { recursive: true });
  try { await fs.access(STORE_FILE); } catch {
    await fs.writeFile(STORE_FILE, JSON.stringify({}, null, 2), "utf8");
  }
};

const readStore = async () => {
  await ensureStore();
  const raw = await fs.readFile(STORE_FILE, "utf8");
  return JSON.parse(raw || "{}");
};

const writeStore = async (data) => {
  await ensureStore();
  await fs.writeFile(STORE_FILE, JSON.stringify(data, null, 2), "utf8");
};

const getUsageFromFile = async (userId) => {
  const store = await readStore();
  const bucket = store[bucketKey(userId)] || {};
  const result = emptyUsage();
  for (const f of FEATURES) result[f] = bucket[f] || 0;
  return result;
};

const incrementInFile = async (userId, feature, amount) => {
  const store = await readStore();
  const key = bucketKey(userId);
  if (!store[key]) store[key] = {};
  store[key][feature] = (store[key][feature] || 0) + amount;
  await writeStore(store);
  return store[key][feature];
};

// ── public API ────────────────────────────────────────────────────────────────

/** Get usage for this month for a user. Returns an object with all feature counts. */
const getUsage = async (userId) => {
  if (dbReady()) {
    try {
      const doc = await Usage.findOne({ userId: String(userId), period: monthKey() }).lean();
      const result = emptyUsage();
      if (doc) for (const f of FEATURES) result[f] = doc[f] || 0;
      return result;
    } catch (err) {
      console.error("usageService.getUsage (mongo) failed, falling back to file:", err.message);
    }
  }
  return getUsageFromFile(userId);
};

/** Increment a single feature counter by 1 (or by `amount`). Returns new count. */
const increment = async (userId, feature, amount = 1) => {
  if (!FEATURES.includes(feature)) throw new Error(`Unknown feature: ${feature}`);
  if (dbReady()) {
    try {
      const doc = await Usage.findOneAndUpdate(
        { userId: String(userId), period: monthKey() },
        { $inc: { [feature]: amount } },
        { upsert: true, new: true }
      );
      return doc[feature];
    } catch (err) {
      console.error("usageService.increment (mongo) failed, falling back to file:", err.message);
    }
  }
  return incrementInFile(userId, feature, amount);
};

/** Get usage for all users for the current month (for admin stats). */
const getAllUsageThisMonth = async () => {
  if (dbReady()) {
    try {
      const docs = await Usage.find({ period: monthKey() }).lean();
      const result = {};
      for (const d of docs) {
        const bucket = emptyUsage();
        for (const f of FEATURES) bucket[f] = d[f] || 0;
        result[d.userId] = bucket;
      }
      return result;
    } catch (err) {
      console.error("usageService.getAllUsageThisMonth (mongo) failed, falling back to file:", err.message);
    }
  }

  const store = await readStore();
  const month = monthKey();
  const result = {};
  for (const [k, v] of Object.entries(store)) {
    if (k.endsWith(`_${month}`)) {
      const userId = k.slice(0, -(month.length + 1));
      result[userId] = v;
    }
  }
  return result;
};

module.exports = { getUsage, increment, getAllUsageThisMonth, FEATURES };
