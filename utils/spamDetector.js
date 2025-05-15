const axios = require('axios');

// Configuration for spam detector API
const SPAM_DETECTOR_API = 'http://127.0.0.1:5000/api';

/**
 * Predicts if a message is spam or not
 * @param {string} message - The message to classify
 * @returns {Promise<{isSpam: boolean, confidence: number}>} - Prediction result
 */
async function classifyMessage(message) {
    try {
        const response = await axios.post(`${SPAM_DETECTOR_API}/predict`, { message });
        
        return {
            isSpam: response.data.is_spam,
            confidence: response.data.confidence
        };
    } catch (error) {
        console.error('Error classifying message:', error.message);
        // Return a default value indicating it's not spam with low confidence
        return { isSpam: false, confidence: 0 };
    }
}

/**
 * Checks if the spam detector service is available
 * @returns {Promise<boolean>} - True if service is available
 */
async function isServiceAvailable() {
    try {
        await axios.get(`${SPAM_DETECTOR_API}/health`);
        return true;
    } catch (error) {
        console.error('Spam detection service is not available:', error.message);
        return false;
    }
}

module.exports = {
    classifyMessage,
    isServiceAvailable
}; 