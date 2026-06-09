const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.mw");
const {
  getPlans,
  getMySubscription,
  subscribe,
  cancelSubscription,
  reactivateSubscription,
} = require("../controllers/subscriptionController");

// Public
router.get("/plans", getPlans);

// Protected
router.get("/me", auth, getMySubscription);
router.post("/subscribe", auth, subscribe);
router.post("/cancel", auth, cancelSubscription);
router.post("/reactivate", auth, reactivateSubscription);

module.exports = router;
