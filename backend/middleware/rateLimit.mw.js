const rateLimit = require("express-rate-limit");
const { RATE_LIMIT } = require("../config/constants");
const isProduction = process.env.NODE_ENV === "production";

const jsonMessage = (message) => ({
  success: false,
  message,
});

const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT.WINDOW_MS,
  limit: RATE_LIMIT.MAX_REQUESTS,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: jsonMessage("Too many requests. Please try again later."),
  // Add handler to log when rate limit is hit
  handler: (req, res) => {
    console.error(`\u26d4 RATE LIMIT HIT:`, {
      ip: req.ip,
      path: req.path,
      method: req.method,
      user: req.user?._id || "anonymous",
      timestamp: new Date().toISOString(),
    });
    res
      .status(429)
      .json(jsonMessage("Too many requests. Please try again later."));
  },
  // Skip function to exempt certain conditions
  skip: (req) => {
    // Skip rate limiting for health checks
    if (req.path === "/" || req.path === "/health") {
      return true;
    }
    return false;
  },
});

// Stricter limiter for auth endpoints (login/register/reset)
const authLimiter = rateLimit({
  windowMs: RATE_LIMIT.LOGIN_WINDOW_MS,
  limit: RATE_LIMIT.MAX_LOGIN_ATTEMPTS,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: jsonMessage(
    "Too many authentication attempts. Please try again later.",
  ),
  skip: () => !isProduction,
});

module.exports = {
  apiLimiter,
  authLimiter,
};
