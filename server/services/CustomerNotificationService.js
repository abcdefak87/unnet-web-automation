/**
 * Customer Notification Service
 * Handles WhatsApp notifications to customers for ticket status changes
 */

const prisma = require('../utils/database');
const logger = require('../utils/logger');

class CustomerNotificationService {
  constructor() {
    this.normalizePhone = this.normalizePhone.bind(this);
  }

  /**
   * Normalize phone number to Indonesian format (62)
   */
  normalizePhone(phone) {
    if (!phone) return null;
    let p = phone.toString().replace(/\D/g, '');
    if (p.startsWith('0')) p = '62' + p.substring(1);
    if (!p.startsWith('62')) p = '62' + p;
    return p;
  }

  /**
   * Send WhatsApp message to customer
   */
  async sendMessageToCustomer(customerPhone, message, jobId = null) {
    try {

      const normalizedPhone = this.normalizePhone(customerPhone);
      if (!normalizedPhone) {
        return { success: false, error: 'Invalid phone number' };
      }

      const jid = normalizedPhone + '@s.whatsapp.net';
      
      // Use the same notification system as technicians
      await prisma.notification.create({ 
        data: { 
          type: 'WHATSAPP', 
          recipient: jid, 
          message, 
          status: 'PENDING', 
          jobId: jobId 
        } 
      });
      
      logger.info(`Customer notification queued via notification table to ${normalizedPhone}`);
      return { success: true };
    } catch (error) {
      logger.error('Failed to send customer notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Notify customer when disturbance ticket is created
   */
  async notifyTicketCreated(job) {
    try {
      if (!job.customer || !job.customer.phone) {
        logger.warn('No customer phone number for ticket notification');
        return { success: false, error: 'No customer phone' };
      }

      let message;
      if (job.category === 'GANGGUAN') {
        message = `🎫 *TIKET GANGGUAN DITERIMA*

Halo ${job.customer.name || 'Pelanggan'},

Tiket gangguan Anda telah berhasil diterima dan sedang diproses.

📋 *Detail Tiket:*
🎫 Nomor: ${job.jobNumber}
🔧 Masalah: ${job.problemType || job.description || 'Gangguan WiFi'}
📍 Alamat: ${job.address}
⏰ Status: OPEN
📅 Dibuat: ${new Date(job.createdAt).toLocaleString('id-ID')}

Teknisi akan segera menghubungi Anda untuk penanganan gangguan.

Terima kasih atas kesabaran Anda.`;
      } else if (job.category === 'PSB') {
        message = `🎫 *TIKET PSB DITERIMA*

Halo ${job.customer.name || 'Pelanggan'},

Tiket pemasangan WiFi Anda telah berhasil diterima dan sedang diproses.

📋 *Detail Tiket:*
🎫 Nomor: ${job.jobNumber}
📦 Paket: ${job.packageType || 'WiFi'}
🔧 Instalasi: ${job.installationType || 'Standar'}
📍 Alamat: ${job.address}
⏰ Status: OPEN
📅 Dibuat: ${new Date(job.createdAt).toLocaleString('id-ID')}

Teknisi akan segera menghubungi Anda untuk koordinasi pemasangan WiFi.

Terima kasih atas kepercayaan Anda.`;
      } else {
        // Generic message for other ticket types
        message = `🎫 *TIKET DITERIMA*

Halo ${job.customer.name || 'Pelanggan'},

Tiket Anda telah berhasil diterima dan sedang diproses.

📋 *Detail Tiket:*
🎫 Nomor: ${job.jobNumber}
📍 Alamat: ${job.address}
⏰ Status: OPEN
📅 Dibuat: ${new Date(job.createdAt).toLocaleString('id-ID')}

Teknisi akan segera menghubungi Anda.

Terima kasih.`;
      }

      return await this.sendMessageToCustomer(job.customer.phone, message, job.id);
    } catch (error) {
      logger.error('Failed to notify ticket created:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Notify customer when technician takes the job
   */
  async notifyJobAssigned(job, technician) {
    try {
      if (!job.customer || !job.customer.phone) {
        logger.warn('No customer phone number for job assignment notification');
        return { success: false, error: 'No customer phone' };
      }

      let message;
      if (job.category === 'GANGGUAN') {
        message = `👨‍🔧 *TEKNISI DITUGASKAN*

Halo ${job.customer.name || 'Pelanggan'},

Tiket gangguan Anda telah ditugaskan kepada teknisi.

📋 *Detail Tiket:*
🎫 Nomor: ${job.jobNumber}
👨‍🔧 Teknisi: ${technician.name}
📞 Kontak Teknisi: ${technician.phone || 'Hubungi admin'}
⏰ Status: ASSIGNED

Teknisi akan segera menghubungi Anda untuk koordinasi penanganan gangguan.

Terima kasih.`;
      } else if (job.category === 'PSB') {
        message = `👨‍🔧 *TEKNISI DITUGASKAN*

Halo ${job.customer.name || 'Pelanggan'},

Tiket pemasangan WiFi Anda telah ditugaskan kepada teknisi.

📋 *Detail Tiket:*
🎫 Nomor: ${job.jobNumber}
👨‍🔧 Teknisi: ${technician.name}
📞 Kontak Teknisi: ${technician.phone || 'Hubungi admin'}
⏰ Status: ASSIGNED

Teknisi akan segera menghubungi Anda untuk koordinasi jadwal pemasangan WiFi.

Terima kasih.`;
      } else {
        // Generic message for other ticket types
        message = `👨‍🔧 *TEKNISI DITUGASKAN*

Halo ${job.customer.name || 'Pelanggan'},

Tiket Anda telah ditugaskan kepada teknisi.

📋 *Detail Tiket:*
🎫 Nomor: ${job.jobNumber}
👨‍🔧 Teknisi: ${technician.name}
📞 Kontak Teknisi: ${technician.phone || 'Hubungi admin'}
⏰ Status: ASSIGNED

Teknisi akan segera menghubungi Anda.

Terima kasih.`;
      }

      return await this.sendMessageToCustomer(job.customer.phone, message, job.id);
    } catch (error) {
      logger.error('Failed to notify job assigned:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Notify customer when technician starts working on the job
   */
  async notifyJobInProgress(job, technician) {
    try {
      if (!job.customer || !job.customer.phone) {
        logger.warn('No customer phone number for job in progress notification');
        return { success: false, error: 'No customer phone' };
      }

      let message;
      if (job.category === 'GANGGUAN') {
        message = `🚀 *PENANGANAN GANGGUAN DIMULAI*

Halo ${job.customer.name || 'Pelanggan'},

Teknisi telah memulai penanganan gangguan Anda.

📋 *Detail Tiket:*
🎫 Nomor: ${job.jobNumber}
👨‍🔧 Teknisi: ${technician.name}
⏰ Status: IN PROGRESS
🕐 Dimulai: ${new Date().toLocaleString('id-ID')}

Teknisi sedang bekerja untuk mengatasi gangguan Anda. Mohon bersabar.

Terima kasih.`;
      } else if (job.category === 'PSB') {
        message = `🚀 *PEMASANGAN WIFI DIMULAI*

Halo ${job.customer.name || 'Pelanggan'},

Teknisi telah memulai proses pemasangan WiFi Anda.

📋 *Detail Tiket:*
🎫 Nomor: ${job.jobNumber}
👨‍🔧 Teknisi: ${technician.name}
📦 Paket: ${job.packageType || 'WiFi'}
⏰ Status: IN PROGRESS
🕐 Dimulai: ${new Date().toLocaleString('id-ID')}

Teknisi sedang melakukan pemasangan WiFi. Mohon bersabar.

Terima kasih.`;
      } else {
        // Generic message for other ticket types
        message = `🚀 *PEKERJAAN DIMULAI*

Halo ${job.customer.name || 'Pelanggan'},

Teknisi telah memulai pekerjaan Anda.

📋 *Detail Tiket:*
🎫 Nomor: ${job.jobNumber}
👨‍🔧 Teknisi: ${technician.name}
⏰ Status: IN PROGRESS
🕐 Dimulai: ${new Date().toLocaleString('id-ID')}

Teknisi sedang bekerja. Mohon bersabar.

Terima kasih.`;
      }

      return await this.sendMessageToCustomer(job.customer.phone, message, job.id);
    } catch (error) {
      logger.error('Failed to notify job in progress:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Notify customer when job is completed
   */
  async notifyJobCompleted(job, technician, completionNotes = '') {
    try {
      if (!job.customer || !job.customer.phone) {
        logger.warn('No customer phone number for job completion notification');
        return { success: false, error: 'No customer phone' };
      }

      let message;
      if (job.category === 'GANGGUAN') {
        message = `✅ *GANGGUAN BERHASIL DIATASI*

Halo ${job.customer.name || 'Pelanggan'},

Gangguan WiFi Anda telah berhasil diatasi!

📋 *Detail Tiket:*
🎫 Nomor: ${job.jobNumber}
👨‍🔧 Teknisi: ${technician.name}
✅ Status: COMPLETED
🕐 Selesai: ${new Date().toLocaleString('id-ID')}
${completionNotes ? `📝 Catatan: ${completionNotes}` : ''}

Silakan coba koneksi WiFi Anda. Jika masih ada masalah, jangan ragu untuk menghubungi kami.

Terima kasih telah mempercayai layanan kami!`;
      } else if (job.category === 'PSB') {
        message = `✅ *PEMASANGAN WIFI SELESAI*

Halo ${job.customer.name || 'Pelanggan'},

Pemasangan WiFi Anda telah berhasil diselesaikan!

📋 *Detail Tiket:*
🎫 Nomor: ${job.jobNumber}
👨‍🔧 Teknisi: ${technician.name}
📦 Paket: ${job.packageType || 'WiFi'}
✅ Status: COMPLETED
🕐 Selesai: ${new Date().toLocaleString('id-ID')}
${completionNotes ? `📝 Catatan: ${completionNotes}` : ''}

WiFi Anda sudah siap digunakan! Silakan coba koneksi dan nikmati layanan internet Anda.

Terima kasih telah mempercayai layanan kami!`;
      } else {
        // Generic message for other ticket types
        message = `✅ *PEKERJAAN SELESAI*

Halo ${job.customer.name || 'Pelanggan'},

Pekerjaan Anda telah berhasil diselesaikan!

📋 *Detail Tiket:*
🎫 Nomor: ${job.jobNumber}
👨‍🔧 Teknisi: ${technician.name}
✅ Status: COMPLETED
🕐 Selesai: ${new Date().toLocaleString('id-ID')}
${completionNotes ? `📝 Catatan: ${completionNotes}` : ''}

Terima kasih telah mempercayai layanan kami!`;
      }

      const result = await this.sendMessageToCustomer(job.customer.phone, message, job.id);
      
      // Send rating request after a delay to ensure completion message is sent first
      if (result.success) {
        // Use a more reliable delay method
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay
        
        try {
          const CustomerRatingService = require('./CustomerRatingService');
          await CustomerRatingService.requestCustomerRating(job, technician);
        } catch (ratingError) {
          logger.error('Failed to send rating request:', ratingError);
        }
      }
      
      return result;
    } catch (error) {
      logger.error('Failed to notify job completed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Notify customer when job is cancelled
   */
  async notifyJobCancelled(job, reason = '') {
    try {
      if (!job.customer || !job.customer.phone) {
        logger.warn('No customer phone number for job cancellation notification');
        return { success: false, error: 'No customer phone' };
      }

      let message;
      if (job.category === 'GANGGUAN') {
        message = `❌ *TIKET DIBATALKAN*

Halo ${job.customer.name || 'Pelanggan'},

Tiket gangguan Anda telah dibatalkan.

📋 *Detail Tiket:*
🎫 Nomor: ${job.jobNumber}
❌ Status: CANCELLED
🕐 Dibatalkan: ${new Date().toLocaleString('id-ID')}
${reason ? `📝 Alasan: ${reason}` : ''}

Jika Anda masih mengalami masalah, silakan buat tiket baru atau hubungi customer service kami.

Terima kasih.`;
      } else if (job.category === 'PSB') {
        message = `❌ *TIKET PSB DIBATALKAN*

Halo ${job.customer.name || 'Pelanggan'},

Tiket pemasangan WiFi Anda telah dibatalkan.

📋 *Detail Tiket:*
🎫 Nomor: ${job.jobNumber}
❌ Status: CANCELLED
🕐 Dibatalkan: ${new Date().toLocaleString('id-ID')}
${reason ? `📝 Alasan: ${reason}` : ''}

Jika Anda masih berminat untuk pemasangan WiFi, silakan daftar kembali atau hubungi customer service kami.

Terima kasih.`;
      } else {
        // Generic message for other ticket types
        message = `❌ *TIKET DIBATALKAN*

Halo ${job.customer.name || 'Pelanggan'},

Tiket Anda telah dibatalkan.

📋 *Detail Tiket:*
🎫 Nomor: ${job.jobNumber}
❌ Status: CANCELLED
🕐 Dibatalkan: ${new Date().toLocaleString('id-ID')}
${reason ? `📝 Alasan: ${reason}` : ''}

Jika Anda masih membutuhkan bantuan, silakan buat tiket baru atau hubungi customer service kami.

Terima kasih.`;
      }

      return await this.sendMessageToCustomer(job.customer.phone, message, job.id);
    } catch (error) {
      logger.error('Failed to notify job cancelled:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send custom notification to customer
   */
  async sendCustomNotification(customerPhone, title, message, jobId = null) {
    try {
      const fullMessage = `📢 *${title}*\n\n${message}`;
      return await this.sendMessageToCustomer(customerPhone, fullMessage, jobId);
    } catch (error) {
      logger.error('Failed to send custom notification:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new CustomerNotificationService();
