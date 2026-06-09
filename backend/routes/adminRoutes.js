const express = require("express");
const router = express.Router();
const adminAuth = require("../middleware/adminAuth.mw");
const {
  getStats,
  getUsers,
  updateUserSubscription,
  deleteUser,
  getBlogPosts,
  getBlogPost,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  getPageContent,
  updatePageSection,
  getSubscriptionTiers,
  createSubscriptionTier,
  updateSubscriptionTier,
  deleteSubscriptionTier,
  addTierOffer,
  updateTierOffer,
  deleteTierOffer,
  getNavItems,
  createNavItem,
  updateNavItem,
  deleteNavItem,
} = require("../controllers/adminController");

// All routes require admin auth
router.use(adminAuth);

// Stats
router.get("/stats", getStats);

// Users
router.get("/users", getUsers);
router.put("/users/:id/subscription", updateUserSubscription);
router.delete("/users/:id", deleteUser);

// Blog
router.get("/blog", getBlogPosts);
router.get("/blog/:id", getBlogPost);
router.post("/blog", createBlogPost);
router.put("/blog/:id", updateBlogPost);
router.delete("/blog/:id", deleteBlogPost);

// Page content (sections)
router.get("/pages", getPageContent);
router.put("/pages/:section", updatePageSection);

// Subscription tiers CRUD
router.get("/tiers", getSubscriptionTiers);
router.post("/tiers", createSubscriptionTier);
router.put("/tiers/:id", updateSubscriptionTier);
router.delete("/tiers/:id", deleteSubscriptionTier);

// Tier offers
router.post("/tiers/:id/offers", addTierOffer);
router.put("/tiers/:id/offers/:offerId", updateTierOffer);
router.delete("/tiers/:id/offers/:offerId", deleteTierOffer);

// Landing page navigation
router.get("/nav", getNavItems);
router.post("/nav", createNavItem);
router.put("/nav/:id", updateNavItem);
router.delete("/nav/:id", deleteNavItem);

module.exports = router;
