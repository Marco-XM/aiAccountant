const jwt = require("jsonwebtoken");

// Ensure JWT_SECRET is set
if (!process.env.JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not defined.");
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");
    const queryToken = req.query?.token;
    const bearerToken = authHeader ? authHeader.replace("Bearer ", "") : "";
    const token = bearerToken || queryToken;

    if (!authHeader && !queryToken) {
      return res
        .status(401)
        .json({ message: "Access Denied. No authorization header provided." });
    }

    if (!token) {
      return res
        .status(401)
        .json({ message: "Access Denied. No token provided." });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    // Tokens are signed with `_id` (see authController.signToken). Expose both
    // `_id` and `id` so controllers can use either convention consistently.
    req.user = { ...decoded, id: decoded._id || decoded.id, _id: decoded._id || decoded.id };
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ message: "Token expired. Please login again." });
    }
    console.error("Token verification error:", err.message);
    res.status(401).json({ message: "Invalid token." });
  }
};

module.exports = authMiddleware;
