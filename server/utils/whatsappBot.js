/**
 * WhatsApp Bot Utility
 * Provides access to the WhatsApp bot instance for sending messages
 */

let whatsappBotInstance = null;

/**
 * Set WhatsApp bot instance
 * @param {Object} botInstance - WhatsApp bot instance
 */
function setWhatsAppBot(botInstance) {
  whatsappBotInstance = botInstance;
}

/**
 * Get WhatsApp bot instance
 * @returns {Object|null} WhatsApp bot instance
 */
function getWhatsAppBot() {
  return whatsappBotInstance;
}

/**
 * Check if WhatsApp bot is available
 * @returns {boolean} True if bot is available
 */
function isWhatsAppBotAvailable() {
  return whatsappBotInstance && whatsappBotInstance.sendMessage;
}

/**
 * Send message via WhatsApp bot
 * @param {string} jid - WhatsApp JID
 * @param {Object} message - Message object
 * @returns {Promise} Send result
 */
async function sendWhatsAppMessage(jid, message) {
  if (!isWhatsAppBotAvailable()) {
    throw new Error('WhatsApp bot not available');
  }
  
  return await whatsappBotInstance.sendMessage(jid, message);
}

module.exports = {
  setWhatsAppBot,
  getWhatsAppBot,
  isWhatsAppBotAvailable,
  sendWhatsAppMessage
};
