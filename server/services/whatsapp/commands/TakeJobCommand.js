/**
 * Take Job Command - Take/assign a job
 */

const BaseCommand = require('./BaseCommand');

class TakeJobCommand extends BaseCommand {
  constructor() {
    super('ambil', {
      description: 'Ambil pekerjaan yang tersedia',
      usage: '/ambil [nomor_job]',
      aliases: ['take', 'assign'],
      rateLimit: {
        windowMs: 120000, // 2 minutes
        maxRequests: 5, // 5 requests per 2 minutes
        blockDuration: 300000 // 5 minutes block
      }
    });
  }

  async execute(userJid, args, context = {}) {
    try {
      const phoneNumber = userJid.split('@')[0];
      
      // Check if technician is registered
      const isRegistered = await this.checkTechnicianRegistration(phoneNumber);
      if (!isRegistered) {
        return this.formatError(
          'Anda belum terdaftar sebagai teknisi.\n\n' +
          'Gunakan /daftar [nama] untuk mendaftar terlebih dahulu.'
        );
      }

      // Get job number from args or session
      let jobNumber;
      if (args.length > 0) {
        jobNumber = args[0];
      } else {
        // Try to get from session
        const session = context.session;
        if (session && session.currentJob) {
          jobNumber = session.currentJob.jobNumber;
        } else {
          return this.formatError(
            'Nomor pekerjaan harus disertakan.\n\n' +
            'Contoh: /ambil PSB-1234-0001\n\n' +
            'Atau gunakan /pekerjaan untuk melihat pekerjaan tersedia.'
          );
        }
      }

      // Validate job number
      if (!jobNumber || jobNumber.length < 5) {
        return this.formatError(
          'Nomor pekerjaan tidak valid.\n\n' +
          'Format: PSB-1234-0001 atau GANGGUAN-1234-0001'
        );
      }

      // Try to assign job
      const result = await this.assignJob(jobNumber, phoneNumber);
      
      if (result.success) {
        // Update session
        const job = await this.getJobDetails(jobNumber);
        if (job) {
          // Update session with current job
          if (context.sessionManager) {
            context.sessionManager.updateSession(userJid, {
              currentJob: job,
              lastAction: 'take',
              lastActionTime: new Date()
            });
          }
        }

        return this.formatSuccess(
          `✅ *Pekerjaan Berhasil Diambil!*\n\n` +
          `🎫 Tiket: ${jobNumber}\n` +
          `👤 Teknisi: ${phoneNumber}\n` +
          `📅 Diambil: ${new Date().toLocaleString('id-ID')}\n\n` +
          `🎯 *Langkah Selanjutnya:*\n` +
          `1️⃣ Pergi ke lokasi pelanggan\n` +
          `2️⃣ Gunakan /mulai ${jobNumber} saat mulai bekerja\n` +
          `3️⃣ Gunakan /selesai ${jobNumber} saat selesai\n\n` +
          `💡 *Tips:*\n` +
          `- Pastikan Anda sudah di lokasi sebelum memulai\n` +
          `- Hubungi pelanggan jika diperlukan\n` +
          `- Gunakan /batal ${jobNumber} jika tidak bisa melanjutkan`
        );
      } else {
        return this.formatError(
          `❌ *Gagal Mengambil Pekerjaan*\n\n` +
          `Alasan: ${result.message}\n\n` +
          `💡 *Kemungkinan penyebab:*\n` +
          `- Pekerjaan sudah diambil teknisi lain\n` +
          `- Pekerjaan sudah selesai atau dibatalkan\n` +
          `- Nomor pekerjaan tidak ditemukan\n\n` +
          `🔍 *Coba:*\n` +
          `/pekerjaan - Lihat pekerjaan tersedia\n` +
          `/pekerjaanku - Lihat pekerjaan saya`
        );
      }

    } catch (error) {
      return this.formatError(
        'Terjadi kesalahan saat mengambil pekerjaan. Silakan coba lagi.'
      );
    }
  }

  async checkTechnicianRegistration(phoneNumber) {
    try {
      const db = require('../../whatsapp/consolidated/BotDatabaseService');
      return await db.checkExistingTechnician(phoneNumber);
    } catch (error) {
      console.error('Error checking technician registration:', error);
      return false;
    }
  }

  async assignJob(jobNumber, phoneNumber) {
    try {
      const db = require('../../whatsapp/consolidated/BotDatabaseService');
      return await db.assignJobToTechnician(jobNumber, phoneNumber);
    } catch (error) {
      console.error('Error assigning job:', error);
      return { success: false, message: 'Database error' };
    }
  }

  async getJobDetails(jobNumber) {
    try {
      const db = require('../../whatsapp/consolidated/BotDatabaseService');
      return await db.getJobByNumber(jobNumber);
    } catch (error) {
      console.error('Error getting job details:', error);
      return null;
    }
  }
}

module.exports = TakeJobCommand;
