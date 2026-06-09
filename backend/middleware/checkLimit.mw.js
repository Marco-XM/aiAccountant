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
const localSubStore   = require("../services/localSubscriptionStore");
const localTierStore  = require("../services/localTierStore");
const usageService    = require("../services/usageService");

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

    // Get user's current plan
    let sub = await localSubStore.findByUserId(userId);
    if (!sub) sub = await localSubStore.createDefaultSubscription(userId);
    const planId = sub.plan || "free";

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
