const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const localTransactionStore = require("../services/localTransactionStore");
const { isMongoObjectId } = require("../services/userIdentity");
const { loadUserTaxes } = require("../services/taxService");
const { calculateDashboard } = require("./dashboardController");

const isDatabaseReady = () => mongoose.connection.readyState === 1;
const useLocal = (userId) =>
  !isDatabaseReady() || !isMongoObjectId(userId);

// ── helpers ──────────────────────────────────────────────────────────────────

const parseIntParam = (val, def, min, max) => {
  const n = parseInt(val, 10);
  if (isNaN(n)) return def;
  return Math.min(max, Math.max(min, n));
};

// ── v1 Transactions ───────────────────────────────────────────────────────────

/**
 * GET /api/v1/transactions
 * Query params: page, limit, type, category, dateFrom, dateTo, status
 */
const v1ListTransactions = async (req, res) => {
  const userId = req.user._id || req.user.id;
  const page = parseIntParam(req.query.page, 1, 1, 1000);
  const limit = parseIntParam(req.query.limit, 50, 1, 200);

  if (useLocal(userId)) {
    const result = await localTransactionStore.listTransactions({
      userId,
      page,
      limit,
      type: req.query.type,
      status: req.query.status,
      category: req.query.category,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
    });
    return res.json({ total: result.total, page, limit, transactions: result.transactions });
  }

  // MongoDB path
  const filter = { userId };
  if (req.query.type) filter.type = req.query.type;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.dateFrom || req.query.dateTo) {
    filter.date = {};
    if (req.query.dateFrom) filter.date.$gte = new Date(req.query.dateFrom);
    if (req.query.dateTo) filter.date.$lte = new Date(req.query.dateTo);
  }

  const skip = (page - 1) * limit;
  const [total, items] = await Promise.all([
    Transaction.countDocuments(filter),
    Transaction.find(filter).sort({ date: -1 }).skip(skip).limit(limit).lean(),
  ]);

  return res.json({ total, page, limit, transactions: items });
};

/**
 * GET /api/v1/transactions/:id
 */
const v1GetTransaction = async (req, res) => {
  const userId = req.user._id || req.user.id;
  const { id } = req.params;

  if (useLocal(userId)) {
    const t = await localTransactionStore.getTransactionById(id, userId);
    if (!t) return res.status(404).json({ message: "Transaction not found." });
    return res.json({ transaction: t });
  }

  const t = await Transaction.findOne({ _id: id, userId }).lean();
  if (!t) return res.status(404).json({ message: "Transaction not found." });
  return res.json({ transaction: t });
};

/**
 * POST /api/v1/transactions
 * Create a new transaction from an external system.
 */
const v1CreateTransaction = async (req, res) => {
  const userId = req.user._id || req.user.id;
  const { date, desc, amount, currency, category, type, vendor, account,
          paymentMethod, reference, status, notes, externalId } = req.body;

  if (!date || !desc || amount === undefined || !category) {
    return res.status(400).json({
      message: "Required fields: date, desc, amount, category.",
    });
  }

  const doc = {
    userId,
    date: new Date(date),
    desc,
    amount: Number(amount),
    currency: currency || "USD",
    category,
    type: type || "expense",
    vendor,
    account,
    paymentMethod,
    reference,
    status: status || "pending",
    notes,
    // Store the external ERP/system ID for traceability
    externalId: externalId || null,
    source: "api",
  };

  if (useLocal(userId)) {
    const saved = await localTransactionStore.createTransaction(doc, { userId });
    return res.status(201).json({ transaction: saved });
  }

  const saved = await Transaction.create(doc);
  return res.status(201).json({ transaction: saved });
};

/**
 * PUT /api/v1/transactions/:id
 * Update a transaction.
 */
const v1UpdateTransaction = async (req, res) => {
  const userId = req.user._id || req.user.id;
  const { id } = req.params;
  const allowed = ["date","desc","amount","currency","category","type",
                   "vendor","account","paymentMethod","reference","status","notes"];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (updates.date) updates.date = new Date(updates.date);
  if (updates.amount) updates.amount = Number(updates.amount);

  if (useLocal(userId)) {
    const updated = await localTransactionStore.updateTransaction(id, userId, updates);
    if (!updated) return res.status(404).json({ message: "Transaction not found." });
    return res.json({ transaction: updated });
  }

  const updated = await Transaction.findOneAndUpdate(
    { _id: id, userId },
    { $set: updates },
    { new: true }
  ).lean();
  if (!updated) return res.status(404).json({ message: "Transaction not found." });
  return res.json({ transaction: updated });
};

/**
 * DELETE /api/v1/transactions/:id
 */
const v1DeleteTransaction = async (req, res) => {
  const userId = req.user._id || req.user.id;
  const { id } = req.params;

  if (useLocal(userId)) {
    const deleted = await localTransactionStore.deleteTransaction(id, userId);
    if (!deleted) return res.status(404).json({ message: "Transaction not found." });
    return res.json({ message: "Transaction deleted." });
  }

  const deleted = await Transaction.findOneAndDelete({ _id: id, userId }).lean();
  if (!deleted) return res.status(404).json({ message: "Transaction not found." });
  return res.json({ message: "Transaction deleted." });
};

// ── v1 Dashboard ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/dashboard
 * Returns the same KPI summary as the internal dashboard.
 */
const v1GetDashboard = async (req, res) => {
  const userId = req.user._id || req.user.id;

  let transactions = [];
  if (useLocal(userId)) {
    const result = await localTransactionStore.listTransactions({ userId, limit: 10000 });
    transactions = result.transactions || [];
  } else {
    transactions = await Transaction.find({ userId }).lean();
  }

  const taxes = await loadUserTaxes(userId);
  const summary = calculateDashboard(transactions, taxes);
  return res.json({ dashboard: summary });
};

// ── v1 Ping / info ────────────────────────────────────────────────────────────

/**
 * GET /api/v1/ping
 * Health check for API consumers.
 */
const v1Ping = (_req, res) => {
  return res.json({
    status: "ok",
    version: "1",
    timestamp: new Date().toISOString(),
    docs: "https://github.com/your-org/aiAccountant/wiki/API",
  });
};

module.exports = {
  v1ListTransactions,
  v1GetTransaction,
  v1CreateTransaction,
  v1UpdateTransaction,
  v1DeleteTransaction,
  v1GetDashboard,
  v1Ping,
};
