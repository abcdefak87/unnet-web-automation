/**
 * My Jobs Command - Show technician's assigned jobs
 */

const BaseCommand = require('./BaseCommand');

class MyJobsCommand extends BaseCommand {
  constructor() {
    super('pekerjaanku', {
      description: 'Lihat pekerjaan yang sudah diambil',
      usage: '/pekerjaanku',
      aliases: ['myjobs', 'myjob', 'assigned'],
      rateLimit: {
        windowMs: 60000, // 1 minute
        maxRequests: 15, // 15 requests per minute
        blockDuration: 120000 // 2 minutes block
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

      // Get technician's jobs
      const technician = await this.getTechnician(phoneNumber);
      if (!technician) {
        return this.formatError(
          'Data teknisi tidak ditemukan. Silakan daftar ulang dengan /daftar [nama].'
        );
      }

      const jobs = await this.getTechnicianJobs(technician.id);
      
      if (!jobs || jobs.length === 0) {
        return this.formatInfo(
          `📋 *Tidak Ada Pekerjaan*\n\n` +
          `Anda belum memiliki pekerjaan yang ditugaskan.\n\n` +
          `💡 *Tips:*\n` +
          `- Gunakan /pekerjaan untuk melihat pekerjaan tersedia\n` +
          `- Ambil pekerjaan dengan /ambil [nomor_job]\n` +
          `- Anda akan menerima notifikasi pekerjaan baru`
        );
      }

      // Group jobs by status
      const groupedJobs = this.groupJobsByStatus(jobs);
      
      let message = `📋 *Pekerjaan Saya (${jobs.length})*\n\n`;
      
      // Show IN_PROGRESS jobs first
      if (groupedJobs.IN_PROGRESS.length > 0) {
        message += `🟡 *Sedang Berjalan (${groupedJobs.IN_PROGRESS.length})*\n\n`;
        groupedJobs.IN_PROGRESS.forEach((job, index) => {
          message += this.formatJobInfo(job, 'IN_PROGRESS');
          if (index < groupedJobs.IN_PROGRESS.length - 1) {
            message += `\n${'─'.repeat(25)}\n\n`;
          }
        });
        message += `\n`;
      }

      // Show ASSIGNED jobs
      if (groupedJobs.ASSIGNED.length > 0) {
        message += `🔵 *Ditugaskan (${groupedJobs.ASSIGNED.length})*\n\n`;
        groupedJobs.ASSIGNED.forEach((job, index) => {
          message += this.formatJobInfo(job, 'ASSIGNED');
          if (index < groupedJobs.ASSIGNED.length - 1) {
            message += `\n${'─'.repeat(25)}\n\n`;
          }
        });
        message += `\n`;
      }

      // Show COMPLETED jobs (last 5)
      if (groupedJobs.COMPLETED.length > 0) {
        const recentCompleted = groupedJobs.COMPLETED.slice(0, 5);
        message += `✅ *Selesai Terbaru (${recentCompleted.length})*\n\n`;
        recentCompleted.forEach((job, index) => {
          message += this.formatJobInfo(job, 'COMPLETED');
          if (index < recentCompleted.length - 1) {
            message += `\n${'─'.repeat(25)}\n\n`;
          }
        });
        message += `\n`;
      }

      // Add action buttons
      if (groupedJobs.ASSIGNED.length > 0) {
        const nextJob = groupedJobs.ASSIGNED[0];
        message += `🎯 *Aksi Selanjutnya:*\n`;
        message += `Gunakan /mulai ${nextJob.jobNumber} untuk memulai pekerjaan\n\n`;
      }

      message += `💡 *Perintah Tersedia:*\n`;
      message += `/mulai [job] - Mulai pekerjaan\n`;
      message += `/selesai [job] - Selesaikan pekerjaan\n`;
      message += `/batal [job] - Batalkan pekerjaan\n`;
      message += `/statistik - Lihat statistik`;

      return this.formatSuccess(message);

    } catch (error) {
      return this.formatError(
        'Gagal mengambil daftar pekerjaan. Silakan coba lagi.'
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

  async getTechnician(phoneNumber) {
    try {
      const db = require('../../whatsapp/consolidated/BotDatabaseService');
      return await db.getTechnicianByJid(phoneNumber + '@s.whatsapp.net');
    } catch (error) {
      console.error('Error getting technician:', error);
      return null;
    }
  }

  async getTechnicianJobs(technicianId) {
    try {
      const db = require('../../whatsapp/consolidated/BotDatabaseService');
      return await db.getTechnicianJobs(technicianId);
    } catch (error) {
      console.error('Error getting technician jobs:', error);
      return [];
    }
  }

  groupJobsByStatus(jobs) {
    const grouped = {
      ASSIGNED: [],
      IN_PROGRESS: [],
      COMPLETED: [],
      CANCELLED: []
    };

    jobs.forEach(job => {
      if (grouped[job.status]) {
        grouped[job.status].push(job);
      }
    });

    // Sort by creation date (newest first)
    Object.keys(grouped).forEach(status => {
      grouped[status].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    });

    return grouped;
  }

  formatJobInfo(job, status) {
    const customerName = job.customer?.name || 'N/A';
    const customerPhone = job.customer?.phone || 'N/A';
    const location = job.address || 'N/A';
    const problem = this.getProblemDescription(job);
    
    let statusEmoji = '🔵';
    if (status === 'IN_PROGRESS') statusEmoji = '🟡';
    else if (status === 'COMPLETED') statusEmoji = '✅';
    else if (status === 'CANCELLED') statusEmoji = '❌';

    let info = `${statusEmoji} *${job.jobNumber}*\n`;
    info += `👤 ${customerName}\n`;
    info += `📞 ${customerPhone}\n`;
    info += `📍 ${location}\n`;
    info += `🔧 ${problem}\n`;
    
    if (status === 'ASSIGNED') {
      info += `⏰ Ditugaskan: ${new Date(job.createdAt).toLocaleDateString('id-ID')}\n`;
    } else if (status === 'IN_PROGRESS') {
      info += `⏰ Dimulai: ${new Date(job.createdAt).toLocaleDateString('id-ID')}\n`;
    } else if (status === 'COMPLETED') {
      info += `✅ Selesai: ${new Date(job.completedAt || job.updatedAt).toLocaleDateString('id-ID')}\n`;
    }

    return info;
  }

  getProblemDescription(job) {
    if (job.description) {
      return job.description.length > 40 
        ? job.description.substring(0, 40) + '...'
        : job.description;
    }
    
    if (job.type === 'PSB') {
      return 'Pemasangan WiFi';
    } else if (job.type === 'GANGGUAN') {
      return 'Perbaikan gangguan';
    } else if (job.type === 'MAINTENANCE') {
      return 'Maintenance';
    }
    
    return 'Perbaikan teknis';
  }
}

module.exports = MyJobsCommand;
