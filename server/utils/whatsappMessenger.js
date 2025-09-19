class WhatsAppMessenger {
  constructor() {
    this.isConnected = false;
    this.checkConnection();
  }

  checkConnection() {
    this.isConnected = global.whatsappSocket && global.whatsappSocket.user;
    return this.isConnected;
  }

  async sendMessage(to, message) {
    try {
      // Check connection
      if (!this.checkConnection()) {
        console.warn('⚠️ WhatsApp not connected, message not sent');
        return { success: false, error: 'WhatsApp not connected' };
      }

      // Format phone number
      let phoneNumber = to.toString().replace(/[^0-9]/g, '');
      
      // Add country code if not present
      if (phoneNumber.startsWith('0')) {
        phoneNumber = '62' + phoneNumber.substring(1);
      }
      if (!phoneNumber.startsWith('62')) {
        phoneNumber = '62' + phoneNumber;
      }

      // Format JID
      const jid = phoneNumber.includes('@') ? phoneNumber : phoneNumber + '@s.whatsapp.net';

      // Send directly via socket
      await global.whatsappSocket.sendMessage(jid, { text: message });

      console.log(`✅ WhatsApp message sent to ${phoneNumber}`);
      return { success: true, to: phoneNumber };
    } catch (error) {
      console.error('❌ Failed to send WhatsApp message:', error.message);
      return { success: false, error: error.message };
    }
  }

  async sendOTP(phoneNumber, otpCode) {
    const message = `🔐 *Password Reset OTP*\n\nYour OTP code is: *${otpCode}*\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this, please ignore this message.`;
    return this.sendMessage(phoneNumber, message);
  }

  async sendNotification(phoneNumber, title, content) {
    const message = `📢 *${title}*\n\n${content}`;
    return this.sendMessage(phoneNumber, message);
  }
}

// Export singleton instance
module.exports = new WhatsAppMessenger();
