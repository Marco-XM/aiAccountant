/**
 * checkLimit(feature) — Express middleware factory.
 *
 * Usage:  router.post("/generate", auth, checkLimit("aiChartGenerations"), controller);
 *
 * 1. Reads user's subscription plan from localSubscriptionStore
 * 2. Reads tier limits from localTierStore (live, admin-editable)
 * 3. Reads current-month usage from usageService
 * 4. If limit is -1 → unlimited, passes through
 * 5. If usage >= limit → 403 with a clear message
 * 6. If request succeeds, the CALLING controller is responsible for calling
 *    usageService.increment(userId, feature) after its successful operation.
 *    (We do NOT increment here because we don't know if the controller succeeded.)
 */
const mongoose        = require("mongoose");
const Subscription    = require("../models/Subscription");
const localSubStore   = require("../services/localSubscriptionStore");
const localTierStore  = require("../services/localTierStore");
const usageService    = require("../services/usageService");

const dbReady = () => mongoose.connection.readyState === 1;

// Resolve the user's plan id from the same place `subscribe` writes it.
// In production that's MongoDB; in local dev it's the file-backed store.
const resolvePlanId = async (userId) => {
  if (dbReady()) {
    const sub = await Subscription.findOne({ user: userId }).lean();
    return sub?.plan || "free";
  }
  let sub = await localSubStore.findByUserId(userId);
  if (!sub) sub = await localSubStore.createDefaultSubscription(userId);
  return sub.plan || "free";
};

const FEATURE_LABELS = {
  transactions:       "transactions",
  excelUploads:       "Excel file uploads",
  aiChartGenerations: "AI chart generations",
  aiChatMessages:     "AI chat messages",
  aiExcelGenerations: "AI Excel generations",
};

/**
 * Returns a middleware that enforces the tier limit for `feature`.
 * @param {string} feature - key in tier.limits and usageService.FEATURES
 */
const checkLimit = (feature) => async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Not authenticated." });

    // Get user's current plan (MongoDB in production, file store in local dev)
    const planId = await resolvePlanId(userId);

    // Get live tier (admin-editable)
    const tier = await localTierStore.getTierById(planId);
    const limits = tier?.limits || {};
    const limit = limits[feature] ?? -1;

    // -1 = unlimited
    if (limit === -1) return next();

    // Check current month usage
    const usage = await usageService.getUsage(userId);
    const current = usage[feature] || 0;

    if (current >= limit) {
      const label = FEATURE_LABELS[feature] || feature;
      const tierName = tier?.name || planId;
      return res.status(403).json({
        message: `You've reached your ${label} limit (${limit}/${limit}) on the ${tierName} plan. Upgrade to continue.`,
        code: "LIMIT_EXCEEDED",
        feature,
        limit,
        used: current,
        plan: planId,
      });
    }

    // Store resolved info on req for the controller to call increment after success
    req.tierLimit = { feature, userId, limit, used: current };
    next();
  } catch (err) {
    console.error(`checkLimit(${feature}) error:`, err);
    next(); // fail open — don't block the user due to our own errors
  }
};

module.exports = checkLimit;
