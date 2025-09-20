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

}

module.exports = new CustomerRatingService();
