const crypto = require("crypto");
const fs = require("fs").promises;
const path = require("path");

const STORE_DIR = path.join(__dirname, "..", "uploads", "transactions-local");
const STORE_FILE = path.join(STORE_DIR, "store.json");

const ensureStore = async () => {
  await fs.mkdir(STORE_DIR, { recursive: true });
  try {
    await fs.access(STORE_FILE);
  } catch {
    await fs.writeFile(STORE_FILE, JSON.stringify({ transactions: [] }, null, 2), "utf8");
  }
};

const readStore = async () => {
  await ensureStore();
  const raw = await fs.readFile(STORE_FILE, "utf8");
  const parsed = JSON.parse(raw || "{}");
  return Array.isArray(parsed.transactions) ? parsed.transactions : [];
};

const writeStore = async (transactions) => {
  await ensureStore();
  await fs.writeFile(STORE_FILE, JSON.stringify({ transactions }, null, 2), "utf8");
};

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const normalizeStatus = (value) => {
  const raw = normalizeText(value);
  if (["pending", "approved", "rejected", "needs_review", "reconciled", "flagged"].includes(raw)) return raw;
  if (raw === "needs review") return "needs_review";
  return raw || "pending";
};

const normalizeType = (value) => {
  const raw = normalizeText(value);
  if (["income", "expense", "transfer"].includes(raw)) return raw;
  return "expense";
};

const toRecord = ({ transaction, userId, meta = {} }) => {
  const now = new Date().toISOString();
  const id = transaction._id ? String(transaction._id) : crypto.randomUUID();
  const createdAt = transaction.createdAt ? new Date(transaction.createdAt).toISOString() : now;
  const updatedAt = now;
  const transactionId = transaction.transactionId || `TXN${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  return {
    ...transaction,
    _id: id,
    transactionId,
    userId: String(userId),
    date: transaction.date ? new Date(transaction.date).toISOString() : now,
    desc: String(transaction.desc || transaction.description || "Imported transaction"),
    amount: Number.isFinite(Number(transaction.amount)) ? Math.abs(Number(transaction.amount)) : 0,
    category: String(transaction.category || "Uncategorized"),
    type: normalizeType(transaction.type),
    status: normalizeStatus(transaction.status),
    vendor: transaction.vendor ? String(transaction.vendor) : "",
    currency: transaction.currency ? String(transaction.currency) : "USD",
    notes: transaction.notes ? String(transaction.notes) : "",
    reference: transaction.reference ? String(transaction.reference) : "",
    account: transaction.account ? String(transaction.account) : "",
    paymentMethod: transaction.paymentMethod ? String(transaction.paymentMethod) : "",
    importJobId: transaction.importJobId ? String(transaction.importJobId) : "",
    importSheet: transaction.importSheet ? String(transaction.importSheet) : "",
    importRow: Number(transaction.importRow) || undefined,
    rawData: transaction.rawData || null,
    tags: Array.isArray(transaction.tags) ? transaction.tags : [],
    duplicateHash: transaction.duplicateHash ? String(transaction.duplicateHash) : "",
    sourceFile: transaction.sourceFile || null,
    aiAnalysis: transaction.aiAnalysis || null,
    metaData: transaction.metaData || null,
    createdAt,
    updatedAt,
    localOnly: true,
    localMeta: meta,
  };
};

const matchesQuery = (transaction, query = {}) => {
  if (query.userId && String(transaction.userId) !== String(query.userId)) {
    return false;
  }

  if (query.category && String(transaction.category) !== String(query.category)) {
    return false;
  }

  if (query.status) {
    const normalizedStatus = normalizeStatus(query.status);
    if (normalizeStatus(transaction.status) !== normalizedStatus) {
      return false;
    }
  }

  if (query.type) {
    const normalizedType = normalizeType(query.type);
    if (normalizeType(transaction.type) !== normalizedType) {
      return false;
    }
  }

  if (query.search && String(query.search).trim()) {
    const searchTerm = normalizeText(query.search);
    const haystack = [transaction.desc, transaction.category, transaction.vendor, transaction.status]
      .map(normalizeText)
      .join(" ");
    if (!haystack.includes(searchTerm)) {
      return false;
    }
  }

  if (query.dateFrom || query.dateTo) {
    const value = new Date(transaction.date || transaction.createdAt || 0).getTime();
    const from = query.dateFrom ? new Date(query.dateFrom).getTime() : null;
    const toDate = query.dateTo ? new Date(query.dateTo) : null;
    if (toDate) toDate.setHours(23, 59, 59, 999);
    const to = toDate ? toDate.getTime() : null;
    if (from && value < from) return false;
    if (to && value > to) return false;
  }

  return true;
};

const sortRecords = (items, sort = "date", direction = "desc") => [...items].sort((left, right) => {
  const multiplier = direction === "asc" ? 1 : -1;
  if (sort === "amount") {
    return ((Number(left.amount) || 0) - (Number(right.amount) || 0)) * multiplier;
  }
  if (["category", "type", "status", "vendor", "source"].includes(sort)) {
    return String(left[sort] || "").localeCompare(String(right[sort] || "")) * multiplier;
  }
  const leftTime = new Date(left.date || left.createdAt || 0).getTime();
  const rightTime = new Date(right.date || right.createdAt || 0).getTime();
  return (leftTime - rightTime) * multiplier;
});

const createTransactions = async (transactions, { userId, meta = {} }) => {
  const store = await readStore();
  const created = transactions.map((transaction) => toRecord({ transaction, userId, meta }));
  store.push(...created);
  await writeStore(store);
  return created;
};

const createTransaction = async (transaction, { userId, meta = {} }) => {
  const created = await createTransactions([transaction], { userId, meta });
  return created[0];
};

const listTransactions = async ({ userId, page = 1, limit = 1000, category, status, type, search, dateFrom, dateTo, sort = "date", direction = "desc" }) => {
  const store = await readStore();
  const filter = { userId, category, status, type, search, dateFrom, dateTo };
  const filtered = sortRecords(store.filter((transaction) => matchesQuery(transaction, filter)), sort, direction);
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Math.min(5000, Number(limit) || 1000));
  const start = (pageNum - 1) * limitNum;
  const items = filtered.slice(start, start + limitNum);

  return {
    transactions: items,
    total: filtered.length,
    currentPage: pageNum,
    totalPages: Math.ceil(filtered.length / limitNum),
  };
};

const getStats = async ({ userId, category, status, type, search, dateFrom, dateTo }) => {
  const store = await readStore();
  const filter = { userId, category, status, type, search, dateFrom, dateTo };
  const filtered = store.filter((transaction) => matchesQuery(transaction, filter));

  const summary = filtered.reduce(
    (accumulator, transaction) => {
      const amount = Math.abs(Number(transaction.amount) || 0);
      accumulator.totalTransactions += 1;
      if (normalizeType(transaction.type) === "income") accumulator.totalIncome += amount;
      if (normalizeType(transaction.type) === "expense") accumulator.totalExpenses += amount;
      if (["needs_review", "pending"].includes(normalizeStatus(transaction.status))) accumulator.pendingCount += 1;
      return accumulator;
    },
    {
      totalTransactions: 0,
      totalIncome: 0,
      totalExpenses: 0,
      pendingCount: 0,
    },
  );

  const categoryMap = new Map();
  for (const transaction of filtered) {
    const key = transaction.category || "Uncategorized";
    const current = categoryMap.get(key) || { _id: key, count: 0, totalAmount: 0 };
    current.count += 1;
    current.totalAmount += Math.abs(Number(transaction.amount) || 0);
    categoryMap.set(key, current);
  }

  return {
    summary,
    categoryBreakdown: Array.from(categoryMap.values()).sort((left, right) => right.totalAmount - left.totalAmount),
  };
};

const getTransactionById = async (transactionId, userId) => {
  const store = await readStore();
  return store.find((transaction) => String(transaction._id) === String(transactionId) && String(transaction.userId) === String(userId)) || null;
};

const updateTransaction = async (transactionId, userId, updates) => {
  const store = await readStore();
  const index = store.findIndex((transaction) => String(transaction._id) === String(transactionId) && String(transaction.userId) === String(userId));
  if (index === -1) return null;

  const next = { ...store[index], ...updates, updatedAt: new Date().toISOString() };
  if (updates.date !== undefined) next.date = new Date(updates.date).toISOString();
  if (updates.amount !== undefined) next.amount = Math.abs(Number(updates.amount) || 0);
  if (updates.type !== undefined) next.type = normalizeType(updates.type);
  if (updates.status !== undefined) next.status = normalizeStatus(updates.status);
  if (updates.category !== undefined) next.category = String(updates.category);
  if (updates.desc !== undefined) next.desc = String(updates.desc);
  if (updates.vendor !== undefined) next.vendor = String(updates.vendor || "");
  if (updates.currency !== undefined) next.currency = String(updates.currency || "USD");
  if (updates.notes !== undefined) next.notes = String(updates.notes || "");
  if (updates.reference !== undefined) next.reference = String(updates.reference || "");
  if (updates.account !== undefined) next.account = String(updates.account || "");
  if (updates.paymentMethod !== undefined) next.paymentMethod = String(updates.paymentMethod || "");

  store[index] = next;
  await writeStore(store);
  return next;
};

const deleteTransaction = async (transactionId, userId) => {
  const store = await readStore();
  const index = store.findIndex((transaction) => String(transaction._id) === String(transactionId) && String(transaction.userId) === String(userId));
  if (index === -1) return null;

  const [removed] = store.splice(index, 1);
  await writeStore(store);
  return removed;
};

const deleteMany = async (transactionIds, userId) => {
  const ids = new Set((Array.isArray(transactionIds) ? transactionIds : []).map(String));
  const store = await readStore();
  const remaining = [];
  let deletedCount = 0;

  for (const transaction of store) {
    const shouldDelete = String(transaction.userId) === String(userId) && ids.has(String(transaction._id));
    if (shouldDelete) {
      deletedCount += 1;
      continue;
    }
    remaining.push(transaction);
  }

  await writeStore(remaining);
  return { deletedCount };
};

const deleteAll = async (userId) => {
  const store = await readStore();
  const remaining = store.filter((transaction) => String(transaction.userId) !== String(userId));
  const deletedCount = store.length - remaining.length;
  await writeStore(remaining);
  return { deletedCount };
};

module.exports = {
  ensureStore,
  createTransactions,
  createTransaction,
  listTransactions,
  getStats,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  deleteMany,
  deleteAll,
};
