/**
 * Create Admin Account Script
 * Usage: node scripts/createAdmin.js
 *
 * This script:
 *   1. Creates a new user (or skips if email already exists)
 *   2. Adds the email to ADMIN_EMAILS in .env so they get isAdmin=true on login
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const readline = require("readline");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const STORE_DIR = path.join(__dirname, "..", "uploads", "auth");
const STORE_FILE = path.join(STORE_DIR, "local-users.json");
const ENV_FILE = path.join(__dirname, "..", ".env");

// ─── Store helpers ────────────────────────────────────────────────────────────

function readStore() {
  fs.mkdirSync(STORE_DIR, { recursive: true });
  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, JSON.stringify({ users: [] }, null, 2));
  }
  const raw = fs.readFileSync(STORE_FILE, "utf8");
  const parsed = JSON.parse(raw || "{}");
  return Array.isArray(parsed.users) ? parsed.users : [];
}

function writeStore(users) {
  fs.mkdirSync(STORE_DIR, { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify({ users }, null, 2));
}

// ─── .env helpers ─────────────────────────────────────────────────────────────

function addToAdminEmails(email) {
  const env = fs.readFileSync(ENV_FILE, "utf8");
  const emailLower = email.trim().toLowerCase();

  // Already has ADMIN_EMAILS line?
  if (/^ADMIN_EMAILS=/m.test(env)) {
    const updated = env.replace(/^(ADMIN_EMAILS=.*)$/m, (match) => {
      const existing = match.replace("ADMIN_EMAILS=", "").split(",").map((e) => e.trim()).filter(Boolean);
      if (existing.map((e) => e.toLowerCase()).includes(emailLower)) return match; // already in list
      return `ADMIN_EMAILS=${[...existing, emailLower].join(",")}`;
    });
    fs.writeFileSync(ENV_FILE, updated);
  } else {
    // Append ADMIN_EMAILS line
    fs.writeFileSync(ENV_FILE, env.trimEnd() + `\n\n# Admin emails (comma-separated)\nADMIN_EMAILS=${emailLower}\n`);
  }
}

// ─── Prompt helper ────────────────────────────────────────────────────────────

function prompt(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function promptPassword(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let password = "";
    stdin.on("data", function handler(char) {
      if (char === "\r" || char === "\n") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", handler);
        process.stdout.write("\n");
        resolve(password);
      } else if (char === "\u0003") {
        process.exit();
      } else if (char === "\u007f") {
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write("\b \b");
        }
      } else {
        password += char;
        process.stdout.write("*");
      }
    });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n=== aiAccountant — Create Admin Account ===\n");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  const name = await prompt(rl, "Full name:      ");
  const email = await prompt(rl, "Email:          ");
  rl.close();

  const password = await promptPassword("Password:       ");

  if (!name.trim() || !email.trim() || !password.trim()) {
    console.error("\n❌  All fields are required.");
    process.exit(1);
  }

  const emailLower = email.trim().toLowerCase();

  // ── 1. Create or promote user in local store ──────────────────────────────
  const users = readStore();
  const existing = users.find((u) => u.email.toLowerCase() === emailLower);

  if (existing) {
    console.log(`\nℹ️  User "${emailLower}" already exists in the local store.`);
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
    users.push({
      id: `local_${crypto.randomBytes(12).toString("hex")}`,
      name: name.trim(),
      email: emailLower,
      passwordHash,
      businessType: "service",
      resetPasswordTokenHash: null,
      resetPasswordExpiresAt: null,
      passwordChangedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    writeStore(users);
    console.log(`\n✅  User "${emailLower}" created in local store.`);
  }

  // ── 2. Add to ADMIN_EMAILS in .env ────────────────────────────────────────
  addToAdminEmails(emailLower);
  console.log(`✅  "${emailLower}" added to ADMIN_EMAILS in .env`);

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Admin account ready!

 Email:    ${emailLower}

 Next steps:
   1. Restart the backend server  (node server.js)
   2. Open http://localhost:5173/login
   3. Log in with the email above
   4. Navigate to http://localhost:5173/admin
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
