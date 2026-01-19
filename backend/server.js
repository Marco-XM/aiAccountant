const express = require("express");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const { apiLimiter } = require("./middleware/rateLimit.mw");

/* Import Routes */
const authRoutes = require("./routes/authRoutes");
const geminiRoutes = require("./routes/geminiRoutes");
const excelRoutes = require("./routes/excelRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const aiExcelRoutes = require("./routes/aiExcelRoutes");
const chatbotRoutes = require("./routes/chatbotRoutes");
const chatRoutes = require("./routes/chatRoutes");
const chartRoutes = require("./routes/chartRoutes");

const app = express();
const PORT = process.env.PORT || process.env.HTTP_PORT || 5000;

// Behind proxies (Render/Heroku/Nginx), req.ip needs trust proxy for rate limiting.
app.set("trust proxy", 1);

// Database connection with error handling
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Database Connected Successfully"))
  .catch((err) => {
    console.error("❌ Failed to connect to database:", err.message);
    process.exit(1);
  });

// CORS configuration
const clientUrl = process.env.CLIENT_URL || process.env.CLIENT;

const allowedOrigins = clientUrl
  ? clientUrl
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean)
  : null;

const isProduction = process.env.NODE_ENV === "production";

const isLocalDevOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser clients (curl/postman) with no Origin header
      if (!origin) return callback(null, true);

      // If explicitly configured, only allow listed origins
      if (allowedOrigins) {
        if (allowedOrigins.includes(origin)) return callback(null, true);

        // Dev convenience: if you're developing locally, allow any localhost port
        // even when CLIENT/CLIENT_URL is set to a single localhost origin.
        if (!isProduction && isLocalDevOrigin(origin))
          return callback(null, true);

        return callback(null, false);
      }

      // Dev default: allow any localhost port (Vite may choose 5174, 5175, ...)
      return callback(null, isLocalDevOrigin(origin));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
    optionsSuccessStatus: 200,
  }),
);

app.use(helmet());
app.use(express.json({ limit: "1mb" }));

// Apply rate limiting selectively
app.use("/api", (req, res, next) => {
  // Disable rate limiting in development
  if (!isProduction) {
    console.log(
      `🔓 Rate limiting disabled (dev mode): ${req.method} ${req.path}`,
    );
    return next();
  }

  // Skip rate limiting for these operations in production
  const skipPaths = [
    "/api/transactions/upload",
    "/api/transactions/bulk",
    "/api/transactions/all",
  ];

  if (skipPaths.some((path) => req.path === path)) {
    return next();
  }

  apiLimiter(req, res, next);
});

// Use Routes
app.use("/api/auth", authRoutes);
app.use("/api", geminiRoutes);
app.use("/api/excel", excelRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/ai-excel", aiExcelRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/charts", chartRoutes);

app.get("/", (req, res) => {
  res.send("Backend is Working Correctly");
});

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Increase server timeout to 5 minutes for large file uploads with AI processing
server.timeout = 300000; // 5 minutes
server.keepAliveTimeout = 310000; // Slightly longer than timeout

module.exports = app;
