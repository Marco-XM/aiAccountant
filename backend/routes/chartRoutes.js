const express = require('express');
const router = express.Router();
const {
	generateChart,
	getWorkspace,
	listReports,
	saveReport,
	deleteReport,
} = require('../controllers/chartController');
const authMiddleware = require('../middleware/auth.mw');

// Workspace bootstrap and chart generation
router.get('/workspace', authMiddleware, getWorkspace);
router.post('/generate', authMiddleware, generateChart);

// Saved analytics reports
router.get('/reports', authMiddleware, listReports);
router.post('/reports', authMiddleware, saveReport);
router.delete('/reports/:reportId', authMiddleware, deleteReport);

module.exports = router;
