/**
 * Bot Database Service
 * Handles database operations for WhatsApp bot
 */

const prisma = require('../../utils/database');

class BotDatabaseService {
  // Helper: normalize phone to 62 format - flexible format support
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

  // Check existing technician by phone/jid - flexible format support
  async checkExistingTechnician(phone) {
    try {
      const normalized = this.normalizePhone(phone);
      const originalPhone = phone;
      const phoneWithoutCountry = phone.replace(/^62/, '0');
      
      const technician = await prisma.technician.findFirst({
        where: {
          OR: [
            { phone: normalized },
            { phone: originalPhone },
            { phone: phoneWithoutCountry },
            { whatsappJid: normalized ? normalized + '@s.whatsapp.net' : undefined },
            { whatsappJid: originalPhone ? originalPhone + '@s.whatsapp.net' : undefined },
            { whatsappJid: phoneWithoutCountry ? phoneWithoutCountry + '@s.whatsapp.net' : undefined }
          ]
        }
      });
      return !!technician;
    } catch (error) {
      console.error('Error checking existing technician:', error);
      return false;
    }
  }

  // Check TechnicianRegistration status by phone
  async getTechnicianRegistrationStatus(phone) {
    try {
      const normalized = this.normalizePhone(phone);
      const reg = await prisma.technicianRegistration.findFirst({
        where: { phone: normalized, status: 'PENDING' }
      });
      return reg;
    } catch (error) {
      console.error('Error getting technician registration status:', error);
      return null;
    }
  }

  // Create TechnicianRegistration entry
  async createTechnicianRegistration({ name, phone, whatsappJid }) {
    try {
      const normalized = this.normalizePhone(phone);
      const [firstName, ...rest] = (name || '').trim().split(' ').filter(Boolean);
      const lastName = rest.join(' ') || null;

      const reg = await prisma.technicianRegistration.create({
        data: {
          telegramChatId: whatsappJid || (normalized ? normalized + '@s.whatsapp.net' : null),
          telegramUsername: null,
          firstName: firstName || (name || 'Teknisi'),
          lastName,
          phone: normalized,
          status: 'PENDING'
        }
      });
      return reg;
    } catch (error) {
      console.error('Error creating technician registration:', error);
      throw error;
    }
  }
  // Get technician by WhatsApp JID
  async getTechnicianByJid(jid) {
    try {
      return await prisma.technician.findUnique({
        where: { whatsappJid: jid }
      });
    } catch (error) {
      console.error('Error getting technician by JID:', error);
      return null;
    }
  }

  // Register new technician
  async registerTechnician(phoneNumber, name) {
    try {
      const normalized = this.normalizePhone(phoneNumber);
      const whatsappJid = normalized + '@s.whatsapp.net';
      
      // Check if already registered
      const existing = await prisma.technician.findFirst({
        where: {
          OR: [
            { whatsappJid },
            { phone: normalized }
          ]
        }
      });

      if (existing) {
        return { success: false, message: 'Nomor ini sudah terdaftar!' };
      }

      await prisma.technician.create({
        data: {
          name: name,
          phone: normalized,
          whatsappJid: whatsappJid,
          isActive: true,
          isAvailable: true
        }
      });

      return { success: true, message: 'Berhasil mendaftar sebagai teknisi!' };
    } catch (error) {
      console.error('Error registering technician:', error);
      return { success: false, message: 'Gagal mendaftar: ' + error.message };
    }
  }

  // Get available jobs
  async getAvailableJobs() {
    try {
      const jobs = await prisma.job.findMany({
        where: {
          status: {
            in: ['OPEN', 'ASSIGNED'] // Job yang bisa diambil (belum selesai)
          },
          technicians: {
            none: {} // Job yang belum ada teknisi
          }
        },
        include: {
          customer: true,
          technicians: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      console.log(`🔍 getAvailableJobs: Found ${jobs.length} jobs`);
      jobs.forEach(job => {
        console.log(`  - ${job.jobNumber}: status=${job.status}, technicians=${job.technicians.length}`);
      });
      
      return jobs;
    } catch (error) {
      console.error('Error getting available jobs:', error);
      return [];
    }
  }

  // Get job by job number
  async getJobByNumber(jobNumber) {
    try {
      return await prisma.job.findFirst({
        where: {
          jobNumber: jobNumber
        },
        include: {
          customer: true,
          technicians: {
            include: {
              technician: true
            }
          }
        }
      });
    } catch (error) {
      console.error('Error getting job by number:', error);
      return null;
    }
  }

  // Get technician's assigned jobs
  async getTechnicianJobs(technicianId) {
    try {
      return await prisma.job.findMany({
        where: {
          technicians: {
            some: {
              technicianId: technicianId
            }
          },
          status: {
            in: ['ASSIGNED', 'IN_PROGRESS']
          }
        },
        include: {
          customer: true,
          technicians: {
            where: {
              technicianId: technicianId
            }
          }
        }
      });
    } catch (error) {
      console.error('Error getting technician jobs:', error);
      return [];
    }
  }

  // Assign job to technician
  async assignJob(jobId, technicianId) {
    try {
      // Create JobTechnician relation
      await prisma.jobTechnician.create({
        data: {
          jobId: jobId,
          technicianId: technicianId,
          role: 'PRIMARY',
          assignedAt: new Date()
        }
      });

      // Update job status
      return await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'ASSIGNED'
        }
      });
    } catch (error) {
      console.error('Error assigning job:', error);
      throw error;
    }
  }

  // Update job status
  async updateJobStatus(jobId, status) {
    try {
      return await prisma.job.update({
        where: { id: jobId },
        data: { status }
      });
    } catch (error) {
      console.error('Error updating job status:', error);
      throw error;
    }
  }

  // Get technician statistics (enhanced version)
  async getTechnicianStats(phoneNumber) {
    try {
      const EnhancedStatsService = require('../../services/EnhancedTechnicianStatsService');
      return await EnhancedStatsService.getEnhancedTechnicianStats(phoneNumber);
    } catch (error) {
      console.error('Error getting enhanced technician stats:', error);
      // Fallback to basic stats
      return await this.getBasicTechnicianStats(phoneNumber);
    }
  }

  // Basic technician statistics (fallback) - flexible format support
  async getBasicTechnicianStats(phoneNumber) {
    try {
      const normalized = this.normalizePhone(phoneNumber);
      const originalPhone = phoneNumber;
      const phoneWithoutCountry = phoneNumber.replace(/^62/, '0');
      
      console.log(`[DEBUG] getBasicTechnicianStats for:`, {
        original: phoneNumber,
        normalized,
        phoneWithoutCountry
      });
      
      const technician = await prisma.technician.findFirst({
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

      if (!technician) {
        return null;
      }

      const completedJobs = await prisma.job.count({
        where: {
          technicians: {
            some: {
              technicianId: technician.id
            }
          },
          status: 'COMPLETED'
        }
      });

      const activeJobs = await prisma.job.count({
        where: {
          technicians: {
            some: {
              technicianId: technician.id
            }
          },
          status: {
            in: ['ASSIGNED', 'IN_PROGRESS']
          }
        }
      });

      const totalJobs = completedJobs + activeJobs;

      return {
        basic: {
          totalJobs,
          completedJobs,
          activeJobs,
          completionRate: totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0
        },
        rating: {
          averageRating: technician.totalRating && technician.ratingCount > 0 ? 
            Math.round((technician.totalRating / technician.ratingCount) * 10) / 10 : 0,
          ratingCount: technician.ratingCount || 0
        }
      };
    } catch (error) {
      console.error('Error getting basic technician stats:', error);
      return null;
    }
  }

  // Assign job to technician with phone number
  async assignJobToTechnician(jobNumber, phoneNum) {
    try {
      // Find technician by phone
      const technician = await prisma.technician.findFirst({
        where: { 
          OR: [
            { whatsappJid: phoneNum + '@s.whatsapp.net' },
            { phone: phoneNum }
          ]
        }
      });

      if (!technician) {
        return { success: false, message: 'Anda belum terdaftar sebagai teknisi. Silakan /daftar terlebih dahulu.' };
      }

      // Find job by number
      const job = await prisma.job.findFirst({
        where: { jobNumber },
        include: { technicians: true }
      });

      console.log(`🔍 Debug job ${jobNumber}:`, {
        found: !!job,
        status: job?.status,
        techniciansCount: job?.technicians?.length || 0,
        technicians: job?.technicians?.map(t => t.technicianId) || []
      });

      if (!job) {
        return { success: false, message: 'Pekerjaan tidak ditemukan.' };
      }

      // Check if job is available for assignment
      if (job.status !== 'OPEN' && job.status !== 'ASSIGNED') {
        console.log(`❌ Job ${jobNumber} status: ${job.status} (not available)`);
        return { success: false, message: 'Pekerjaan ini sudah diambil atau selesai.' };
      }

      // Check if job already has a technician assigned
      if (job.technicians && job.technicians.length > 0) {
        console.log(`❌ Job ${jobNumber} already has ${job.technicians.length} technician(s)`);
        return { success: false, message: 'Pekerjaan ini sudah diambil teknisi lain.' };
      }

      // Assign job using JobTechnician relation
      await prisma.jobTechnician.create({
        data: {
          jobId: job.id,
          technicianId: technician.id,
          role: 'PRIMARY',
          assignedAt: new Date()
        }
      });

      // Update job status
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'ASSIGNED'
        }
      });

      // Notify customer that job has been assigned
      try {
        const CustomerNotificationService = require('../../services/CustomerNotificationService');
        const jobWithCustomer = await prisma.job.findUnique({
          where: { id: job.id },
          include: { customer: true }
        });
        if (jobWithCustomer && jobWithCustomer.customer) {
          await CustomerNotificationService.notifyJobAssigned(jobWithCustomer, technician);
        }
      } catch (notificationError) {
        console.error('Failed to notify customer about job assignment:', notificationError);
      }

      return { success: true, message: 'Pekerjaan berhasil diambil' };
    } catch (error) {
      console.error('Error assigning job:', error);
      return { success: false, message: 'Gagal mengambil pekerjaan: ' + error.message };
    }
  }

  // Start job
  async startJob(jobNumber, phoneNum) {
    try {
      // Find technician
      const technician = await prisma.technician.findFirst({
        where: { 
          OR: [
            { whatsappJid: phoneNum + '@s.whatsapp.net' },
            { phone: phoneNum }
          ]
        }
      });

      if (!technician) {
        return { success: false, message: 'Anda belum terdaftar sebagai teknisi.' };
      }

      // Find job
      const job = await prisma.job.findFirst({
        where: { 
          jobNumber,
          technicians: {
            some: {
              technicianId: technician.id
            }
          }
        }
      });

      if (!job) {
        return { success: false, message: 'Pekerjaan tidak ditemukan atau bukan milik Anda.' };
      }

      if (job.status !== 'ASSIGNED') {
        return { success: false, message: 'Pekerjaan sudah dimulai atau selesai.' };
      }

      // Update job status
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'IN_PROGRESS'
        }
      });

      // Update JobTechnician acceptedAt
      await prisma.jobTechnician.updateMany({
        where: {
          jobId: job.id,
          technician: {
            OR: [
              { phone: phoneNum },
              { whatsappJid: phoneNum + '@s.whatsapp.net' }
            ]
          }
        },
        data: {
          acceptedAt: new Date()
        }
      });

      // Notify customer that job is in progress
      try {
        const CustomerNotificationService = require('../../services/CustomerNotificationService');
        const jobWithCustomer = await prisma.job.findUnique({
          where: { id: job.id },
          include: { customer: true }
        });
        if (jobWithCustomer && jobWithCustomer.customer) {
          await CustomerNotificationService.notifyJobInProgress(jobWithCustomer, technician);
        }
      } catch (notificationError) {
        console.error('Failed to notify customer about job in progress:', notificationError);
      }

      return { success: true, message: 'Pekerjaan dimulai' };
    } catch (error) {
      console.error('Error starting job:', error);
      return { success: false, message: 'Gagal memulai pekerjaan: ' + error.message };
    }
  }

  // Complete job
  async completeJob(jobNumber, phoneNum, notes = '') {
    try {
      // Find technician
      const technician = await prisma.technician.findFirst({
        where: { 
          OR: [
            { whatsappJid: phoneNum + '@s.whatsapp.net' },
            { phone: phoneNum }
          ]
        }
      });

      if (!technician) {
        return { success: false, message: 'Anda belum terdaftar sebagai teknisi.' };
      }

      // Find job
      const job = await prisma.job.findFirst({
        where: { 
          jobNumber,
          technicians: {
            some: {
              technicianId: technician.id
            }
          }
        }
      });

      if (!job) {
        return { success: false, message: 'Pekerjaan tidak ditemukan atau bukan milik Anda.' };
      }

      if (job.status === 'COMPLETED') {
        return { success: false, message: 'Pekerjaan sudah selesai.' };
      }

      // Update job status
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          notes: notes || job.notes
        }
      });

      // Notify customer that job is completed
      try {
        const CustomerNotificationService = require('../../services/CustomerNotificationService');
        const jobWithCustomer = await prisma.job.findUnique({
          where: { id: job.id },
          include: { customer: true }
        });
        if (jobWithCustomer && jobWithCustomer.customer) {
          await CustomerNotificationService.notifyJobCompleted(jobWithCustomer, technician, notes);
        }
      } catch (notificationError) {
        console.error('Failed to notify customer about job completion:', notificationError);
      }

      // Request customer rating
      try {
        const CustomerRatingService = require('../../services/CustomerRatingService');
        const jobWithCustomer = await prisma.job.findUnique({
          where: { id: job.id },
          include: { customer: true }
        });
        if (jobWithCustomer && jobWithCustomer.customer) {
          await CustomerRatingService.requestCustomerRating(jobWithCustomer, technician);
          console.log('✅ Rating request sent to customer');
        }
      } catch (ratingError) {
        console.error('Failed to request customer rating:', ratingError);
      }

      return { success: true, message: 'Pekerjaan selesai' };
    } catch (error) {
      console.error('Error completing job:', error);
      return { success: false, message: 'Gagal menyelesaikan pekerjaan: ' + error.message };
    }
  }

  // Get pending notifications
  async getPendingNotifications() {
    try {
      const notifs = await prisma.notification.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: 20
      });
      return notifs;
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  }

  // Mark notification as sent
  async markNotificationSent(notificationId) {
    try {
      await prisma.notification.update({
        where: { id: notificationId },
        data: { status: 'SENT', sentAt: new Date() }
      });
      return true;
    } catch (error) {
      console.error('Error marking notification:', error);
      return false;
    }
  }
}

module.exports = new BotDatabaseService();
