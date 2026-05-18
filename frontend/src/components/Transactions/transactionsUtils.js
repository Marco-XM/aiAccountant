const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const formatCurrency = (value) => {
  const numericValue = Number(value || 0);
  if (Number.isNaN(numericValue)) {
    return "-$0.00";
  }

  return currencyFormatter.format(numericValue);
};

export const formatCompactNumber = (value) => {
  const numericValue = Number(value || 0);
  if (Number.isNaN(numericValue)) {
    return "0";
  }

  return compactNumberFormatter.format(numericValue);
};

export const formatDate = (value) => {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

export const formatDateTime = (value) => {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

export const normalizeTransaction = (transaction = {}) => {
  if (!transaction || typeof transaction !== "object") {
    transaction = {};
  }

  const amount = Number(transaction.amount ?? transaction.total ?? 0);
  const dateValue =
    transaction.date || transaction.transactionDate || transaction.createdAt || "";

  return {
    ...transaction,
    _id: transaction._id || transaction.id || `${dateValue}-${transaction.desc || transaction.description || "transaction"}`,
    desc: transaction.desc || transaction.description || transaction.memo || transaction.title || "Untitled transaction",
    amount: Number.isNaN(amount) ? 0 : amount,
    category: transaction.category || "Uncategorized",
    status: transaction.status || "needs_review",
    type: transaction.type || (amount < 0 ? "expense" : "income"),
    vendor: transaction.vendor || transaction.payee || transaction.merchant || "",
    tags: Array.isArray(transaction.tags) ? transaction.tags : [],
    date: dateValue,
    note: transaction.note || transaction.notes || "",
  };
};

export const getTypeTone = (type) => {
  if (type === "income") {
    return "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/30";
  }

  if (type === "transfer") {
    return "text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-300 dark:bg-sky-500/10 dark:border-sky-500/30";
  }

  return "text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-500/10 dark:border-rose-500/30";
};

export const getStatusTone = (status) => {
  const normalizedStatus = String(status || "").toLowerCase();

  if (normalizedStatus === "approved" || normalizedStatus === "cleared") {
    return "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/30";
  }

  if (normalizedStatus === "reconciled") {
    return "text-cyan-700 bg-cyan-50 border-cyan-200 dark:text-cyan-300 dark:bg-cyan-500/10 dark:border-cyan-500/30";
  }

  if (normalizedStatus === "pending" || normalizedStatus === "needs_review") {
    return "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/30";
  }

  if (normalizedStatus === "rejected" || normalizedStatus === "flagged") {
    return "text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-500/10 dark:border-rose-500/30";
  }

  return "text-slate-700 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-slate-500/10 dark:border-slate-500/30";
};

export const getCategoryScore = (category) => {
  const normalizedCategory = String(category || "").toLowerCase();

  if (/(salary|invoice|sale|revenue|client|customer|subscription)/.test(normalizedCategory)) {
    return "income";
  }

  if (/(rent|utilities|tax|travel|office|equipment|service|subscription|software)/.test(normalizedCategory)) {
    return "expense";
  }

  return "neutral";
};

export const suggestCategory = (description = "", vendor = "") => {
  const text = `${description} ${vendor}`.toLowerCase();

  if (/salary|payroll|invoice|payment received|subscription revenue|sale/.test(text)) {
    return "Revenue";
  }

  if (/uber|lyft|taxi|travel|flight|hotel/.test(text)) {
    return "Travel";
  }

  if (/aws|gcp|azure|hosting|cloud|server|domain/.test(text)) {
    return "Software & Hosting";
  }

  if (/office|stationery|printer|paper/.test(text)) {
    return "Office Supplies";
  }

  if (/rent|lease|building/.test(text)) {
    return "Rent";
  }

  if (/food|meal|restaurant|cafe|coffee/.test(text)) {
    return "Meals";
  }

  return "Uncategorized";
};

export const deriveInsights = (transactions) => {
  const rows = (transactions || []).map(normalizeTransaction);
  const totalTransactions = rows.length;
  const totalIncome = rows.filter((item) => item.type === "income").reduce((sum, item) => sum + Math.abs(item.amount || 0), 0);
  const totalExpenses = rows.filter((item) => item.type !== "income").reduce((sum, item) => sum + Math.abs(item.amount || 0), 0);
  const pendingCount = rows.filter((item) => ["pending", "needs_review"].includes(String(item.status || "").toLowerCase())).length;

  const duplicateMap = new Map();
  rows.forEach((item) => {
    const key = [String(item.date || "").slice(0, 10), String(item.desc || "").toLowerCase().trim(), String(Math.abs(item.amount || 0)).trim()].join("|");
    duplicateMap.set(key, (duplicateMap.get(key) || 0) + 1);
  });

  const duplicateCount = Array.from(duplicateMap.values()).filter((count) => count > 1).reduce((sum, count) => sum + count - 1, 0);

  const sortedByAmount = [...rows].sort((left, right) => Math.abs(right.amount || 0) - Math.abs(left.amount || 0));
  const suspicious = sortedByAmount.filter((item, index) => {
    const value = Math.abs(item.amount || 0);
    return value >= 5000 || (index < 10 && value >= (Math.abs(sortedByAmount[Math.min(10, sortedByAmount.length - 1)]?.amount || 0) || 0) * 1.5);
  }).slice(0, 5);

  const uncategorizedCount = rows.filter((item) => !item.category || String(item.category).toLowerCase() === "uncategorized").length;

  const categoryFrequency = new Map();
  rows.forEach((item) => {
    const key = item.category || "Uncategorized";
    const current = categoryFrequency.get(key) || { category: key, count: 0, total: 0 };
    current.count += 1;
    current.total += Math.abs(item.amount || 0);
    categoryFrequency.set(key, current);
  });

  const topCategories = Array.from(categoryFrequency.values())
    .sort((left, right) => right.total - left.total)
    .slice(0, 4);

  const monthlyBuckets = new Map();
  rows.forEach((item) => {
    const value = new Date(item.date);
    if (Number.isNaN(value.getTime())) {
      return;
    }

    const key = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
    const bucket = monthlyBuckets.get(key) || { key, income: 0, expense: 0 };
    if (item.type === "income") {
      bucket.income += Math.abs(item.amount || 0);
    } else {
      bucket.expense += Math.abs(item.amount || 0);
    }
    monthlyBuckets.set(key, bucket);
  });

  const monthlyTrend = Array.from(monthlyBuckets.values()).sort((left, right) => left.key.localeCompare(right.key)).slice(-6);

  const suggestedCategory = suggestCategory(suspicious[0]?.desc, suspicious[0]?.vendor);

  return {
    summary: {
      totalTransactions,
      totalIncome,
      totalExpenses,
      pendingCount,
    },
    duplicateCount,
    suspicious,
    uncategorizedCount,
    topCategories,
    monthlyTrend,
    suggestedCategory,
  };
};
