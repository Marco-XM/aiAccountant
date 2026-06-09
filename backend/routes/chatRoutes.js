const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.mw');
const Chat = require('../models/Chat');
const mongoose = require('mongoose');
const { isMongoObjectId } = require('../services/userIdentity');
const localChatStore = require('../services/localChatStore');

const isDatabaseReady = () => mongoose.connection.readyState === 1;
const canUseMongoChat = (userId) => isDatabaseReady() && isMongoObjectId(userId);

// Get all chat sessions for user
router.get('/sessions', authMiddleware, async (req, res) => {
  try {
    if (!canUseMongoChat(req.user._id)) {
      const sessions = await localChatStore.getSessions(req.user._id);
      return res.json(sessions);
    }

    const chats = await Chat.find({ userId: req.user._id })
      .sort({ updatedAt: -1 })
      .select('title createdAt updatedAt messages')
      .lean();
    
    res.json(chats);
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    res.status(500).json({ error: 'Failed to fetch chat sessions' });
  }
})

// Get a specific chat session
router.get('/sessions/:id', authMiddleware, async (req, res) => {
  try {
    if (!canUseMongoChat(req.user._id)) {
      const session = await localChatStore.getSession(req.params.id, req.user._id);
      if (!session) return res.status(404).json({ error: 'Chat not found' });
      return res.json(session);
    }

    const chat = await Chat.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    res.json(chat);
  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
})

// Create new chat session
router.post('/sessions', authMiddleware, async (req, res) => {
  try {
    if (!canUseMongoChat(req.user._id)) {
      const session = await localChatStore.createSession(req.user._id, req.body.title);
      return res.json(session);
    }

    const { title } = req.body;
    
    const chat = new Chat({
      userId: req.user._id,
      title: title || 'New Chat',
      messages: []
    });
    
    await chat.save();
    res.json(chat);
  } catch (error) {
    console.error('Error creating chat:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
})

// Update chat session (save messages)
router.put('/sessions/:id', authMiddleware, async (req, res) => {
  try {
    if (!canUseMongoChat(req.user._id)) {
      const session = await localChatStore.updateSession(req.params.id, req.user._id, req.body);
      if (!session) return res.status(404).json({ error: 'Chat not found' });
      return res.json(session);
    }

    const { messages, title, suggestedQuestions } = req.body;
    
    const chat = await Chat.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    if (messages) chat.messages = messages;
    if (title) chat.title = title;
    if (suggestedQuestions) chat.suggestedQuestions = suggestedQuestions;
    
    await chat.save();
    res.json(chat);
  } catch (error) {
    console.error('Error updating chat:', error);
    res.status(500).json({ error: 'Failed to update chat' });
  }
});

// Delete chat session
router.delete('/sessions/:id', authMiddleware, async (req, res) => {
  try {
    if (!canUseMongoChat(req.user._id)) {
      const removed = await localChatStore.deleteSession(req.params.id, req.user._id);
      if (!removed) return res.status(404).json({ error: 'Chat not found' });
      return res.json({ message: 'Chat deleted successfully' });
    }

    const chat = await Chat.findOneAndDelete({ 
      _id: req.params.id, 
      userId: req.user._id 
    });
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    res.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

module.exports = router;
