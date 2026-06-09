const mongoose = require("mongoose");
const Subscription = require("../models/Subscription");
const { FAKE_PAYMENT_CARDS } = require("../config/constants");
const localStore = require("../services/localSubscriptionStore");
const localTierStore = require("../services/localTierStore");
const usageService = require("../services/usageService");

const isDev = process.env.NODE_ENV !== "production";
const isDatabaseReady = () => mongoose.connection.readyState === 1;
const useLocalStore = () => isDev || !isDatabaseReady();

/* ─── Helper: Determine card brand ─────────────────────────────────────── */
const getCardBrand = (cardNumber) => {
  const num = cardNumber.replace(/\s/g, "");
  if (/^4/.test(num)) return "Visa";
  if (/^5[1-5]/.test(num)) return "Mastercard";
  if (/^3[47]/.test(num)) return "Amex";
  if (/^6(?:011|5)/.test(num)) return "Discover";
  return "Unknown";
};

/* ─── Helper: Process fake payment ─────────────────────────────────────── */
const processFakePayment = (cardNumber, expiryMonth, expiryYear) => {
  const num = cardNumber.replace(/\s/g, "");

  // Validate card length
  if (num.length < 13 || num.length > 19 || !/^\d+$/.test(num)) {
    return { success: false, error: "Invalid card number." };
  }

  // Check expiry
  const now = new Date();
  const expYear = parseInt(expiryYear, 10);
  const expMonth = parseInt(expiryMonth, 10);
  const fullYear = expYear < 100 ? 2000 + expYear : expYear;
  if (
    fullYear < now.getFullYear() ||
    (fullYear === now.getFullYear() && expMonth < now.getMonth() + 1)
  ) {
    return { success: false, error: "Your card has expired." };
  }

  // Test card outcomes
  if (FAKE_PAYMENT_CARDS.DECLINED.includes(num)) {
    return { success: false, error: "Your card was declined." };
  }
  if (FAKE_PAYMENT_CARDS.INSUFFICIENT_FUNDS.includes(num)) {
    return { success: false, error: "Insufficient funds on this card." };
  }
  if (FAKE_PAYMENT_CARDS.EXPIRED_CARD.includes(num)) {
    return { success: false, error: "Your card has expired." };
  }

  return { success: true };
};

/* ─── GET /api/subscriptions/plans ──────────────────────────────────────── */
const getPlans = async (req, res) => {
  try {
    const tiers = await localTierStore.getAllTiers();
    const plans = tiers
      .filter((t) => t.active !== false)
      .map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        price: t.price,
        features: t.features,
        limits: t.limits || {},
        highlight: t.highlight,
        badge: t.badge,
        offers: (t.offers || []).filter((o) => o.active),
      }));
    res.json({ plans });
  } catch (err) {
    console.error("getPlans error:", err);
    res.status(500).json({ message: "Failed to load plans." });
  }
};

/* ─── Helper: Get or create subscription ───────────────────────────────── */
const getOrCreateSub = async (userId) => {
  if (useLocalStore()) {
    let sub = await localStore.findByUserId(userId);
    if (!sub) sub = await localStore.createDefaultSubscription(userId);
    return sub;
  }

  let sub = await Subscription.findOne({ user: userId });
  if (!sub) {
    sub = await Subscription.create({
      user: userId,
      plan: "free",
      status: "active",
      currentPeriodEnd: localStore.getPeriodEnd("monthly"),
    });
  }
  return sub;
};

/* ─── GET /api/subscriptions/me ─────────────────────────────────────────── */
const getMySubscription = async (req, res) => {
  try {
    const userId = req.user._id;
    const sub = await getOrCreateSub(userId);
    const tier = await localTierStore.getTierById(sub.plan);
    const fallbackTier = await localTierStore.getTierById("free");
    const planDetails = tier || fallbackTier || { id: "free", name: "Free", price: { monthly: 0 }, features: [], limits: {} };
    // Include current month usage so the frontend can show progress
    const usage = await usageService.getUsage(userId);
    res.json({
      subscription: sub,
      planDetails,
      usage,
    });
  } catch (err) {
    console.error("getMySubscription error:", err);
    res.status(500).json({ message: "Failed to load subscription." });
  }
};

/* ─── POST /api/subscriptions/subscribe ─────────────────────────────────── */
const subscribe = async (req, res) => {
  try {
    const userId = req.user._id;
    const { planId, billingCycle = "monthly", paymentMethod } = req.body;

    // Validate plan against live tier store
    const plan = await localTierStore.getTierById(planId);
    if (!plan) {
      return res.status(400).json({ message: "Invalid plan selected." });
    }

    // Free plan doesn't need payment
    if (planId !== "free") {
      if (!paymentMethod) {
        return res
          .status(400)
          .json({ message: "Payment method is required for paid plans." });
      }

      const { cardNumber, expiryMonth, expiryYear, cvv, cardholderName } =
        paymentMethod;

      if (!cardNumber || !expiryMonth || !expiryYear || !cvv || !cardholderName) {
        return res
          .status(400)
          .json({ message: "All payment fields are required." });
      }

      if (!/^\d{3,4}$/.test(cvv)) {
        return res.status(400).json({ message: "Invalid CVV." });
      }

      // Simulate processing delay (handled on frontend with loading state)
      const paymentResult = processFakePayment(cardNumber, expiryMonth, expiryYear);
      if (!paymentResult.success) {
        return res.status(402).json({ message: paymentResult.error });
      }
    }

    const amount = plan.price[billingCycle] || 0;
    const cardNum = paymentMethod?.cardNumber?.replace(/\s/g, "") || "";
    const last4 = cardNum.slice(-4);
    const brand = planId !== "free" ? getCardBrand(cardNum) : null;

    const invoice = {
      amount,
      currency: "USD",
      status: "paid",
      plan: planId,
      billingCycle,
      description: `${plan.name} plan — ${billingCycle} billing`,
    };

    const subData = {
      plan: planId,
      status: "active",
      billingCycle,
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: localStore.getPeriodEnd(billingCycle),
      cancelAtPeriodEnd: false,
      paymentMethod:
        planId !== "free"
          ? {
              last4,
              brand,
              expiryMonth: paymentMethod?.expiryMonth,
              expiryYear: paymentMethod?.expiryYear,
              cardholderName: paymentMethod?.cardholderName,
            }
          : null,
    };

    let subscription;

    if (useLocalStore()) {
      const existing = await localStore.findByUserId(userId);
      const existingInvoices = existing?.invoices || [];
      subscription = await localStore.upsertSubscription(userId, {
        ...subData,
        invoices: amount > 0 ? [invoice, ...existingInvoices].slice(0, 20) : existingInvoices,
      });
    } else {
      subscription = await Subscription.findOneAndUpdate(
        { user: userId },
        {
          ...subData,
          ...(amount > 0 && {
            $push: {
              invoices: {
                $each: [invoice],
                $position: 0,
                $slice: 20,
              },
            },
          }),
        },
        { upsert: true, new: true }
      );
    }

    res.json({
      message: `Successfully subscribed to ${plan.name}!`,
      subscription,
      planDetails: plan,
    });
  } catch (err) {
    console.error("subscribe error:", err);
    res.status(500).json({ message: "Subscription failed. Please try again." });
  }
};

/* ─── POST /api/subscriptions/cancel ────────────────────────────────────── */
const cancelSubscription = async (req, res) => {
  try {
    const userId = req.user._id;

    if (useLocalStore()) {
      const sub = await localStore.findByUserId(userId);
      if (!sub) return res.status(404).json({ message: "Subscription not found." });
      await localStore.upsertSubscription(userId, {
        ...sub,
        cancelAtPeriodEnd: true,
        status: sub.plan === "free" ? "active" : sub.status,
      });
    } else {
      await Subscription.findOneAndUpdate(
        { user: userId },
        { cancelAtPeriodEnd: true },
        { new: true }
      );
    }

    res.json({
      message:
        "Your subscription will be cancelled at the end of the current billing period.",
    });
  } catch (err) {
    console.error("cancelSubscription error:", err);
    res.status(500).json({ message: "Failed to cancel subscription." });
  }
};

/* ─── POST /api/subscriptions/reactivate ────────────────────────────────── */
const reactivateSubscription = async (req, res) => {
  try {
    const userId = req.user._id;

    if (useLocalStore()) {
      const sub = await localStore.findByUserId(userId);
      if (!sub) return res.status(404).json({ message: "Subscription not found." });
      await localStore.upsertSubscription(userId, {
        ...sub,
        cancelAtPeriodEnd: false,
      });
    } else {
      await Subscription.findOneAndUpdate(
        { user: userId },
        { cancelAtPeriodEnd: false },
        { new: true }
      );
    }

    res.json({ message: "Subscription reactivated successfully." });
  } catch (err) {
    console.error("reactivateSubscription error:", err);
    res.status(500).json({ message: "Failed to reactivate subscription." });
  }
};

module.exports = {
  getPlans,
  getMySubscription,
  subscribe,
  cancelSubscription,
  reactivateSubscription,
};
