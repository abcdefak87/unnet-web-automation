/**
 * Register Command - Register as technician
 */

const BaseCommand = require('./BaseCommand');

class RegisterCommand extends BaseCommand {
  constructor() {
    super('daftar', {
      description: 'Daftar sebagai teknisi',
      usage: '/daftar [nama]',
      aliases: ['register', 'reg'],
      rateLimit: {
        windowMs: 300000, // 5 minutes
        maxRequests: 3, // 3 attempts per 5 minutes
        blockDuration: 600000 // 10 minutes block
      }
    });
  }

  async execute(userJid, args, context = {}) {
    try {
      // Validate arguments
      if (args.length < 1) {
        return this.formatError(
          'Nama harus disertakan.\n\nContoh: /daftar John Doe'
        );
      }

      const name = args[0];
      
      // Validate name
      if (name.length < 2 || name.length > 50) {
        return this.formatError(
          'Nama harus 2-50 karakter.'
        );
      }

      // Extract phone number from JID
      const phoneNumber = userJid.split('@')[0];
      
      // Check if already registered
      const existingTechnician = await this.checkExistingTechnician(phoneNumber);
      if (existingTechnician) {
        return this.formatError(
          'Nomor ini sudah terdaftar sebagai teknisi.\n\n' +
          'Gunakan /myjobs untuk melihat pekerjaan Anda.'
        );
      }

      // Register technician
      const result = await this.registerTechnician(phoneNumber, name);
      
      if (result.success) {
        return this.formatSuccess(
          `✅ *Registrasi Berhasil!*\n\n` +
          `👤 Nama: ${name}\n` +
          `📱 WhatsApp: ${phoneNumber}\n\n` +
          `🎉 Selamat bergabung sebagai teknisi!\n\n` +
          `📋 *Perintah yang tersedia:*\n` +
          `/jobs - Lihat pekerjaan tersedia\n` +
          `/myjobs - Lihat pekerjaan saya\n` +
          `/stats - Lihat statistik\n\n` +
          `💡 *Tips:*\n` +
          `- Anda akan menerima notifikasi pekerjaan baru\n` +
          `- Gunakan tombol interaktif untuk aksi cepat\n` +
          `- Ketik /menu untuk melihat semua perintah`
        );
      } else {
        return this.formatError(
          `Gagal mendaftar: ${result.message}\n\n` +
          'Silakan coba lagi atau hubungi administrator.'
        );
      }

    } catch (error) {
      return this.formatError(
        'Terjadi kesalahan saat registrasi. Silakan coba lagi.'
      );
    }
  }

  async checkExistingTechnician(phoneNumber) {
    try {
      const db = require('../../whatsapp/consolidated/BotDatabaseService');
      return await db.checkExistingTechnician(phoneNumber);
    } catch (error) {
      console.error('Error checking existing technician:', error);
      return false;
    }
  }

  async registerTechnician(phoneNumber, name) {
    try {
      const db = require('../../whatsapp/consolidated/BotDatabaseService');
      return await db.registerTechnician(phoneNumber, name);
    } catch (error) {
      console.error('Error registering technician:', error);
      return { success: false, message: 'Database error' };
    }
  }
}

module.exports = RegisterCommand;
