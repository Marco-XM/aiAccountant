/**
 * Local JSON store for subscription tiers.
 * Initialized from SUBSCRIPTION_PLANS in constants, then managed via admin CRUD.
 * Each tier can have an `offers` array for discounts / promotions.
 */
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { SUBSCRIPTION_PLANS } = require("../config/constants");

const STORE_DIR  = path.join(__dirname, "..", "uploads", "tiers");
const STORE_FILE = path.join(STORE_DIR, "store.json");

// ── seed from constants ──────────────────────────────────────────────────────
const buildDefaultTiers = () => {
  const tiers = {};
  let order = 0;
  for (const [key, plan] of Object.entries(SUBSCRIPTION_PLANS)) {
    tiers[key] = {
      id:          key,
      name:        plan.name,
      description: plan.description || "",
      price:       { monthly: plan.price.monthly, annual: plan.price.annual },
      limits: {
        transactions:       plan.limits?.transactions       ?? -1,
        excelUploads:       plan.limits?.excelUploads       ?? -1,
        aiChartGenerations: plan.limits?.aiChartGenerations ?? -1,
        aiChatMessages:     plan.limits?.aiChatMessages     ?? -1,
        aiExcelGenerations: plan.limits?.aiExcelGenerations ?? -1,
      },
      features:    Array.isArray(plan.features) ? plan.features : [],
      highlight:   key === "pro",
      badge:       key === "pro" ? "Most Popular" : null,
      sortOrder:   order++,
      active:      true,
      offers:      [],
      createdAt:   new Date().toISOString(),
      updatedAt:   new Date().toISOString(),
    };
  }
  return tiers;
};

// ── file helpers ─────────────────────────────────────────────────────────────
const ensureStore = async () => {
  await fs.mkdir(STORE_DIR, { recursive: true });
  try {
    await fs.access(STORE_FILE);
  } catch {
    await fs.writeFile(
      STORE_FILE,
      JSON.stringify({ tiers: buildDefaultTiers() }, null, 2),
      "utf8"
    );
  }
};

const readStore = async () => {
  await ensureStore();
  const raw = await fs.readFile(STORE_FILE, "utf8");
  const parsed = JSON.parse(raw || "{}");
  return typeof parsed.tiers === "object" && parsed.tiers !== null
    ? parsed.tiers
    : buildDefaultTiers();
};

const writeStore = async (tiers) => {
  await ensureStore();
  await fs.writeFile(STORE_FILE, JSON.stringify({ tiers }, null, 2), "utf8");
};

// ── exports ──────────────────────────────────────────────────────────────────
const getAllTiers = async () => {
  const tiers = await readStore();
  // Merge in any default tiers missing from the store (e.g. "free" added after initial seed)
  const defaults = buildDefaultTiers();
  let changed = false;
  for (const [key, defaultTier] of Object.entries(defaults)) {
    if (!tiers[key]) {
      tiers[key] = defaultTier;
      changed = true;
    }
  }
  if (changed) await writeStore(tiers);
  return Object.values(tiers).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
};

const getTierById = async (id) => {
  const tiers = await readStore();
  return tiers[id] || null;
};

const DEFAULT_LIMITS = { transactions: -1, excelUploads: -1, aiChartGenerations: -1, aiChatMessages: -1, aiExcelGenerations: -1 };

const normalizeLimits = (src) => {
  const base = { ...DEFAULT_LIMITS };
  if (src && typeof src === "object") {
    for (const key of Object.keys(DEFAULT_LIMITS)) {
      if (src[key] !== undefined) base[key] = Number(src[key]);
    }
  }
  return base;
};

const createTier = async (data) => {
  const tiers = await readStore();
  const id = data.id || `tier_${crypto.randomBytes(6).toString("hex")}`;
  if (tiers[id]) throw Object.assign(new Error("Tier already exists"), { code: "DUPLICATE" });

  const tier = {
    id,
    name:        data.name || id,
    description: data.description || "",
    price:       { monthly: Number(data.price?.monthly ?? 0), annual: Number(data.price?.annual ?? 0) },
    limits:      normalizeLimits(data.limits),
    features:    Array.isArray(data.features) ? data.features : [],
    highlight:   Boolean(data.highlight),
    badge:       data.badge || null,
    sortOrder:   data.sortOrder ?? Object.keys(tiers).length,
    active:      data.active !== false,
    offers:      [],
    createdAt:   new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
  };
  tiers[id] = tier;
  await writeStore(tiers);
  return tier;
};

const updateTier = async (id, data) => {
  const tiers = await readStore();
  // If tier missing from store, seed it from defaults before updating
  if (!tiers[id]) {
    const defaults = buildDefaultTiers();
    if (!defaults[id]) return null;
    tiers[id] = defaults[id];
  }

  const existing = tiers[id];
  const updated = {
    ...existing,
    name:        data.name        ?? existing.name,
    description: data.description ?? existing.description,
    price: {
      monthly: data.price?.monthly !== undefined ? Number(data.price.monthly) : existing.price.monthly,
      annual:  data.price?.annual  !== undefined ? Number(data.price.annual)  : existing.price.annual,
    },
    limits:     data.limits !== undefined ? normalizeLimits(data.limits) : (existing.limits || normalizeLimits({})),
    features:   Array.isArray(data.features)  ? data.features  : existing.features,
    highlight:  data.highlight  !== undefined  ? Boolean(data.highlight)  : existing.highlight,
    badge:      data.badge      !== undefined  ? data.badge      : existing.badge,
    sortOrder:  data.sortOrder  !== undefined  ? Number(data.sortOrder) : existing.sortOrder,
    active:     data.active     !== undefined  ? Boolean(data.active)   : existing.active,
    updatedAt:  new Date().toISOString(),
  };
  tiers[id] = updated;
  await writeStore(tiers);
  return updated;
};

const deleteTier = async (id) => {
  const tiers = await readStore();
  if (!tiers[id]) return false;
  delete tiers[id];
  await writeStore(tiers);
  return true;
};

// ── offer helpers ─────────────────────────────────────────────────────────────
const addOffer = async (tierId, offerData) => {
  const tiers = await readStore();
  if (!tiers[tierId]) return null;

  const offer = {
    id:           `offer_${crypto.randomBytes(6).toString("hex")}`,
    label:        offerData.label || "Special Offer",
    description:  offerData.description || "",
    discountPct:  offerData.discountPct  != null ? Number(offerData.discountPct)  : null,
    discountFlat: offerData.discountFlat != null ? Number(offerData.discountFlat) : null,
    validFrom:    offerData.validFrom  || null,
    validUntil:   offerData.validUntil || null,
    code:         offerData.code || null,
    active:       offerData.active !== false,
    createdAt:    new Date().toISOString(),
  };

  tiers[tierId].offers = [...(tiers[tierId].offers || []), offer];
  tiers[tierId].updatedAt = new Date().toISOString();
  await writeStore(tiers);
  return offer;
};

const updateOffer = async (tierId, offerId, data) => {
  const tiers = await readStore();
  if (!tiers[tierId]) return null;

  tiers[tierId].offers = (tiers[tierId].offers || []).map((o) =>
    o.id === offerId ? { ...o, ...data, id: offerId } : o
  );
  tiers[tierId].updatedAt = new Date().toISOString();
  await writeStore(tiers);
  return tiers[tierId].offers.find((o) => o.id === offerId) || null;
};

const deleteOffer = async (tierId, offerId) => {
  const tiers = await readStore();
  if (!tiers[tierId]) return false;
  const before = tiers[tierId].offers.length;
  tiers[tierId].offers = (tiers[tierId].offers || []).filter((o) => o.id !== offerId);
  if (tiers[tierId].offers.length === before) return false;
  tiers[tierId].updatedAt = new Date().toISOString();
  await writeStore(tiers);
  return true;
};

module.exports = { getAllTiers, getTierById, createTier, updateTier, deleteTier, addOffer, updateOffer, deleteOffer };
