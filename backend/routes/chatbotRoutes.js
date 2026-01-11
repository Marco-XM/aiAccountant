const express = require('express');
const authMiddleware = require('../middleware/auth.mw');
const { chat } = require('../controllers/chatbotController');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// POST /api/chatbot/chat - Send a message to the chatbot
router.post('/chat', chat);

module.exports = router;
