const express = require('express');
const { generateExpenseExcel, getExpenseStats, generateSalesExcel, getSalesStats } = require('../controllers/excelController');

const router = express.Router();

// GET /api/excel/expenses/download - Download Excel file with expense data
router.get('/expenses/download', generateExpenseExcel);

// GET /api/excel/expenses/stats - Get expense statistics
router.get('/expenses/stats', getExpenseStats);

// GET /api/excel/sales/download - Download Excel file with sales data
router.get('/sales/download', generateSalesExcel);

// GET /api/excel/sales/stats - Get sales statistics
router.get('/sales/stats', getSalesStats);

module.exports = router;