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

const normalizeStatus = (value) => {
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim().toLowerCase();
  if (["pending", "approved", "rejected", "needs_review", "reconciled", "flagged"].includes(raw))
    return raw;
  if (raw === "needs review") return "needs_review";
  return undefined;
};

const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
);

const os = require('os');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // In Vercel, only /tmp is writable
    const uploadDir = os.tmpdir();
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
    (amountRaw !== undefined && String(amountRaw).trim().startsWith("-")
      ? "expense"
      : "expense");

  const normalizedDate = date && !Number.isNaN(date.getTime()) ? date : new Date();
  const normalizedAmount = Number.isFinite(amount) ? Math.abs(amount) : 0;
  const normalizedDesc = description || String(getValue(["vendor", "name", "title"]) || "Imported transaction");
  const normalizedVendor = String(getValue(["vendor", "merchant"]) || "");
  const normalizedCategory = String(getValue(["category"]) || "Uncategorized");
  const normalizedStatus = normalizeStatus(getValue(["status"])) || "pending";

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
    paymentMethod: String(getValue(["payment method", "paymentmethod", "method"]) || ""),
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

      if (hasStructuredFields) {
        const hasAmountLike =
          hasKey("amount") ||
          hasKey("total") ||
          hasKey("net") ||
          hasKey("gross") ||
          hasKey("price");
        const salesSignals = [
          hasKey("sale"),
          hasKey("sales"),
          hasKey("customer"),
          hasKey("invoice"),
          hasKey("product") && hasKey("quantity"),
          hasKey("sales rep"),
        ].filter(Boolean).length;

        const transactionType =
          salesSignals >= 2 && hasAmountLike ? "income" : "expense";
        console.log(
          `Detected structured ${transactionType} data (bypassing AI), processing directly...`,
        );
        return processStructuredExcelData(data, transactionType);
      }

      dataToAnalyze = limitedData;

      prompt = `
            Analyze the following Excel data and extract financial transactions. 
            Each row represents a potential transaction. Look for columns that might contain:
            - Date information (any date format)
            - Amount/money values (numbers, could be positive or negative)
            - Description/details about the transaction
            - Category or type information
            
            Data sample: ${JSON.stringify(limitedData)}
            
            For each valid transaction row, respond with a JSON array:
            [
                {
                    "date": "YYYY-MM-DD format",
                    "description": "transaction description",
                    "amount": positive_number,
                    "category": "best_guess_category",
                    "vendor": "vendor if identifiable",
                    "type": "expense",
                    "confidence": 0.8
                }
            ]
            
            Important: 
            - Convert all dates to YYYY-MM-DD format
            - Make amounts positive numbers
            - If no clear transactions found, return empty array []
            - Only include rows that clearly look like financial transactions
            `;
    } else {
      // PDF
      dataToAnalyze = data;
      prompt = `
            Analyze the following PDF text and extract financial transactions.
            Look for transaction patterns like dates, amounts, descriptions.
            
            Text: ${data}
            
            Please respond with ONLY a JSON array in this format:
            [
                {
                    "date": "YYYY-MM-DD",
                    "description": "transaction description",
                    "amount": number,
                    "category": "suggested category",
                    "vendor": "vendor name if available",
                    "type": "expense",
                    "confidence": 0.9
                }
            ]
            
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

// Process well-structured Excel data directly (bypassing AI)
const processStructuredExcelData = (data, transactionType = "expense") => {
  console.log(
    "Processing",
    data.length,
    "structured Excel rows directly as",
    transactionType,
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

      const category =
        row["Category"] ||
        row["category"] ||
        row["Type"] ||
        row["type"] ||
        row["Product"] ||
        row["product"] ||
        "Uncategorized";
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
          const transaction = {
            date: parsedDate.toISOString().split("T")[0],
            description: `${description}${employee ? ` - ${employee}` : ""}`,
            amount: Math.abs(amount),
            category: category,
            vendor: vendor,
            type: transactionType,
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
      console.log(
        "Excel data extracted successfully, rows:",
        extractedData.length,
      );

      // Check if this is a well-structured report (sales or expenses)
      const firstRow = extractedData[0];
      const keysLower = firstRow
        ? Object.keys(firstRow).map((k) => String(k).toLowerCase())
        : [];

      const hasKey = (needle) =>
        keysLower.some((k) => k === needle || k.includes(needle));

      const hasAmountLike =
        hasKey("amount") ||
        hasKey("total") ||
        hasKey("net") ||
        hasKey("gross") ||
        hasKey("price");
      const hasDateLike = hasKey("date");

      // Sales indicators
      const salesSignals = [
        hasKey("sale"),
        hasKey("sales"),
        hasKey("customer"),
        hasKey("invoice"),
        hasKey("order"),
        hasKey("product") && hasKey("quantity"),
        hasKey("sales rep"),
      ].filter(Boolean).length;

      // Expense indicators
      const expenseSignals = [
        hasKey("expense"),
        hasKey("vendor"),
        hasKey("employee"),
        hasKey("supplier"),
        hasKey("department"),
      ].filter(Boolean).length;

      const hasSalesStructure =
        !!firstRow && salesSignals >= 2 && hasAmountLike;
      const hasExpenseStructure =
        !!firstRow &&
        (hasKey("expense id") ||
          (expenseSignals >= 2 && hasAmountLike && hasDateLike));

      const transactionType = hasSalesStructure ? "income" : "expense";

      if (hasExpenseStructure || hasSalesStructure) {
        console.log(
          `Detected structured ${transactionType} data, processing directly...`,
        );
        const transactions = processStructuredExcelData(
          extractedData,
          transactionType,
        );
        console.log(
          `processStructuredExcelData returned ${transactions.length} transactions`,
        );

        if (transactions.length > 0) {
          // Save structured transactions directly to database using bulk insert (much faster)
          const userId = req.user._id;
          const localStore = useLocalTransactionStore(userId);
          console.log(
            `Starting to save ${transactions.length} transactions for user: ${userId}`,
          );
          console.log(`User ID type: ${typeof userId}, Value: ${userId}`);

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
              category: transaction.category || "Uncategorized",
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

          return res.json({
            success: true,
            message: `Successfully processed ${savedTransactions.length} transactions from structured Excel file`,
            data: {
              transactions: savedTransactions,
              totalProcessed: savedTransactions.length,
              transactionsSaved: savedTransactions.length,
              transactionsFound: transactions.length,
              processedDirectly: true,
            },
          });
        } else {
          console.warn("No valid transactions found in structured Excel data");
          // Clean up uploaded file
          fs.unlinkSync(filePath);
          return res.status(400).json({
            error: "No valid transactions found in the Excel file",
            debug: "processStructuredExcelData returned 0 transactions",
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
      category: transaction.category || "Uncategorized",
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

    const result = {
      summary: stats[0] || {
        totalTransactions: 0,
        totalIncome: 0,
        totalExpenses: 0,
        pendingCount: 0,
      },
      categoryBreakdown: categoryStats,
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
