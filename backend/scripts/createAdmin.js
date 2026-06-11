/**
 * Create Admin Account Script
 * Usage: node scripts/createAdmin.js
 *
 * This script:
 *   1. Connects to MongoDB and creates the user there (or promotes an existing
 *      one) with isAdmin=true — this is the primary, required step.
 *   2. Adds the email to ADMIN_EMAILS in .env so they get isAdmin=true on login
 *      via the email allow-list as well.
 *   3. Mirrors the user into the local file store (best-effort) so login still
 *      works when the backend runs in development mode, which uses the local
 *      auth store instead of MongoDB.
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const readline = require("readline");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const User = require("../models/User");

const STORE_DIR = path.join(__dirname, "..", "uploads", "auth");
const STORE_FILE = path.join(STORE_DIR, "local-users.json");
const ENV_FILE = path.join(__dirname, "..", ".env");

// ─── CLI args / mode ──────────────────────────────────────────────────────────

// Parse `--key=value` / `--flag` style arguments.
const cliArgs = (() => {
  const out = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([^=]+)(?:=(.*))?$/);
    if (match) out[match[1]] = match[2] === undefined ? true : match[2];
  }
  return out;
})();

// Production mode = NODE_ENV=production OR the --prod flag. In production we
// target the remote database only and skip the local .env / file-store writes,
// which don't exist or persist on Vercel's read-only filesystem.
const isProduction = process.env.NODE_ENV === "production" || Boolean(cliArgs.prod);

// ─── MongoDB helpers ────────────────────────────────────────────────────────

// Resolve the connection string the same way the app does (mongoBootstrap):
// --mongo-uri / MONGODB_URI / MONGO_URI first, then a dev-only localhost
// fallback. In production there is NO localhost fallback — a real URI is required.
function resolveMongoUris() {
  const primary =
    cliArgs["mongo-uri"] || process.env.MONGODB_URI || process.env.MONGO_URI || "";
  const fallback =
    process.env.MONGODB_FALLBACK_URI ||
    (!isProduction ? "mongodb://127.0.0.1:27017/ai-accountant" : "");
  return [primary, fallback].filter(Boolean);
}

async function connectMongo() {
  const candidates = resolveMongoUris();
  if (!candidates.length) {
    throw new Error(
      "No MongoDB connection string configured. Pass --mongo-uri=\"<Atlas URI>\" or set " +
        "MONGODB_URI (use the same value as your Vercel project's MONGODB_URI env var).",
    );
  }

  let lastError = null;
  for (const uri of candidates) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
      return uri;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

// ─── Local store helpers ──────────────────────────────────────────────────────

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
      } else if (char === "") {
        process.exit();
      } else if (char === "") {
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
  console.log(`\n=== aiAccountant — Create Admin Account${isProduction ? " (PRODUCTION)" : ""} ===\n`);

  // Inputs: CLI flags → env vars → interactive prompt (only if a TTY exists).
  // This lets the script run non-interactively in CI / one-off jobs against the
  // production database, while still being usable interactively for local dev.
  let name = cliArgs.name || process.env.ADMIN_NAME || "";
  let email = cliArgs.email || process.env.ADMIN_EMAIL || "";
  let password = cliArgs.password || process.env.ADMIN_PASSWORD || "";

  const canPrompt = Boolean(process.stdin.isTTY) && cliArgs.input !== "false";

  if ((!name || !email) && canPrompt) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (!name) name = await prompt(rl, "Full name:      ");
    if (!email) email = await prompt(rl, "Email:          ");
    rl.close();
  }
  if (!password && canPrompt) {
    password = await promptPassword("Password:       ");
  }

  name = String(name).trim();
  email = String(email).trim();

  if (!name || !email || !String(password).trim()) {
    console.error(
      "\n❌  Missing name, email, or password.\n" +
        "    Provide them interactively, or non-interactively via env vars:\n" +
        "      ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD\n" +
        "    (or flags --name=, --email=, --password=).",
    );
    process.exit(1);
  }

  const emailLower = email.toLowerCase();
  const passwordHash = await bcrypt.hash(password, 10);

  // ── 1. Create or promote user in MongoDB (primary, required) ──────────────
  try {
    await connectMongo();
    console.log(`\n🔌  Connected to MongoDB (host: ${mongoose.connection.host}, db: ${mongoose.connection.name}).`);

    const existing = await User.findOne({ email: emailLower });
    if (existing) {
      existing.isAdmin = true;
      await existing.save();
      console.log(`✅  Existing user "${emailLower}" promoted to admin in the database.`);
    } else {
      await User.create({
        name,
        email: emailLower,
        password: passwordHash,
        businessType: "service",
        isAdmin: true,
      });
      console.log(`✅  Admin user "${emailLower}" created in the database.`);
    }
  } catch (error) {
    console.error(`\n❌  Failed to save admin to the database: ${error.message}`);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }

  // ── 2. Production: stop here. The deployed app reads admins from this same
  //       database (isAdmin=true), so the account already works on the live
  //       site. The local .env / file-store steps don't apply on Vercel. ─────
  if (isProduction) {
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Production admin ready ✅

 Email:    ${emailLower}

 This admin lives in the production MongoDB your Vercel deployment
 connects to (isAdmin=true), so it works on the live site immediately —
 no redeploy needed. Log in at your production URL with the email above.

 Optional belt-and-suspenders (email allow-list):
   1. Vercel → Project → Settings → Environment Variables
   2. Add or append:  ADMIN_EMAILS = ${emailLower}
   3. Redeploy so the new value is picked up
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    return;
  }

  // ── 3. Development only: keep local .env + file store in sync so login works
  //       when the backend runs in dev mode (which uses the local auth store).
  try {
    addToAdminEmails(emailLower);
    console.log(`✅  "${emailLower}" added to ADMIN_EMAILS in .env`);
  } catch (error) {
    console.warn(`⚠️  Could not update .env (non-fatal): ${error.message}`);
  }

  try {
    const users = readStore();
    const existing = users.find((u) => u.email.toLowerCase() === emailLower);
    if (existing) {
      console.log(`ℹ️  User "${emailLower}" already present in the local store (dev fallback).`);
    } else {
      users.push({
        id: `local_${crypto.randomBytes(12).toString("hex")}`,
        name,
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
      console.log(`✅  Mirrored "${emailLower}" into the local store (dev fallback).`);
    }
  } catch (error) {
    console.warn(`⚠️  Could not mirror to local store (non-fatal): ${error.message}`);
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Admin account ready!  (development)

 Email:    ${emailLower}

 Next steps:
   1. Restart the backend server  (node server.js)
   2. Open http://localhost:5173/login  →  log in  →  /admin

 To create this admin in PRODUCTION (your Vercel Atlas DB) instead:
   node scripts/createAdmin.js --prod --mongo-uri="<your Atlas URI>" \\
     --name="${name}" --email="${emailLower}" --password="********"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
