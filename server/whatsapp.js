/**
 * Main WhatsApp Module
 * Exports WhatsApp functionality for server routes
 */

const fs = require('fs');
const path = require('path');

class WhatsApp {
  constructor() {
    this.isConnected = false;
    this.messageQueue = [];
    this.checkConnection();
  }

  checkConnection() {
    const sessionPath = path.join(__dirname, 'auth_info_baileys');
    this.isConnected = fs.existsSync(sessionPath) && fs.readdirSync(sessionPath).length > 0;
    return this.isConnected;
  }

  async sendMessage(to, message) {
    try {
      // Format phone number
      const formattedNumber = this.formatPhoneNumber(to);
      
      // Write message to test-message.json for the bot to pick up
      const messageData = {
        to: formattedNumber,
        message,
        timestamp: new Date().toISOString(),
        type: 'outgoing'
      };
      
      const testMessagePath = path.join(__dirname, '../scripts/test-message.json');
      
      // Write the message
      fs.writeFileSync(testMessagePath, JSON.stringify(messageData, null, 2));
      
      return {
        success: true,
        messageId: Date.now().toString()
      };
    } catch (error) {
      console.error('Failed to send WhatsApp message:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendJobNotification(technicianPhone, job) {
    const message = `🔔 *New Job Available*\n\n` +
      `📋 Job ID: ${job.jobNumber || job.id}\n` +
      `👤 Customer: ${job.customer?.name || 'N/A'}\n` +
      `📍 Location: ${job.location || 'N/A'}\n` +
      `🔧 Type: ${job.type || 'N/A'}\n\n` +
      `Type /ambil ${job.jobNumber || job.id} to take this job`;
    
    return this.sendMessage(technicianPhone, message);
  }

  async sendJobAssignmentNotification(technicianPhone, job) {
    const message = `✅ *Job Assigned*\n\n` +
      `You have been assigned job #${job.jobNumber || job.id}\n` +
      `Customer: ${job.customer?.name || 'N/A'}\n` +
      `Location: ${job.location || 'N/A'}\n\n` +
      `Type /mulai ${job.jobNumber || job.id} when you start working`;
    
    return this.sendMessage(technicianPhone, message);
  }

  async sendJobCompletionNotification(adminPhone, job, technician) {
    const message = `✅ *Job Completed*\n\n` +
      `Job #${job.jobNumber || job.id} has been completed\n` +
      `Technician: ${technician?.name || 'N/A'}\n` +
      `Customer: ${job.customer?.name || 'N/A'}\n` +
      `Completed at: ${new Date().toLocaleString()}`;
    
    return this.sendMessage(adminPhone, message);
  }

  formatPhoneNumber(phone) {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Add country code if not present
    if (!cleaned.startsWith('62')) {
      if (cleaned.startsWith('0')) {
        cleaned = '62' + cleaned.substring(1);
      } else {
        cleaned = '62' + cleaned;
      }
    }
    
    // Add @s.whatsapp.net suffix
    return cleaned + '@s.whatsapp.net';
  }

  async broadcastMessage(numbers, message) {
    const results = [];
    for (const number of numbers) {
      const result = await this.sendMessage(number, message);
      results.push({ number, ...result });
      // Small delay between messages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return results;
  }
}

module.exports = new WhatsApp();
