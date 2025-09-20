const BaseCommand = require('./BaseCommand');
const prisma = require('../../utils/database');

class EnhancedStatsCommand extends BaseCommand {
  constructor() {
    super('statistik', {
      description: 'Menampilkan statistik performa teknisi yang komprehensif',
      usage: '/statistik [detail|ringkasan]',
      aliases: ['stats', 'statistik']
    });
    this.prisma = prisma;
  }

  async execute(userJid, args, context = {}) {
    try {
      const phoneNumber = userJid.split('@')[0];
      const showDetail = args.includes('detail');
      
      // Check if technician is registered
      const isRegistered = await this.checkTechnicianRegistration(phoneNumber);
      if (!isRegistered) {
        return this.formatError(
          'Anda belum terdaftar sebagai teknisi.\n\n' +
          'Gunakan /daftar [nama] untuk mendaftar terlebih dahulu.'
        );
      }

      // Get enhanced technician stats
      const stats = await this.getTechnicianStats(phoneNumber);
      if (!stats) {
        return this.formatError(
          'Data statistik tidak ditemukan. Silakan coba lagi.'
        );
      }

      // Format enhanced statistics message
      if (showDetail) {
        return this.formatDetailedStats(stats, context.pushName);
      } else {
        return this.formatSummaryStats(stats, context.pushName);
      }

    } catch (error) {
      console.error('Error in enhanced stats command:', error);
      return this.formatError(
        'Terjadi kesalahan saat mengambil statistik. Silakan coba lagi.'
      );
    }
  }

  /**
   * Format summary statistics (compact view)
   */
  formatSummaryStats(stats, technicianName) {
    const { basic, rating, performance, insights, teamComparison } = stats;
    
    let message = `📊 *STATISTIK ANDA*\n\n`;
    message += `👤 ${technicianName}\n\n`;
    
    // Basic stats with emojis
    message += `🎯 *Ringkasan:*\n`;
    message += `📋 Total Pekerjaan: ${basic.totalJobs}\n`;
    message += `✅ Selesai: ${basic.completedJobs}\n`;
    message += `⏳ Aktif: ${basic.activeJobs}\n`;
    message += `📈 Completion Rate: ${basic.completionRate}%\n`;
    
    if (rating.averageRating > 0) {
      message += `⭐ Rating: ${rating.averageRating}/5 (${rating.ratingCount} review)\n`;
    }
    
    if (performance) {
      message += `⚡ Efisiensi: ${performance.efficiencyScore}%\n`;
      if (performance.avgWorkTimeMinutes > 0) {
        message += `⏱️ Rata-rata Kerja: ${Math.round(performance.avgWorkTimeMinutes / 60 * 10) / 10} jam\n`;
      }
    }
    
    // Team ranking
    if (teamComparison) {
      message += `\n🏆 *Ranking Tim:*\n`;
      message += `📊 Rating: #${teamComparison.ratingRank}/${teamComparison.teamSize}\n`;
      message += `✅ Penyelesaian: #${teamComparison.completionRank}/${teamComparison.teamSize}\n`;
    }
    
    // Top insight
    if (insights && insights.length > 0) {
      const topInsight = insights[0];
      const emoji = topInsight.type === 'positive' ? '💡' : 
                   topInsight.type === 'warning' ? '⚠️' : 'ℹ️';
      message += `\n${emoji} *Insight:* ${topInsight.message}\n`;
    }
    
    message += `\n💪 Tetap semangat!`;
    message += `\n\n_Tip: Ketik /statistik detail untuk info lengkap_`;
    
    return message;
  }

  /**
   * Format detailed statistics (comprehensive view)
   */
  formatDetailedStats(stats, technicianName) {
    const { basic, rating, performance, timeAnalysis, categoryBreakdown, insights, achievements, recentActivity, teamComparison } = stats;
    
    let message = `📊 *STATISTIK DETAIL ANDA*\n\n`;
    message += `👤 ${technicianName}\n`;
    message += `📅 ${new Date().toLocaleDateString('id-ID')}\n\n`;
    
    // Basic Performance
    message += `🎯 *PERFORMA UTAMA:*\n`;
    message += `📋 Total Pekerjaan: ${basic.totalJobs}\n`;
    message += `✅ Selesai: ${basic.completedJobs}\n`;
    message += `⏳ Aktif: ${basic.activeJobs}\n`;
    message += `📈 Completion Rate: ${basic.completionRate}%\n`;
    
    if (performance) {
      message += `⚡ Skor Efisiensi: ${performance.efficiencyScore}/100\n`;
      message += `⏱️ Total Jam Kerja: ${performance.totalWorkHours} jam\n`;
      if (performance.avgWorkTimeMinutes > 0) {
        message += `🕐 Rata-rata per Job: ${Math.round(performance.avgWorkTimeMinutes / 60 * 10) / 10} jam\n`;
      }
    }
    message += `\n`;
    
    // Rating Details
    if (rating.averageRating > 0) {
      message += `⭐ *RATING & KUALITAS:*\n`;
      message += `🌟 Rating Rata-rata: ${rating.averageRating}/5\n`;
      message += `📝 Total Review: ${rating.ratingCount}\n`;
      
      if (rating.ratingDistribution) {
        message += `📊 Distribusi Rating:\n`;
        for (let i = 5; i >= 1; i--) {
          const count = rating.ratingDistribution[i] || 0;
          const stars = '⭐'.repeat(i);
          message += `${stars} ${count} review\n`;
        }
      }
      
      if (rating.qualityScore > 0) {
        message += `🎯 Skor Kualitas: ${rating.qualityScore}/10\n`;
      }
      message += `\n`;
    }
    
    // Time Analysis
    if (timeAnalysis && timeAnalysis.avgCompletionTimeHours > 0) {
      message += `⏰ *ANALISIS WAKTU:*\n`;
      message += `🕐 Rata-rata Penyelesaian: ${timeAnalysis.avgCompletionTimeHours} jam\n`;
      
      if (timeAnalysis.fastestJob) {
        message += `⚡ Tercepat: ${timeAnalysis.fastestJob.jobNumber} (${timeAnalysis.fastestJob.duration}h)\n`;
      }
      
      if (timeAnalysis.slowestJob) {
        message += `🐌 Terlama: ${timeAnalysis.slowestJob.jobNumber} (${timeAnalysis.slowestJob.duration}h)\n`;
      }
      
      if (timeAnalysis.timeDistribution) {
        message += `📅 Distribusi Waktu:\n`;
        message += `• Same Day: ${timeAnalysis.timeDistribution.sameDay}\n`;
        message += `• 1-3 Days: ${timeAnalysis.timeDistribution.oneToThreeDays}\n`;
        message += `• 3-7 Days: ${timeAnalysis.timeDistribution.threeToSevenDays}\n`;
        message += `• >7 Days: ${timeAnalysis.timeDistribution.moreThanSevenDays}\n`;
      }
      message += `\n`;
    }
    
    // Category Breakdown
    if (categoryBreakdown && Object.keys(categoryBreakdown).length > 0) {
      message += `📂 *PERFORMA PER KATEGORI:*\n`;
      Object.entries(categoryBreakdown).forEach(([category, stats]) => {
        const emoji = category === 'PSB' ? '🏠' : category === 'GANGGUAN' ? '🔧' : '📋';
        message += `${emoji} ${category}:\n`;
        message += `  • Total: ${stats.total} | Selesai: ${stats.completed}\n`;
        message += `  • Rate: ${stats.completionRate}% | Rating: ${stats.avgRating}/5\n`;
      });
      message += `\n`;
    }
    
    // Team Comparison
    if (teamComparison) {
      message += `🏆 *PERBANDINGAN TIM:*\n`;
      message += `👥 Total Teknisi: ${teamComparison.teamSize}\n`;
      message += `📊 Ranking Rating: #${teamComparison.ratingRank}\n`;
      message += `✅ Ranking Penyelesaian: #${teamComparison.completionRank}\n`;
      message += `📈 Rating Tim Rata-rata: ${Math.round(teamComparison.avgTeamRating * 10) / 10}/5\n`;
      message += `\n`;
    }
    
    // Achievements
    if (achievements && achievements.length > 0) {
      message += `🏅 *PENCAPAIAN TERBARU:*\n`;
      achievements.slice(0, 3).forEach(achievement => {
        const emoji = this.getAchievementEmoji(achievement.achievementType);
        const date = new Date(achievement.earnedAt).toLocaleDateString('id-ID');
        message += `${emoji} ${achievement.achievementName}\n`;
        message += `   📅 ${date}\n`;
      });
      message += `\n`;
    }
    
    // Recent Activity
    if (recentActivity && recentActivity.length > 0) {
      message += `📅 *AKTIVITAS TERBARU:*\n`;
      recentActivity.slice(0, 3).forEach(job => {
        const statusEmoji = job.status === 'COMPLETED' ? '✅' : 
                           job.status === 'IN_PROGRESS' ? '🟡' : '🔵';
        const date = new Date(job.updatedAt).toLocaleDateString('id-ID');
        const rating = job.customerRating ? ` ⭐${job.customerRating}` : '';
        const time = job.completionTime ? ` (${job.completionTime}h)` : '';
        message += `${statusEmoji} ${job.jobNumber} - ${date}${rating}${time}\n`;
      });
      message += `\n`;
    }
    
    // Insights
    if (insights && insights.length > 0) {
      message += `💡 *INSIGHTS & REKOMENDASI:*\n`;
      insights.forEach(insight => {
        const emoji = insight.type === 'positive' ? '✅' : 
                     insight.type === 'warning' ? '⚠️' : 'ℹ️';
        message += `${emoji} ${insight.title}: ${insight.message}\n`;
      });
      message += `\n`;
    }
    
    message += `💪 Tetap semangat dan terus tingkatkan performa!`;
    
    return message;
  }

  /**
   * Get achievement emoji based on type
   */
  getAchievementEmoji(type) {
    const emojiMap = {
      'COMPLETION_STREAK': '🔥',
      'HIGH_RATING': '⭐',
      'FAST_COMPLETION': '⚡',
      'TEAM_PLAYER': '👥',
      'PROBLEM_SOLVER': '🧠',
      'CUSTOMER_SATISFACTION': '😊',
      'EFFICIENCY': '🎯',
      'CONSISTENCY': '📈'
    };
    return emojiMap[type] || '🏆';
  }

  /**
   * Check if technician is registered - flexible phone format support
   */
  async checkTechnicianRegistration(phoneNumber) {
    try {
      const normalized = this.normalizePhone(phoneNumber);
      const originalPhone = phoneNumber;
      const phoneWithoutCountry = phoneNumber.replace(/^62/, '0');
      
      console.log(`[DEBUG] Checking technician registration for:`, {
        original: phoneNumber,
        normalized,
        phoneWithoutCountry
      });
      
      const technician = await this.prisma.technician.findFirst({
        where: { 
          OR: [
            { whatsappJid: normalized + '@s.whatsapp.net' },
            { whatsappJid: originalPhone + '@s.whatsapp.net' },
            { whatsappJid: phoneWithoutCountry + '@s.whatsapp.net' },
            { phone: normalized },
            { phone: originalPhone },
            { phone: phoneWithoutCountry }
          ]
        }
      });
      
      console.log(`[DEBUG] Technician found:`, !!technician);
      if (technician) {
        console.log(`[DEBUG] Technician details:`, {
          id: technician.id,
          name: technician.name,
          phone: technician.phone,
          whatsappJid: technician.whatsappJid
        });
      }
      
      return !!technician;
    } catch (error) {
      console.error('Error checking technician registration:', error);
      return false;
    }
  }

  /**
   * Get technician stats using the enhanced service
   */
  async getTechnicianStats(phoneNumber) {
    try {
      const EnhancedStatsService = require('../../EnhancedTechnicianStatsService');
      return await EnhancedStatsService.getEnhancedTechnicianStats(phoneNumber);
    } catch (error) {
      console.error('Error getting enhanced stats:', error);
      // Fallback to basic stats
      try {
        const BotDatabaseService = require('../../../whatsapp/consolidated/BotDatabaseService');
        return await BotDatabaseService.getTechnicianStats(phoneNumber);
      } catch (fallbackError) {
        console.error('Error getting fallback stats:', fallbackError);
        return null;
      }
    }
  }

  /**
   * Normalize phone number - flexible format support
   */
  normalizePhone(phone) {
    if (!phone) return null;
    
    // Remove all non-numeric characters
    let cleaned = phone.toString().replace(/[^0-9]/g, '');
    
    // Handle different formats
    if (cleaned.startsWith('62')) {
      // Already in 62 format
      return cleaned;
    } else if (cleaned.startsWith('0')) {
      // Convert from 0 format to 62
      return '62' + cleaned.substring(1);
    } else {
      // Assume it's missing country code, add 62
      return '62' + cleaned;
    }
  }
}

module.exports = EnhancedStatsCommand;
