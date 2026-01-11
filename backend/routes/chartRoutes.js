const express = require('express');
const router = express.Router();
const { generateChart } = require('../controllers/chartController');
const authMiddleware = require('../middleware/auth.mw');

// Generate chart from natural language query
router.post('/generate', authMiddleware, generateChart);

module.exports = router;
