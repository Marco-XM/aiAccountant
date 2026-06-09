const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

const STORE_DIR = process.env.VERCEL === "1" ? require("path").join("/tmp", "chat-local") : path.join(__dirname, "..", "uploads", "chat-local");
const STORE_FILE = path.join(STORE_DIR, 'store.json');

const ensureStore = async () => {
  await fs.mkdir(STORE_DIR, { recursive: true });
  try {
    await fs.access(STORE_FILE);
  } catch {
    await fs.writeFile(STORE_FILE, JSON.stringify({ sessions: [] }, null, 2), 'utf8');
  }
};

const readStore = async () => {
  await ensureStore();
  const raw = await fs.readFile(STORE_FILE, 'utf8');
  const parsed = JSON.parse(raw || '{}');
  return Array.isArray(parsed.sessions) ? parsed.sessions : [];
};

const writeStore = async (sessions) => {
  await ensureStore();
  await fs.writeFile(STORE_FILE, JSON.stringify({ sessions }, null, 2), 'utf8');
};

const getSessions = async (userId) => {
  const sessions = await readStore();
  return sessions
    .filter((s) => s.userId === String(userId))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map(({ _id, title, createdAt, updatedAt, messages }) => ({
      _id,
      title,
      createdAt,
      updatedAt,
      messages,
    }));
};

const getSession = async (id, userId) => {
  const sessions = await readStore();
  return sessions.find((s) => s._id === String(id) && s.userId === String(userId)) || null;
};

const createSession = async (userId, title) => {
  const sessions = await readStore();
  const now = new Date().toISOString();
  const session = {
    _id: crypto.randomUUID(),
    userId: String(userId),
    title: title || 'New Chat',
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  sessions.push(session);
  await writeStore(sessions);
  return session;
};

const updateSession = async (id, userId, { messages, title } = {}) => {
  const sessions = await readStore();
  const idx = sessions.findIndex((s) => s._id === String(id) && s.userId === String(userId));
  if (idx === -1) return null;
  if (messages !== undefined) sessions[idx].messages = messages;
  if (title !== undefined) sessions[idx].title = title;
  sessions[idx].updatedAt = new Date().toISOString();
  await writeStore(sessions);
  return sessions[idx];
};

const deleteSession = async (id, userId) => {
  const sessions = await readStore();
  const idx = sessions.findIndex((s) => s._id === String(id) && s.userId === String(userId));
  if (idx === -1) return null;
  const [removed] = sessions.splice(idx, 1);
  await writeStore(sessions);
  return removed;
};

module.exports = { getSessions, getSession, createSession, updateSession, deleteSession };
