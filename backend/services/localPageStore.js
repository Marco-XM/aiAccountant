const fs = require("fs/promises");
const path = require("path");

const STORE_DIR = path.join(__dirname, "..", "uploads", "pages");
const STORE_FILE = path.join(STORE_DIR, "store.json");

const DEFAULT_CONTENT = {
  hero: {
    title: "AI-Powered Accounting for Modern Businesses",
    subtitle:
      "Manage transactions, generate reports, and get AI-powered insights—all in one platform built for growing businesses.",
    ctaPrimary: "Start for free",
    ctaSecondary: "View pricing",
    badge: "Now with AI-powered financial insights",
  },
  features: {
    heading: "Everything you need to manage finances",
    subheading:
      "Powerful tools built specifically for modern businesses, combining AI intelligence with intuitive design.",
  },
  stats: [
    { value: "10,000+", label: "Businesses served" },
    { value: "$2B+", label: "Transactions processed" },
    { value: "99.9%", label: "Uptime SLA" },
    { value: "4.9/5", label: "Customer rating" },
  ],
  cta: {
    heading: "Ready to take control of your finances?",
    subheading:
      "Join thousands of businesses already using AI Accountant. Start free, upgrade when you grow.",
    ctaPrimary: "Start for free",
    ctaSecondary: "See pricing plans",
  },
};

const ensureStore = async () => {
  await fs.mkdir(STORE_DIR, { recursive: true });
  try {
    await fs.access(STORE_FILE);
  } catch {
    await fs.writeFile(
      STORE_FILE,
      JSON.stringify({ sections: DEFAULT_CONTENT }, null, 2),
      "utf8"
    );
  }
};

const getAllSections = async () => {
  await ensureStore();
  const raw = await fs.readFile(STORE_FILE, "utf8");
  const parsed = JSON.parse(raw || "{}");
  return { ...DEFAULT_CONTENT, ...(parsed.sections || {}) };
};

const getSection = async (section) => {
  const sections = await getAllSections();
  return sections[section] || null;
};

const updateSection = async (section, fields) => {
  const sections = await getAllSections();
  sections[section] = { ...(sections[section] || {}), ...fields };
  await ensureStore();
  await fs.writeFile(
    STORE_FILE,
    JSON.stringify({ sections }, null, 2),
    "utf8"
  );
  return sections[section];
};

module.exports = { getAllSections, getSection, updateSection };
