/**
 * Cancel Job Command - Cancel a job
 */

const BaseCommand = require('./BaseCommand');

class CancelJobCommand extends BaseCommand {
  constructor() {
    super('batal', {
      description: 'Batalkan pekerjaan',
      usage: '/batal [nomor_job] [alasan]',
      aliases: ['cancel', 'abort'],
      rateLimit: {
        windowMs: 300000, // 5 minutes
        maxRequests: 3, // 3 requests per 5 minutes
        blockDuration: 600000 // 10 minutes block
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
            'Contoh: /batal PSB-1234-0001\n\n' +
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

      // Get reason from args (optional)
      const reason = args.length > 1 ? args.slice(1).join(' ') : 'Dibatalkan oleh teknisi';

      // Confirm cancellation
      const job = await this.getJobDetails(jobNumber);
      if (!job) {
        return this.formatError(
          'Pekerjaan tidak ditemukan atau bukan milik Anda.'
        );
      }

      // Try to cancel job
      const result = await this.cancelJob(jobNumber, phoneNumber, reason);
      
      if (result.success) {
        // Clear session
        if (context.sessionManager) {
          context.sessionManager.clearSession(userJid);
        }

        return this.formatSuccess(
          `🚫 *Pekerjaan Dibatalkan*\n\n` +
          `🎫 Tiket: ${jobNumber}\n` +
          `👤 Teknisi: ${phoneNumber}\n` +
          `📅 Dibatalkan: ${new Date().toLocaleString('id-ID')}\n` +
          `📝 Alasan: ${reason}\n\n` +
          `⚠️ *Penting:*\n` +
          `- Pekerjaan ini akan tersedia untuk teknisi lain\n` +
          `- Pastikan alasan pembatalan sudah tepat\n` +
          `- Hubungi admin jika ada masalah teknis\n\n` +
          `📋 *Langkah Selanjutnya:*\n` +
          `/jobs - Lihat pekerjaan tersedia lainnya\n` +
          `/stats - Lihat statistik performa\n\n` +
          `💡 *Tips:*\n` +
          `- Batalkan hanya jika benar-benar diperlukan\n` +
          `- Berikan alasan yang jelas\n` +
          `- Ambil pekerjaan baru untuk tetap produktif`
        );
      } else {
        return this.formatError(
          `❌ *Gagal Membatalkan Pekerjaan*\n\n` +
          `Alasan: ${result.message}\n\n` +
          `💡 *Kemungkinan penyebab:*\n` +
          `- Pekerjaan sudah selesai atau dibatalkan\n` +
          `- Anda bukan teknisi yang ditugaskan\n` +
          `- Pekerjaan tidak dapat dibatalkan dalam status ini\n` +
          `- Nomor pekerjaan tidak ditemukan\n\n` +
          `🔍 *Coba:*\n` +
          `/myjobs - Lihat pekerjaan yang diambil\n` +
          `Hubungi admin untuk bantuan`
        );
      }

    } catch (error) {
      return this.formatError(
        'Terjadi kesalahan saat membatalkan pekerjaan. Silakan coba lagi.'
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

  async cancelJob(jobNumber, phoneNumber, reason) {
    try {
      // For now, we'll use the database service to update job status
      // In a real implementation, you might want to create a specific cancelJob method
      const db = require('../../whatsapp/consolidated/BotDatabaseService');
      
      // Get job first to check if it belongs to this technician
      const job = await db.getJobByNumber(jobNumber);
      if (!job) {
        return { success: false, message: 'Pekerjaan tidak ditemukan' };
      }

      // Check if technician is assigned to this job
      const technician = await db.getTechnicianByJid(phoneNumber + '@s.whatsapp.net');
      if (!technician) {
        return { success: false, message: 'Teknisi tidak ditemukan' };
      }

      // Check if job belongs to this technician
      const isAssigned = job.technicians && job.technicians.some(jt => jt.technicianId === technician.id);
      if (!isAssigned) {
        return { success: false, message: 'Anda bukan teknisi yang ditugaskan untuk pekerjaan ini' };
      }

      // Check if job can be cancelled
      if (job.status === 'COMPLETED') {
        return { success: false, message: 'Pekerjaan sudah selesai dan tidak dapat dibatalkan' };
      }

      // Update job status to CANCELLED
      await db.updateJobStatus(job.id, 'CANCELLED');
      
      return { success: true, message: 'Pekerjaan berhasil dibatalkan' };
      
    } catch (error) {
      console.error('Error cancelling job:', error);
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

module.exports = CancelJobCommand;
