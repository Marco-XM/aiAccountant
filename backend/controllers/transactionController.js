const crypto = require("crypto");
const { EventEmitter } = require("events");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const mongoose = require("mongoose");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const XLSX = require("xlsx");
const pdfParse = require("pdf-parse");
const Transaction = require("../models/Transaction");
const localTransactionStore = require("../services/localTransactionStore");
const usageService = require("../services/usageService");
const { isMongoObjectId } = require("../services/userIdentity");

const normalizeTransactionType = (value) => {
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim().toLowerCase();

  if (
    ["income", "in", "revenue", "sale", "sales", "credit", "deposit"].includes(
      raw,
    )
  )
    return "income";
  if (
    [
      "expense",
      "exp",
      "cost",
      "debit",
      "withdrawal",
      "spend",
      "spending",
    ].includes(raw)
  )
    return "expense";
  if (["transfer", "xfer", "move"].includes(raw)) return "transfer";

  if (["income", "expense", "transfer"].includes(raw)) return raw;
  return undefined;
};

/**
 * Infer income vs expense from a single row's content when no explicit
 * "type" column is present.
 *
 * Priority order:
 *  1. A dedicated "type" / "transaction type" column value
 *  2. Reference / ID prefix  (SAL → income, EXP/PUR/PAY → expense)
 *  3. Category or Description keywords
 *  4. Amount sign  (negative → expense; positive alone is NOT proof of expense)
 *  5. Default: "expense" (last resort)
 */
const inferTypeFromRow = (row) => {
  const entries = Object.entries(row || {});
  const get = (...names) => {
    for (const name of names) {
      const lc = name.toLowerCase();
      for (const [k, v] of entries) {
        if (String(k).toLowerCase() === lc) return String(v ?? "").trim();
      }
    }
    return "";
  };

  // 1. Explicit type column
  const explicit = normalizeTransactionType(
    get("type", "transaction type", "txn type", "trans type"),
  );
  if (explicit) return explicit;

  // 2. Reference / ID prefix
  const ref = get(
    "id", "transaction id", "reference", "ref", "sale id", "sales id",
    "expense id", "invoice id", "invoice no", "invoice number",
  );
  if (ref) {
    const refUpper = ref.toUpperCase();
    if (/^(SAL|SLS|INV|REV|REC|RCPT|INC|CR)/.test(refUpper)) return "income";
    if (/^(EXP|PUR|PAY|PMT|BILL|COST|DR)/.test(refUpper)) return "expense";
  }

  // 3. Category keywords
  const category = get("category", "cat");
  if (category) {
    const catLc = category.toLowerCase();
    if (/\b(sale|sales|revenue|income|receipt|credit|invoice|earning|gain)\b/.test(catLc))
      return "income";
    if (/\b(expense|cost|purchase|payment|bill|fee|charge|debit|spend)\b/.test(catLc))
      return "expense";
  }

  // 4. Description keywords
  const desc = get("description", "desc", "details", "narration", "memo", "purpose");
  if (desc) {
    const descLc = desc.toLowerCase();
    if (/\b(sale|sales|revenue|income|receipt|credit|earned|invoice|customer payment)\b/.test(descLc))
      return "income";
    if (/\b(expense|purchase|payment|bill|fee|charge|subscription|salary|rent|utility)\b/.test(descLc))
      return "expense";
  }

  // 5. Amount sign
  const amountRaw = get("amount", "total", "net", "gross", "value", "price", "debit", "credit");
  if (amountRaw !== "") {
    const num = parseFloat(String(amountRaw).replace(/[^0-9.-]/g, ""));
    if (!isNaN(num) && num < 0) return "expense";
  }

  return "expense"; // final fallback
};

const normalizeStatus = (value) => {
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim().toLowerCase();
  if (["pending", "approved", "rejected", "needs_review", "reconciled", "flagged"].includes(raw))
    return raw;
  if (raw === "needs review") return "needs_review";
  return undefined;
};

// ---------------------------------------------------------------------------
// inferCategoryFromRow
// Assigns a meaningful category based on description, vendor, reference ID,
// amount, and transaction type when no explicit category column is present
// (or when the column value is blank / "Uncategorized").
//
// Returns a string category name.
// ---------------------------------------------------------------------------
const CATEGORY_RULES = [
  // ── INCOME ──────────────────────────────────────────────────────────────
  { pattern: /\b(sale|sales|sold|invoice|invoiced|receipt|revenue|turnover|retail)\b/i,  type: "income",  category: "Sales Revenue" },
  { pattern: /\b(service fee|service revenue|consulting|advisory|professional service|project fee)\b/i, type: "income", category: "Service Revenue" },
  { pattern: /\b(interest income|interest earned|bank interest|savings interest)\b/i, type: "income", category: "Interest Income" },
  { pattern: /\b(rental income|rent received|lease income|sublease)\b/i, type: "income", category: "Rental Income" },
  { pattern: /\b(dividend|investment return|capital gain|stock sale)\b/i, type: "income", category: "Investment Income" },
  { pattern: /\b(refund|rebate|cashback|reimbursement received|credit note)\b/i, type: "income", category: "Refunds & Rebates" },
  { pattern: /\b(grant|donation received|contribution|sponsorship income)\b/i, type: "income", category: "Grants & Donations" },
  { pattern: /\b(subscription income|membership fee|license fee received)\b/i, type: "income", category: "Subscription Income" },
  { pattern: /\b(commission earned|affiliate income|referral income)\b/i, type: "income", category: "Commissions" },
  { pattern: /\b(product sale|goods sold|merchandise)\b/i, type: "income", category: "Product Sales" },

  // ── PAYROLL & HR ─────────────────────────────────────────────────────────
  { pattern: /\b(salary|salaries|payroll|wage|wages|paycheck|compensation|employee pay|staff pay|hr payment)\b/i, category: "Salaries & Payroll" },
  { pattern: /\b(bonus|incentive|commission paid|overtime pay)\b/i, category: "Salaries & Payroll" },
  { pattern: /\b(contractor|freelance|independent contractor|temp staff|agency worker)\b/i, category: "Contract Labor" },

  // ── RENT & FACILITIES ────────────────────────────────────────────────────
  { pattern: /\b(rent|lease|rental|office space|coworking|storage rent)\b/i, category: "Rent & Lease" },
  { pattern: /\b(maintenance|repair|service contract|cleaning|janitorial|facility)\b/i, category: "Maintenance & Repairs" },

  // ── UTILITIES ────────────────────────────────────────────────────────────
  { pattern: /\b(electricity|electric bill|power bill|kwh|energy bill)\b/i, category: "Utilities" },
  { pattern: /\b(water bill|water service|sewage|water usage)\b/i, category: "Utilities" },
  { pattern: /\b(internet|broadband|wifi|network service|isp|data plan)\b/i, category: "Utilities" },
  { pattern: /\b(phone|telephone|mobile|cellular|telecom|at&t|verizon|t-mobile)\b/i, category: "Utilities" },
  { pattern: /\b(gas bill|natural gas|heating bill)\b/i, category: "Utilities" },

  // ── TRAVEL & TRANSPORT ───────────────────────────────────────────────────
  { pattern: /\b(flight|airline|airfare|air ticket|plane ticket|airways|delta|united|american air|emirates)\b/i, category: "Travel & Transport" },
  { pattern: /\b(hotel|accommodation|lodging|airbnb|booking\.com|motel|inn|resort)\b/i, category: "Travel & Transport" },
  { pattern: /\b(uber|lyft|taxi|cab|rideshare|careem|bolt|grab)\b/i, category: "Travel & Transport" },
  { pattern: /\b(fuel|gasoline|petrol|diesel|gas station|shell|bp|chevron|exxon)\b/i, category: "Travel & Transport" },
  { pattern: /\b(train|rail|amtrak|metro|subway|bus fare|transit|toll|parking)\b/i, category: "Travel & Transport" },
  { pattern: /\b(car rental|vehicle rental|hertz|avis|enterprise rental)\b/i, category: "Travel & Transport" },
  { pattern: /\b(mileage|travel expense|per diem|business trip)\b/i, category: "Travel & Transport" },

  // ── FOOD & MEALS ─────────────────────────────────────────────────────────
  { pattern: /\b(restaurant|cafe|coffee|starbucks|mcdonalds|mcdonald|subway|burger|pizza|dining|lunch|dinner|breakfast|meal|food)\b/i, category: "Meals & Entertainment" },
  { pattern: /\b(entertainment|event ticket|concert|cinema|theatre|team outing|client entertainment)\b/i, category: "Meals & Entertainment" },

  // ── MARKETING & ADVERTISING ──────────────────────────────────────────────
  { pattern: /\b(advertising|ads|ad spend|ad campaign|google ads|facebook ads|meta ads|instagram ads|linkedin ads|tiktok ads)\b/i, category: "Marketing & Advertising" },
  { pattern: /\b(marketing|promotion|campaign|seo|social media|content creation|influencer|pr agency|public relations)\b/i, category: "Marketing & Advertising" },
  { pattern: /\b(print|flyer|banner|brochure|signage|trade show|exhibition)\b/i, category: "Marketing & Advertising" },

  // ── OFFICE SUPPLIES ──────────────────────────────────────────────────────
  { pattern: /\b(office supply|office supplies|stationery|paper|printer|toner|ink cartridge|staples store|amazon|office depot)\b/i, category: "Office Supplies" },
  { pattern: /\b(furniture|desk|chair|equipment purchase|computer|laptop|monitor|keyboard|mouse)\b/i, category: "Office Supplies" },

  // ── SOFTWARE & SUBSCRIPTIONS ─────────────────────────────────────────────
  { pattern: /\b(software|saas|subscription|license|microsoft|google workspace|slack|zoom|salesforce|hubspot|quickbooks|xero|dropbox|adobe)\b/i, category: "Software & Subscriptions" },
  { pattern: /\b(app store|play store|apple|cloud storage|hosting|domain|aws|azure|gcp|digitalocean)\b/i, category: "Software & Subscriptions" },
  { pattern: /\b(streaming|netflix|spotify|youtube premium|annual plan|monthly plan)\b/i, category: "Software & Subscriptions" },

  // ── PROFESSIONAL SERVICES ────────────────────────────────────────────────
  { pattern: /\b(legal|attorney|lawyer|law firm|legal fee|court)\b/i, category: "Professional Services" },
  { pattern: /\b(accounting|accountant|audit|cpa|bookkeeping|tax preparation)\b/i, category: "Professional Services" },
  { pattern: /\b(consulting fee|consultant|advisory fee|management fee)\b/i, category: "Professional Services" },

  // ── INSURANCE ────────────────────────────────────────────────────────────
  { pattern: /\b(insurance|premium|policy|coverage|health insurance|life insurance|property insurance|liability|workers comp)\b/i, category: "Insurance" },

  // ── BANKING & FINANCE ────────────────────────────────────────────────────
  { pattern: /\b(bank fee|bank charge|service charge|transaction fee|wire fee|atm fee|overdraft|nsf)\b/i, category: "Bank & Finance Charges" },
  { pattern: /\b(interest expense|loan interest|mortgage interest|credit card interest|finance charge)\b/i, category: "Bank & Finance Charges" },
  { pattern: /\b(loan repayment|loan payment|mortgage payment|emi|installment)\b/i, category: "Loan Repayment" },
  { pattern: /\b(credit card payment|card payment|cc payment)\b/i, category: "Bank & Finance Charges" },

  // ── TAXES ────────────────────────────────────────────────────────────────
  { pattern: /\b(tax|vat|gst|sales tax|income tax|payroll tax|corporate tax|irs|hmrc|withholding tax|customs duty|import duty)\b/i, category: "Taxes & Duties" },

  // ── SHIPPING & LOGISTICS ─────────────────────────────────────────────────
  { pattern: /\b(shipping|freight|courier|fedex|ups|dhl|usps|delivery|postage|cargo|logistics|import|export)\b/i, category: "Shipping & Logistics" },

  // ── HEALTHCARE ───────────────────────────────────────────────────────────
  { pattern: /\b(medical|doctor|hospital|pharmacy|medicine|dental|vision|healthcare|clinic)\b/i, category: "Healthcare" },

  // ── TRAINING & EDUCATION ─────────────────────────────────────────────────
  { pattern: /\b(training|course|workshop|seminar|conference|certification|udemy|coursera|education|tuition|learning)\b/i, category: "Training & Education" },

  // ── INVENTORY & GOODS ────────────────────────────────────────────────────
  { pattern: /\b(inventory|stock|raw material|material|goods purchase|product purchase|merchandise purchase|cogs|cost of goods)\b/i, category: "Inventory & COGS" },
  { pattern: /\b(supplier|vendor payment|purchase order|po |wholesale|procurement)\b/i, category: "Inventory & COGS" },

  // ── TRANSFERS ────────────────────────────────────────────────────────────
  { pattern: /\b(transfer|interbank|wire transfer|ach|bank transfer|funds transfer|internal transfer)\b/i, category: "Transfers" },
];

/**
 * Returns the best-matching category name for a transaction row.
 * Searches description, vendor, category column, and reference in that order.
 * Falls back to a type-aware default ("Sales Revenue" for income, "Other Expense" for expense).
 */
const inferCategoryFromRow = (row, transactionType) => {
  const get = (...keys) => {
    for (const key of keys) {
      const lc = key.toLowerCase();
      for (const [k, v] of Object.entries(row || {})) {
        if (String(k).toLowerCase() === lc) return String(v ?? "").trim();
      }
    }
    return "";
  };

  // Build a combined text blob from the most descriptive fields
  const text = [
    get("description", "desc", "details", "narration", "memo", "purpose", "notes"),
    get("vendor", "merchant", "supplier", "customer", "payee", "company", "name"),
    get("category", "cat", "type", "product", "item", "department"),
    get("id", "transaction id", "reference", "ref", "sale id", "expense id", "invoice id"),
  ]
    .filter(Boolean)
    .join(" ");

  if (!text.trim()) {
    // Nothing to match on — use type-aware defaults
    if (transactionType === "income") return "Sales Revenue";
    if (transactionType === "transfer") return "Transfers";
    return "Other Expense";
  }

  // Try type-specific rules first, then general rules
  for (const rule of CATEGORY_RULES) {
    if (rule.type && rule.type !== transactionType) continue; // skip wrong-type rules
    if (rule.pattern.test(text)) return rule.category;
  }
  // Second pass — ignore type restriction
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) return rule.category;
  }

  // Type-aware fallback
  if (transactionType === "income") return "Sales Revenue";
  if (transactionType === "transfer") return "Transfers";
  return "Other Expense";
};

const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Vercel's filesystem is read-only except for /tmp
    const uploadDir = process.env.VERCEL === '1'
      ? '/tmp'
      : path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /xlsx|xls|csv|pdf/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase(),
  );
  const mimetype =
    allowedTypes.test(file.mimetype) ||
    file.mimetype ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.mimetype === "application/vnd.ms-excel" ||
    file.mimetype === "application/csv" ||
    file.mimetype === "text/csv" ||
    file.mimetype === "application/pdf";

  if (mimetype && extname) {
    return cb(null, true);
  }

  cb(new Error("Only Excel (.xlsx, .xls), CSV, and PDF files are allowed"));
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter,
});

const nowIso = () => new Date().toISOString();
const buildDuplicateHash = ({ userId, date, desc, amount, vendor }) => {
  const dateKey = date ? new Date(date).toISOString().slice(0, 10) : "";
  const textKey = String(desc || vendor || "").toLowerCase().replace(/\s+/g, " ").trim();
  const amountKey = Number(amount || 0).toFixed(2);
  return crypto
    .createHash("sha1")
    .update([String(userId), dateKey, textKey, amountKey].join("|"))
    .digest("hex");
};
const importJobs = new Map();
const importJobEvents = new EventEmitter();
const IMPORT_JOB_TTL_MS = 1000 * 60 * 60;

const isDatabaseReady = () => mongoose.connection.readyState === 1;
const useLocalTransactionStore = (userId) => !isDatabaseReady() || !isMongoObjectId(userId);

const serializeTransactionDocument = (document) => {
  if (!document) return document;
  if (typeof document.toObject === "function") {
    return document.toObject();
  }
  return document;
};

const saveTransactionsBatch = async (transactions, userId, meta = {}) => {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return [];
  }

  if (useLocalTransactionStore(userId)) {
    return localTransactionStore.createTransactions(transactions, { userId, meta });
  }

  try {
    const inserted = await Transaction.insertMany(transactions, { ordered: false });
    return inserted.map(serializeTransactionDocument);
  } catch (bulkError) {
    if (bulkError.insertedDocs) {
      return bulkError.insertedDocs.map(serializeTransactionDocument);
    }

    console.warn("[Transactions] falling back to local store after batch insert failure", {
      message: bulkError.message,
    });
    return localTransactionStore.createTransactions(transactions, { userId, meta });
  }
};

const getImportJobKey = (userId, jobId) => `${String(userId)}:${String(jobId)}`;

const serializeImportJob = (job) => ({
  id: job.id,
  userId: job.userId,
  status: job.status,
  degradedMode: Boolean(job.degradedMode),
  fileName: job.fileName,
  fileType: job.fileType,
  fileSize: job.fileSize,
  totalChunks: job.totalChunks,
  totalRows: job.totalRows,
  createdCount: job.createdCount,
  skippedRows: job.skippedRows,
  completedRows: job.completedRows,
  progress: job.progress,
  queueSize: job.queue.length,
  failedChunks: job.failedChunks,
  errors: job.errors,
  cancelRequested: job.cancelRequested,
  finalizeRequested: job.finalizeRequested,
  isProcessing: job.isProcessing,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
  completedAt: job.completedAt,
});

const emitImportJobUpdate = (job) => {
  job.updatedAt = nowIso();
  const key = getImportJobKey(job.userId, job.id);
  importJobEvents.emit(key, serializeImportJob(job));
};

const buildTransactionFromChunkRow = (row, userId, job) => {
  if (!row || typeof row !== "object") return null;

  const entries = Object.entries(row);
  const getValue = (names) => {
    const lowered = names.map((name) => String(name).toLowerCase());
    for (const [key, value] of entries) {
      const normalized = String(key).toLowerCase();
      if (lowered.includes(normalized)) return value;
    }
    for (const [key, value] of entries) {
      const normalized = String(key).toLowerCase();
      if (lowered.some((name) => normalized.includes(name))) return value;
    }
    return undefined;
  };

  const description = String(
    getValue(["description", "desc", "details", "narration", "memo"]) ??
      getValue(["raw"] ) ??
      "",
  ).trim();
  const amountRaw = getValue(["amount", "debit", "credit", "total", "value"]);
  const amount = Number(String(amountRaw ?? "").replace(/[^0-9.-]/g, ""));
  const dateRaw = getValue(["date", "transaction date", "posted date", "created at"]);
  const date = dateRaw ? new Date(dateRaw) : null;

  if (!description && !Number.isFinite(amount)) return null;

  const transactionType =
    normalizeTransactionType(getValue(["type"])) ||
    inferTypeFromRow(row);

  const normalizedDate = date && !Number.isNaN(date.getTime()) ? date : new Date();
  const normalizedAmount = Number.isFinite(amount) ? Math.abs(amount) : 0;
  const normalizedDesc = description || String(getValue(["vendor", "name", "title"]) || "Imported transaction");
  const normalizedVendor = String(getValue(["vendor", "merchant"]) || "");

  // Use the explicit category if present, otherwise infer from row content
  const rawCategory = String(getValue(["category"]) || "").trim();
  const normalizedCategory =
    rawCategory && rawCategory.toLowerCase() !== "uncategorized"
      ? rawCategory
      : inferCategoryFromRow(row, transactionType);

  const normalizedStatus = normalizeStatus(getValue(["status"])) || "pending";

  const VALID_PAYMENT_METHODS = ["cash", "credit_card", "debit_card", "bank_transfer", "check", "other"];
  const rawPaymentMethod = String(getValue(["payment method", "paymentmethod", "method"]) || "").trim().toLowerCase();
  const normalizedPaymentMethod = VALID_PAYMENT_METHODS.includes(rawPaymentMethod) ? rawPaymentMethod : undefined;

  return {
    user: userId,
    userId,
    date: normalizedDate,
    desc: normalizedDesc,
    amount: normalizedAmount,
    category: normalizedCategory,
    type: transactionType,
    status: normalizedStatus,
    vendor: normalizedVendor,
    currency: String(getValue(["currency"]) || "USD"),
    notes: String(getValue(["notes"]) || ""),
    reference: String(getValue(["reference", "ref", "id"]) || ""),
    account: String(getValue(["account"]) || ""),
    ...(normalizedPaymentMethod ? { paymentMethod: normalizedPaymentMethod } : {}),
    source: job?.fileName || "import-job",
    importJobId: job?.id,
    importSheet: row.__sheetName ? String(row.__sheetName) : "",
    importRow: Number(row.__rowIndex) || undefined,
    rawData: row,
    tags: [
      normalizedCategory === "Uncategorized" ? "needs-mapping" : "",
      normalizedStatus === "pending" ? "new-import" : "",
    ].filter(Boolean),
    duplicateHash: buildDuplicateHash({
      userId,
      date: normalizedDate,
      desc: normalizedDesc,
      amount: normalizedAmount,
      vendor: normalizedVendor,
    }),
  };
};

const markFailedChunk = (job, chunkIndex, rows, reason) => {
  const existingIndex = job.failedChunks.findIndex(
    (item) => item.chunkIndex === chunkIndex,
  );

  const entry = {
    chunkIndex,
    reason,
    rowCount: rows.length,
    updatedAt: nowIso(),
  };

  if (existingIndex >= 0) {
    job.failedChunks[existingIndex] = entry;
  } else {
    job.failedChunks.push(entry);
  }

  if (job.failedChunks.length > 20) {
    const oldestKey = job.failedChunks[0]?.chunkIndex;
    if (oldestKey !== undefined) job.failedChunkData.delete(oldestKey);
  }
  job.failedChunkData.set(chunkIndex, rows);
};

const clearFailedChunk = (job, chunkIndex) => {
  job.failedChunks = job.failedChunks.filter(
    (item) => item.chunkIndex !== chunkIndex,
  );
  job.failedChunkData.delete(chunkIndex);
};

const updateImportJobProgress = (job) => {
  if (!job.totalChunks || job.totalChunks <= 0) {
    job.progress = 0;
    return;
  }

  const completedChunkCount =
    job.processedChunkIndexes.size +
    new Set(job.failedChunks.map((item) => item.chunkIndex)).size;
  job.progress = Math.min(
    100,
    Math.round((completedChunkCount / job.totalChunks) * 100),
  );
};

const finalizeImportJobIfDone = (job) => {
  if (!job.finalizeRequested || job.isProcessing || job.queue.length > 0) {
    return;
  }

  const doneCount =
    job.processedChunkIndexes.size +
    new Set(job.failedChunks.map((item) => item.chunkIndex)).size;

  if (doneCount < job.totalChunks) {
    return;
  }

  if (job.failedChunks.length > 0) {
    job.status = "needs_retry";
  } else {
    job.status = "completed";
    job.completedAt = nowIso();
  }

  updateImportJobProgress(job);
  emitImportJobUpdate(job);
};

const processImportQueue = async (job) => {
  if (job.isProcessing || job.cancelRequested) return;
  job.isProcessing = true;
  if (job.status === "queued") job.status = "processing";
  emitImportJobUpdate(job);

  console.info("[TransactionsImport] processImportQueue:start", {
    jobId: job.id,
    userId: job.userId,
    queueSize: job.queue.length,
    processedChunks: job.processedChunkIndexes.size,
  });

  while (job.queue.length > 0) {
    if (job.cancelRequested) break;
    const payload = job.queue.shift();
    const { chunkIndex, rows } = payload;

    if (job.processedChunkIndexes.has(chunkIndex)) {
      continue;
    }

    try {
      const transactions = rows
        .map((row) => buildTransactionFromChunkRow(row, job.userId, job))
        .filter(Boolean);

      const skippedRows = rows.length - transactions.length;
      if (skippedRows > 0) {
        job.skippedRows += skippedRows;
      }

      if (transactions.length === 0) {
        job.processedChunkIndexes.add(chunkIndex);
        clearFailedChunk(job, chunkIndex);
        updateImportJobProgress(job);
        emitImportJobUpdate(job);
        continue;
      }

      const savedTransactions = await saveTransactionsBatch(transactions, job.userId, {
        source: "import-job",
        jobId: job.id,
        fileName: job.fileName,
      });
      const insertedCount = savedTransactions.length;

      if (insertedCount < transactions.length) {
        markFailedChunk(
          job,
          chunkIndex,
          rows,
          `Partial insert (${insertedCount}/${transactions.length})`,
        );
      } else {
        clearFailedChunk(job, chunkIndex);
      }

      job.createdCount += insertedCount;
      job.completedRows += rows.length;
      job.processedChunkIndexes.add(chunkIndex);
      updateImportJobProgress(job);
      emitImportJobUpdate(job);
    } catch (error) {
      console.error("[TransactionsImport] processImportQueue:chunk-failed", {
        jobId: job.id,
        userId: job.userId,
        chunkIndex,
        message: error.message,
      });
      markFailedChunk(job, chunkIndex, rows, error.message);
      job.errors.push({ at: nowIso(), chunkIndex, message: error.message });
      job.completedRows += rows.length;
      updateImportJobProgress(job);
      emitImportJobUpdate(job);
    }
  }

  job.isProcessing = false;
  console.info("[TransactionsImport] processImportQueue:end", {
    jobId: job.id,
    userId: job.userId,
    status: job.status,
    completedRows: job.completedRows,
    failedChunks: job.failedChunks.length,
  });
  finalizeImportJobIfDone(job);
};

const queueImportChunk = (job, chunkIndex, rows) => {
  if (job.cancelRequested || job.status === "canceled") {
    return false;
  }

  if (job.processedChunkIndexes.has(chunkIndex)) {
    return true;
  }

  const existingQueueItem = job.queue.find((item) => item.chunkIndex === chunkIndex);
  if (existingQueueItem) {
    existingQueueItem.rows = rows;
  } else {
    job.queue.push({ chunkIndex, rows });
  }

  setImmediate(() => {
    processImportQueue(job).catch((error) => {
      job.status = "failed";
      job.errors.push({ at: nowIso(), message: error.message });
      emitImportJobUpdate(job);
    });
  });

  emitImportJobUpdate(job);
  return true;
};

const sweepExpiredImportJobs = () => {
  const now = Date.now();
  for (const [key, job] of importJobs.entries()) {
    const age = now - new Date(job.updatedAt || job.createdAt).getTime();
    if (age <= IMPORT_JOB_TTL_MS) continue;
    importJobs.delete(key);
  }
};

setInterval(sweepExpiredImportJobs, 1000 * 60 * 10).unref();

// Helper function to extract data from Excel
const extractDataFromExcel = (filePath) => {
  try {
    console.log("Reading Excel file:", filePath);
    const workbook = XLSX.readFile(filePath);
    console.log("Sheet names:", workbook.SheetNames);

    const data = [];

    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const sheetRows = XLSX.utils.sheet_to_json(worksheet, {
        defval: "",
        raw: true,
      });

      sheetRows.forEach((row, index) => {
        data.push({
          ...row,
          __sheetName: sheetName,
          __rowIndex: index + 1,
        });
      });
    });

    console.log("Extracted rows count:", data.length);
    console.log("First few rows:", data.slice(0, 3));

    return data;
  } catch (error) {
    console.error("Excel parsing error:", error);
    throw new Error("Failed to parse Excel file: " + error.message);
  }
};

// Helper function to extract text from PDF
const extractDataFromPDF = async (filePath) => {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    throw new Error("Failed to parse PDF file: " + error.message);
  }
};

// AI analysis function
const analyzeWithAI = async (data, fileType) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    let prompt;
    let dataToAnalyze;

    if (fileType === "excel") {
      // Check if data is already well-structured (like your expense data)
      const limitedData = Array.isArray(data) ? data.slice(0, 5) : [data];
      const firstRow = limitedData[0] || {};

      console.log("Analyzing", limitedData.length, "Excel rows with AI");
      console.log("Sample data structure:", firstRow);

      // Check if this looks like well-structured financial data.
      // If yes, process directly (bypass AI) but choose the correct transaction type.
      const keysLower = Object.keys(firstRow).map((k) =>
        String(k).toLowerCase(),
      );
      const hasKey = (needle) =>
        keysLower.some((k) => k === needle || k.includes(needle));
      const hasStructuredFields =
        hasKey("amount") ||
        hasKey("date") ||
        hasKey("description") ||
        hasKey("expense id") ||
        hasKey("sale");

      const hasAmountLike =
        hasKey("amount") || hasKey("total") || hasKey("net") ||
        hasKey("gross") || hasKey("price");

      if (hasStructuredFields) {
        // ── Smarter type detection ──────────────────────────────────────────
        // 1. Column-header signals
        const headerSalesSignals = [
          hasKey("sale"), hasKey("sales"), hasKey("customer"),
          hasKey("invoice"), hasKey("product") && hasKey("quantity"),
          hasKey("sales rep"),
        ].filter(Boolean).length;

        const headerExpenseSignals = [
          hasKey("expense id"), hasKey("expense"), hasKey("supplier"),
          hasKey("vendor") && !hasKey("customer"), hasKey("cost"),
          hasKey("purchase"),
        ].filter(Boolean).length;

        // 2. Row-data signals from the first row
        const rowInferred = inferTypeFromRow(firstRow);

        // 3. Sample the first 5 rows and tally inferred types
        const sampleRows = limitedData.slice(0, 5);
        const sampleIncomeCt = sampleRows.filter((r) => inferTypeFromRow(r) === "income").length;
        const sampleExpenseCt = sampleRows.length - sampleIncomeCt;

        let transactionType;
        if (headerSalesSignals >= 2 && hasAmountLike && sampleExpenseCt === 0) {
          transactionType = "income";
        } else if (headerExpenseSignals >= 2 && sampleIncomeCt === 0) {
          transactionType = "expense";
        } else if (sampleIncomeCt > sampleExpenseCt) {
          // Majority of sampled rows look like income — use per-row inference
          transactionType = "per_row";
        } else if (sampleExpenseCt > sampleIncomeCt) {
          transactionType = "expense";
        } else {
          // Tie or single row — trust the first row's inferred type
          transactionType = rowInferred;
        }

        console.log(
          `Detected structured data — headerSales=${headerSalesSignals} headerExpense=${headerExpenseSignals} sampleIncome=${sampleIncomeCt}/${sampleRows.length} → mode=${transactionType}`,
        );

        if (transactionType === "per_row") {
          // Build a per-row schema so resolveRowType infers each row individually
          return processStructuredExcelData(data, {
            columnMap: {},
            typeRule: { mode: "per_row_infer" },
          });
        }
        return processStructuredExcelData(data, transactionType);
      }

      dataToAnalyze = limitedData;

      prompt = `
            Analyze the following Excel data and extract financial transactions.
            Each row represents a potential transaction. Determine the correct type AND category for EACH row individually.

            Data sample: ${JSON.stringify(limitedData)}

            Respond with ONLY a JSON array (no markdown, no explanation):
            [
                {
                    "date": "YYYY-MM-DD",
                    "description": "transaction description",
                    "amount": positive_number,
                    "category": "specific category name",
                    "vendor": "vendor or customer name if identifiable",
                    "type": "income OR expense OR transfer",
                    "confidence": 0.9
                }
            ]

            Rules for "type":
            - "income"   — revenue, sale, receipt, credit, money received
            - "expense"  — cost, purchase, payment, debit, money paid out
            - "transfer" — money moved between accounts with no net gain/loss
            - If the file is clearly a sales/invoices file, use "income" for all rows
            - If the file is clearly an expense/payables file, use "expense" for all rows
            - Infer from column names AND cell values — do NOT default everything to "expense"

            Rules for "category" — pick the BEST match from this list:
            Income: "Sales Revenue", "Service Revenue", "Interest Income", "Rental Income",
                    "Investment Income", "Refunds & Rebates", "Grants & Donations",
                    "Subscription Income", "Commissions", "Product Sales"
            Expenses: "Salaries & Payroll", "Contract Labor", "Rent & Lease",
                      "Utilities", "Travel & Transport", "Meals & Entertainment",
                      "Marketing & Advertising", "Office Supplies",
                      "Software & Subscriptions", "Professional Services",
                      "Insurance", "Bank & Finance Charges", "Loan Repayment",
                      "Taxes & Duties", "Shipping & Logistics", "Healthcare",
                      "Training & Education", "Inventory & COGS",
                      "Maintenance & Repairs", "Other Expense"
            Other: "Transfers"
            - Use the description, vendor name, reference ID, and column context to choose
            - Never use "Uncategorized" — always pick the closest match

            Other rules:
            - Dates must be YYYY-MM-DD; amounts must be positive numbers
            - Return [] if no valid transactions found
            `;
    } else {
      // PDF
      dataToAnalyze = data;
      prompt = `
            Analyze the following PDF text and extract financial transactions.
            Look for transaction patterns like dates, amounts, descriptions.
            
            Text: ${data}
            
            Please respond with ONLY a JSON array in this format (no markdown, no explanation):
            [
                {
                    "date": "YYYY-MM-DD",
                    "description": "transaction description",
                    "amount": positive_number,
                    "category": "specific category name",
                    "vendor": "vendor or customer name if available",
                    "type": "income OR expense OR transfer",
                    "confidence": 0.9
                }
            ]

            Rules for "type":
            - "income"   if the row represents a sale, revenue, receipt, credit, or money received
            - "expense"  if the row represents a cost, purchase, payment, debit, or money paid out
            - "transfer" if money moved between accounts
            - Infer from context — do NOT default everything to "expense"

            Rules for "category" — pick the BEST match from this list:
            Income: "Sales Revenue", "Service Revenue", "Interest Income", "Rental Income",
                    "Investment Income", "Refunds & Rebates", "Grants & Donations",
                    "Subscription Income", "Commissions", "Product Sales"
            Expenses: "Salaries & Payroll", "Contract Labor", "Rent & Lease",
                      "Utilities", "Travel & Transport", "Meals & Entertainment",
                      "Marketing & Advertising", "Office Supplies",
                      "Software & Subscriptions", "Professional Services",
                      "Insurance", "Bank & Finance Charges", "Loan Repayment",
                      "Taxes & Duties", "Shipping & Logistics", "Healthcare",
                      "Training & Education", "Inventory & COGS",
                      "Maintenance & Repairs", "Other Expense"
            Other: "Transfers"
            - Use description, vendor, amounts, and context to choose the best category
            - Never use "Uncategorized" — always pick the closest match
            
            If no transactions found, return empty array [].
            `;
    }

    console.log("Sending prompt to AI...");
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log("AI Response:", text.substring(0, 500));

    // Clean and parse JSON response
    let aiTransactions = [];
    try {
      const cleanedText = text.trim().replace(/```json|```/g, "");
      aiTransactions = JSON.parse(cleanedText);

      if (!Array.isArray(aiTransactions)) {
        console.log("AI response is not an array, wrapping in array");
        aiTransactions = [aiTransactions];
      }

      console.log("AI found", aiTransactions.length, "transactions");
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.log("Raw AI response:", text);
      aiTransactions = [];
    }

    // If Excel data and AI found transactions, try to process more rows
    if (
      fileType === "excel" &&
      Array.isArray(data) &&
      data.length > 50 &&
      aiTransactions.length > 0
    ) {
      console.log("Processing remaining Excel rows...");

      // Process remaining rows using the pattern from successful AI analysis
      const remainingRows = data.slice(50);
      const additionalTransactions = processExcelRowsBasedOnPattern(
        remainingRows,
        aiTransactions[0],
      );

      aiTransactions = [...aiTransactions, ...additionalTransactions];
      console.log(
        "Total transactions after processing all rows:",
        aiTransactions.length,
      );
    }

    return aiTransactions;
  } catch (error) {
    console.error("AI Analysis error:", error);
    return [];
  }
};

// --- Import job API handlers ---
const createImportJob = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    if (!userId) return res.status(401).json({ error: "User not authenticated" });

    if (!isDatabaseReady()) {
      console.warn("[TransactionsImport] createImportJob:database-unavailable", {
        userId: String(userId),
        fileName: req.body?.fileName,
      });
    }

    console.info("[TransactionsImport] createImportJob", {
      userId: String(userId),
      fileName: req.body?.fileName,
      fileType: req.body?.fileType,
      fileSize: req.body?.fileSize,
    });

    const jobId = crypto.randomUUID();
    const job = {
      id: jobId,
      userId,
      fileName: req.body?.fileName || `upload-${jobId}`,
      fileType: req.body?.fileType || "csv",
      fileSize: Number(req.body?.fileSize) || 0,
      status: "queued",
      queue: [],
      processedChunkIndexes: new Set(),
      failedChunks: [],
      failedChunkData: new Map(),
      createdCount: 0,
      skippedRows: 0,
      completedRows: 0,
      totalRows: 0,
      totalChunks: 0,
      progress: 0,
      degradedMode: !isDatabaseReady(),
      cancelRequested: false,
      finalizeRequested: false,
      isProcessing: false,
      errors: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    importJobs.set(getImportJobKey(userId, jobId), job);
    emitImportJobUpdate(job);

    console.info("[TransactionsImport] createImportJob:success", {
      userId: String(userId),
      jobId,
    });

    res.json({ jobId });
  } catch (error) {
    console.error("[TransactionsImport] createImportJob:failed", error.message);
    console.error("Failed to create import job:", error);
    res.status(500).json({ error: "Failed to create import job" });
  }
};

const getImportJob = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    const { jobId } = req.params;
    const key = getImportJobKey(userId, jobId);
    const job = importJobs.get(key);
    console.info("[TransactionsImport] getImportJob", { userId: String(userId), jobId, found: !!job });
    if (!job) return res.status(404).json({ error: "Import job not found" });
    res.json(serializeImportJob(job));
  } catch (error) {
    console.error("Failed to get import job:", error);
    res.status(500).json({ error: "Failed to get import job" });
  }
};

const streamImportJob = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    const { jobId } = req.params;
    const key = getImportJobKey(userId, jobId);
    const job = importJobs.get(key);
    console.info("[TransactionsImport] streamImportJob:open", {
      userId: String(userId),
      jobId,
      found: !!job,
      status: job?.status,
    });
    if (!job) return res.status(404).json({ error: "Import job not found" });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders && res.flushHeaders();

    const listener = (payload) => {
      console.info("[TransactionsImport] streamImportJob:update", {
        jobId,
        status: payload.status,
        progress: payload.progress,
        completedRows: payload.completedRows,
        failedChunks: payload.failedChunks?.length || 0,
      });
      try {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch (e) {
        // ignore
      }
    };

    importJobEvents.on(key, listener);

    // send initial state
    res.write(`data: ${JSON.stringify(serializeImportJob(job))}\n\n`);

    req.on("close", () => {
      importJobEvents.removeListener(key, listener);
      console.info("[TransactionsImport] streamImportJob:close", { userId: String(userId), jobId });
    });
  } catch (error) {
    console.error("Failed to stream import job:", error);
    res.status(500).end();
  }
};

const addImportChunk = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    const { jobId } = req.params;
    const { chunkIndex, rows, totalChunks, totalRows } = req.body || {};

    console.info("[TransactionsImport] addImportChunk", {
      userId: String(userId),
      jobId,
      chunkIndex,
      rowCount: Array.isArray(rows) ? rows.length : 0,
      totalChunks,
      totalRows,
    });

    if (!Number.isFinite(chunkIndex))
      return res.status(400).json({ error: "chunkIndex is required" });
    if (!Array.isArray(rows))
      return res.status(400).json({ error: "rows must be an array" });

    const key = getImportJobKey(userId, jobId);
    const job = importJobs.get(key);
    if (!job) return res.status(404).json({ error: "Import job not found" });

    const numericChunkIndex = Number(chunkIndex);
    const numericTotalChunks = Number(totalChunks);
    const numericTotalRows = Number(totalRows);

    if (Number.isInteger(numericChunkIndex) && numericChunkIndex >= 0) {
      job.totalChunks = Math.max(
        Number(job.totalChunks || 0),
        numericChunkIndex + 1,
        Number.isFinite(numericTotalChunks) ? numericTotalChunks : 0,
      );
    }

    if (Number.isFinite(numericTotalRows) && numericTotalRows > 0) {
      job.totalRows = Math.max(Number(job.totalRows || 0), numericTotalRows);
    } else {
      job.totalRows = Math.max(
        Number(job.totalRows || 0),
        Number(job.completedRows || 0) + rows.length,
      );
    }

    const accepted = queueImportChunk(job, Number(chunkIndex), rows);
    if (!accepted) {
      console.warn("[TransactionsImport] addImportChunk:rejected", {
        userId: String(userId),
        jobId,
        chunkIndex,
      });
      return res.status(400).json({ error: "Job canceled or not accepting chunks" });
    }

    console.info("[TransactionsImport] addImportChunk:accepted", {
      userId: String(userId),
      jobId,
      chunkIndex,
      queueSize: job.queue.length,
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("Failed to add import chunk:", error);
    res.status(500).json({ error: "Failed to add import chunk" });
  }
};

const finalizeImportJob = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    const { jobId } = req.params;
    const key = getImportJobKey(userId, jobId);
    const job = importJobs.get(key);
    if (!job) return res.status(404).json({ error: "Import job not found" });

    console.info("[TransactionsImport] finalizeImportJob", {
      userId: String(userId),
      jobId,
      status: job.status,
      queueSize: job.queue.length,
      processedChunks: job.processedChunkIndexes.size,
    });

    job.finalizeRequested = true;
    emitImportJobUpdate(job);
    setImmediate(() => processImportQueue(job));

    res.json(serializeImportJob(job));
  } catch (error) {
    console.error("Failed to finalize import job:", error);
    res.status(500).json({ error: "Failed to finalize import job" });
  }
};

const retryImportChunks = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    const { jobId } = req.params;
    const { chunkIndexes } = req.body || {};
    const key = getImportJobKey(userId, jobId);
    const job = importJobs.get(key);
    if (!job) return res.status(404).json({ error: "Import job not found" });

    console.info("[TransactionsImport] retryImportChunks", {
      userId: String(userId),
      jobId,
      chunkIndexes,
      failedChunks: job.failedChunks.map((item) => item.chunkIndex),
    });

    const toRetry = Array.isArray(chunkIndexes) && chunkIndexes.length ? chunkIndexes : job.failedChunks.map((c) => c.chunkIndex);
    for (const idx of toRetry) {
      const rows = job.failedChunkData.get(idx) || null;
      if (!rows) continue;
      clearFailedChunk(job, idx);
      queueImportChunk(job, idx, rows);
    }

    res.json(serializeImportJob(job));
  } catch (error) {
    console.error("Failed to retry import chunks:", error);
    res.status(500).json({ error: "Failed to retry import chunks" });
  }
};

const cancelImportJob = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    const { jobId } = req.params;
    const key = getImportJobKey(userId, jobId);
    const job = importJobs.get(key);
    if (!job) return res.status(404).json({ error: "Import job not found" });

    console.info("[TransactionsImport] cancelImportJob", {
      userId: String(userId),
      jobId,
      status: job.status,
      queueSize: job.queue.length,
    });

    job.cancelRequested = true;
    job.status = "canceled";
    emitImportJobUpdate(job);
    res.json(serializeImportJob(job));
  } catch (error) {
    console.error("Failed to cancel import job:", error);
    res.status(500).json({ error: "Failed to cancel import job" });
  }
};

// ---------------------------------------------------------------------------
// AI-powered schema analysis — reads headers + sample rows and returns:
//   fileType: "sales" | "expenses" | "hybrid" | "bank_statement" | "payroll"
//   columnMap: { amount, date, description[], vendor, category }
//   typeRule: { mode: "all_income"|"all_expense"|"sign_based"|"column_based",
//               column, incomeValues[], expenseValues[] }
// ---------------------------------------------------------------------------
const buildFallbackSchema = (headers, rows) => {
  const lc = (s) => String(s || "").toLowerCase();
  const keysLower = headers.map(lc);
  const has = (needle) => keysLower.some((k) => k === needle || k.includes(needle));

  const salesScore = [has("sale"), has("customer"), has("invoice"), has("order"), has("revenue"), has("sales rep")].filter(Boolean).length;
  const expenseScore = [has("expense"), has("vendor"), has("supplier"), has("department"), has("employee")].filter(Boolean).length;

  const amountCol = headers.find((h) => /net.?amount|final.?amount/i.test(h))
    || headers.find((h) => /^amount$/i.test(h))
    || headers.find((h) => /amount|total|net|gross|price/i.test(h));
  const dateCol = headers.find((h) => /date/i.test(h));
  const descCols = headers.filter((h) => /description|desc|memo|product|item|purpose|details/i.test(h)).slice(0, 2);
  const vendorCol = headers.find((h) => /vendor|supplier|customer|payee|company/i.test(h));
  const categoryCol = headers.find((h) => /category|department|region/i.test(h))
    || headers.find((h) => /product|type/i.test(h));

  // Check for a direction/type column (e.g. "Debit/Credit", "Transaction Type")
  const typeCol = headers.find((h) => /direction|debit.?credit|cr.?dr|txn.?type|transaction.?type/i.test(h));

  let fileType = "expenses";
  let mode = "all_expense";
  if (salesScore > expenseScore) { fileType = "sales"; mode = "all_income"; }
  else if (salesScore === expenseScore && (salesScore > 0 || expenseScore > 0)) { fileType = "hybrid"; mode = "sign_based"; }

  if (typeCol) mode = "column_based";

  return {
    fileType,
    fileSummary: `Detected via column-name signals (sales=${salesScore}, expenses=${expenseScore})`,
    columnMap: { amount: amountCol || null, date: dateCol || null, description: descCols, vendor: vendorCol || null, category: categoryCol || null },
    typeRule: {
      mode,
      column: typeCol || null,
      incomeValues: typeCol ? ["credit", "cr", "in", "income", "receipt", "sale"] : [],
      expenseValues: typeCol ? ["debit", "dr", "out", "expense", "payment", "purchase"] : [],
    },
  };
};

const analyzeFileSchema = async (rows) => {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const sample = rows.slice(0, 15);

  const prompt = `You are a financial data analyst. Analyze this Excel/CSV file schema.

HEADERS: ${JSON.stringify(headers)}
SAMPLE ROWS (first ${sample.length}): ${JSON.stringify(sample)}

Respond with ONLY a valid JSON object — no markdown, no extra text:
{
  "fileType": "sales",
  "fileSummary": "one sentence",
  "columnMap": {
    "amount": "<exact column name for the final/net monetary amount>",
    "date": "<exact column name for date>",
    "description": ["<col1>", "<col2 optional>"],
    "vendor": "<exact column name for vendor/payee/customer, or null>",
    "category": "<exact column name for category/product/type, or null>"
  },
  "typeRule": {
    "mode": "all_income",
    "column": null,
    "incomeValues": [],
    "expenseValues": []
  }
}

fileType must be exactly one of: "sales", "expenses", "hybrid", "bank_statement", "payroll"
mode must be exactly one of:
  "all_income"     — every row is income/revenue (e.g. a sales ledger)
  "all_expense"    — every row is an expense (e.g. an expense report)
  "sign_based"     — positive amount = income, negative = expense
  "column_based"   — a column distinguishes income vs expense rows

For "column_based": set "column" to the exact header name and list the values that mean income vs expense.`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const schema = JSON.parse(text);
    console.log("[analyzeFileSchema] AI result:", JSON.stringify(schema));
    return schema;
  } catch (err) {
    console.warn("[analyzeFileSchema] AI call failed, using fallback:", err.message);
    return buildFallbackSchema(headers, rows);
  }
};

// Resolve per-row transaction type using the schema's typeRule
const resolveRowType = (row, typeRule) => {
  if (!typeRule) return inferTypeFromRow(row);
  const { mode, column, incomeValues = [], expenseValues = [] } = typeRule;

  if (mode === "all_income") return "income";
  if (mode === "all_expense") return "expense";
  if (mode === "per_row_infer") return inferTypeFromRow(row);

  if (mode === "sign_based") {
    const keys = Object.keys(row);
    const numericVal = keys.reduce((found, k) => {
      if (found !== null) return found;
      const v = parseFloat(row[k]);
      return (!isNaN(v) && v !== 0) ? v : null;
    }, null);
    return numericVal !== null && numericVal < 0 ? "expense" : "income";
  }

  if (mode === "column_based" && column && row[column] != null) {
    const val = String(row[column]).toLowerCase().trim();
    if (incomeValues.some((iv) => String(iv).toLowerCase() === val || val.includes(String(iv).toLowerCase()))) return "income";
    if (expenseValues.some((ev) => String(ev).toLowerCase() === val || val.includes(String(ev).toLowerCase()))) return "expense";
  }

  // Fall back to content-based inference instead of blindly returning "expense"
  return inferTypeFromRow(row);
};

// Process well-structured Excel data directly (bypassing AI)
const processStructuredExcelData = (data, schemaOrType = "expense") => {
  // Accept legacy string argument for backwards compat
  const schema = (typeof schemaOrType === "string")
    ? { columnMap: {}, typeRule: { mode: schemaOrType === "income" ? "all_income" : "all_expense" } }
    : schemaOrType;

  const { columnMap = {}, typeRule } = schema;
  console.log(
    "Processing",
    data.length,
    `structured Excel rows (mode=${(schema.typeRule || {}).mode || "?"})`,
    "...",
  );
  const transactions = [];

  // Log a sample of the data structure for debugging
  if (data.length > 0) {
    console.log("Sample row structure:", Object.keys(data[0]));
    console.log("First row data:", JSON.stringify(data[0], null, 2));
    if (data.length > 1) {
      console.log("Second row data:", JSON.stringify(data[1], null, 2));
    }
  }

  data.forEach((row, index) => {
    try {
      // Get all available keys for this row
      const keys = Object.keys(row);

      // Map the Excel columns to our transaction format (more flexible mapping)
      const expenseId =
        row["Expense ID"] ||
        row["ExpenseID"] ||
        row["ID"] ||
        row["id"] ||
        `TXN${index + 1}`;

      // Try multiple variations for date field
      let date =
        row["Date"] ||
        row["date"] ||
        row["Transaction Date"] ||
        row["DATE"] ||
        row["Date of Transaction"] ||
        row["TransactionDate"] ||
        row["Txn Date"];

      // If still no date found, look for any field with "date" in the name
      if (!date) {
        const dateKey = keys.find((key) => key.toLowerCase().includes("date"));
        if (dateKey) date = row[dateKey];
      }

      // Try multiple variations for description
      let description =
        row["Description"] ||
        row["description"] ||
        row["Vendor"] ||
        row["vendor"] ||
        row["Purpose"] ||
        row["Details"] ||
        row["details"] ||
        row["Memo"] ||
        row["memo"] ||
        row["Transaction Description"] ||
        row["Expense Description"] ||
        "Transaction";

      // Try multiple variations for amount
      let amount = parseFloat(
        row["Amount"] ||
          row["amount"] ||
          row["Total"] ||
          row["total"] ||
          row["Cost"] ||
          row["cost"] ||
          row["Price"] ||
          row["price"] ||
          row["Value"] ||
          row["value"] ||
          row["Net Amount"] ||
          row["Gross Amount"] ||
          row["Net Total"] ||
          row["Total Amount"] ||
          0,
      );

      // If still no amount found, look for any numeric field
      if (amount === 0) {
        const numericKey = keys.find((key) => {
          const value = row[key];
          return typeof value === "number" && value > 0;
        });
        if (numericKey) amount = parseFloat(row[numericKey]);
      }

      const rawCategory =
        row["Category"] ||
        row["category"] ||
        row["Type"] ||
        row["type"] ||
        row["Product"] ||
        row["product"] ||
        "";
      const vendor =
        row["Vendor"] ||
        row["vendor"] ||
        row["Supplier"] ||
        row["supplier"] ||
        row["Company"] ||
        row["company"] ||
        row["Customer"] ||
        row["customer"] ||
        "";
      const employee =
        row["Employee"] ||
        row["employee"] ||
        row["Name"] ||
        row["name"] ||
        row["Requestor"] ||
        row["requestor"] ||
        row["Sales Rep"] ||
        row["Rep"] ||
        "";
      const department =
        row["Department"] ||
        row["department"] ||
        row["Dept"] ||
        row["dept"] ||
        row["Region"] ||
        row["region"] ||
        "";
      const status =
        row["Status"] ||
        row["status"] ||
        row["State"] ||
        row["state"] ||
        "pending";

      // Log the extracted values for debugging
      if (index < 5) {
        console.log(`Row ${index + 1} extracted values:`, {
          date: date,
          amount: amount,
          description: description,
          rawAmount:
            row["Amount"] || row["amount"] || row["Total"] || row["Cost"],
          rawDate:
            row["Date"] ||
            row["date"] ||
            row["Transaction Date"] ||
            row["DATE"],
        });
      }

      // Validate required fields
      if (date && amount > 0) {
        // Parse date more robustly
        let parsedDate;
        try {
          parsedDate = new Date(date);
          // Check if it's a valid date
          if (isNaN(parsedDate.getTime())) {
            // Try different date formats
            const dateStr = date.toString();
            if (dateStr.includes("/")) {
              const parts = dateStr.split("/");
              if (parts.length === 3) {
                // Try MM/DD/YYYY format
                parsedDate = new Date(
                  `${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(
                    2,
                    "0",
                  )}`,
                );
              }
            }
          }
        } catch (e) {
          console.error(`Error parsing date "${date}" in row ${index}:`, e);
          parsedDate = new Date(); // Use current date as fallback
        }

        if (!isNaN(parsedDate.getTime())) {
          const rowType = resolveRowType(row, typeRule);
          // Use explicit category if present; otherwise infer from row content
          const resolvedCategory =
            rawCategory && rawCategory.toLowerCase() !== "uncategorized"
              ? rawCategory
              : inferCategoryFromRow(row, rowType);

          const transaction = {
            date: parsedDate.toISOString().split("T")[0],
            description: `${description}${employee ? ` - ${employee}` : ""}`,
            amount: Math.abs(amount),
            category: resolvedCategory,
            vendor: vendor,
            type: rowType,
            confidence: 0.95,
            department: department,
            originalStatus: status,
            originalRowIndex: index,
          };
          transactions.push(transaction);

          // Log first few transactions for debugging
          if (index < 3) {
            console.log(`Transaction ${index + 1}:`, transaction);
          }
        } else {
          console.warn(`Invalid date "${date}" in row ${index}, skipping`);
        }
      } else {
        console.warn(`Missing required data in row ${index}:`, {
          date: date,
          amount: amount,
          hasDate: !!date,
          hasValidAmount: amount > 0,
          rawDate:
            row["Date"] ||
            row["date"] ||
            row["Transaction Date"] ||
            row["DATE"],
          rawAmount:
            row["Amount"] || row["amount"] || row["Total"] || row["Cost"],
        });
      }
    } catch (error) {
      console.error("Error processing structured row", index, ":", error);
      console.error("Row data:", row);
    }
  });

  console.log(
    `Successfully processed ${transactions.length} out of ${data.length} total rows`,
  );
  return transactions;
};

// Helper function to process remaining Excel rows based on AI pattern
const processExcelRowsBasedOnPattern = (rows, sampleTransaction) => {
  const additionalTransactions = [];

  // Try to identify column patterns from the sample
  const firstRow = rows[0] || {};
  const keys = Object.keys(firstRow);

  console.log("Processing", rows.length, "additional rows using pattern...");

  rows.forEach((row, index) => {
    try {
      // Look for date-like columns
      let date = null;
      let amount = null;
      let description = "";

      // Find date column
      for (let key of keys) {
        const value = row[key];
        if (
          value &&
          (key.toLowerCase().includes("date") ||
            key.toLowerCase().includes("time"))
        ) {
          const parsedDate = new Date(value);
          if (!isNaN(parsedDate)) {
            date = parsedDate.toISOString().split("T")[0];
            break;
          }
        }
      }

      // Find amount column
      for (let key of keys) {
        const value = row[key];
        if (typeof value === "number" && Math.abs(value) > 0) {
          amount = Math.abs(value);
          break;
        } else if (
          typeof value === "string" &&
          /^\$?[\d,]+\.?\d*$/.test(value.replace(/[^\d.,]/g, ""))
        ) {
          amount = Math.abs(parseFloat(value.replace(/[^\d.]/g, "")));
          break;
        }
      }

      // Find description column
      for (let key of keys) {
        const value = row[key];
        if (
          typeof value === "string" &&
          value.length > 3 &&
          !key.toLowerCase().includes("date")
        ) {
          description = value;
          break;
        }
      }

      // Create transaction if we found essential data
      if (date && amount && amount > 0) {
        additionalTransactions.push({
          date: date,
          description: description || `Transaction ${index + 1}`,
          amount: amount,
          category: "Uncategorized",
          vendor: "",
          type: "expense",
          confidence: 0.7,
        });
      }
    } catch (error) {
      console.error("Error processing row", index, ":", error);
    }
  });

  console.log(
    "Processed",
    additionalTransactions.length,
    "additional transactions",
  );
  return additionalTransactions;
};

// Upload and analyze file
const uploadAndAnalyzeFile = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user._id) {
      console.error("❌ Upload failed: User not authenticated");
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!req.file) {
      console.error("❌ Upload failed: No file uploaded");
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path;
    const fileType = path
      .extname(req.file.originalname)
      .toLowerCase()
      .includes("pdf")
      ? "pdf"
      : "excel";

    console.log(
      `📁 Processing ${fileType} file: ${req.file.originalname} for user: ${req.user._id}`,
    );
    console.log(`📍 File path: ${filePath}`);

    let extractedData;
    if (fileType === "excel") {
      extractedData = extractDataFromExcel(filePath);
      console.log("Excel data extracted successfully, rows:", extractedData.length);

      if (extractedData.length > 0) {
        // Use AI to analyse the schema so we can correctly type every row
        console.log("🤖 Analysing file schema with AI...");
        const schema = await analyzeFileSchema(extractedData);
        console.log(`📊 File type detected: ${schema.fileType} | mode: ${schema.typeRule?.mode}`);

        const transactions = processStructuredExcelData(extractedData, schema);
        console.log(`processStructuredExcelData returned ${transactions.length} transactions`);

        if (transactions.length > 0) {
          const userId = req.user._id;
          const localStore = useLocalTransactionStore(userId);
          console.log(`Starting to save ${transactions.length} transactions for user: ${userId}`);

          // Prepare all transactions for bulk insert
          const transactionsToInsert = transactions.map((transaction, i) => {
            if (i === 0) {
              console.log(`Sample transaction to save:`, {
                date: transaction.date,
                amount: transaction.amount,
                description: transaction.description,
                category: transaction.category,
                type: transaction.type,
              });
            }

            return {
              userId: userId,
              date: new Date(transaction.date),
              desc: transaction.description || "Transaction",
              amount: Math.abs(transaction.amount),
              category: (transaction.category && transaction.category !== "Uncategorized")
                ? transaction.category
                : inferCategoryFromRow(transaction, normalizeTransactionType(transaction.type) || "expense"),
              vendor: transaction.vendor || "",
              type: normalizeTransactionType(transaction.type) || "expense",
              status: "needs_review",
              sourceFile: {
                filename: req.file.filename,
                originalName: req.file.originalname,
                fileType: fileType,
                uploadDate: new Date(),
              },
              aiAnalysis: {
                confidence: transaction.confidence || 0.95,
                extractedText: JSON.stringify(extractedData.slice(0, 10)), // Sample only
                processingNotes: "Processed directly from structured Excel",
              },
            };
          });

          // Bulk insert - much faster than individual saves
          let savedTransactions = [];
          try {
            if (localStore) {
              savedTransactions = await localTransactionStore.createTransactions(
                transactionsToInsert,
                { userId, meta: { source: "structured-excel" } },
              );
            } else {
              savedTransactions = await Transaction.insertMany(
                transactionsToInsert,
                {
                  ordered: false, // Continue on error
                },
              );
              console.log(
                `✅ Successfully bulk inserted ${savedTransactions.length} transactions`,
              );
            }
          } catch (bulkError) {
            // insertMany with ordered:false still inserts valid docs even if some fail
            if (bulkError.insertedDocs) {
              savedTransactions = bulkError.insertedDocs;
              console.log(
                `⚠️ Bulk insert completed with some errors. Saved ${savedTransactions.length} out of ${transactions.length}`,
              );
            } else {
              console.error(`❌ Bulk insert failed:`, bulkError.message);
              // Fallback to individual saves
              for (let i = 0; i < transactionsToInsert.length; i++) {
                try {
                  const saved = await Transaction.create(
                    transactionsToInsert[i],
                  );
                  savedTransactions.push(saved);
                } catch (saveError) {
                  console.error(
                    `❌ Error saving transaction ${i + 1}:`,
                    saveError.message,
                  );
                }
              }
            }
          }

          console.log(
            `Successfully saved ${savedTransactions.length} out of ${transactions.length} transactions`,
          );

          // Clean up uploaded file
          fs.unlinkSync(filePath);

          // Count as one excel upload
          usageService.increment(req.user._id, "excelUploads").catch(() => {});

          return res.json({
            success: true,
            message: `Successfully processed ${savedTransactions.length} transactions from ${schema.fileType} Excel file`,
            data: {
              transactions: savedTransactions,
              totalProcessed: savedTransactions.length,
              transactionsSaved: savedTransactions.length,
              transactionsFound: transactions.length,
              fileType: schema.fileType,
              typingMode: schema.typeRule?.mode,
            },
          });
        } else {
          console.warn("No valid transactions found in structured Excel data");
          fs.unlinkSync(filePath);
          return res.status(400).json({
            error: "No valid transactions found in the Excel file",
          });
        }
      }
    } else {
      extractedData = await extractDataFromPDF(filePath);
      console.log("PDF text extracted, length:", extractedData.length);
    }

    if (
      !extractedData ||
      (Array.isArray(extractedData) && extractedData.length === 0)
    ) {
      return res
        .status(400)
        .json({ error: "No data found in the uploaded file" });
    }

    // Analyze with AI
    console.log("Starting AI analysis...");
    const aiAnalysis = await analyzeWithAI(extractedData, fileType);
    console.log(
      "AI analysis completed, found transactions:",
      aiAnalysis.length,
    );

    // Save transactions to database using bulk insert (faster)
    const userId = req.user._id; // Get user ID from authenticated user
    const localStore = useLocalTransactionStore(userId);

    const transactionsToInsert = aiAnalysis.map((transaction) => ({
      userId: userId,
      date: new Date(transaction.date),
      desc: transaction.description,
      amount: Math.abs(transaction.amount),
      category: (transaction.category && transaction.category !== "Uncategorized")
        ? transaction.category
        : inferCategoryFromRow(transaction, normalizeTransactionType(transaction.type) || "expense"),
      vendor: transaction.vendor,
      type: normalizeTransactionType(transaction.type) || "expense",
      sourceFile: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        fileType: fileType,
        uploadDate: new Date(),
      },
      aiAnalysis: {
        confidence: transaction.confidence || 0.8,
        extractedText:
          fileType === "pdf"
            ? extractedData.substring(0, 1000) // Limit text size
            : JSON.stringify(extractedData.slice(0, 10)), // Sample only
        suggestedCategory: transaction.category,
        processingNotes: "Processed with Gemini AI",
      },
      status: "needs_review",
    }));

    // Bulk insert for better performance
    let savedTransactions = [];
    try {
      if (localStore) {
        savedTransactions = await localTransactionStore.createTransactions(
          transactionsToInsert,
          { userId, meta: { source: "ai-analysis" } },
        );
      } else {
        savedTransactions = await Transaction.insertMany(transactionsToInsert, {
          ordered: false, // Continue even if some fail
        });
        console.log(
          `✅ Successfully bulk inserted ${savedTransactions.length} AI-analyzed transactions`,
        );
      }
    } catch (bulkError) {
      // insertMany with ordered:false still inserts valid docs
      if (bulkError.insertedDocs) {
        savedTransactions = bulkError.insertedDocs;
        console.log(
          `⚠️ Bulk insert completed with some errors. Saved ${savedTransactions.length} out of ${aiAnalysis.length}`,
        );
      } else {
        console.error(
          "Bulk insert failed, trying individual saves:",
          bulkError.message,
        );
        // Fallback to individual saves
        for (const transactionData of transactionsToInsert) {
          try {
            const saved = await Transaction.create(transactionData);
            savedTransactions.push(saved);
          } catch (saveError) {
            console.error(
              "Error saving individual transaction:",
              saveError.message,
            );
          }
        }
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({
      message: "File processed successfully",
      transactionsFound: aiAnalysis.length,
      transactionsSaved: savedTransactions.length,
      transactions: savedTransactions,
    });
  } catch (error) {
    console.error("Error processing file:", error);

    // Clean up file if it exists
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error("Error cleaning up file:", unlinkError);
      }
    }

    res.status(500).json({
      error: "Failed to process file",
      message: error.message,
    });
  }
};

// Create a single transaction (manual entry)
// POST /api/transactions
const createTransaction = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const userId = req.user._id;
    const localStore = useLocalTransactionStore(userId);
    const {
      date,
      desc,
      amount,
      category,
      type,
      status,
      vendor,
      currency,
      notes,
      reference,
      account,
      paymentMethod,
    } = req.body;

    const parsedAmount = Number(amount);
    if (!date || !desc || !Number.isFinite(parsedAmount) || !category) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "date, desc, amount, and category are required.",
      });
    }

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    const normalizedType = normalizeTransactionType(type) || "expense";

    console.log("\n📝 Creating transaction:");
    console.log("  Type (input):", type);
    console.log("  Type (normalized):", normalizedType);
    console.log("  Amount:", Math.abs(parsedAmount));
    console.log("  Category:", String(category));

    const transaction = new Transaction({
      userId,
      date: parsedDate,
      desc: String(desc),
      amount: Math.abs(parsedAmount),
      category: String(category),
      type: normalizedType,
      status: normalizeStatus(status) || "pending",
      vendor: vendor ? String(vendor) : undefined,
      currency: currency ? String(currency) : undefined,
      notes: notes ? String(notes) : undefined,
      reference: reference ? String(reference) : undefined,
      account: account ? String(account) : undefined,
      paymentMethod: paymentMethod ? String(paymentMethod) : undefined,
      duplicateHash: buildDuplicateHash({
        userId,
        date: parsedDate,
        desc: String(desc),
        amount: Math.abs(parsedAmount),
        vendor,
      }),
    });

    let saved;
    if (useLocalTransactionStore(userId)) {
      saved = await localTransactionStore.createTransaction(transaction.toObject(), {
        userId,
        meta: { source: "manual-entry" },
      });
    } else {
      saved = await transaction.save();
    }
    console.log(
      "✅ Transaction saved with ID:",
      saved._id,
      "Type:",
      saved.type,
    );
    // Increment usage counter (fire-and-forget, don't block the response)
    usageService.increment(userId, "transactions").catch(() => {});
    return res.status(201).json(saved);
  } catch (error) {
    console.error("Error creating transaction:", error);
    return res
      .status(500)
      .json({ error: "Failed to create transaction", message: error.message });
  }
};

// Get all transactions for user
const getTransactions = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const userId = req.user._id;
    const {
      page = 1,
      limit = 1000,
      category,
      status,
      type,
      search,
      dateFrom,
      dateTo,
      sort = "date",
      direction = "desc",
    } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(5000, parseInt(limit, 10) || 1000));

    if (useLocalTransactionStore(userId)) {
      const localResult = await localTransactionStore.listTransactions({
        userId,
        page: pageNum,
        limit: limitNum,
        category,
        status,
        type,
        search,
        dateFrom,
        dateTo,
        sort,
        direction,
      });

      return res.json({
        transactions: localResult.transactions,
        totalPages: localResult.totalPages,
        currentPage: localResult.currentPage,
        total: localResult.total,
      });
    }

    const filter = { userId };
    if (category) filter.category = category;
    if (status) {
      filter.status = normalizeStatus(status) || status;
    }
    if (type) {
      // Normalize the filter type to match database values
      const normalizedFilterType = normalizeTransactionType(type);
      if (normalizedFilterType) {
        filter.type = normalizedFilterType;
      } else {
        // Fallback to case-insensitive regex for backward compatibility
        filter.type = { $regex: `^${String(type)}$`, $options: "i" };
      }
    }

    if (search && String(search).trim()) {
      const searchTerm = String(search).trim();
      filter.$or = [
        { desc: { $regex: searchTerm, $options: "i" } },
        { category: { $regex: searchTerm, $options: "i" } },
        { vendor: { $regex: searchTerm, $options: "i" } },
        { status: { $regex: searchTerm, $options: "i" } },
      ];
    }

    if (dateFrom || dateTo) {
      filter.date = {};
      const from = dateFrom ? new Date(dateFrom) : null;
      const to = dateTo ? new Date(dateTo) : null;
      if (from && !Number.isNaN(from.getTime())) filter.date.$gte = from;
      if (to && !Number.isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        filter.date.$lte = to;
      }
      if (!Object.keys(filter.date).length) delete filter.date;
    }

    console.log(
      "Fetching transactions for user:",
      userId,
      "with filter:",
      JSON.stringify(filter),
      "limit:",
      limitNum,
    );

    const allowedSorts = new Set(["date", "amount", "category", "type", "status", "vendor", "createdAt"]);
    const sortField = allowedSorts.has(String(sort)) ? String(sort) : "date";
    const sortDirection = String(direction).toLowerCase() === "asc" ? 1 : -1;
    const sortSpec = { [sortField]: sortDirection, _id: sortDirection };

    const transactions = await Transaction.find(filter)
      .sort(sortSpec)
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum);

    const total = await Transaction.countDocuments(filter);

    // Debug: Check if there are ANY transactions in the database
    const allTransactionsCount = await Transaction.countDocuments({});
    console.log(
      `📊 Database stats: ${allTransactionsCount} total transactions in DB, ${total} for current user`,
    );
    console.log(
      `Found ${transactions.length} transactions out of ${total} total for user ${userId}`,
    );

    // Debug: log transaction types in results
    if (transactions.length > 0) {
      const typeCounts = transactions.reduce((acc, t) => {
        acc[t.type] = (acc[t.type] || 0) + 1;
        return acc;
      }, {});
      console.log("  Transaction types in result:", typeCounts);
    }

    res.json({
      transactions: transactions.map((t) => {
        const obj = serializeTransactionDocument(t);
        // Ensure type and status are normalized
        obj.type = normalizeTransactionType(obj.type) || obj.type;
        obj.status = normalizeStatus(obj.status) || obj.status;
        return obj;
      }),
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      total,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch transactions", message: error.message });
  }
};

// Update transaction
const updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Only allow specific fields to be updated.
    const updates = {};
    const allowed = [
      "date",
      "desc",
      "amount",
      "category",
      "type",
      "status",
      "vendor",
      "currency",
      "notes",
      "reference",
      "account",
      "paymentMethod",
    ];

    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (updates.type !== undefined) {
      updates.type = normalizeTransactionType(updates.type) || updates.type;
    }
    if (updates.status !== undefined) {
      updates.status = normalizeStatus(updates.status) || updates.status;
    }
    if (updates.amount !== undefined) {
      const parsedAmount = Number(updates.amount);
      if (Number.isFinite(parsedAmount))
        updates.amount = Math.abs(parsedAmount);
    }
    if (updates.date !== undefined) {
      const parsedDate = new Date(updates.date);
      if (!Number.isNaN(parsedDate.getTime())) updates.date = parsedDate;
    }

    if (localStore) {
      const transaction = await localTransactionStore.updateTransaction(id, userId, updates);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      return res.json(transaction);
    }

    const transaction = await Transaction.findOneAndUpdate(
      { _id: id, userId },
      { $set: updates },
      { new: true, runValidators: true },
    );

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    res.json(transaction);
  } catch (error) {
    console.error("Error updating transaction:", error);
    res.status(500).json({ error: "Failed to update transaction" });
  }
};

// Delete transaction
const deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const localStore = useLocalTransactionStore(userId);

    if (localStore) {
      const transaction = await localTransactionStore.deleteTransaction(id, userId);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      return res.json({ message: "Transaction deleted successfully" });
    }

    const transaction = await Transaction.findOneAndDelete({ _id: id, userId });

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    res.json({ message: "Transaction deleted successfully" });
  } catch (error) {
    console.error("Error deleting transaction:", error);
    res.status(500).json({ error: "Failed to delete transaction" });
  }
};

// Bulk delete transactions
const bulkDeleteTransactions = async (req, res) => {
  try {
    console.log("=== BULK DELETE REQUEST ===");
    console.log("User ID:", req.user._id);
    console.log("Request body:", req.body);

    const { ids } = req.body;
    const userId = req.user._id;
    const localStore = useLocalTransactionStore(userId);

    if (!Array.isArray(ids) || ids.length === 0) {
      console.log("Validation failed: No IDs provided");
      return res.status(400).json({ error: "No transaction IDs provided" });
    }

    console.log("Attempting to delete", ids.length, "transactions");
    const result = localStore
      ? await localTransactionStore.deleteMany(ids, userId)
      : await Transaction.deleteMany({
          _id: { $in: ids },
          userId: userId,
        });

    console.log("Deleted", result.deletedCount, "transactions");
    res.json({
      message: `${result.deletedCount} transaction(s) deleted successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error bulk deleting transactions:", error);
    res.status(500).json({ error: "Failed to delete transactions" });
  }
};

// Delete all transactions
const deleteAllTransactions = async (req, res) => {
  try {
    console.log("=== DELETE ALL REQUEST ===");
    console.log("User ID:", req.user._id);

    const userId = req.user._id;

    // First, count how many transactions exist
    const localStore = useLocalTransactionStore(userId);
    const countBefore = localStore
      ? (await localTransactionStore.listTransactions({ userId, page: 1, limit: 1 })).total
      : await Transaction.countDocuments({ userId: userId });
    console.log(
      `Found ${countBefore} transactions to delete for user:`,
      userId,
    );

    // Delete all transactions for this user
    const result = localStore
      ? await localTransactionStore.deleteAll(userId)
      : await Transaction.deleteMany({ userId: userId });

    // Verify deletion
    const countAfter = localStore
      ? (await localTransactionStore.listTransactions({ userId, page: 1, limit: 1 })).total
      : await Transaction.countDocuments({ userId: userId });
    console.log(`Deleted ${result.deletedCount} transactions`);
    console.log(`Remaining transactions: ${countAfter}`);

    if (countAfter > 0) {
      console.warn(
        `⚠️ Warning: ${countAfter} transactions still remain after deletion!`,
      );
    } else {
      console.log("✅ All transactions successfully deleted");
    }

    res.json({
      message: `All ${result.deletedCount} transaction(s) deleted successfully`,
      deletedCount: result.deletedCount,
      remainingCount: countAfter,
    });
  } catch (error) {
    console.error("Error deleting all transactions:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ error: "Failed to delete all transactions" });
  }
};

// Get transaction statistics
const getTransactionStats = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { category, status, type, search, dateFrom, dateTo } = req.query;

    const userId = req.user._id;
    const localStore = useLocalTransactionStore(userId);

    console.log("Fetching stats for user:", userId);

    const filter = { userId };
    if (category) filter.category = category;
    if (status) filter.status = normalizeStatus(status) || status;
    if (type) {
      const normalizedFilterType = normalizeTransactionType(type);
      if (normalizedFilterType) {
        filter.type = normalizedFilterType;
      }
    }

    if (search && String(search).trim()) {
      const searchTerm = String(search).trim();
      filter.$or = [
        { desc: { $regex: searchTerm, $options: "i" } },
        { category: { $regex: searchTerm, $options: "i" } },
        { vendor: { $regex: searchTerm, $options: "i" } },
        { status: { $regex: searchTerm, $options: "i" } },
      ];
    }

    if (dateFrom || dateTo) {
      filter.date = {};
      const from = dateFrom ? new Date(dateFrom) : null;
      const to = dateTo ? new Date(dateTo) : null;
      if (from && !Number.isNaN(from.getTime())) filter.date.$gte = from;
      if (to && !Number.isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        filter.date.$lte = to;
      }
      if (!Object.keys(filter.date).length) delete filter.date;
    }

    if (localStore) {
      const localStats = await localTransactionStore.getStats({
        userId,
        category,
        status,
        type,
        search,
        dateFrom,
        dateTo,
      });
      return res.json(localStats);
    }

    const stats = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalIncome: {
            $sum: {
              $cond: [{ $eq: ["$type", "income"] }, "$amount", 0],
            },
          },
          totalExpenses: {
            $sum: {
              $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0],
            },
          },
          pendingCount: {
            $sum: {
              $cond: [{ $in: ["$status", ["needs_review", "pending"]] }, 1, 0],
            },
          },
          needsReviewCount: {
            $sum: { $cond: [{ $eq: ["$status", "needs_review"] }, 1, 0] },
          },
          reconciliationCount: {
            $sum: { $cond: [{ $in: ["$status", ["pending", "flagged"]] }, 1, 0] },
          },
        },
      },
    ]);

    const categoryStats = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    console.log("Stats calculated:", stats[0]);
    console.log("Category breakdown count:", categoryStats.length);

    const summaryDoc = stats[0] || {
      totalTransactions: 0,
      totalIncome: 0,
      totalExpenses: 0,
      pendingCount: 0,
      needsReviewCount: 0,
      reconciliationCount: 0,
    };

    const result = {
      summary: summaryDoc,
      categoryBreakdown: categoryStats,
      // Operations snapshot tiles (consumed by the dashboard)
      pendingReconciliations: summaryDoc.reconciliationCount || 0,
      unreviewedCount: summaryDoc.needsReviewCount || 0,
      uploadsInProgress: 0,
    };

    res.json(result);
  } catch (error) {
    console.error("Error fetching transaction stats:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch statistics", message: error.message });
  }
};

module.exports = {
  upload,
  uploadAndAnalyzeFile,
  createImportJob,
  getImportJob,
  streamImportJob,
  addImportChunk,
  finalizeImportJob,
  retryImportChunks,
  cancelImportJob,
  createTransaction,
  getTransactions,
  updateTransaction,
  deleteTransaction,
  bulkDeleteTransactions,
  deleteAllTransactions,
  getTransactionStats,
};
