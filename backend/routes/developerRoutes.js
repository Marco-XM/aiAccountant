const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.mw");
const asyncHandler = require("../middleware/asyncHandler");
const {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  updateApiKey,
  listScopes,
} = require("../controllers/developerController");

// All developer-key routes require a logged-in user (JWT)
router.use(authMiddleware);

router.get("/scopes", asyncHandler(listScopes));
router.get("/keys", asyncHandler(listApiKeys));
router.post("/keys", asyncHandler(createApiKey));
router.patch("/keys/:id", asyncHandler(updateApiKey));
router.delete("/keys/:id", asyncHandler(revokeApiKey));

module.exports = router;
