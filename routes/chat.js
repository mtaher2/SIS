const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../utils/auth');
const axios = require('axios');

// Apply authentication middleware to all chat routes
router.use(isAuthenticated);

// Chat endpoint
router.post('/', async (req, res) => {
  try {
    const response = await axios.post('http://localhost:5005/chat', {
      question: req.body.question
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Chatbot error:', error);
    res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});

module.exports = router; 