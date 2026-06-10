const mongoose = require("mongoose");
const User = require("../models/User");
const Subscription = require("../models/Subscription");
const BlogPost = require("../models/BlogPost");
const localAuth = require("../services/localAuthStore");
const localSub = require("../services/localSubscriptionStore");
const localBlog = require("../services/localBlogStore");
const localPages = require("../services/localPageStore");
const localTiers = require("../services/localTierStore");
const localNav = require("../services/localNavStore");

const isDev = process.env.NODE_ENV !== "production";
const isDatabaseReady = () => mongoose.connection.readyState === 1;
const useLocal = () => isDev || !isDatabaseReady();

// Admin accounts must not appear in user-facing stats or lists
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
const isAdminEmail = (email) =>
  ADMIN_EMAILS.includes(String(email || "").trim().toLowerCase());

/* ── Platform Stats ────────────────────────────────────────────────── */
const getStats = async (req, res) => {
  try {
    let totalUsers = 0;
    let planCounts = {};
    let recentSignups = 0;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get dynamic tiers for plan count keys
    const allTiers = await localTiers.getAllTiers();
    allTiers.forEach((t) => { planCounts[t.id] = 0; });
    if (!planCounts.free) planCounts.free = 0;

    if (useLocal()) {
      const allUsers = await localAuth.getAllUsers();
      // Exclude admin accounts
      const users = allUsers.filter((u) => !isAdminEmail(u.email));
      totalUsers = users.length;
      recentSignups = users.filter(
        (u) => u.createdAt && new Date(u.createdAt) > sevenDaysAgo
      ).length;

      const subStore = await localSub.getAllSubscriptions();
      Object.values(subStore).forEach((sub) => {
        if (planCounts[sub.plan] !== undefined) planCounts[sub.plan]++;
        else planCounts.free++;
      });
      const noSubUsers = totalUsers - Object.keys(subStore).length;
      if (noSubUsers > 0) planCounts.free += noSubUsers;
    } else {
      totalUsers = await User.countDocuments({ email: { $nin: ADMIN_EMAILS } });
      recentSignups = await User.countDocuments({
        email: { $nin: ADMIN_EMAILS },
        createdAt: { $gte: sevenDaysAgo },
      });
    }

    // Revenue: sum price * count for each tier
    let monthlyRevenue = 0;
    for (const [planId, count] of Object.entries(planCounts)) {
      const tier = allTiers.find((t) => t.id === planId);
      if (tier && tier.price?.monthly) monthlyRevenue += tier.price.monthly * count;
    }

    const blogPosts = await localBlog.getAllPosts(true);

    res.json({
      totalUsers,
      planCounts,
      recentSignups,
      monthlyRevenue,
      totalBlogPosts: blogPosts.length,
      publishedBlogPosts: blogPosts.filter((p) => p.status === "published").length,
    });
  } catch (err) {
    console.error("getStats error:", err);
    res.status(500).json({ message: "Failed to load stats." });
  }
};

/* ── Users ─────────────────────────────────────────────────────────── */
const getUsers = async (req, res) => {
  try {
    let users = [];
    let subscriptions = {};

    if (useLocal()) {
      const allUsers = await localAuth.getAllUsers();
      // Hide admin accounts from the users list
      users = allUsers.filter((u) => !isAdminEmail(u.email));
      subscriptions = await localSub.getAllSubscriptions();
    } else {
      const dbUsers = await User.find({ email: { $nin: ADMIN_EMAILS } })
        .lean()
        .select("-password -resetPasswordTokenHash");
      users = dbUsers.map((u) => ({ ...u, id: u._id.toString() }));

      const subs = await Subscription.find({}).lean();
      subscriptions = subs.reduce((acc, sub) => {
        acc[String(sub.user)] = {
          plan: sub.plan,
          status: sub.status,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        };
        return acc;
      }, {});
    }

    const enriched = users.map((u) => {
      const uid = u.id || u._id?.toString();
      const sub = subscriptions[uid] || { plan: "free", status: "active" };
      return {
        id: uid,
        name: u.name,
        email: u.email,
        businessType: u.businessType,
        createdAt: u.createdAt,
        plan: sub.plan || "free",
        subscriptionStatus: sub.status || "active",
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd || false,
        isAdmin: Boolean(u.isAdmin) || isAdminEmail(u.email),
      };
    });

    res.json({ users: enriched });
  } catch (err) {
    console.error("getUsers error:", err);
    res.status(500).json({ message: "Failed to load users." });
  }
};

const updateUserSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { plan } = req.body;

    // Validate against dynamic tiers
    const tier = await localTiers.getTierById(plan);
    if (!tier) {
      return res.status(400).json({ message: "Invalid plan — tier not found." });
    }

    if (useLocal()) {
      const existing = await localSub.findByUserId(id);
      await localSub.upsertSubscription(id, {
        ...(existing || {}),
        plan,
        status: "active",
        cancelAtPeriodEnd: false,
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: localSub.getPeriodEnd("monthly"),
      });
    } else {
      await Subscription.findOneAndUpdate(
        { user: id },
        {
          plan,
          status: "active",
          cancelAtPeriodEnd: false,
          currentPeriodStart: new Date(),
          currentPeriodEnd: localSub.getPeriodEnd("monthly"),
        },
        { upsert: true, new: true }
      );
    }

    res.json({ message: `User plan updated to ${plan}.` });
  } catch (err) {
    console.error("updateUserSubscription error:", err);
    res.status(500).json({ message: "Failed to update subscription." });
  }
};

const setUserAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { isAdmin } = req.body;
    if (typeof isAdmin !== "boolean") {
      return res.status(400).json({ message: "isAdmin (boolean) is required." });
    }

    if (useLocal()) {
      if (typeof localAuth.updateUser !== "function") {
        return res
          .status(501)
          .json({ message: "Admin promotion requires a database connection." });
      }
      await localAuth.updateUser(id, { isAdmin });
    } else {
      const user = await User.findByIdAndUpdate(id, { isAdmin }, { new: true });
      if (!user) return res.status(404).json({ message: "User not found." });
    }

    res.json({
      message: isAdmin
        ? "User promoted to admin. They get admin access on their next login."
        : "Admin access revoked.",
    });
  } catch (err) {
    console.error("setUserAdmin error:", err);
    res.status(500).json({ message: "Failed to update admin access." });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (useLocal()) {
      await localAuth.deleteUser(id);
    } else {
      await User.findByIdAndDelete(id);
    }
    res.json({ message: "User deleted." });
  } catch (err) {
    console.error("deleteUser error:", err);
    res.status(500).json({ message: "Failed to delete user." });
  }
};

/* ── Blog Posts ────────────────────────────────────────────────────── */
const getBlogPosts = async (req, res) => {
  try {
    const posts = await localBlog.getAllPosts(true);
    res.json({ posts });
  } catch (err) {
    res.status(500).json({ message: "Failed to load posts." });
  }
};

const getBlogPost = async (req, res) => {
  try {
    const post = await localBlog.getPostById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found." });
    res.json({ post });
  } catch (err) {
    res.status(500).json({ message: "Failed to load post." });
  }
};

const createBlogPost = async (req, res) => {
  try {
    const { title, slug, excerpt, content, status, author, tags, coverImage } = req.body;
    if (!title) return res.status(400).json({ message: "Title is required." });
    const post = await localBlog.createPost({
      title, slug, excerpt, content, status, author, tags, coverImage,
    });
    res.status(201).json({ post, message: "Post created." });
  } catch (err) {
    res.status(500).json({ message: "Failed to create post." });
  }
};

const updateBlogPost = async (req, res) => {
  try {
    const post = await localBlog.updatePost(req.params.id, req.body);
    if (!post) return res.status(404).json({ message: "Post not found." });
    res.json({ post, message: "Post updated." });
  } catch (err) {
    res.status(500).json({ message: "Failed to update post." });
  }
};

const deleteBlogPost = async (req, res) => {
  try {
    const ok = await localBlog.deletePost(req.params.id);
    if (!ok) return res.status(404).json({ message: "Post not found." });
    res.json({ message: "Post deleted." });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete post." });
  }
};

/* ── Page Content ──────────────────────────────────────────────────── */
const getPageContent = async (req, res) => {
  try {
    const sections = await localPages.getAllSections();
    res.json({ sections });
  } catch (err) {
    res.status(500).json({ message: "Failed to load page content." });
  }
};

const updatePageSection = async (req, res) => {
  try {
    const { section } = req.params;
    const updated = await localPages.updateSection(section, req.body);
    res.json({ section: updated, message: "Section updated." });
  } catch (err) {
    res.status(500).json({ message: "Failed to update section." });
  }
};

/* ── Subscription Tiers CRUD ───────────────────────────────────────── */
const getSubscriptionTiers = async (req, res) => {
  try {
    const tiers = await localTiers.getAllTiers();
    res.json({ tiers });
  } catch (err) {
    res.status(500).json({ message: "Failed to load tiers." });
  }
};

const createSubscriptionTier = async (req, res) => {
  try {
    const tier = await localTiers.createTier(req.body);
    res.status(201).json({ tier, message: "Tier created." });
  } catch (err) {
    if (err.code === "DUPLICATE") return res.status(409).json({ message: err.message });
    res.status(500).json({ message: "Failed to create tier." });
  }
};

const updateSubscriptionTier = async (req, res) => {
  try {
    const tier = await localTiers.updateTier(req.params.id, req.body);
    if (!tier) return res.status(404).json({ message: "Tier not found." });
    res.json({ tier, message: "Tier updated." });
  } catch (err) {
    res.status(500).json({ message: "Failed to update tier." });
  }
};

const deleteSubscriptionTier = async (req, res) => {
  try {
    const ok = await localTiers.deleteTier(req.params.id);
    if (!ok) return res.status(404).json({ message: "Tier not found." });
    res.json({ message: "Tier deleted." });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete tier." });
  }
};

/* ── Tier Offers ───────────────────────────────────────────────────── */
const addTierOffer = async (req, res) => {
  try {
    const offer = await localTiers.addOffer(req.params.id, req.body);
    if (!offer) return res.status(404).json({ message: "Tier not found." });
    res.status(201).json({ offer, message: "Offer added." });
  } catch (err) {
    res.status(500).json({ message: "Failed to add offer." });
  }
};

const updateTierOffer = async (req, res) => {
  try {
    const offer = await localTiers.updateOffer(req.params.id, req.params.offerId, req.body);
    if (!offer) return res.status(404).json({ message: "Offer not found." });
    res.json({ offer, message: "Offer updated." });
  } catch (err) {
    res.status(500).json({ message: "Failed to update offer." });
  }
};

const deleteTierOffer = async (req, res) => {
  try {
    const ok = await localTiers.deleteOffer(req.params.id, req.params.offerId);
    if (!ok) return res.status(404).json({ message: "Offer not found." });
    res.json({ message: "Offer deleted." });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete offer." });
  }
};

/* ── Landing Page Navigation ───────────────────────────────────────── */
const getNavItems = async (req, res) => {
  try {
    const nav = await localNav.getNav();
    res.json({ nav });
  } catch (err) {
    res.status(500).json({ message: "Failed to load nav." });
  }
};

const createNavItem = async (req, res) => {
  try {
    const { parentId, ...data } = req.body;
    const item = await localNav.createNavItem(data, parentId || null);
    res.status(201).json({ item, message: "Nav item created." });
  } catch (err) {
    res.status(400).json({ message: err.message || "Failed to create nav item." });
  }
};

const updateNavItem = async (req, res) => {
  try {
    const item = await localNav.updateNavItem(req.params.id, req.body);
    if (!item) return res.status(404).json({ message: "Nav item not found." });
    res.json({ item, message: "Nav item updated." });
  } catch (err) {
    res.status(500).json({ message: "Failed to update nav item." });
  }
};

const deleteNavItem = async (req, res) => {
  try {
    const ok = await localNav.deleteNavItem(req.params.id);
    if (!ok) return res.status(404).json({ message: "Nav item not found." });
    res.json({ message: "Nav item deleted." });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete nav item." });
  }
};

module.exports = {
  getStats,
  getUsers,
  updateUserSubscription,
  setUserAdmin,
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
};
