/**
 * Per-user, per-billing-period usage counters.
 * Stored in uploads/usage/store.json as:
 *   { "<userId>_<YYYY-MM>": { transactions, excelUploads, aiChartGenerations, aiChatMessages, aiExcelGenerations } }
 *
 * Call increment(userId, feature) after a successful action.
 * Call getUsage(userId) to read current month counts.
 */
const fs = require("fs/promises");
const path = require("path");

const STORE_DIR  = path.join(__dirname, "..", "uploads", "usage");
const STORE_FILE = path.join(STORE_DIR, "store.json");

const FEATURES = [
  "transactions",
  "excelUploads",
  "aiChartGenerations",
  "aiChatMessages",
  "aiExcelGenerations",
];

const monthKey = () => {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

const bucketKey = (userId) => `${String(userId)}_${monthKey()}`;

// ── file helpers ─────────────────────────────────────────────────────────────
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

// ── public API ───────────────────────────────────────────────────────────────

/** Get usage for this month for a user. Returns an object with all feature counts. */
const getUsage = async (userId) => {
  const store = await readStore();
  const bucket = store[bucketKey(userId)] || {};
  const result = {};
  for (const f of FEATURES) result[f] = bucket[f] || 0;
  return result;
};

/** Increment a single feature counter by 1 (or by `amount`). Returns new count. */
const increment = async (userId, feature, amount = 1) => {
  if (!FEATURES.includes(feature)) throw new Error(`Unknown feature: ${feature}`);
  const store = await readStore();
  const key = bucketKey(userId);
  if (!store[key]) store[key] = {};
  store[key][feature] = (store[key][feature] || 0) + amount;
  await writeStore(store);
  return store[key][feature];
};

/** Get usage for all users for the current month (for admin stats). */
const getAllUsageThisMonth = async () => {
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
