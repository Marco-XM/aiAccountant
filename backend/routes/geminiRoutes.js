const express = require('express');
const { calculateBoxes } = require('../controllers/geminiController');

const router = express.Router();

// POST /api/calculate-boxes
router.post('/calculate-boxes', calculateBoxes);

module.exports = router;