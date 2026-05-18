const mongoose = require("mongoose");
const { URL } = require("url");

const createMongoHealth = () => ({
  status: "disconnected",
  phase: "idle",
  source: null,
  host: null,
  database: null,
  attempts: 0,
  lastError: null,
  lastErrorType: null,
  connectedAt: null,
});

const mongoHealth = createMongoHealth();

const getEnv = () => ({
  primary: process.env.MONGODB_URI || process.env.MONGO_URI || "",
  fallback:
    process.env.MONGODB_FALLBACK_URI ||
    (!process.env.NODE_ENV || process.env.NODE_ENV === "development"
      ? "mongodb://127.0.0.1:27017/ai-accountant"
      : ""),
});

const sanitizeMongoUri = (uri) => {
  if (!uri) return { host: null, database: null, protocol: null };

  try {
    const parsed = new URL(uri);
    return {
      protocol: parsed.protocol.replace(":", ""),
      host: parsed.hostname || null,
      port: parsed.port || null,
      database: parsed.pathname ? parsed.pathname.replace(/^\//, "") || null : null,
    };
  } catch {
    const match = uri.match(/^mongodb(?:\+srv)?:\/\/(?:[^@]+@)?([^\/\?]+)(?:\/([^\?]*))?/i);
    return {
      protocol: uri.startsWith("mongodb+srv://") ? "mongodb+srv" : uri.startsWith("mongodb://") ? "mongodb" : null,
      host: match?.[1] || null,
      port: null,
      database: match?.[2] || null,
    };
  }
};

const classifyMongoError = (error) => {
  const message = String(error?.message || "");
  const code = String(error?.code || "");

  if (/querysrv|eai_again|enotfound|dns/i.test(message) || ["ENOTFOUND", "EAI_AGAIN"].includes(code)) {
    return "dns";
  }

  if (/auth|authentication|sasl|unauthorized/i.test(message) || code === "18") {
    return "auth";
  }

  if (/timed out|server selection timed out|connect timeout|socket timeout/i.test(message) || ["ETIMEDOUT", "ECONNREFUSED"].includes(code)) {
    return "timeout";
  }

  return "unknown";
};

const logHints = (type) => {
  if (type === "dns") {
    console.error("   Hints: verify internet/DNS, confirm the Atlas SRV record, and check any VPN or firewall filtering DNS.");
  } else if (type === "auth") {
    console.error("   Hints: verify credentials, URL-encoding for the password, and that the MongoDB user has access to the target database.");
  } else {
    console.error("   Hints: whitelist your IP in Atlas, confirm the cluster is healthy, and check whether a local MongoDB instance is reachable.");
  }
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const connectOne = async ({ uri, label, attempt, totalAttempts }) => {
  const details = sanitizeMongoUri(uri);
  mongoHealth.phase = "connecting";
  mongoHealth.source = label;
  mongoHealth.host = details.host;
  mongoHealth.database = details.database;
  mongoHealth.attempts = mongoHealth.attempts + 1;

  console.log(
    `[mongo] phase=connecting source=${label} attempt=${attempt}/${totalAttempts} host=${details.host || "unknown"} db=${details.database || "default"}`,
  );

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS) || 5000,
    socketTimeoutMS: Number(process.env.MONGODB_SOCKET_TIMEOUT_MS) || 45000,
    connectTimeoutMS: Number(process.env.MONGODB_CONNECT_TIMEOUT_MS) || 5000,
  });

  mongoHealth.status = "connected";
  mongoHealth.phase = "connected";
  mongoHealth.connectedAt = new Date().toISOString();
  mongoHealth.lastError = null;
  mongoHealth.lastErrorType = null;

  console.log(
    `[mongo] phase=connected source=${label} host=${details.host || "unknown"} db=${details.database || "default"}`,
  );
};

const validateIndexes = async () => {
  const modelNames = mongoose.modelNames();
  if (!modelNames.length) {
    return;
  }

  console.log(`[mongo] phase=index-validation models=${modelNames.length}`);
  await Promise.all(modelNames.map((name) => mongoose.model(name).init()));
  console.log(`[mongo] phase=index-validation status=ok`);
};

const connectMongoDatabase = async () => {
  const { primary, fallback } = getEnv();
  const allowDegradedMode = process.env.ALLOW_DEGRADED_MODE === "true";
  const isProduction = process.env.NODE_ENV === "production";
  const retryAttempts = Math.max(1, Number(process.env.MONGODB_RETRY_ATTEMPTS) || 3);
  const retryBaseDelayMs = Math.max(100, Number(process.env.MONGODB_RETRY_BASE_DELAY_MS) || 500);

  const candidates = [];
  if (primary) candidates.push({ uri: primary, label: "primary" });
  if (fallback && fallback !== primary) candidates.push({ uri: fallback, label: "fallback" });

  if (!candidates.length) {
    mongoHealth.status = "missing-config";
    mongoHealth.phase = "config";
    const error = new Error("No MongoDB connection string configured. Set MONGODB_URI or MONGO_URI.");
    mongoHealth.lastError = error.message;
    mongoHealth.lastErrorType = "config";
    throw error;
  }

  let lastError = null;

  for (const candidate of candidates) {
    for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
      try {
        await connectOne({
          uri: candidate.uri,
          label: candidate.label,
          attempt,
          totalAttempts: retryAttempts,
        });
        await validateIndexes();
        return mongoHealth;
      } catch (error) {
        lastError = error;
        const errorType = classifyMongoError(error);
        mongoHealth.status = "error";
        mongoHealth.phase = "retrying";
        mongoHealth.lastError = error.message;
        mongoHealth.lastErrorType = errorType;
        mongoHealth.host = sanitizeMongoUri(candidate.uri).host;
        mongoHealth.database = sanitizeMongoUri(candidate.uri).database;

        console.error(
          `[mongo] phase=failed source=${candidate.label} attempt=${attempt}/${retryAttempts} host=${mongoHealth.host || "unknown"} type=${errorType} message=${error.message}`,
        );
        logHints(errorType);

        if (attempt < retryAttempts) {
          const delayMs = retryBaseDelayMs * 2 ** (attempt - 1);
          console.log(`[mongo] phase=backoff source=${candidate.label} delayMs=${delayMs}`);
          await wait(delayMs);
        }
      }
    }
  }

  mongoHealth.status = allowDegradedMode ? "degraded" : "unavailable";
  mongoHealth.phase = allowDegradedMode ? "degraded" : "failed";

  if (allowDegradedMode) {
    console.warn("[mongo] phase=degraded backend will start without MongoDB because ALLOW_DEGRADED_MODE=true");
    return mongoHealth;
  }

  const finalError = new Error(`Unable to connect to MongoDB after ${candidates.length * retryAttempts} attempts.`);
  finalError.cause = lastError;
  throw finalError;
};

const getMongoHealth = () => ({ ...mongoHealth });

const getRedisHealth = () => {
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI || "";
  if (!redisUrl) {
    return { configured: false, status: "not_configured" };
  }

  return {
    configured: true,
    status: "not_connected",
    host: sanitizeMongoUri(redisUrl).host,
  };
};

module.exports = {
  connectMongoDatabase,
  getMongoHealth,
  getRedisHealth,
};