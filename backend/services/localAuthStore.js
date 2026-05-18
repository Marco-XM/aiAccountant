const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const STORE_DIR = path.join(__dirname, "..", "uploads", "auth");
const STORE_FILE = path.join(STORE_DIR, "local-users.json");

const ensureStore = async () => {
  await fs.mkdir(STORE_DIR, { recursive: true });
  try {
    await fs.access(STORE_FILE);
  } catch {
    await fs.writeFile(STORE_FILE, JSON.stringify({ users: [] }, null, 2), "utf8");
  }
};

const readStore = async () => {
  await ensureStore();
  const raw = await fs.readFile(STORE_FILE, "utf8");
  const parsed = JSON.parse(raw || "{}");
  return Array.isArray(parsed.users) ? parsed.users : [];
};

const writeStore = async (users) => {
  await ensureStore();
  await fs.writeFile(STORE_FILE, JSON.stringify({ users }, null, 2), "utf8");
};

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const toPublicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  businessType: user.businessType,
});

const createUser = async ({ name, email, passwordHash, businessType }) => {
  const users = await readStore();
  const normalizedEmail = normalizeEmail(email);

  if (users.some((user) => normalizeEmail(user.email) === normalizedEmail)) {
    const error = new Error("User already exists");
    error.code = "USER_EXISTS";
    throw error;
  }

  const user = {
    id: `local_${crypto.randomBytes(12).toString("hex")}`,
    name: name || normalizedEmail.split("@")[0] || "User",
    email: normalizedEmail,
    passwordHash,
    businessType: businessType || "service",
    resetPasswordTokenHash: null,
    resetPasswordExpiresAt: null,
    passwordChangedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  users.push(user);
  await writeStore(users);
  return user;
};

const findUserByEmail = async (email) => {
  const users = await readStore();
  const normalizedEmail = normalizeEmail(email);
  return users.find((user) => normalizeEmail(user.email) === normalizedEmail) || null;
};

const findUserByResetTokenHash = async (tokenHash) => {
  const users = await readStore();
  return (
    users.find(
      (user) =>
        user.resetPasswordTokenHash &&
        user.resetPasswordTokenHash === tokenHash &&
        (!user.resetPasswordExpiresAt || new Date(user.resetPasswordExpiresAt) > new Date()),
    ) || null
  );
};

const saveUser = async (updatedUser) => {
  const users = await readStore();
  const index = users.findIndex((user) => user.id === updatedUser.id);

  if (index === -1) {
    users.push(updatedUser);
  } else {
    users[index] = updatedUser;
  }

  updatedUser.updatedAt = new Date().toISOString();
  await writeStore(users);
  return updatedUser;
};

module.exports = {
  createUser,
  findUserByEmail,
  findUserByResetTokenHash,
  saveUser,
  toPublicUser,
};
