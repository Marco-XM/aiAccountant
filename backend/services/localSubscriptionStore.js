const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const STORE_DIR = process.env.VERCEL === "1" ? require("path").join("/tmp", "subscriptions") : path.join(__dirname, "..", "uploads", "subscriptions");
const STORE_FILE = path.join(STORE_DIR, "store.json");

const ensureStore = async () => {
  await fs.mkdir(STORE_DIR, { recursive: true });
  try {
    await fs.access(STORE_FILE);
  } catch {
    await fs.writeFile(
      STORE_FILE,
      JSON.stringify({ subscriptions: {} }, null, 2),
      "utf8"
    );
  }
};

const readStore = async () => {
  await ensureStore();
  const raw = await fs.readFile(STORE_FILE, "utf8");
  const parsed = JSON.parse(raw || "{}");
  return typeof parsed.subscriptions === "object" ? parsed.subscriptions : {};
};

const writeStore = async (subscriptions) => {
  await ensureStore();
  await fs.writeFile(
    STORE_FILE,
    JSON.stringify({ subscriptions }, null, 2),
    "utf8"
  );
};

const getPeriodEnd = (billingCycle) => {
  const d = new Date();
  if (billingCycle === "annual") {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString();
};

const findByUserId = async (userId) => {
  const store = await readStore();
  return store[String(userId)] || null;
};

const upsertSubscription = async (userId, data) => {
  const store = await readStore();
  const existing = store[String(userId)] || {};
  const updated = {
    ...existing,
    ...data,
    userId: String(userId),
    updatedAt: new Date().toISOString(),
  };
  if (!updated.createdAt) updated.createdAt = new Date().toISOString();
  store[String(userId)] = updated;
  await writeStore(store);
  return updated;
};

const createDefaultSubscription = async (userId) => {
  return upsertSubscription(userId, {
    plan: "free",
    status: "active",
    billingCycle: "monthly",
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: getPeriodEnd("monthly"),
    cancelAtPeriodEnd: false,
    paymentMethod: null,
    invoices: [],
  });
};

const addInvoice = async (userId, invoice) => {
  const store = await readStore();
  const sub = store[String(userId)];
  if (!sub) throw new Error("Subscription not found");
  const invoices = Array.isArray(sub.invoices) ? sub.invoices : [];
  invoices.unshift({
    ...invoice,
    _id: crypto.randomBytes(8).toString("hex"),
    paidAt: new Date().toISOString(),
  });
  sub.invoices = invoices.slice(0, 20); // keep last 20
  sub.updatedAt = new Date().toISOString();
  store[String(userId)] = sub;
  await writeStore(store);
  return sub;
};

module.exports = {
  findByUserId,
  upsertSubscription,
  createDefaultSubscription,
  addInvoice,
  getPeriodEnd,
  getAllSubscriptions: readStore,
};
