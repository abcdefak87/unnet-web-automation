/**
 * Complete Job Command - Complete a job
 */

const BaseCommand = require('./BaseCommand');

class CompleteJobCommand extends BaseCommand {
  constructor() {
    super('selesai', {
      description: 'Selesaikan pekerjaan',
      usage: '/selesai [nomor_job] [catatan]',
      aliases: ['complete', 'finish', 'done'],
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
            'Contoh: /selesai PSB-1234-0001\n\n' +
            'Atau gunakan /myjobs untuk melihat pekerjaan yang sedang berjalan.'
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

      // Get notes from args (optional)
      const notes = args.length > 1 ? args.slice(1).join(' ') : '';

      // Try to complete job
      const result = await this.completeJob(jobNumber, phoneNumber, notes);
      
      if (result.success) {
        // Clear session
        if (context.sessionManager) {
          context.sessionManager.clearSession(userJid);
        }

        return this.formatSuccess(
          `🎉 *Pekerjaan Selesai!*\n\n` +
          `🎫 Tiket: ${jobNumber}\n` +
          `👤 Teknisi: ${phoneNumber}\n` +
          `📅 Selesai: ${new Date().toLocaleString('id-ID')}\n` +
          `${notes ? `📝 Catatan: ${notes}\n` : ''}` +
          `✅ Status: Selesai\n\n` +
          `🎯 *Terima kasih atas kerja keras Anda!*\n\n` +
          `📋 *Langkah Selanjutnya:*\n` +
          `/jobs - Lihat pekerjaan tersedia lainnya\n` +
          `/myjobs - Lihat pekerjaan yang diambil\n` +
          `/stats - Lihat statistik performa\n\n` +
          `💡 *Tips:*\n` +
          `- Pastikan pelanggan puas dengan hasil\n` +
          `- Ambil pekerjaan baru untuk terus produktif\n` +
          `- Update status secara berkala`
        );
      } else {
        return this.formatError(
          `❌ *Gagal Menyelesaikan Pekerjaan*\n\n` +
          `Alasan: ${result.message}\n\n` +
          `💡 *Kemungkinan penyebab:*\n` +
          `- Pekerjaan belum dimulai (gunakan /mulai terlebih dahulu)\n` +
          `- Pekerjaan sudah selesai atau dibatalkan\n` +
          `- Anda bukan teknisi yang ditugaskan\n` +
          `- Nomor pekerjaan tidak ditemukan\n\n` +
          `🔍 *Coba:*\n` +
          `/myjobs - Lihat pekerjaan yang sedang berjalan\n` +
          `/mulai ${jobNumber} - Mulai pekerjaan terlebih dahulu`
        );
      }

    } catch (error) {
      return this.formatError(
        'Terjadi kesalahan saat menyelesaikan pekerjaan. Silakan coba lagi.'
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

  async completeJob(jobNumber, phoneNumber, notes) {
    try {
      const db = require('../../whatsapp/consolidated/BotDatabaseService');
      return await db.completeJob(jobNumber, phoneNumber, notes);
    } catch (error) {
      console.error('Error completing job:', error);
      return { success: false, message: 'Database error' };
    }
  }
}

module.exports = CompleteJobCommand;
