const express = require('express');
const router = express.Router();
const { generateExcelWithAI, downloadExcel } = require('../controllers/aiExcelController');
const auth = require('../middleware/auth.mw');
const checkLimit = require('../middleware/checkLimit.mw');

// Generate Excel with AI
router.post('/generate', auth, checkLimit('aiExcelGenerations'), generateExcelWithAI);

// Download generated Excel file
router.get('/download/:fileName', auth, downloadExcel);

module.exports = router;
