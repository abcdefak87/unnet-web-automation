const prisma = require('../utils/database');

class WhatsAppNotificationService {
  /**
   * Send WhatsApp message through notification queue
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} message - Message content
   * @param {Object} metadata - Additional metadata
   */
  async sendMessage(phoneNumber, message, metadata = {}) {
    try {
      // Normalize phone number
      const normalizedPhone = this.normalizePhone(phoneNumber);
      
      // Create notification record
      const notification = await prisma.notification.create({
        data: {
          type: 'WHATSAPP_MESSAGE',
          recipient: normalizedPhone,
          message: message,
          status: 'PENDING',
          jobId: metadata.jobId || null
        }
      });

      console.log(`WhatsApp message queued for ${normalizedPhone}: ${message.substring(0, 50)}...`);
      return { success: true, notificationId: notification.id };
    } catch (error) {
      console.error('Error queuing WhatsApp message:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send rating request to customer
   * @param {Object} job - Job object
   * @param {Object} technician - Technician object
   */
  async sendRatingRequest(job, technician) {
    try {
      const message = this.generateRatingMessage(job, technician);
      
      const result = await this.sendMessage(job.customer.phone, message, {
        messageType: 'RATING_REQUEST',
        jobId: job.id,
        jobNumber: job.jobNumber,
        technicianName: technician.name,
        customerName: job.customer.name
      });

      if (result.success) {
        console.log(`Rating request sent to customer ${job.customer.phone} for job ${job.jobNumber}`);
      }

      return result;
    } catch (error) {
      console.error('Error sending rating request:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate rating request message
   */
  generateRatingMessage(job, technician) {
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
   * Process pending notifications
   */
  async processPendingNotifications() {
    try {
      const pendingNotifications = await prisma.notification.findMany({
        where: {
          type: 'WHATSAPP_MESSAGE',
          status: 'PENDING'
        },
        orderBy: {
          createdAt: 'asc'
        },
        take: 10 // Process 10 at a time
      });

      for (const notification of pendingNotifications) {
        try {
          // Mark as processing
          await prisma.notification.update({
            where: { id: notification.id },
            data: { status: 'PROCESSING' }
          });

          // Here you would integrate with your WhatsApp bot service
          // For now, we'll just mark as sent
          await prisma.notification.update({
            where: { id: notification.id },
            data: { 
              status: 'SENT',
              sentAt: new Date()
            }
          });

          console.log(`Processed notification ${notification.id} for ${notification.recipient}`);
        } catch (error) {
          console.error(`Error processing notification ${notification.id}:`, error);
          
          // Mark as failed
          await prisma.notification.update({
            where: { id: notification.id },
            data: { 
              status: 'FAILED',
              errorMessage: error.message
            }
          });
        }
      }

      return { processed: pendingNotifications.length };
    } catch (error) {
      console.error('Error processing pending notifications:', error);
      return { processed: 0, error: error.message };
    }
  }

  /**
   * Normalize phone number to Indonesian format
   */
  normalizePhone(phone) {
    if (!phone) return null;
    
    // Remove all non-digit characters
    let cleaned = phone.replace(/[^0-9]/g, '');
    
    // Remove leading zeros
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    // Add Indonesia country code if not present
    if (!cleaned.startsWith('62')) {
      cleaned = '62' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats() {
    try {
      const stats = await prisma.notification.groupBy({
        by: ['status'],
        _count: {
          status: true
        },
        where: {
          type: 'WHATSAPP_MESSAGE',
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      });

      const result = {
        total: 0,
        pending: 0,
        sent: 0,
        failed: 0,
        processing: 0
      };

      stats.forEach(stat => {
        result.total += stat._count.status;
        result[stat.status.toLowerCase()] = stat._count.status;
      });

      return result;
    } catch (error) {
      console.error('Error getting notification stats:', error);
      return null;
    }
  }
}

module.exports = new WhatsAppNotificationService();
