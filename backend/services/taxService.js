/**
 * Pure tax calculation engine.
 *
 * Given a base amount and a list of taxes, computes each tax line and the totals.
 * Each tax: { name, type: "percentage"|"flat", rate, amount, order, compound, active }
 *   - order:    ascending — lower numbers are calculated first.
 *   - compound: when true the tax applies to the running total (base + earlier
 *               taxes); when false it applies to the original base amount.
 *
 * The `compound` flag is per-tax, so a single set of taxes can mix tax-on-tax
 * and on-base behaviour.
 */
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const calculateTaxes = (base, taxes = []) => {
  const safeBase = Number(base) || 0;
  const active = (Array.isArray(taxes) ? taxes : [])
    .filter((t) => t && t.active !== false)
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

  let running = safeBase;
  let totalTax = 0;

  const lines = active.map((tax) => {
    const taxableBase = tax.compound ? running : safeBase;
    const amount =
      tax.type === "flat"
        ? round2(tax.amount)
        : round2(taxableBase * ((Number(tax.rate) || 0) / 100));
    running = round2(running + amount);
    totalTax = round2(totalTax + amount);
    return {
      id: tax.id || (tax._id ? String(tax._id) : null),
      name: tax.name,
      type: tax.type || "percentage",
      rate: Number(tax.rate) || 0,
      compound: Boolean(tax.compound),
      taxableBase: round2(taxableBase),
      amount,
    };
  });

  return {
    base: round2(safeBase),
    lines,
    totalTax: round2(totalTax),
    total: round2(safeBase + totalTax),
  };
};

/* ── Persistence-aware helpers ──────────────────────────────────────────
 * Shared by every consumer (transactions, dashboard, chatbot, charts) so a
 * transaction is always taxed the same way regardless of where it's shown.
 * Tax is computed on-read from the user's saved rules — never stored on the
 * transaction — so editing a rule is reflected everywhere immediately. */
const mongoose = require("mongoose");
const Tax = require("../models/Tax");
const localTaxStore = require("./localTaxStore");
const { isMongoObjectId } = require("./userIdentity");

const dbReady = () => mongoose.connection.readyState === 1;
const useLocalTaxes = (userId) => !dbReady() || !isMongoObjectId(userId);

const toClientTax = (t) => ({
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

// Load a user's saved tax rules from MongoDB (or the local file store fallback).
const loadUserTaxes = async (userId) => {
  if (useLocalTaxes(userId)) {
    return (await localTaxStore.list(userId)).map(toClientTax);
  }
  const docs = await Tax.find({ userId: String(userId) }).sort({ order: 1 }).lean();
  return docs.map(toClientTax);
};

// The taxes that apply to a single transaction, based on its income/expense type.
const applicableTaxes = (type, taxes = []) => {
  const t = String(type || "").toLowerCase() === "income" ? "income" : "expense";
  return (Array.isArray(taxes) ? taxes : []).filter((tax) =>
    ["all", t].includes(tax.appliesTo || "all"),
  );
};

// Tax owed on one transaction. Transfers move money between accounts → never taxed.
const taxForTransaction = (amount, type, taxes = []) => {
  const base = Math.abs(Number(amount) || 0);
  if (String(type || "").toLowerCase() === "transfer") {
    return { taxAmount: 0, totalWithTax: round2(base), lines: [] };
  }
  const result = calculateTaxes(base, applicableTaxes(type, taxes));
  return { taxAmount: result.totalTax, totalWithTax: result.total, lines: result.lines };
};

// Roll a set of transactions up into tax totals. `totalTax` is the sum of the
// per-transaction tax (so it always matches the per-row figures shown in the UI);
// the aggregate income/expense figures are kept for the Taxes-page report.
const summarizeTransactionTaxes = (transactions = [], taxes = []) => {
  const incomeTaxes = (taxes || []).filter((t) => ["all", "income"].includes(t.appliesTo || "all"));
  const expenseTaxes = (taxes || []).filter((t) => ["all", "expense"].includes(t.appliesTo || "all"));
  const amountOf = (t) => Math.abs(Number(t.amount) || 0);

  let incomeBase = 0;
  let expenseBase = 0;
  let perTransactionTax = 0;

  for (const t of transactions || []) {
    const type = String(t.type || "").toLowerCase();
    if (type === "transfer") continue;
    const amt = amountOf(t);
    if (type === "income") incomeBase += amt;
    else expenseBase += amt;
    perTransactionTax += taxForTransaction(amt, type, taxes).taxAmount;
  }

  return {
    incomeBase: round2(incomeBase),
    expenseBase: round2(expenseBase),
    incomeTax: calculateTaxes(incomeBase, incomeTaxes).totalTax,
    expenseTax: calculateTaxes(expenseBase, expenseTaxes).totalTax,
    perTransactionTax: round2(perTransactionTax),
    totalTax: round2(perTransactionTax),
    taxCount: (taxes || []).length,
  };
};

module.exports = {
  calculateTaxes,
  loadUserTaxes,
  applicableTaxes,
  taxForTransaction,
  summarizeTransactionTaxes,
};
