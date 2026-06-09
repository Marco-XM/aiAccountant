const express = require("express");
const router = express.Router();
const apiKeyAuth = require("../middleware/apiKeyAuth.mw");
const asyncHandler = require("../middleware/asyncHandler");
const {
  v1Ping,
  v1ListTransactions,
  v1GetTransaction,
  v1CreateTransaction,
  v1UpdateTransaction,
  v1DeleteTransaction,
  v1GetDashboard,
} = require("../controllers/v1ApiController");

/**
 * Public v1 API — authenticated via API keys only.
 *
 * Base path: /api/v1
 *
 * Endpoints:
 *   GET    /api/v1/ping                  — health check (no auth)
 *   GET    /api/v1/transactions          — list transactions  (transactions:read)
 *   GET    /api/v1/transactions/:id      — get one transaction (transactions:read)
 *   POST   /api/v1/transactions          — create transaction  (transactions:write)
 *   PUT    /api/v1/transactions/:id      — update transaction  (transactions:write)
 *   DELETE /api/v1/transactions/:id      — delete transaction  (transactions:write)
 *   GET    /api/v1/dashboard             — KPI summary          (dashboard:read)
 */

// No auth needed
router.get("/ping", v1Ping);

// Transactions
router.get(
  "/transactions",
  apiKeyAuth(["transactions:read"]),
  asyncHandler(v1ListTransactions)
);

router.get(
  "/transactions/:id",
  apiKeyAuth(["transactions:read"]),
  asyncHandler(v1GetTransaction)
);

router.post(
  "/transactions",
  apiKeyAuth(["transactions:write"]),
  asyncHandler(v1CreateTransaction)
);

router.put(
  "/transactions/:id",
  apiKeyAuth(["transactions:write"]),
  asyncHandler(v1UpdateTransaction)
);

router.delete(
  "/transactions/:id",
  apiKeyAuth(["transactions:write"]),
  asyncHandler(v1DeleteTransaction)
);

// Dashboard
router.get(
  "/dashboard",
  apiKeyAuth(["dashboard:read"]),
  asyncHandler(v1GetDashboard)
);

module.exports = router;
