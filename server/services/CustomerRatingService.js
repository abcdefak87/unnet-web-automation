const prisma = require('../utils/database');

class CustomerRatingService {
  /**
   * Normalize phone number to 62 format
   * @param {string} phone - Phone number
   * @returns {string} Normalized phone number
   */
  normalizePhone(phone) {
    if (!phone) return null;
    let p = phone.toString().replace(/\D/g, '');
    if (p.startsWith('0')) p = '62' + p.substring(1);
    if (!p.startsWith('62')) p = '62' + p;
    return p;
  }
  /**
   * Send instant rating request to customer after job completion
   * @param {Object} job - Completed job object
   * @param {Object} technician - Technician object
   */
  async requestCustomerRating(job, technician) {
    try {
      const message = this.generateRatingRequestMessage(job, technician);
      
      // Send directly via WhatsApp bot (if available)
      try {
        const { getWhatsAppBot } = require('../utils/whatsappBot');
        const bot = getWhatsAppBot();
        
        if (bot && bot.sendMessage) {
          const customerJid = this.normalizePhone(job.customer.phone) + '@s.whatsapp.net';
          await bot.sendMessage(customerJid, { text: message });
          console.log(`✅ Rating request sent directly to customer ${job.customer.phone} for job ${job.jobNumber}`);
          return;
        }
      } catch (botError) {
        console.log('WhatsApp bot not available, using notification service...');
      }

      // Fallback: Use notification service
      const WhatsAppService = require('./WhatsAppNotificationService');
      const result = await WhatsAppService.sendRatingRequest(job, technician);
      
      if (result.success) {
        console.log(`Rating request queued for customer ${job.customer.phone} for job ${job.jobNumber}`);
      } else {
        console.error(`Failed to send rating request: ${result.error}`);
      }
    } catch (error) {
      console.error('Error sending instant rating request:', error);
    }
  }

  /**
   * Generate rating request message
   */
  generateRatingRequestMessage(job, technician) {
    return `📱 *UNNET WIFI - Rating Layanan*

Halo ${job.customer.name}! 👋

Kami harap Anda puas dengan layanan yang diberikan oleh teknisi ${technician.name} untuk job ${job.jobNumber}.

Mohon berikan rating dan feedback Anda dengan membalas pesan ini menggunakan format:

*RATING [1-5] [feedback opsional]*

Contoh:
*RATING 5 Teknisi sangat ramah dan pekerjaan rapi*
*RATING 4 Bagus, tapi agak lama*
*RATING 5*

Rating 1 = Sangat Buruk
Rating 2 = Buruk  
Rating 3 = Biasa
Rating 4 = Baik
Rating 5 = Sangat Baik

Terima kasih atas kepercayaan Anda! 🙏

---
UNNET WIFI Customer Service`;
  }

  /**
   * Process rating from WhatsApp message
   * @param {string} phoneNumber - Customer phone number
   * @param {string} message - Rating message
   */
  async processWhatsAppRating(phoneNumber, message) {
    try {
      // Parse rating message: "RATING 5 Teknisi sangat baik"
      const ratingMatch = message.match(/RATING\s+([1-5])\s*(.*)/i);
      
      if (!ratingMatch) {
        return {
          success: false,
          message: 'Format tidak valid. Gunakan: RATING [1-5] [feedback opsional]'
        };
      }

      const rating = parseInt(ratingMatch[1]);
      const feedback = ratingMatch[2]?.trim() || '';

      if (rating < 1 || rating > 5) {
        return {
          success: false,
          message: 'Rating harus antara 1-5'
        };
      }

      // Find customer's most recent completed job
      // Try multiple phone formats
      const normalizedPhone = this.normalizePhone(phoneNumber);
      const originalPhone = phoneNumber;
      const phoneWithoutCountry = phoneNumber.replace(/^62/, '0');
      
      const customer = await prisma.customer.findFirst({
        where: { 
          OR: [
            { phone: normalizedPhone },
            { phone: originalPhone },
            { phone: phoneWithoutCountry }
          ]
        },
        include: {
          jobs: {
            where: {
              status: 'COMPLETED',
              completedAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
              }
            },
            include: {
              technicians: {
                where: {
                  customerRating: null // No rating yet
                }
              }
            },
            orderBy: { completedAt: 'desc' },
            take: 1
          }
        }
      });

      if (!customer || customer.jobs.length === 0) {
        return {
          success: false,
          message: 'Tidak ada job yang bisa diberi rating. Pastikan job sudah selesai dalam 7 hari terakhir.'
        };
      }

      const job = customer.jobs[0];
      if (job.technicians.length === 0) {
        return {
          success: false,
          message: 'Job ini sudah pernah diberi rating.'
        };
      }

      // Submit rating
      const result = await this.submitRating(job.id, rating, feedback);
      
      if (result.success) {
        return {
          success: true,
          message: `Terima kasih! Rating ${rating}/5 telah berhasil dikirim untuk job ${job.jobNumber}.`
        };
      } else {
        return {
          success: false,
          message: 'Gagal mengirim rating. Silakan coba lagi.'
        };
      }

    } catch (error) {
      console.error('Error processing WhatsApp rating:', error);
      return {
        success: false,
        message: 'Terjadi kesalahan. Silakan coba lagi.'
      };
    }
  }

  /**
   * Submit rating to database
   */
  async submitRating(jobId, rating, feedback) {
    try {
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
          customer: true,
          technicians: {
            include: { technician: true }
          }
        }
      });

      if (!job || job.status !== 'COMPLETED') {
        return { success: false, error: 'Job not found or not completed' };
      }

      // Update job technician record
      await prisma.jobTechnician.updateMany({
        where: { jobId },
        data: {
          customerRating: rating,
          completionNotes: feedback ? 
            `${(await prisma.jobTechnician.findFirst({ where: { jobId } })).completionNotes}\n\nCustomer Feedback: ${feedback}` : 
            undefined
        }
      });

      // Update technician statistics (disabled - fields not in current schema)
      // for (const assignment of job.technicians) {
      //   await this.updateTechnicianRatingStats(assignment.technicianId, rating);
      // }

      // Notify technicians about the rating received
      await this.notifyTechniciansAboutRating(job, rating, feedback);

      return { success: true, jobNumber: job.jobNumber };
    } catch (error) {
      console.error('Error submitting rating:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update technician rating statistics
   */
  async updateTechnicianRatingStats(technicianId, newRating) {
    try {
      const technician = await prisma.technician.findUnique({
        where: { id: technicianId },
        include: {
          jobAssignments: {
            where: {
              customerRating: { not: null }
            }
          }
        }
      });

      if (!technician) return;

      const totalRating = technician.jobAssignments.reduce((sum, assignment) => 
        sum + (assignment.customerRating || 0), 0
      ) + newRating;
      
      const ratingCount = technician.jobAssignments.length + 1;
      const avgRating = totalRating / ratingCount;

      await prisma.technician.update({
        where: { id: technicianId },
        data: {
          totalRating,
          ratingCount,
          lastPerformanceUpdate: new Date()
        }
      });

      // Check for achievements
      await this.checkRatingAchievements(technicianId, avgRating);

    } catch (error) {
      console.error('Error updating technician rating stats:', error);
    }
  }

  /**
   * Check for rating-based achievements
   */
  async checkRatingAchievements(technicianId, avgRating) {
    try {
      const AchievementService = require('./TechnicianAchievementService');
      const technician = await prisma.technician.findUnique({
        where: { id: technicianId }
      });

      if (!technician) return;

      const stats = {
        performance: {
          efficiencyScore: technician.performanceScore || 0
        }
      };

      await AchievementService.checkAndAwardAchievements(technicianId, stats);

    } catch (error) {
      console.error('Error checking rating achievements:', error);
    }
  }

  /**
   * Notify technicians when they receive a rating from customer
   * @param {Object} job - Job object with technicians
   * @param {number} rating - Rating value (1-5)
   * @param {string} feedback - Customer feedback
   */
  async notifyTechniciansAboutRating(job, rating, feedback) {
    try {
      console.log(`🔔 [RATING NOTIFICATION] Starting notification process for job ${job.jobNumber}`);
      console.log(`🔔 [RATING NOTIFICATION] Rating: ${rating}/5, Feedback: "${feedback || 'None'}"`);
      console.log(`🔔 [RATING NOTIFICATION] Job technicians count: ${job.technicians?.length || 0}`);

      if (!job.technicians || job.technicians.length === 0) {
        console.warn(`⚠️ [RATING NOTIFICATION] No technicians found for job ${job.jobNumber}`);
        return;
      }

      for (const assignment of job.technicians) {
        const technician = assignment.technician;
        if (!technician) {
          console.warn(`⚠️ [RATING NOTIFICATION] Skipping assignment without technician data`);
          continue;
        }

        console.log(`🔔 [RATING NOTIFICATION] Processing technician: ${technician.name} (${technician.phone})`);
        console.log(`🔔 [RATING NOTIFICATION] Technician WhatsApp JID: ${technician.whatsappJid || 'Not set'}`);

        const message = this.generateTechnicianRatingNotification(job, technician, rating, feedback);
        
        // Send notification to technician via WhatsApp bot
        try {
          const technicianJid = technician.whatsappJid || (this.normalizePhone(technician.phone) ? `${this.normalizePhone(technician.phone)}@s.whatsapp.net` : null);
          
          console.log(`🔔 [RATING NOTIFICATION] Final JID for ${technician.name}: ${technicianJid}`);
          
          if (technicianJid) {
            let notificationSent = false;
            
            // Try direct send via global WhatsApp socket first
            try {
              console.log(`🔔 [RATING NOTIFICATION] Checking global WhatsApp socket...`);
              if (global.whatsappSocket && global.whatsappSocket.user && global.whatsappSocket.sendMessage) {
                console.log(`🔔 [RATING NOTIFICATION] Global socket available, sending message...`);
                await global.whatsappSocket.sendMessage(technicianJid, { text: message });
                console.log(`✅ [RATING NOTIFICATION] SUCCESS: Rating notification sent directly via global socket to technician ${technician.name} (${technician.phone})`);
                notificationSent = true;
              } else {
                console.log(`🔔 [RATING NOTIFICATION] Global socket not available or missing sendMessage method`);
              }
            } catch (globalSocketError) {
              console.log(`🔔 [RATING NOTIFICATION] Global socket error: ${globalSocketError.message}`);
            }

            // Try direct send via WhatsApp bot instance
            if (!notificationSent) {
              try {
                console.log(`🔔 [RATING NOTIFICATION] Trying WhatsApp bot instance...`);
                const { getWhatsAppBot } = require('../utils/whatsappBot');
                const bot = getWhatsAppBot();
                
                if (bot && bot.sendMessage) {
                  console.log(`🔔 [RATING NOTIFICATION] Bot instance available, sending message...`);
                  await bot.sendMessage(technicianJid, { text: message });
                  console.log(`✅ [RATING NOTIFICATION] SUCCESS: Rating notification sent directly via bot instance to technician ${technician.name} (${technician.phone})`);
                  notificationSent = true;
                } else {
                  console.log(`🔔 [RATING NOTIFICATION] Bot instance not available or missing sendMessage method`);
                }
              } catch (botError) {
                console.log(`🔔 [RATING NOTIFICATION] Bot instance error: ${botError.message}`);
              }
            }

            // Fallback: Queue notification in database
            if (!notificationSent) {
              console.log(`🔔 [RATING NOTIFICATION] Queueing notification in database...`);
              await prisma.notification.create({
                data: {
                  type: 'WHATSAPP',
                  recipient: technicianJid,
                  message: message,
                  status: 'PENDING',
                  jobId: job.id
                }
              });
              
              console.log(`📝 [RATING NOTIFICATION] Rating notification queued for technician ${technician.name} (${technician.phone})`);
            }
          } else {
            console.warn(`⚠️ [RATING NOTIFICATION] No valid WhatsApp JID for technician ${technician.name} (${technician.phone})`);
          }
        } catch (notificationError) {
          console.error(`❌ [RATING NOTIFICATION] Failed to notify technician ${technician.name} about rating:`, notificationError);
        }
      }

      console.log(`🔔 [RATING NOTIFICATION] Completed notification process for job ${job.jobNumber}`);

    } catch (error) {
      console.error('❌ [RATING NOTIFICATION] Error notifying technicians about rating:', error);
    }
  }

  /**
   * Generate rating notification message for technician
   */
  generateTechnicianRatingNotification(job, technician, rating, feedback) {
    const ratingText = {
      1: 'Sangat Buruk',
      2: 'Buruk',
      3: 'Biasa', 
      4: 'Baik',
      5: 'Sangat Baik'
    };

    const ratingEmoji = {
      1: '😞',
      2: '😐',
      3: '😊',
      4: '😄',
      5: '🤩'
    };

    // Format customer name and phone properly
    const customerName = job.customer?.name || 'Data tidak tersedia';
    const customerPhone = job.customer?.phone ? 
      (job.customer.phone.startsWith('62') ? 
        job.customer.phone : 
        '62' + job.customer.phone.replace(/^0/, '')) : 
      'Data tidak tersedia';

    let message = `🎉 *RATING DITERIMA!* ${ratingEmoji[rating]}

Halo *${technician.name}*! 👋

Pelanggan baru saja memberikan rating untuk job yang telah Anda selesaikan:

📋 *Detail Job:*
🎫 Tiket: *${job.jobNumber}*
👤 Pelanggan: *${customerName}*
📞 Kontak: *${customerPhone}*
🏷️ Kategori: *${job.category || job.type}*
📅 Selesai: *${job.completedAt ? new Date(job.completedAt).toLocaleString('id-ID') : 'Data tidak tersedia'}*

⭐ *Rating: ${rating}/5 - ${ratingText[rating]}*`;

    if (feedback && feedback.trim()) {
      message += `\n\n💬 *Feedback Pelanggan:*
"${feedback}"`;
    }

    // Generate personalized tips based on rating
    const tips = this.generatePersonalizedTips(rating, feedback);
    message += `\n\n💡 *Tips untuk Performa Lebih Baik:*`;
    tips.forEach(tip => {
      message += `\n• ${tip}`;
    });

    message += `\n\n🎯 *Terima kasih atas kerja keras Anda!*
📈 *Terus tingkatkan kualitas layanan untuk kepuasan pelanggan*

---
*UNNET WIFI Management* 🚀`;

    return message;
  }

  /**
   * Generate personalized tips based on rating and feedback
   */
  generatePersonalizedTips(rating, feedback) {
    const baseTips = [
      'Komunikasi yang jelas dan ramah dengan pelanggan',
      'Pekerjaan yang rapi dan sesuai standar perusahaan',
      'Tepat waktu sesuai jadwal yang disepakati',
      'Follow-up untuk memastikan kepuasan pelanggan',
      'Dokumentasi pekerjaan yang lengkap dan akurat'
    ];

    const highRatingTips = [
      'Pertahankan standar kualitas yang sudah baik',
      'Jadikan ini sebagai motivasi untuk terus berprestasi',
      'Bagikan pengalaman terbaik dengan rekan kerja',
      'Terus tingkatkan kemampuan teknis dan komunikasi'
    ];

    const lowRatingTips = [
      'Evaluasi ulang proses kerja dan komunikasi',
      'Minta feedback lebih detail dari pelanggan',
      'Diskusikan dengan supervisor untuk perbaikan',
      'Fokus pada aspek yang perlu ditingkatkan',
      'Jangan menyerah, gunakan sebagai pembelajaran'
    ];

    const improvementTips = [
      'Identifikasi area yang bisa diperbaiki',
      'Latih kemampuan komunikasi dan empati',
      'Perhatikan detail pekerjaan dengan lebih teliti',
      'Jalin hubungan baik dengan pelanggan'
    ];

    // Select tips based on rating
    if (rating >= 4) {
      return highRatingTips.slice(0, 3);
    } else if (rating <= 2) {
      return lowRatingTips.slice(0, 4);
    } else {
      return improvementTips.slice(0, 4);
    }
  }

}

module.exports = new CustomerRatingService();
