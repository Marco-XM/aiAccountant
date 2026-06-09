/**
 * Local JSON store for landing-page navigation items (pages & sub-pages).
 */
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const STORE_DIR  = process.env.VERCEL === "1" ? require("path").join("/tmp", "pages") : path.join(__dirname, "..", "uploads", "pages");
const STORE_FILE = path.join(STORE_DIR, "nav.json");

const DEFAULT_NAV = [
  { id: "nav_features", label: "Features",  href: "#features", target: "_self", order: 0, children: [] },
  { id: "nav_pricing",  label: "Pricing",   href: "/pricing",  target: "_self", order: 1, children: [] },
  { id: "nav_blog",     label: "Blog",      href: "/blog",     target: "_self", order: 2, children: [] },
];

const ensureStore = async () => {
  await fs.mkdir(STORE_DIR, { recursive: true });
  try {
    await fs.access(STORE_FILE);
  } catch {
    await fs.writeFile(
      STORE_FILE,
      JSON.stringify({ nav: DEFAULT_NAV }, null, 2),
      "utf8"
    );
  }
};

const readStore = async () => {
  await ensureStore();
  const raw  = await fs.readFile(STORE_FILE, "utf8");
  const data = JSON.parse(raw || "{}");
  return Array.isArray(data.nav) ? data.nav : DEFAULT_NAV;
};

const writeStore = async (nav) => {
  await ensureStore();
  await fs.writeFile(STORE_FILE, JSON.stringify({ nav }, null, 2), "utf8");
};

// ── Nav item helpers ─────────────────────────────────────────────────────────
const getNav = async () => {
  const nav = await readStore();
  return nav.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
};

const createNavItem = async (data, parentId = null) => {
  const nav = await readStore();

  const item = {
    id:       `nav_${crypto.randomBytes(6).toString("hex")}`,
    label:    data.label || "New Page",
    href:     data.href  || "#",
    target:   data.target || "_self",
    order:    data.order  ?? nav.length,
    children: [],
  };

  if (parentId) {
    const parent = nav.find((n) => n.id === parentId);
    if (!parent) throw new Error("Parent nav item not found.");
    parent.children = [...(parent.children || []), { ...item, children: undefined }];
  } else {
    nav.push(item);
  }

  await writeStore(nav);
  return item;
};

const updateNavItem = async (id, data) => {
  const nav = await readStore();

  // Check top-level first
  const topIdx = nav.findIndex((n) => n.id === id);
  if (topIdx !== -1) {
    nav[topIdx] = { ...nav[topIdx], ...data, id, children: nav[topIdx].children };
    await writeStore(nav);
    return nav[topIdx];
  }

  // Check children
  for (const parent of nav) {
    const childIdx = (parent.children || []).findIndex((c) => c.id === id);
    if (childIdx !== -1) {
      parent.children[childIdx] = { ...parent.children[childIdx], ...data, id };
      await writeStore(nav);
      return parent.children[childIdx];
    }
  }

  return null;
};

const deleteNavItem = async (id) => {
  const nav = await readStore();

  // Top-level
  const topIdx = nav.findIndex((n) => n.id === id);
  if (topIdx !== -1) {
    nav.splice(topIdx, 1);
    await writeStore(nav);
    return true;
  }

  // Children
  for (const parent of nav) {
    const before = (parent.children || []).length;
    parent.children = (parent.children || []).filter((c) => c.id !== id);
    if (parent.children.length < before) {
      await writeStore(nav);
      return true;
    }
  }

  return false;
};

module.exports = { getNav, createNavItem, updateNavItem, deleteNavItem };
