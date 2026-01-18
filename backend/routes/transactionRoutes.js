const express = require("express");
const authMiddleware = require("../middleware/auth.mw");
const {
  upload,
  uploadAndAnalyzeFile,
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
router.post("/upload", upload.single("file"), uploadAndAnalyzeFile);

// POST /api/transactions - Create a manual transaction
router.post("/", createTransaction);

// GET /api/transactions - Get all transactions for user
router.get("/", getTransactions);

// GET /api/transactions/stats - Get transaction statistics
router.get("/stats", getTransactionStats);

// DELETE /api/transactions/bulk - Bulk delete transactions
router.delete("/bulk", bulkDeleteTransactions);

// DELETE /api/transactions/all - Delete all transactions
router.delete("/all", deleteAllTransactions);

// PUT /api/transactions/:id - Update a transaction
router.put("/:id", updateTransaction);

// DELETE /api/transactions/:id - Delete a transaction
router.delete("/:id", deleteTransaction);

module.exports = router;
