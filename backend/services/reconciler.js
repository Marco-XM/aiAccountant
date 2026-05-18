const Transaction = require("../models/Transaction");
const localStore = require("./localTransactionStore");
const mongoose = require("mongoose");

// Lightweight reconciliation service scaffold.
// Responsibilities:
// - list pending local transactions
// - attempt idempotent insert into MongoDB
// - delete or mark local records on success
// - expose `reconcileAll` for manual/admin runs

const listPending = async ({ userId, limit = 100 } = {}) => {
  const res = await localStore.listTransactions({ userId, page: 1, limit });
  return res.transactions || [];
};

const reconcileOne = async (localTx) => {
  if (!mongoose.connection.readyState) throw new Error("Database not connected");

  // Basic idempotency: prefer _id from local record if available
  const doc = {
    _id: String(localTx._id || localTx.id || localTx.raw?._id || localTx.raw?.id || require("crypto").randomUUID()),
    userId: String(localTx.userId || localTx.raw?.userId || ""),
    date: localTx.date || new Date(),
    amount: localTx.amount || localTx.raw?.amount || 0,
    type: localTx.type || localTx.raw?.type || "expense",
    status: localTx.status || "pending",
    category: localTx.category || localTx.raw?.category || "Uncategorized",
    desc: localTx.desc || localTx.raw?.description || "",
    vendor: localTx.vendor || localTx.raw?.vendor || "",
    currency: localTx.currency || "USD",
    account: localTx.account || "",
    importJobId: localTx.importJobId || "",
    raw: localTx.raw || localTx,
  };

  // Use upsert to avoid duplicates
  try {
    await Transaction.updateOne({ _id: doc._id }, { $setOnInsert: doc }, { upsert: true });
    // remove from local store on success
    await localStore.deleteTransaction(doc._id);
    return { ok: true, id: doc._id };
  } catch (err) {
    return { ok: false, error: err.message };
  }
};

const reconcileAll = async ({ userId } = {}) => {
  if (!mongoose.connection.readyState) throw new Error("Database not connected");
  const pending = await listPending({ userId, limit: 500 });
  const results = [];
  for (const tx of pending) {
    // Best-effort: continue on errors
    try {
      const r = await reconcileOne(tx);
      results.push(r);
    } catch (err) {
      results.push({ ok: false, error: err.message });
    }
  }
  return results;
};

// Optionally hook into mongoose connection events to auto-trigger
mongoose.connection?.on?.("connected", () => {
  console.log("reconciler: mongoose connected — no automatic reconcile by default");
});

module.exports = { listPending, reconcileOne, reconcileAll };
