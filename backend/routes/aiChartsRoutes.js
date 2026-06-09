const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.mw");
const checkLimit = require("../middleware/checkLimit.mw");
const controller = require("../controllers/aiChartsController");

// Public/chart workspace endpoints (require auth)
router.get("/workspace", auth, controller.getWorkspace);
router.post("/generate", auth, checkLimit("aiChartGenerations"), controller.generate);

// Async job API
router.post("/jobs", auth, controller.createJob);
router.get("/jobs/:jobId", auth, controller.getJob);
router.get("/jobs/:jobId/stream", auth, controller.streamJob);

// Saved reports
router.get("/reports", auth, controller.listReports);
router.post("/reports", auth, controller.saveReport);
router.delete("/reports/:reportId", auth, controller.deleteReport);

// Admin-only: trigger manual reconciliation of local store -> Mongo
// Note: Protect this route appropriately in production (RBAC/admin).
router.post("/admin/reconcile", auth, controller.triggerReconcile);

module.exports = router;
