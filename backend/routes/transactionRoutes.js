const express = require("express");
const authMiddleware = require("../middleware/auth.mw");
const asyncHandler = require("../middleware/asyncHandler");
const { z } = require("zod");
const { validateQuery } = require("../middleware/validateRequest");
const {
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
} = require("../controllers/transactionController");

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// POST /api/transactions/upload - Upload and analyze file
router.post("/upload", upload.single("file"), asyncHandler(uploadAndAnalyzeFile));

// Background import job routes
router.post("/import-jobs", asyncHandler(createImportJob));
router.get("/import-jobs/:jobId", asyncHandler(getImportJob));
router.get("/import-jobs/:jobId/stream", asyncHandler(streamImportJob));
router.post("/import-jobs/:jobId/chunks", asyncHandler(addImportChunk));
router.post("/import-jobs/:jobId/finalize", asyncHandler(finalizeImportJob));
router.post("/import-jobs/:jobId/retry", asyncHandler(retryImportChunks));
router.post("/import-jobs/:jobId/cancel", asyncHandler(cancelImportJob));

// POST /api/transactions - Create a manual transaction
// Validate query helper for GET list
const transactionsQuerySchema = z.object({
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined ? 1000 : Number(v)))
    .refine((n) => Number.isInteger(n) && n > 0 && n <= 5000, {
      message: "limit must be an integer between 1 and 5000",
    }),
  page: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined ? 1 : Number(v)))
    .refine((n) => Number.isInteger(n) && n >= 1, { message: "page must be integer >= 1" }),
  cursor: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sort: z.string().optional(),
  direction: z.enum(["asc", "desc"]).optional(),
});

router.post("/", asyncHandler(createTransaction));

// GET /api/transactions - Get all transactions for user
router.get("/", validateQuery(transactionsQuerySchema), asyncHandler(getTransactions));

// GET /api/transactions/stats - Get transaction statistics
router.get("/stats", asyncHandler(getTransactionStats));

// DELETE /api/transactions/bulk - Bulk delete transactions
router.delete("/bulk", asyncHandler(bulkDeleteTransactions));

// DELETE /api/transactions/all - Delete all transactions
router.delete("/all", asyncHandler(deleteAllTransactions));

// PUT /api/transactions/:id - Update a transaction
router.put("/:id", asyncHandler(updateTransaction));

// DELETE /api/transactions/:id - Delete a transaction
router.delete("/:id", asyncHandler(deleteTransaction));

module.exports = router;
