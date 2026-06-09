// Vercel serverless entry point.
// Sets VERCEL=1 before requiring server.js so that server.js
// does NOT call app.listen() — Vercel handles the HTTP listener.
process.env.VERCEL = "1";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { connectMongoDatabase } = require("../services/mongoBootstrap");

// Kick off DB connection once per cold start (non-blocking).
// Requests will degrade gracefully if MongoDB is still warming up.
connectMongoDatabase().catch((err) =>
  console.error("[vercel] MongoDB connection error:", err.message)
);

module.exports = require("../server");
