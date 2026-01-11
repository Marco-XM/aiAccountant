const express = require('express');
const authMiddleware = require('../middleware/auth.mw');
const {
    upload,
    uploadAndAnalyzeFile,
    getTransactions,
    updateTransaction,
    deleteTransaction,
    getTransactionStats
} = require('../controllers/transactionController');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// POST /api/transactions/upload - Upload and analyze file
router.post('/upload', upload.single('file'), uploadAndAnalyzeFile);

// GET /api/transactions - Get all transactions for user
router.get('/', getTransactions);

// GET /api/transactions/stats - Get transaction statistics
router.get('/stats', getTransactionStats);

// PUT /api/transactions/:id - Update a transaction
router.put('/:id', updateTransaction);

// DELETE /api/transactions/:id - Delete a transaction
router.delete('/:id', deleteTransaction);

module.exports = router;