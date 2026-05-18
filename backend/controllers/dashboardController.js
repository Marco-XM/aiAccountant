const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const localTransactionStore = require("../services/localTransactionStore");
const { isMongoObjectId } = require("../services/userIdentity");

const isDatabaseReady = () => mongoose.connection.readyState === 1;
const useLocalTransactionStore = (userId) => !isDatabaseReady() || !isMongoObjectId(userId);

const normalizeType = (value) => {
  const raw = String(value || "").toLowerCase();
  if (["income", "expense", "transfer"].includes(raw)) return raw;
  return "expense";
};

const normalizeStatus = (value) => String(value || "pending").toLowerCase();

const monthKey = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "Unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const startOfMonth = (offset = 0) => {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  date.setMonth(date.getMonth() + offset);
  return date;
};

const calculateDashboard = (transactions = []) => {
  const rows = transactions.map((transaction) => ({
    ...transaction,
    type: normalizeType(transaction.type),
    status: normalizeStatus(transaction.status),
    amount: Math.abs(Number(transaction.amount) || 0),
    date: transaction.date || transaction.createdAt,
    desc: transaction.desc || transaction.description || "Untitled transaction",
    category: transaction.category || "Uncategorized",
    vendor: transaction.vendor || transaction.payee || "",
  }));

  const currentMonthStart = startOfMonth(0);
  const previousMonthStart = startOfMonth(-1);
  const nextMonthStart = startOfMonth(1);

  const currentRows = rows.filter((row) => {
    const date = new Date(row.date);
    return !Number.isNaN(date.getTime()) && date >= currentMonthStart && date < nextMonthStart;
  });
  const previousRows = rows.filter((row) => {
    const date = new Date(row.date);
    return !Number.isNaN(date.getTime()) && date >= previousMonthStart && date < currentMonthStart;
  });

  const sumByType = (items, type) =>
    items.filter((item) => item.type === type).reduce((sum, item) => sum + item.amount, 0);

  const revenue = sumByType(rows, "income");
  const expenses = sumByType(rows, "expense");
  const currentRevenue = sumByType(currentRows, "income");
  const currentExpenses = sumByType(currentRows, "expense");
  const previousRevenue = sumByType(previousRows, "income");
  const previousExpenses = sumByType(previousRows, "expense");
  const netProfit = revenue - expenses;
  const currentProfit = currentRevenue - currentExpenses;
  const previousProfit = previousRevenue - previousExpenses;
  const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const growth = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : currentRevenue > 0 ? 100 : 0;
  const burnRate = currentExpenses || expenses / Math.max(1, new Set(rows.map((row) => monthKey(row.date))).size);
  const runway = burnRate > 0 && netProfit > 0 ? netProfit / burnRate : 0;
  const taxEstimate = Math.max(0, currentProfit * 0.22);
  const pendingCount = rows.filter((row) => ["pending", "needs_review"].includes(row.status)).length;
  const reconciliationCount = rows.filter((row) => ["pending", "needs_review", "flagged"].includes(row.status)).length;

  const monthlyMap = new Map();
  for (const row of rows) {
    const key = monthKey(row.date);
    const current = monthlyMap.get(key) || { month: key, revenue: 0, expenses: 0, profit: 0, cashFlow: 0 };
    if (row.type === "income") current.revenue += row.amount;
    if (row.type === "expense") current.expenses += row.amount;
    current.profit = current.revenue - current.expenses;
    current.cashFlow = current.profit;
    monthlyMap.set(key, current);
  }
  const monthlyTrend = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);

  // Normalize trend points to a stable contract for frontend charts
  const trends = monthlyTrend.map((pt) => {
    // `pt.month` is YYYY-MM from monthKey; convert to ISO date (first of month)
    const date = `${pt.month}-01`;
    return {
      date,
      income: Number(pt.revenue || 0),
      expense: Number(pt.expenses || 0),
      profit: Number(pt.profit || 0),
      cashFlow: Number(pt.cashFlow || 0),
    };
  });

  const categoryMap = new Map();
  const vendorMap = new Map();
  const duplicateMap = new Map();
  const heatmap = new Map();

  for (const row of rows) {
    if (row.type === "expense") {
      const category = categoryMap.get(row.category) || { category: row.category, amount: 0, count: 0 };
      category.amount += row.amount;
      category.count += 1;
      categoryMap.set(row.category, category);

      const vendor = row.vendor || "Unknown vendor";
      const vendorEntry = vendorMap.get(vendor) || { vendor, amount: 0, count: 0 };
      vendorEntry.amount += row.amount;
      vendorEntry.count += 1;
      vendorMap.set(vendor, vendorEntry);
    }

    const duplicateKey = [String(row.date || "").slice(0, 10), row.desc.toLowerCase().trim(), row.amount.toFixed(2)].join("|");
    duplicateMap.set(duplicateKey, (duplicateMap.get(duplicateKey) || 0) + 1);

    const date = new Date(row.date);
    if (!Number.isNaN(date.getTime())) {
      const key = `${date.getDay()}-${date.getHours()}`;
      const item = heatmap.get(key) || { day: date.getDay(), hour: date.getHours(), count: 0, amount: 0 };
      item.count += 1;
      item.amount += row.amount;
      heatmap.set(key, item);
    }
  }

  const duplicateCount = Array.from(duplicateMap.values())
    .filter((count) => count > 1)
    .reduce((sum, count) => sum + count - 1, 0);
  const suspicious = [...rows]
    .filter((row) => row.amount >= 5000 || row.status === "flagged")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);
  const topCategories = Array.from(categoryMap.values()).sort((a, b) => b.amount - a.amount).slice(0, 8);
  const topVendors = Array.from(vendorMap.values()).sort((a, b) => b.amount - a.amount).slice(0, 8);
  const recentTransactions = [...rows]
    .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
    .slice(0, 8);

  const softwareCategory = topCategories.find((entry) => /software|hosting|subscription|cloud/i.test(entry.category));
  const insights = [
    {
      type: growth >= 0 ? "positive" : "warning",
      title: "Revenue momentum",
      text: `Revenue is ${Math.abs(growth).toFixed(1)}% ${growth >= 0 ? "above" : "below"} the previous month.`,
    },
    {
      type: currentExpenses > previousExpenses ? "warning" : "positive",
      title: "Expense movement",
      text: `Current month expenses are ${previousExpenses ? Math.abs(((currentExpenses - previousExpenses) / previousExpenses) * 100).toFixed(1) : "0.0"}% ${currentExpenses > previousExpenses ? "higher" : "lower"} than last month.`,
    },
    {
      type: duplicateCount ? "warning" : "positive",
      title: "Duplicate risk",
      text: duplicateCount ? `${duplicateCount} potential duplicate transactions need review.` : "No duplicate pattern is visible in the current ledger.",
    },
    {
      type: "info",
      title: "Tax reserve",
      text: `Set aside about ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(taxEstimate)} based on current-month profit.`,
    },
  ];

  if (softwareCategory) {
    insights.push({
      type: "info",
      title: "Subscription spend",
      text: `${softwareCategory.category} is the top recurring-like spend category at ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(softwareCategory.amount)}.`,
    });
  }

  return {
    summary: {
      totalTransactions: rows.length,
      revenue,
      expenses,
      netProfit,
      cashFlow: netProfit,
      currentRevenue,
      currentExpenses,
      currentProfit,
      previousRevenue,
      previousExpenses,
      previousProfit,
      monthlyGrowth: growth,
      burnRate,
      runway,
      taxEstimate,
      profitMargin: margin,
      pendingCount,
      reconciliationCount,
      outstandingInvoices: Math.round(currentRevenue * 0.18),
      bankBalance: Math.max(0, netProfit + currentRevenue * 0.35),
      budgetUsage: currentRevenue > 0 ? Math.min(100, (currentExpenses / currentRevenue) * 100) : 0,
      payrollEstimate: currentExpenses * 0.32,
      subscriptionCosts: softwareCategory?.amount || 0,
    },
    monthlyTrend,
    trends,
    topCategories,
    topVendors,
    heatmap: Array.from(heatmap.values()).slice(0, 120),
    recentTransactions,
    suspicious,
    insights,
    workflow: {
      approvals: pendingCount,
      reconciliation: reconciliationCount,
      duplicateCount,
      uncategorized: rows.filter((row) => row.category === "Uncategorized").length,
      reminders: [
        { title: "Month-end close", due: "3 days", priority: "High" },
        { title: "Review tax reserve", due: "This week", priority: "Medium" },
        { title: "Export CFO packet", due: "Friday", priority: "Medium" },
      ],
      tasks: [
        { title: "Approve pending transactions", count: pendingCount },
        { title: "Reconcile bank feed", count: reconciliationCount },
        { title: "Investigate anomalies", count: suspicious.length },
      ],
    },
  };
};

const getDashboardOverview = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const userId = req.user._id;
    let transactions = [];
    const localStore = useLocalTransactionStore(userId);

    if (localStore) {
      const result = await localTransactionStore.listTransactions({ userId, page: 1, limit: 5000 });
      transactions = result.transactions;
    } else {
      transactions = await Transaction.find({ userId })
        .sort({ date: -1, _id: -1 })
        .limit(10000)
        .lean();
    }

    res.json(calculateDashboard(transactions));
  } catch (error) {
    console.error("Error building dashboard overview:", error);
    res.status(500).json({ error: "Failed to load dashboard overview", message: error.message });
  }
};

module.exports = {
  getDashboardOverview,
};
