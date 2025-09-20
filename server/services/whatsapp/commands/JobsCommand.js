/**
 * Jobs Command - Show available jobs
 */

const BaseCommand = require('./BaseCommand');

class JobsCommand extends BaseCommand {
  constructor() {
    super('jobs', {
      description: 'Lihat pekerjaan yang tersedia',
      usage: '/jobs',
      aliases: ['pekerjaan', 'job'],
      rateLimit: {
        windowMs: 60000, // 1 minute
        maxRequests: 10, // 10 requests per minute
        blockDuration: 120000 // 2 minutes block
      }
    });
  }

  async execute(userJid, args, context = {}) {
    try {
      // Get available jobs
      const jobs = await this.getAvailableJobs();
      
      if (!jobs || jobs.length === 0) {
        return this.formatInfo(
          `📋 *Tidak Ada Pekerjaan Tersedia*\n\n` +
          `Saat ini belum ada pekerjaan yang bisa diambil.\n\n` +
          `💡 *Tips:*\n` +
          `- Coba lagi nanti\n` +
          `- Pastikan Anda sudah terdaftar sebagai teknisi\n` +
          `- Gunakan /myjobs untuk melihat pekerjaan yang sudah diambil`
        );
      }

      // Format jobs list
      let message = `📋 *Pekerjaan Tersedia (${jobs.length})*\n\n`;
      
      jobs.forEach((job, index) => {
        const customerName = job.customer?.name || 'N/A';
        const customerPhone = job.customer?.phone || 'N/A';
        const location = job.address || 'N/A';
        const problem = this.getProblemDescription(job);
        
        message += `🎫 *${job.jobNumber}*\n`;
        message += `👤 Pelanggan: ${customerName}\n`;
        message += `📞 Kontak: ${customerPhone}\n`;
        message += `📍 Lokasi: ${location}\n`;
        message += `🔧 Masalah: ${problem}\n`;
        message += `⏰ Status: ${job.status}\n`;
        
        if (index < jobs.length - 1) {
          message += `\n${'─'.repeat(30)}\n\n`;
        }
      });

      message += `\n🎯 *Cara Mengambil Pekerjaan:*\n`;
      message += `1️⃣ Ketik /ambil ${jobs[0].jobNumber}\n`;
      message += `2️⃣ Atau gunakan tombol interaktif\n\n`;
      message += `💡 *Tips:*\n`;
      message += `- Pekerjaan diurutkan berdasarkan prioritas\n`;
      message += `- Ambil pekerjaan yang sesuai dengan lokasi Anda\n`;
      message += `- Gunakan /myjobs untuk melihat pekerjaan yang sudah diambil`;

      return this.formatSuccess(message);

    } catch (error) {
      return this.formatError(
        'Gagal mengambil daftar pekerjaan. Silakan coba lagi.'
      );
    }
  }

  async getAvailableJobs() {
    try {
      const db = require('../../whatsapp/consolidated/BotDatabaseService');
      return await db.getAvailableJobs();
    } catch (error) {
      console.error('Error getting available jobs:', error);
      return [];
    }
  }

  getProblemDescription(job) {
    if (job.description) {
      return job.description.length > 50 
        ? job.description.substring(0, 50) + '...'
        : job.description;
    }
    
    if (job.type === 'PSB') {
      return 'Pemasangan WiFi baru';
    } else if (job.type === 'GANGGUAN') {
      return 'Perbaikan gangguan WiFi';
    } else if (job.type === 'MAINTENANCE') {
      return 'Maintenance rutin';
    }
    
    return 'Perbaikan teknis';
  }
}

module.exports = JobsCommand;
