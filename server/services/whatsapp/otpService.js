const { getWhatsAppClient } = require('./whatsappClient');

/**
 * Send OTP via WhatsApp
 * @param {string} phoneNumber - WhatsApp number (with country code)
 * @param {string} otp - OTP code
 * @param {string} type - OTP type (REGISTRATION, RESET_PASSWORD)
 * @returns {Promise<boolean>}
 */
async function sendOTP(phoneNumber, otp, type) {
  try {
    const client = getWhatsAppClient();
    
    if (!client || !client.isConnected) {
      console.error('WhatsApp not connected');
      return false;
    }

    // Ensure phone number has country code
    let formattedNumber = phoneNumber.replace(/\D/g, '');
    if (!formattedNumber.startsWith('62')) {
      formattedNumber = '62' + formattedNumber;
    }

    let message = '';
    
    switch(type) {
      case 'REGISTRATION':
        message = `🔐 *Kode OTP Registrasi Anda*\n\n` +
                  `Kode: *${otp}*\n\n` +
                  `Gunakan kode ini untuk menyelesaikan registrasi akun Anda.\n` +
                  `⏱️ Kode berlaku selama 10 menit.\n\n` +
                  `_Jangan bagikan kode ini kepada siapapun!_`;
        break;
        
      case 'RESET_PASSWORD':
        message = `🔓 *Kode OTP Reset Password*\n\n` +
                  `Kode: *${otp}*\n\n` +
                  `Gunakan kode ini untuk mereset password Anda.\n` +
                  `⏱️ Kode berlaku selama 10 menit.\n\n` +
                  `_Jika Anda tidak meminta reset password, abaikan pesan ini._`;
        break;
        
      case 'LOGIN_VERIFICATION':
        message = `🔐 *Kode Verifikasi Login*\n\n` +
                  `Kode: *${otp}*\n\n` +
                  `Gunakan kode ini untuk verifikasi login.\n` +
                  `⏱️ Kode berlaku selama 10 menit.\n\n` +
                  `_Jangan bagikan kode ini kepada siapapun!_`;
        break;
        
      default:
        message = `Kode OTP Anda: *${otp}*\n\n` +
                  `Kode berlaku selama 10 menit.`;
    }

    const jid = formattedNumber + '@s.whatsapp.net';
    
    // Send message
    const result = await client.sendMessage(jid, message);
    
    if (result) {
      console.log(`OTP sent successfully to ${phoneNumber}`);
      return true;
    } else {
      console.error(`Failed to send OTP to ${phoneNumber}`);
      return false;
    }
  } catch (error) {
    console.error('Error sending OTP:', error);
    return false;
  }
}

/**
 * Send welcome message after successful registration
 * @param {string} phoneNumber - WhatsApp number
 * @param {string} name - User name
 * @param {string} username - Username for login
 */
async function sendWelcomeMessage(phoneNumber, name, username) {
  try {
    const client = getWhatsAppClient();
    
    if (!client || !client.isConnected) {
      console.error('WhatsApp not connected');
      return false;
    }

    // Format phone number
    let formattedNumber = phoneNumber.replace(/\D/g, '');
    if (!formattedNumber.startsWith('62')) {
      formattedNumber = '62' + formattedNumber;
    }

    const message = `🎉 *Selamat Datang, ${name}!*\n\n` +
                    `Akun Anda telah berhasil dibuat.\n\n` +
                    `📝 *Detail Akun:*\n` +
                    `Username: ${username}\n` +
                    `WhatsApp: ${phoneNumber}\n\n` +
                    `Anda sekarang dapat login menggunakan username dan password Anda.\n\n` +
                    `_Terima kasih telah bergabung dengan kami!_`;

    const jid = formattedNumber + '@s.whatsapp.net';
    
    await client.sendMessage(jid, message);
    return true;
  } catch (error) {
    console.error('Error sending welcome message:', error);
    return false;
  }
}

/**
 * Send password reset success notification
 * @param {string} phoneNumber - WhatsApp number
 * @param {string} name - User name
 */
async function sendPasswordResetSuccess(phoneNumber, name) {
  try {
    const client = getWhatsAppClient();
    
    if (!client || !client.isConnected) {
      console.error('WhatsApp not connected');
      return false;
    }

    // Format phone number
    let formattedNumber = phoneNumber.replace(/\D/g, '');
    if (!formattedNumber.startsWith('62')) {
      formattedNumber = '62' + formattedNumber;
    }

    const message = `✅ *Password Berhasil Direset*\n\n` +
                    `Halo ${name},\n\n` +
                    `Password Anda telah berhasil direset.\n` +
                    `Anda sekarang dapat login menggunakan password baru Anda.\n\n` +
                    `_Jika Anda tidak melakukan reset password ini, segera hubungi administrator._`;

    const jid = formattedNumber + '@s.whatsapp.net';
    
    await client.sendMessage(jid, message);
    return true;
  } catch (error) {
    console.error('Error sending password reset success:', error);
    return false;
  }
}

module.exports = {
  sendOTP,
  sendWelcomeMessage,
  sendPasswordResetSuccess
};
