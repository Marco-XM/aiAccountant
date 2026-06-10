const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

const adminAuth = (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");
    const token = authHeader ? authHeader.replace("Bearer ", "") : "";

    if (!token) {
      return res.status(401).json({ message: "Admin access denied. No token." });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded.isAdmin) {
      return res.status(403).json({ message: "Forbidden. Admin access required." });
    }

    // Expose both `_id` and `id` (tokens are signed with `_id`).
    req.user = { ...decoded, id: decoded._id || decoded.id, _id: decoded._id || decoded.id };
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired. Please log in again." });
    }
    return res.status(401).json({ message: "Invalid token." });
  }
};

module.exports = adminAuth;
