/**
 * File-backed tax store — fallback for local dev without MongoDB.
 * Keyed by userId → array of taxes. Mirrors the other local stores.
 * NOTE: on Vercel (/tmp) this is ephemeral; production uses MongoDB.
 */
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const STORE_DIR = process.env.VERCEL === "1" ? path.join("/tmp", "taxes") : path.join(__dirname, "..", "uploads", "taxes");
const STORE_FILE = path.join(STORE_DIR, "store.json");

const ensureStore = async () => {
  await fs.mkdir(STORE_DIR, { recursive: true });
  try { await fs.access(STORE_FILE); } catch {
    await fs.writeFile(STORE_FILE, JSON.stringify({}, null, 2), "utf8");
  }
};

const readStore = async () => {
  await ensureStore();
  const raw = await fs.readFile(STORE_FILE, "utf8");
  return JSON.parse(raw || "{}");
};

const writeStore = async (data) => {
  await ensureStore();
  await fs.writeFile(STORE_FILE, JSON.stringify(data, null, 2), "utf8");
};

const list = async (userId) => {
  const store = await readStore();
  return (store[String(userId)] || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
};

const create = async (userId, data) => {
  const store = await readStore();
  const key = String(userId);
  const now = new Date().toISOString();
  const tax = { id: `tax_${crypto.randomBytes(6).toString("hex")}`, ...data, createdAt: now, updatedAt: now };
  store[key] = [...(store[key] || []), tax];
  await writeStore(store);
  return tax;
};

const update = async (userId, id, data) => {
  const store = await readStore();
  const key = String(userId);
  let updated = null;
  store[key] = (store[key] || []).map((t) => {
    if (t.id === id) {
      updated = { ...t, ...data, id, updatedAt: new Date().toISOString() };
      return updated;
    }
    return t;
  });
  await writeStore(store);
  return updated;
};

const remove = async (userId, id) => {
  const store = await readStore();
  const key = String(userId);
  const before = (store[key] || []).length;
  store[key] = (store[key] || []).filter((t) => t.id !== id);
  await writeStore(store);
  return (store[key] || []).length < before;
};

module.exports = { list, create, update, remove };
