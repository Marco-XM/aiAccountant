const mongoose = require("mongoose");
const Tax = require("../models/Tax");
const Transaction = require("../models/Transaction");
const localTaxStore = require("../services/localTaxStore");
const localTransactionStore = require("../services/localTransactionStore");
const { calculateTaxes, loadUserTaxes } = require("../services/taxService");
const { isMongoObjectId } = require("../services/userIdentity");

const dbReady = () => mongoose.connection.readyState === 1;
const useLocal = (userId) => !dbReady() || !isMongoObjectId(userId);

const sanitize = (body = {}) => {
  const out = {};
  if (body.name !== undefined) out.name = String(body.name).trim();
  if (body.type !== undefined) out.type = body.type === "flat" ? "flat" : "percentage";
  if (body.rate !== undefined) out.rate = Number(body.rate) || 0;
  if (body.amount !== undefined) out.amount = Number(body.amount) || 0;
  if (body.order !== undefined) out.order = Number(body.order) || 0;
  if (body.compound !== undefined) out.compound = Boolean(body.compound);
  if (body.appliesTo !== undefined)
    out.appliesTo = ["income", "expense"].includes(body.appliesTo) ? body.appliesTo : "all";
  if (body.active !== undefined) out.active = Boolean(body.active);
  return out;
};

const toClient = (t) => ({
  id: t.id || String(t._id),
  name: t.name,
  type: t.type || "percentage",
  rate: t.rate || 0,
  amount: t.amount || 0,
  order: t.order || 0,
  compound: Boolean(t.compound),
  appliesTo: t.appliesTo || "all",
  active: t.active !== false,
});

// Shared with the dashboard, chatbot, charts and transaction list.
const loadTaxes = loadUserTaxes;

/* ── CRUD ─────────────────────────────────────────────────────────────── */
const listTaxes = async (req, res) => {
  try {
    const taxes = await loadTaxes(req.user._id);
    res.json({ taxes });
  } catch (err) {
    console.error("listTaxes error:", err);
    res.status(500).json({ message: "Failed to load taxes." });
  }
};

const createTax = async (req, res) => {
  try {
    const data = sanitize(req.body);
    if (!data.name) return res.status(400).json({ message: "Tax name is required." });

    const userId = req.user._id;
    let tax;
    if (useLocal(userId)) {
      tax = toClient(await localTaxStore.create(userId, data));
    } else {
      tax = toClient(await Tax.create({ ...data, userId: String(userId) }));
    }
    res.status(201).json({ tax, message: "Tax created." });
  } catch (err) {
    console.error("createTax error:", err);
    res.status(500).json({ message: "Failed to create tax." });
  }
};

const updateTax = async (req, res) => {
  try {
    const data = sanitize(req.body);
    const userId = req.user._id;
    const { id } = req.params;

    let tax;
    if (useLocal(userId)) {
      tax = await localTaxStore.update(userId, id, data);
    } else {
      tax = await Tax.findOneAndUpdate({ _id: id, userId: String(userId) }, data, { new: true });
    }
    if (!tax) return res.status(404).json({ message: "Tax not found." });
    res.json({ tax: toClient(tax), message: "Tax updated." });
  } catch (err) {
    console.error("updateTax error:", err);
    res.status(500).json({ message: "Failed to update tax." });
  }
};

const deleteTax = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    let ok;
    if (useLocal(userId)) {
      ok = await localTaxStore.remove(userId, id);
    } else {
      const result = await Tax.deleteOne({ _id: id, userId: String(userId) });
      ok = result.deletedCount > 0;
    }
    if (!ok) return res.status(404).json({ message: "Tax not found." });
    res.json({ message: "Tax deleted." });
  } catch (err) {
    console.error("deleteTax error:", err);
    res.status(500).json({ message: "Failed to delete tax." });
  }
};

/* ── Calculator: apply taxes to an arbitrary base amount ──────────────── */
const calculate = async (req, res) => {
  try {
    const base = Number(req.body?.base) || 0;
    // Either use the user's saved taxes, or an ad-hoc set passed in the body.
    const taxes = Array.isArray(req.body?.taxes) ? req.body.taxes : await loadTaxes(req.user._id);
    res.json(calculateTaxes(base, taxes));
  } catch (err) {
    console.error("tax calculate error:", err);
    res.status(500).json({ message: "Failed to calculate taxes." });
  }
};

/* ── Report: apply taxes to the user's actual figures ─────────────────── */
const loadTransactions = async (userId) => {
  if (useLocal(userId)) {
    const result = await localTransactionStore.listTransactions({ userId, page: 1, limit: 5000 });
    return result.transactions || [];
  }
  return Transaction.find({ userId }).limit(10000).lean();
};

const report = async (req, res) => {
  try {
    const userId = req.user._id;
    const [taxes, transactions] = await Promise.all([loadTaxes(userId), loadTransactions(userId)]);

    const normType = (t) => (String(t || "").toLowerCase() === "income" ? "income" : "expense");
    const amountOf = (t) => Math.abs(Number(t.amount) || 0);

    const incomeTotal = transactions.filter((t) => normType(t.type) === "income").reduce((s, t) => s + amountOf(t), 0);
    const expenseTotal = transactions.filter((t) => normType(t.type) === "expense").reduce((s, t) => s + amountOf(t), 0);

    const incomeTaxes = taxes.filter((t) => ["all", "income"].includes(t.appliesTo));
    const expenseTaxes = taxes.filter((t) => ["all", "expense"].includes(t.appliesTo));

    // Per-transaction rollup: each transaction taxed by the taxes that apply to its type.
    let perTransactionTax = 0;
    for (const t of transactions) {
      const applicable = normType(t.type) === "income" ? incomeTaxes : expenseTaxes;
      perTransactionTax += calculateTaxes(amountOf(t), applicable).totalTax;
    }
    perTransactionTax = Math.round(perTransactionTax * 100) / 100;

    res.json({
      income: calculateTaxes(incomeTotal, incomeTaxes),
      expense: calculateTaxes(expenseTotal, expenseTaxes),
      perTransaction: { count: transactions.length, totalTax: perTransactionTax },
      taxCount: taxes.length,
    });
  } catch (err) {
    console.error("tax report error:", err);
    res.status(500).json({ message: "Failed to build tax report." });
  }
};

module.exports = { listTaxes, createTax, updateTax, deleteTax, calculate, report };
