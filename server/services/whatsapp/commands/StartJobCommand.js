/**
 * Start Job Command - Start working on a job
 */

const BaseCommand = require('./BaseCommand');

class StartJobCommand extends BaseCommand {
  constructor() {
    super('mulai', {
      description: 'Mulai bekerja pada pekerjaan',
      usage: '/mulai [nomor_job]',
      aliases: ['start', 'begin'],
      rateLimit: {
        windowMs: 120000, // 2 minutes
        maxRequests: 10, // 10 requests per 2 minutes
        blockDuration: 180000 // 3 minutes block
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
            'Contoh: /mulai PSB-1234-0001\n\n' +
            'Atau gunakan /myjobs untuk melihat pekerjaan yang diambil.'
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

      // Try to start job
      const result = await this.startJob(jobNumber, phoneNumber);
      
      if (result.success) {
        // Update session
        const job = await this.getJobDetails(jobNumber);
        if (job) {
          // Update session with current job
          if (context.sessionManager) {
            context.sessionManager.updateSession(userJid, {
              currentJob: job,
              lastAction: 'start',
              lastActionTime: new Date()
            });
          }
        }

        return this.formatSuccess(
          `🚀 *Pekerjaan Dimulai!*\n\n` +
          `🎫 Tiket: ${jobNumber}\n` +
          `👤 Teknisi: ${phoneNumber}\n` +
          `📅 Dimulai: ${new Date().toLocaleString('id-ID')}\n\n` +
          `🎯 *Status:* Sedang Berjalan\n\n` +
          `📋 *Langkah Selanjutnya:*\n` +
          `1️⃣ Lakukan perbaikan/pemasangan\n` +
          `2️⃣ Test koneksi jika diperlukan\n` +
          `3️⃣ Gunakan /selesai ${jobNumber} saat selesai\n\n` +
          `💡 *Tips:*\n` +
          `- Catat detail pekerjaan yang dilakukan\n` +
          `- Ambil foto jika diperlukan\n` +
          `- Pastikan pelanggan puas dengan hasil`
        );
      } else {
        return this.formatError(
          `❌ *Gagal Memulai Pekerjaan*\n\n` +
          `Alasan: ${result.message}\n\n` +
          `💡 *Kemungkinan penyebab:*\n` +
          `- Pekerjaan belum diambil (gunakan /ambil terlebih dahulu)\n` +
          `- Pekerjaan sudah dimulai atau selesai\n` +
          `- Anda bukan teknisi yang ditugaskan\n` +
          `- Nomor pekerjaan tidak ditemukan\n\n` +
          `🔍 *Coba:*\n` +
          `/myjobs - Lihat pekerjaan yang diambil\n` +
          `/ambil ${jobNumber} - Ambil pekerjaan terlebih dahulu`
        );
      }

    } catch (error) {
      return this.formatError(
        'Terjadi kesalahan saat memulai pekerjaan. Silakan coba lagi.'
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

  async startJob(jobNumber, phoneNumber) {
    try {
      const db = require('../../whatsapp/consolidated/BotDatabaseService');
      return await db.startJob(jobNumber, phoneNumber);
    } catch (error) {
      console.error('Error starting job:', error);
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

module.exports = StartJobCommand;
