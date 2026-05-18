const express = require("express");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { randomUUID } = require("crypto");
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
const aiChartsRoutes = require("./routes/aiChartsRoutes");
const excelEditorRoutes = require("./routes/excelEditorRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const {
  connectMongoDatabase,
  getMongoHealth,
  getRedisHealth,
} = require("./services/mongoBootstrap");

const app = express();
const PORT = process.env.PORT || process.env.HTTP_PORT || 5000;
const isProduction = process.env.NODE_ENV === "production";

// Behind proxies (Render/Heroku/Nginx), req.ip needs trust proxy for rate limiting.
app.set("trust proxy", 1);

// CORS configuration
const clientUrl = process.env.CLIENT_URL || process.env.CLIENT;

const allowedOrigins = clientUrl
  ? clientUrl
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean)
  : null;

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
app.use(express.json({ limit: "25mb" }));

app.use((req, res, next) => {
  const requestId = String(req.headers["x-request-id"] || randomUUID());
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  const startedAt = process.hrtime.bigint();
  let responseBytes = 0;
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    try {
      responseBytes = Buffer.byteLength(JSON.stringify(body ?? {}), "utf8");
    } catch {
      responseBytes = 0;
    }
    return originalJson(body);
  };

  console.log(`[http] requestId=${requestId} phase=incoming method=${req.method} route=${req.originalUrl}`);

  res.on("finish", () => {
    const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const contentLength = responseBytes || Number(res.getHeader("content-length") || 0);
    console.log(
      `[http] requestId=${requestId} phase=finished method=${req.method} route=${req.originalUrl} statusCode=${res.statusCode} latencyMs=${latencyMs.toFixed(1)} responseBytes=${contentLength}`,
    );
  });

  next();
});

app.use((req, res, next) => {
  if (req.originalUrl.startsWith("/api")) {
    console.log(`➡️ ${req.method} ${req.originalUrl}`);
  }
  next();
});

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
app.use("/api/excel", excelEditorRoutes);
app.use("/api/excel", excelRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/ai-excel", aiExcelRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/charts", chartRoutes);
app.use("/api/ai-charts", aiChartsRoutes);

app.get("/", (req, res) => {
  res.send("Backend is Working Correctly");
});

app.get("/health", (req, res) => {
  const mongoHealth = getMongoHealth();
  const redisHealth = getRedisHealth();
  const healthy = mongoHealth.status === "connected";

  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : mongoHealth.status,
    environment: process.env.NODE_ENV || "development",
    uptimeSeconds: Math.round(process.uptime()),
    database: mongoHealth,
    redis: redisHealth,
    memoryUsage: process.memoryUsage(),
  });
});

app.use((err, req, res, next) => {
  const statusCode = Number(err.status || err.statusCode || 500);
  const errorCode = err.code || err.name || "INTERNAL_SERVER_ERROR";
  const isProductionMode = process.env.NODE_ENV === "production";

  console.error(
    `[http] requestId=${req.requestId || "unknown"} phase=error method=${req.method} route=${req.originalUrl} statusCode=${statusCode} errorCode=${errorCode} message=${err.message}`,
  );
  if (err.stack) {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    error: errorCode,
    message: err.message || "Internal server error",
    requestId: req.requestId || null,
    ...(isProductionMode ? {} : { stack: err.stack }),
  });
});

process.on("unhandledRejection", (reason) => {
  console.error("[process] unhandledRejection", reason);
  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }
});

process.on("uncaughtException", (error) => {
  console.error("[process] uncaughtException", error);
  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }
});

const bootstrap = async () => {
  try {
    console.log("[startup] phase=env-loaded");
    await connectMongoDatabase();

    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

    // Increase server timeout to 5 minutes for large file uploads with AI processing
    server.timeout = 300000; // 5 minutes
    server.keepAliveTimeout = 310000; // Slightly longer than timeout
  } catch (error) {
    console.error("[startup] phase=failed", error.message);
    process.exit(1);
  }
};

bootstrap();

module.exports = app;
