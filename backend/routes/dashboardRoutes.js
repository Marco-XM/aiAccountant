const express = require("express");
const authMiddleware = require("../middleware/auth.mw");
const { getDashboardOverview } = require("../controllers/dashboardController");

const router = express.Router();

router.use(authMiddleware);
router.get("/overview", getDashboardOverview);

module.exports = router;
