const prisma = require('./database');

/**
 * Integration utilities for WhatsApp bot with rating system
 */
class WhatsAppIntegration {
  
  /**
   * Send message through WhatsApp bot
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} message - Message content
   */
  static async sendMessage(phoneNumber, message) {
    try {
      // This function should integrate with your existing WhatsApp bot
      // For now, we'll create a notification that the bot can process
      
      const notification = await prisma.notification.create({
        data: {
          type: 'WHATSAPP_OUTBOUND',
          recipient: phoneNumber,
          message: message,
          status: 'PENDING',
          metadata: JSON.stringify({
            timestamp: new Date().toISOString(),
            source: 'RATING_SYSTEM'
          })
        }
      });

      console.log(`WhatsApp message queued: ${notification.id} -> ${phoneNumber}`);
      return { success: true, notificationId: notification.id };
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process outbound WhatsApp notifications
   * This should be called periodically by your WhatsApp bot
   */
  static async processOutboundNotifications() {
    try {
      const notifications = await prisma.notification.findMany({
        where: {
          type: 'WHATSAPP_OUTBOUND',
          status: 'PENDING'
        },
        orderBy: {
          createdAt: 'asc'
        },
        take: 5 // Process 5 at a time
      });

      const results = [];
      
      for (const notification of notifications) {
        try {
          // Mark as processing
          await prisma.notification.update({
            where: { id: notification.id },
            data: { status: 'PROCESSING' }
          });

          // Here you would call your actual WhatsApp bot send function
          // Example: await whatsappBot.sendMessage(notification.recipient, notification.message);
          
          // For now, we'll simulate success
          await prisma.notification.update({
            where: { id: notification.id },
            data: { 
              status: 'SENT',
              sentAt: new Date()
            }
          });

          results.push({ 
            notificationId: notification.id, 
            success: true, 
            recipient: notification.recipient 
          });
          
          console.log(`✅ WhatsApp message sent to ${notification.recipient}`);
        } catch (error) {
          console.error(`❌ Failed to send WhatsApp message ${notification.id}:`, error);
          
          await prisma.notification.update({
            where: { id: notification.id },
            data: { 
              status: 'FAILED',
              errorMessage: error.message
            }
          });

          results.push({ 
            notificationId: notification.id, 
            success: false, 
            error: error.message 
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error processing outbound notifications:', error);
      return [];
    }
  }

  /**
   * Process rating messages from WhatsApp
   * This should be called when bot receives a message starting with "RATING"
   */
  static async processRatingMessage(phoneNumber, message) {
    try {
      const CustomerRatingService = require('../services/CustomerRatingService');
      
      const result = await CustomerRatingService.processWhatsAppRating(phoneNumber, message);
      
      return {
        success: result.success,
        message: result.message,
        phoneNumber: phoneNumber
      };
    } catch (error) {
      console.error('Error processing rating message:', error);
      return {
        success: false,
        message: 'Terjadi kesalahan sistem. Silakan coba lagi.',
        phoneNumber: phoneNumber
      };
    }
  }

  /**
   * Normalize phone number for WhatsApp
   */
  static normalizePhone(phone) {
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
    
    // Format for WhatsApp
    return cleaned + '@s.whatsapp.net';
  }

  /**
   * Get pending rating requests
   */
  static async getPendingRatingRequests() {
    try {
      const requests = await prisma.notification.findMany({
        where: {
          type: 'RATING_REQUEST',
          status: 'PENDING'
        },
        include: {
          job: {
            include: {
              customer: true,
              technicians: {
                include: {
                  technician: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'asc'
        },
        take: 10
      });

      return requests.map(request => ({
        id: request.id,
        customerPhone: request.recipient,
        jobNumber: request.job?.jobNumber,
        technicianName: request.job?.technicians[0]?.technician?.name,
        message: request.message,
        createdAt: request.createdAt
      }));
    } catch (error) {
      console.error('Error getting pending rating requests:', error);
      return [];
    }
  }
}

module.exports = WhatsAppIntegration;
