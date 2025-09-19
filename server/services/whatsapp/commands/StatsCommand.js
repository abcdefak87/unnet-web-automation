/**
 * Stats Command - Show technician statistics
 */

const BaseCommand = require('./BaseCommand');

class StatsCommand extends BaseCommand {
  constructor() {
    super('statistik', {
      description: 'Lihat statistik pekerjaan dan performa',
      usage: '/statistik',
      aliases: ['stats', 'stat'],
      rateLimit: {
        windowMs: 60000, // 1 minute
        maxRequests: 20, // 20 requests per minute
        blockDuration: 60000 // 1 minute block
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

      // Get technician stats
      const stats = await this.getTechnicianStats(phoneNumber);
      if (!stats) {
        return this.formatError(
          'Data statistik tidak ditemukan. Silakan coba lagi.'
        );
      }

      // Get recent activity
      const recentJobs = await this.getRecentJobs(phoneNumber);
      
      // Format statistics message
      let message = `📊 *Statistik Teknisi*\n\n`;
      
      // Basic stats
      message += `🎯 *Ringkasan:*\n`;
      message += `📋 Total Pekerjaan: ${stats.totalJobs}\n`;
      message += `✅ Selesai: ${stats.completedJobs}\n`;
      message += `🟡 Sedang Berjalan: ${stats.activeJobs}\n`;
      
      if (stats.totalJobs > 0) {
        const completionRate = Math.round((stats.completedJobs / stats.totalJobs) * 100);
        message += `📈 Tingkat Penyelesaian: ${completionRate}%\n`;
      }
      
      message += `⭐ Rating Rata-rata: ${stats.avgRating}/5.0\n\n`;

      // Recent activity
      if (recentJobs && recentJobs.length > 0) {
        message += `📅 *Aktivitas Terbaru:*\n`;
        recentJobs.slice(0, 3).forEach((job, index) => {
          const statusEmoji = job.status === 'COMPLETED' ? '✅' : 
                             job.status === 'IN_PROGRESS' ? '🟡' : '🔵';
          const date = new Date(job.updatedAt).toLocaleDateString('id-ID');
          
          message += `${statusEmoji} ${job.jobNumber} - ${date}\n`;
        });
        message += `\n`;
      }

      // Performance insights
      message += `💡 *Insight Performa:*\n`;
      
      if (stats.completedJobs >= 10) {
        message += `🎉 Excellent! Anda sudah menyelesaikan ${stats.completedJobs} pekerjaan\n`;
      } else if (stats.completedJobs >= 5) {
        message += `👍 Good job! Terus semangat menyelesaikan pekerjaan\n`;
      } else if (stats.completedJobs > 0) {
        message += `🚀 Keep it up! Anda sedang dalam perjalanan yang baik\n`;
      } else {
        message += `🎯 Mulai ambil pekerjaan dengan /pekerjaan\n`;
      }

      if (stats.activeJobs > 0) {
        message += `⚡ Anda memiliki ${stats.activeJobs} pekerjaan aktif\n`;
      }

      message += `\n📋 *Perintah Berguna:*\n`;
      message += `/pekerjaan - Lihat pekerjaan tersedia\n`;
      message += `/pekerjaanku - Lihat pekerjaan saya\n`;
      message += `/mulai [job] - Mulai pekerjaan\n`;
      message += `/selesai [job] - Selesaikan pekerjaan`;

      return this.formatSuccess(message);

    } catch (error) {
      return this.formatError(
        'Gagal mengambil statistik. Silakan coba lagi.'
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

  async getTechnicianStats(phoneNumber) {
    try {
      const db = require('../../whatsapp/consolidated/BotDatabaseService');
      return await db.getTechnicianStats(phoneNumber);
    } catch (error) {
      console.error('Error getting technician stats:', error);
      return null;
    }
  }

  async getRecentJobs(phoneNumber) {
    try {
      // Get technician first
      const db = require('../../whatsapp/consolidated/BotDatabaseService');
      const technician = await db.getTechnicianByJid(phoneNumber + '@s.whatsapp.net');
      
      if (!technician) return [];

      // Get recent jobs
      const jobs = await db.getTechnicianJobs(technician.id);
      
      // Sort by update date and return recent ones
      return jobs
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, 5);
        
    } catch (error) {
      console.error('Error getting recent jobs:', error);
      return [];
    }
  }
}

module.exports = StatsCommand;
