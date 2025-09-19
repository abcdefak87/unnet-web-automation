const express = require('express');
const { body, query, validationResult } = require('express-validator');
// PrismaClient imported from utils/database
const { authenticateToken, requireRole, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/permissions');
// WhatsApp Integration (New Modular Structure)
const WhatsApp = require('../whatsapp');
const { broadcastJobUpdate } = require('../services/websocketService');
const { uploadJobPhotos } = require('../middleware/upload');
const { getProblemDescription } = require('../utils/problemTypeMapper');

const router = express.Router();
const prisma = require('../utils/database');

// Get all jobs with filters
router.get('/', authenticateToken, [
  query('status').isIn(['pending', 'assigned', 'in_progress', 'completed', 'cancelled', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  query('type').isIn(['installation', 'repair', 'INSTALLATION', 'REPAIR', 'PSB', 'GANGGUAN']).optional(),
  query('category').isIn(['PSB', 'GANGGUAN']).optional(),
  query('approvalStatus').isIn(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  query('page').isInt({ min: 1 }).optional(),
  query('limit').isInt({ min: 1, max: 100 }).optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, type, category, approvalStatus, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (category) where.category = category;
    if (approvalStatus) where.approvalStatus = approvalStatus;

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          customer: true,
          createdBy: {
            select: { id: true, name: true }
          },
          approvedBy: {
            select: { id: true, name: true }
          },
          rejectedBy: {
            select: { id: true, name: true }
          },
          technicians: {
            include: {
              technician: {
                select: { id: true, name: true, phone: true }
              }
            }
          },
          inventoryUsage: {
            include: {
              item: {
                select: { id: true, name: true, unit: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: parseInt(skip),
        take: parseInt(limit)
      }),
      prisma.job.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        jobs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ error: 'Gagal mengambil data pekerjaan' });
  }
});

// Get pending jobs for approval (Admin/Super Admin only) - MUST BE BEFORE /:id route
router.get('/pending-approval', authenticateToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const pendingJobs = await prisma.job.findMany({
      where: { approvalStatus: 'PENDING' },
      include: {
        customer: true,
        createdBy: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: pendingJobs,
      count: pendingJobs.length
    });
  } catch (error) {
    console.error('Get pending jobs error:', error);
    res.status(500).json({ error: 'Gagal mengambil data pekerjaan yang menunggu persetujuan' });
  }
});

// Get single job by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    console.log('Fetching job with ID:', req.params.id);
    
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        createdBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!job) {
      console.log('Job not found:', req.params.id);
      return res.status(404).json({ error: 'Pekerjaan tidak ditemukan' });
    }

    console.log('Job found successfully:', job.jobNumber);
    res.json({ job });
  } catch (error) {
    console.error('Get job error details:', error);
    res.status(500).json({ error: 'Gagal mengambil data pekerjaan', details: error.message });
  }
});

// Create new job - SIMPLIFIED VALIDATION
router.post('/', authenticateToken, requirePermission('jobs:create'), uploadJobPhotos, [
  body('type').isIn(['installation', 'repair', 'INSTALLATION', 'REPAIR', 'PSB', 'GANGGUAN']),
  body('category').isIn(['PSB', 'GANGGUAN']).optional(),
  body('address').isLength({ min: 1 }).trim(),
  body('description').optional().trim(),
  body('problemType').optional().trim(),
  body('customerId').optional().isString(),
  body('scheduledDate').optional().isISO8601()
], async (req, res) => {
  try {
    console.log('=== JOB CREATION DEBUG ===');
    console.log('Request body:', req.body);
    console.log('Request files:', req.files);
    console.log('Content-Type:', req.headers['content-type']);
    console.log('User from token:', req.user);
    
    const errors = validationResult(req);
    console.log('Validation check - isEmpty:', errors.isEmpty());
    console.log('Validation errors array:', errors.array());
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      console.log('Request body for validation:', req.body);
      return res.status(400).json({ errors: errors.array() });
    }

    const { type, category, title, description, problemType, address, customerId, customer, scheduledDate, items = [] } = req.body;

    // Simplified validation - no strict KTP requirements
    console.log('=== SIMPLIFIED JOB CREATION ===');
    console.log('Job type:', type);
    console.log('Customer ID:', customerId);
    console.log('Has customer data:', !!customer);
    
    // Just ensure we have either customerId or customer data
    if (!customerId && !customer) {
      return res.status(400).json({ 
        error: 'Data pelanggan diperlukan untuk membuat job'
      });
    }

    // Generate job number based on category
    const jobCount = await prisma.job.count();
    const prefix = category === 'PSB' ? 'PSB' : category === 'GANGGUAN' ? 'GNG' : 'JOB';
    const jobNumber = `${prefix}-${Date.now()}-${String(jobCount + 1).padStart(4, '0')}`;

    // Create or find customer
    let customerRecord;
    
    if (customerId) {
      // Use existing customer
      console.log('Looking up customer with ID:', customerId);
      customerRecord = await prisma.customer.findUnique({
        where: { id: customerId }
      });
      
      if (!customerRecord) {
        console.log('Customer not found with ID:', customerId);
        return res.status(400).json({ error: `Pelanggan tidak ditemukan dengan ID: ${customerId}` });
      }
      
      // Validate customer data
      if (!customerRecord.address) {
        return res.status(400).json({ 
          error: 'Alamat customer tidak ditemukan. Silakan perbarui data customer terlebih dahulu.'
        });
      }
      
      console.log('Found customer:', customerRecord.name);
    } else if (customer && customer.phone) {
      // Create or find customer by phone
      console.log('Looking up customer by phone:', customer.phone);
      customerRecord = await prisma.customer.findFirst({
        where: { phone: customer.phone }
      });
    } else {
      console.log('Missing customer data - customerId:', customerId, 'customer:', !!customer);
      return res.status(400).json({ error: 'Data customerId atau data customer diperlukan' });
    }

    if (!customerRecord) {
      // Create new customer - simplified data requirements
      const customerData = {
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        email: customer.email || null,
        // Optional KTP data - can be filled freely
        ktpName: customer.ktpName || null,
        ktpNumber: customer.ktpNumber || null,
        ktpAddress: customer.ktpAddress || null,
        shareLocation: customer.shareLocation || null,
        installationType: type === 'INSTALLATION' ? 'NEW_INSTALLATION' : null,
        isVerified: false
      };
      
      console.log('Creating new customer with data:', customerData);
      
      customerRecord = await prisma.customer.create({
        data: customerData
      });
    }

    // Determine category and type
    const jobCategory = category || (type.toUpperCase() === 'PSB' ? 'PSB' : type.toUpperCase() === 'GANGGUAN' ? 'GANGGUAN' : 'PSB');
    const jobType = type.toUpperCase();
    
    // Prepare job data
    const jobData = {
      jobNumber,
      type: jobType,
      category: jobCategory,
      title: title || (jobCategory === 'PSB' ? 'Pemasangan WiFi' : 'Perbaikan Gangguan WiFi'),
      description: jobCategory === 'PSB' ? description : null,
      problemType: jobCategory === 'GANGGUAN' ? problemType : null,
      address,
      customerId: customerRecord.id,
      createdById: req.user.id,
      scheduledDate: scheduledDate ? new Date(scheduledDate) : null
    };

    // Add photo URLs if uploaded (handle files array from upload.any()) - ALL OPTIONAL
    if (req.files && req.files.length > 0) {
      console.log('Processing uploaded files:', req.files.length);
      req.files.forEach(file => {
        console.log('File field:', file.fieldname, 'filename:', file.filename);
        if (file.fieldname === 'housePhoto') {
          jobData.housePhotoUrl = `/uploads/jobs/${file.filename}`;
        } else if (file.fieldname === 'idCardPhoto') {
          jobData.idCardPhotoUrl = `/uploads/jobs/${file.filename}`;
        } else if (file.fieldname === 'customerIdPhoto') {
          jobData.idCardPhotoUrl = `/uploads/jobs/${file.filename}`;
        }
      });
    } else {
      console.log('No files uploaded - proceeding without photos');
    }
    
    // Photos are now completely optional for all job types
    console.log('Job data prepared:', {
      jobNumber: jobData.jobNumber,
      type: jobData.type,
      customerId: jobData.customerId,
      hasPhotos: !!(jobData.housePhotoUrl || jobData.idCardPhotoUrl)
    });

    // Create job with inventory usage
    const job = await prisma.$transaction(async (tx) => {
      const newJob = await tx.job.create({
        data: {
          ...jobData,
          approvalStatus: 'APPROVED', // Auto-approve jobs created through system
          approvedAt: new Date(),
          approvedById: req.user.id,
          status: 'OPEN' // Make immediately available to technicians
        },
        include: {
          customer: true,
          createdBy: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      // Create inventory usage records
      if (items.length > 0) {
        const inventoryUsageData = items.map(item => ({
          jobId: newJob.id,
          itemId: item.itemId,
          quantityUsed: parseInt(item.quantity)
        }));

        await tx.inventoryUsage.createMany({
          data: inventoryUsageData
        });

        // Update item stock (decrease)
        for (const item of items) {
          await tx.item.update({
            where: { id: item.itemId },
            data: {
              currentStock: {
                decrement: parseInt(item.quantity)
              }
            }
          });

          // Log inventory movement
          await tx.inventoryLog.create({
            data: {
              itemId: item.itemId,
              type: 'OUT',
              quantity: parseInt(item.quantity),
              notes: `Used for job ${newJob.jobNumber}`,
              jobId: newJob.id
            }
          });
        }
      }

      return newJob;
    });

    // Use integrated notifier via Notification queue + direct socket
    try {
      const mapsLink = job.latitude && job.longitude
        ? `https://www.google.com/maps?q=${job.latitude},${job.longitude}`
        : (job.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}` : null);
      // Get problem description using utility function

      const message = (
        `🚨 *Tiket Baru GANGGUAN*\n\n` +
        `🎫 Tiket: ${job.jobNumber}\n` +
        `👤 Pelanggan: ${job.customer?.name || '-'}\n` +
        `📞 Kontak: ${job.customer?.phone || '-'}\n` +
        `🔧 Masalah: ${getProblemDescription(job)}\n` +
        `📍 Alamat: ${job.address || '-'}\n` +
        `${mapsLink ? '🗺️ Lokasi: ' + mapsLink + '\n' : ''}` +
        `⏰ Status: ${job.status}\n\n` +
        
        `🎯 *PILIH AKSI:*\n` +
        `1️⃣ AMBIL JOB\n` +
        `2️⃣ BATAL\n\n` +
        
        `💡 *Ketik angka untuk memilih aksi!*`
      );

      // Broadcast to all active technicians
      const techs = await prisma.technician.findMany({ where: { isActive: true } });
      for (const tech of techs) {
        const normalizePhone = (p) => {
          if (!p) return null;
          let n = p.toString().replace(/\D/g, '');
          if (n.startsWith('0')) n = '62' + n.substring(1);
          if (!n.startsWith('62')) n = '62' + n;
          return n;
        };
        const jid = tech.whatsappJid || (normalizePhone(tech.phone) ? `${normalizePhone(tech.phone)}@s.whatsapp.net` : null);
        if (!jid) continue;
        await prisma.notification.create({ data: { type: 'WHATSAPP', recipient: jid, message, status: 'PENDING', jobId: job.id } });
        try { if (global.whatsappSocket && global.whatsappSocket.user) await global.whatsappSocket.sendMessage(jid, { text: message }); } catch (e) {}
      }
    } catch (whatsappError) {
      console.error('WhatsApp integrated broadcast error:', whatsappError);
    }

    // Broadcast real-time update to dashboard
    try {
      broadcastJobUpdate(job, 'CREATED');
    } catch (wsError) {
      console.error('WebSocket broadcast error:', wsError);
    }

    res.status(201).json({ 
      success: true,
      message: 'Pekerjaan berhasil dibuat', 
      data: job 
    });
  } catch (error) {
    console.error('=== JOB CREATION ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error details:', error);
    res.status(500).json({ 
      error: 'Gagal membuat pekerjaan',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Update job status
router.put('/:id/status', authenticateToken, [
  body('status').isIn(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, notes } = req.body;
    const jobId = req.params.id;

    const job = await prisma.job.update({
      where: { id: jobId },
      data: {
        status,
        ...(status === 'COMPLETED' && { completedAt: new Date() }),
        ...(notes && { completionNotes: notes })
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

    res.json({ message: 'Status pekerjaan berhasil diperbarui', job });
  } catch (error) {
    console.error('Update job status error:', error);
    res.status(500).json({ error: 'Gagal memperbarui status pekerjaan' });
  }
});

// Assign technicians to job (admin/superadmin only)
router.post('/:id/assign', authenticateToken, requireRole(['admin', 'superadmin']), [
  body('technicianIds').isArray({ min: 1, max: 1 }),
  body('scheduledDate').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { technicianIds, scheduledDate } = req.body;
    const jobId = req.params.id;

    // Check if job exists and is assignable
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { technicians: true }
    });

    if (!job) {
      return res.status(404).json({ error: 'Pekerjaan tidak ditemukan' });
    }

    if (job.status !== 'OPEN') {
      return res.status(400).json({ error: 'Pekerjaan tidak tersedia untuk penugasan' });
    }

    // Replace assignments safely: clear and reinsert unique technician IDs
    const uniqueTechIds = Array.from(new Set(technicianIds));
    await prisma.jobTechnician.deleteMany({ where: { jobId } });
    if (uniqueTechIds.length > 0) {
      await prisma.jobTechnician.createMany({
        data: uniqueTechIds.map(technicianId => ({ jobId, technicianId }))
      });
    }

    // Update job status, auto-approve, and optional schedule
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'ASSIGNED',
        approvalStatus: 'APPROVED',
        approvedAt: new Date(),
        approvedById: req.user.id,
        ...(scheduledDate && { scheduledDate: new Date(scheduledDate) })
      }
    });

    const updatedJob = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        customer: true,
        technicians: {
          include: {
            technician: true
          }
        }
      }
    });
    if (!updatedJob) {
      return res.status(500).json({ error: 'Gagal memuat ulang pekerjaan setelah penugasan' });
    }

    // Broadcast real-time update
    try {
      broadcastJobUpdate(updatedJob, 'ASSIGNED');
    } catch (wsError) {
      console.error('WebSocket broadcast error:', wsError);
    }

    // Notify assigned technicians via WhatsApp with full details
    try {
      const normalizePhone = (p) => {
        if (!p) return null;
        let n = p.toString().replace(/\D/g, '');
        if (n.startsWith('0')) n = '62' + n.substring(1);
        if (!n.startsWith('62')) n = '62' + n;
        return n;
      };

      const buildMapsLink = (job) => {
        if (job.latitude && job.longitude) {
          return `https://www.google.com/maps?q=${job.latitude},${job.longitude}`;
        }
        if (job.address) {
          const q = encodeURIComponent(job.address);
          return `https://www.google.com/maps/search/?api=1&query=${q}`;
        }
        return null;
      };

      const mapsLink = buildMapsLink(updatedJob);
      
      // Get problem description using utility function

      const detailText = (techName) => (
        `📢 *Penugasan Tiket ${updatedJob.category || updatedJob.type}*\n\n` +
        `👤 Pelanggan: ${updatedJob.customer?.name || '-'}\n` +
        `📞 Kontak: ${updatedJob.customer?.phone || '-'}\n` +
        `🔧 Masalah: ${getProblemDescription(updatedJob)}\n` +
        `📍 Alamat: ${updatedJob.address || '-'}\n` +
        `${mapsLink ? '🗺️ Lokasi: ' + mapsLink + '\n' : ''}` +
        `${updatedJob.scheduledDate ? '⏰ Jadwal: ' + new Date(updatedJob.scheduledDate).toLocaleString('id-ID') + '\n' : ''}` +
        `🔧 Ditugaskan kepada: ${techName}\n` +
        `🧾 Tiket: ${updatedJob.jobNumber}`
      );

      for (const jt of updatedJob.technicians || []) {
        const tech = jt.technician;
        if (!tech) continue;
        const jid = tech.whatsappJid || (normalizePhone(tech.phone) ? `${normalizePhone(tech.phone)}@s.whatsapp.net` : null);
        if (!jid) continue;

        // Queue notification in DB (processed by bot)
        await prisma.notification.create({
          data: {
            type: 'WHATSAPP',
            recipient: jid,
            message: detailText(tech.name || 'Teknisi'),
            status: 'PENDING',
            jobId
          }
        });

        // Try direct send if socket exists (non-blocking)
        try {
          if (global.whatsappSocket && global.whatsappSocket.user) {
            await global.whatsappSocket.sendMessage(jid, { text: detailText(tech.name || 'Teknisi') });
          }
        } catch (e) {
          console.warn('Direct WA send failed (assign notify):', e.message);
        }
      }

      // Notify customer confirmation via WhatsApp
      try {
        const custPhone = updatedJob.customer?.phone ? normalizePhone(updatedJob.customer.phone) : null;
        if (custPhone) {
          const custJid = `${custPhone}@s.whatsapp.net`;
          const assignedTechs = (updatedJob.technicians || []).map(jt => jt.technician?.name).filter(Boolean).join(', ');
          const customerMsg = (
            `✅ *Tiket Anda Sedang Diproses*\n\n` +
            `🧾 Tiket: ${updatedJob.jobNumber}\n` +
            `🔧 Teknisi: ${assignedTechs || '-'}\n` +
            `${updatedJob.scheduledDate ? '⏰ Jadwal: ' + new Date(updatedJob.scheduledDate).toLocaleString('id-ID') + '\n' : ''}` +
            `${mapsLink ? '🗺️ Lokasi: ' + mapsLink + '\n' : ''}` +
            `📍 Alamat: ${updatedJob.address || '-'}\n\n` +
            `Mohon siapkan lokasi/akses agar teknisi dapat bekerja dengan lancar.`
          );

          await prisma.notification.create({
            data: {
              type: 'WHATSAPP',
              recipient: custJid,
              message: customerMsg,
              status: 'PENDING',
              jobId
            }
          });

          try {
            if (global.whatsappSocket && global.whatsappSocket.user) {
              await global.whatsappSocket.sendMessage(custJid, { text: customerMsg });
            }
          } catch (e) {
            console.warn('Direct WA send failed (customer notify):', e.message);
          }
        }
      } catch (custErr) {
        console.warn('Customer WhatsApp notify error:', custErr.message);
      }
    } catch (notifyErr) {
      console.error('WhatsApp notify on assign error:', notifyErr);
    }

    res.json({ message: 'Teknisi berhasil ditugaskan', job: updatedJob });
  } catch (error) {
    console.error('Assign technicians error:', error);
    res.status(500).json({ error: 'Gagal menugaskan teknisi' });
  }
});

// Technician confirm assignment (accept/decline)
router.post('/:id/confirm', authenticateToken, requireRole(['user', 'technician', 'admin', 'superadmin']), [
  body('action').isIn(['ACCEPT', 'DECLINE'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { action } = req.body;
    const jobId = req.params.id;

    // Fetch job with assignments
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        technicians: { include: { technician: true } },
        customer: true
      }
    });

    if (!job) {
      return res.status(404).json({ error: 'Pekerjaan tidak ditemukan' });
    }

    if (job.status !== 'ASSIGNED') {
      return res.status(400).json({ error: 'Pekerjaan tidak dalam status DITUGASKAN' });
    }

    // Determine acting technician (for role user). Admin/superadmin may confirm for any.
    let actingTechnicianId = null;
    if (req.user.role === 'user') {
      // Match user.phone to technician.phone
      if (!req.user.phone) {
        return res.status(403).json({ error: 'Identitas teknisi tidak terhubung dengan pengguna' });
      }
      const technician = await prisma.technician.findUnique({ where: { phone: req.user.phone } });
      if (!technician) {
        return res.status(403).json({ error: 'Data teknisi tidak ditemukan untuk pengguna saat ini' });
      }
      actingTechnicianId = technician.id;

      // Ensure this technician is assigned to the job
      const isAssigned = job.technicians.some(t => t.technicianId === actingTechnicianId);
      if (!isAssigned) {
        return res.status(403).json({ error: 'Anda tidak ditugaskan untuk pekerjaan ini' });
      }
    }

    if (action === 'ACCEPT') {
      // Mark acceptedAt for all assigned or for the acting tech
      if (actingTechnicianId) {
        await prisma.jobTechnician.update({
          where: { jobId_technicianId: { jobId, technicianId: actingTechnicianId } },
          data: { acceptedAt: new Date() }
        });
      } else {
        // Admin confirms on behalf of all assigned technicians
        await prisma.jobTechnician.updateMany({
          where: { jobId },
          data: { acceptedAt: new Date() }
        });
      }

      // Keep status ASSIGNED until start
      const updatedJob = await prisma.job.findUnique({
        where: { id: jobId },
        include: { technicians: { include: { technician: true } }, customer: true }
      });

      try { broadcastJobUpdate(updatedJob, 'CONFIRMED'); } catch (e) { console.error('WS error confirm:', e); }
      return res.json({ message: 'Penugasan diterima', job: updatedJob });
    }

    // DECLINE
    if (actingTechnicianId) {
      await prisma.jobTechnician.delete({ where: { jobId_technicianId: { jobId, technicianId: actingTechnicianId } } });
    } else {
      // Admin declines on behalf: clear all assignments
      await prisma.jobTechnician.deleteMany({ where: { jobId } });
    }

    // If no technicians left, set job back to OPEN
    const remaining = await prisma.jobTechnician.count({ where: { jobId } });
    const jobAfter = await prisma.job.update({
      where: { id: jobId },
      data: { status: remaining > 0 ? 'ASSIGNED' : 'OPEN' },
      include: { technicians: { include: { technician: true } }, customer: true }
    });

    try { broadcastJobUpdate(jobAfter, 'DECLINED'); } catch (e) { console.error('WS error decline:', e); }
    return res.json({ message: 'Penugasan ditolak', job: jobAfter });
  } catch (error) {
    console.error('Confirm assignment error:', error);
    res.status(500).json({ error: 'Gagal mengonfirmasi penugasan' });
  }
});

// Self-assign job (technician/user picks an OPEN job)
router.post('/:id/self-assign', authenticateToken, requireRole(['user', 'technician']), async (req, res) => {
  try {
    const jobId = req.params.id;

    // Load job with current assignments
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { technicians: true, customer: true }
    });

    if (!job) {
      return res.status(404).json({ error: 'Pekerjaan tidak ditemukan' });
    }

    if (job.category !== 'PSB') {
      return res.status(400).json({ error: 'Penugasan mandiri hanya diperbolehkan untuk tiket PSB' });
    }

    if (job.status !== 'OPEN' && job.status !== 'ASSIGNED') {
      return res.status(400).json({ error: 'Pekerjaan tidak tersedia untuk penugasan mandiri' });
    }

    // Resolve current user -> technician
    const userPhone = req.user.phone || req.user.whatsappNumber;
    if (!userPhone) {
      return res.status(403).json({ error: 'Akun pengguna tidak terhubung dengan nomor telepon teknisi' });
    }
    const normalizedPhone = userPhone.replace(/\D/g, '').replace(/^0/, '62').startsWith('62') ? userPhone.replace(/\D/g, '').replace(/^0/, '62') : '62' + userPhone.replace(/\D/g, '');
    const technician = await prisma.technician.findFirst({ where: { phone: normalizedPhone } });
    if (!technician) {
      return res.status(403).json({ error: 'Data teknisi tidak ditemukan untuk pengguna saat ini' });
    }

    // Check if already assigned
    const alreadyAssigned = job.technicians.some(t => t.technicianId === technician.id);
    if (alreadyAssigned) {
      return res.status(400).json({ error: 'Anda sudah ditugaskan untuk pekerjaan ini' });
    }

    // Limit to max 1 technician
    if (job.technicians.length >= 1) {
      return res.status(400).json({ error: 'Pekerjaan ini sudah memiliki teknisi' });
    }

    // Create assignment
    await prisma.jobTechnician.create({
      data: {
        jobId,
        technicianId: technician.id,
        role: job.technicians.length === 0 ? 'PRIMARY' : 'SECONDARY'
      }
    });

    // Update job status to ASSIGNED if it was OPEN
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: { status: 'ASSIGNED' },
      include: { technicians: { include: { technician: true } }, customer: true }
    });

    try { broadcastJobUpdate(updatedJob, 'SELF_ASSIGNED'); } catch (e) { console.error('WS error self-assign:', e); }

    res.json({ message: 'Berhasil mengambil tiket', job: updatedJob });
  } catch (error) {
    console.error('Self-assign error:', error);
    res.status(500).json({ error: 'Failed to self-assign job' });
  }
});

// Complete job with photo
router.put('/:id/complete', authenticateToken, uploadJobPhotos, [
  body('notes').optional().trim(),
  body('technicianLocation').optional().trim()
], async (req, res) => {
  try {
    const { notes, technicianLocation } = req.body;
    const jobId = req.params.id;

    const updateData = {
      status: 'COMPLETED',
      completedAt: new Date(),
      completionNotes: notes,
      technicianLocation
    };

    if (req.files?.completionPhoto) {
      updateData.completionPhotoUrl = `/uploads/jobs/${req.files.completionPhoto[0].filename}`;
    }

    const job = await prisma.job.update({
      where: { id: jobId },
      data: updateData,
      include: {
        customer: true,
        technicians: {
          include: {
            technician: true
          }
        }
      }
    });

    res.json({ message: 'Job completed successfully', job });
  } catch (error) {
    console.error('Complete job error:', error);
    res.status(500).json({ error: 'Failed to complete job' });
  }
});

// Approve job (Admin/Super Admin only)
router.put('/:id/approve', authenticateToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const jobId = req.params.id;
    const { notes } = req.body;

    // Check if job exists and is pending
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        customer: true,
        createdBy: { select: { id: true, name: true } }
      }
    });

    if (!job) {
      return res.status(404).json({ error: 'Pekerjaan tidak ditemukan' });
    }

    if (job.approvalStatus !== 'PENDING') {
      return res.status(400).json({ error: 'Job is not pending approval' });
    }

    // Update job approval status
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        approvalStatus: 'APPROVED',
        approvedAt: new Date(),
        approvedById: req.user.id,
        status: 'OPEN' // Make it available for technicians
      },
      include: {
        customer: true,
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } }
      }
    });

    // Skip legacy WhatsApp.getWhatsAppClient broadcasting; using integrated notifier elsewhere

    // Broadcast real-time update to dashboard
    try {
      broadcastJobUpdate(updatedJob, 'APPROVED');
    } catch (wsError) {
      console.error('WebSocket broadcast error:', wsError);
    }

    res.json({ 
      success: true,
      message: 'Pekerjaan disetujui dan disiarkan ke teknisi', 
      data: updatedJob 
    });
  } catch (error) {
    console.error('Approve job error:', error);
    res.status(500).json({ error: 'Gagal menyetujui pekerjaan' });
  }
});

// Reject job (Admin/Super Admin only)
router.put('/:id/reject', authenticateToken, requireRole(['admin', 'superadmin']), [
  body('reason').isLength({ min: 1 }).trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const jobId = req.params.id;
    const { reason } = req.body;

    // Check if job exists and is pending
    const job = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      return res.status(404).json({ error: 'Pekerjaan tidak ditemukan' });
    }

    if (job.approvalStatus !== 'PENDING') {
      return res.status(400).json({ error: 'Job is not pending approval' });
    }

    // Update job rejection status
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        approvalStatus: 'REJECTED',
        rejectedAt: new Date(),
        rejectedById: req.user.id,
        rejectionReason: reason,
        status: 'CANCELLED'
      },
      include: {
        customer: true,
        createdBy: { select: { id: true, name: true } },
        rejectedBy: { select: { id: true, name: true } }
      }
    });

    // Broadcast real-time update to dashboard
    try {
      broadcastJobUpdate(updatedJob, 'REJECTED');
    } catch (wsError) {
      console.error('WebSocket broadcast error:', wsError);
    }

    res.json({ 
      success: true,
      message: 'Pekerjaan ditolak', 
      data: updatedJob 
    });
  } catch (error) {
    console.error('Reject job error:', error);
    res.status(500).json({ error: 'Gagal menolak pekerjaan' });
  }
});

// Delete job
router.delete('/:id', authenticateToken, requirePermission('jobs:delete'), async (req, res) => {
  try {
    const jobId = req.params.id;

    // Get job data before deletion for WebSocket broadcast
    const jobToDelete = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        customer: true,
        technicians: { include: { technician: true } }
      }
    });

    if (!jobToDelete) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Delete related records first
    await prisma.jobTechnician.deleteMany({
      where: { jobId: jobId }
    });

    // Delete the job
    await prisma.job.delete({
      where: { id: jobId }
    });

    // Broadcast real-time update to dashboard
    try {
      const { broadcastJobUpdate } = require('../services/websocketService');
      broadcastJobUpdate(jobToDelete, 'DELETED');
    } catch (wsError) {
      console.error('WebSocket broadcast error for job deletion:', wsError);
    }

    res.json({ message: 'Pekerjaan berhasil dihapus' });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ error: 'Gagal menghapus pekerjaan' });
  }
});

// Update job
router.put('/:id', authenticateToken, requirePermission('jobs:edit'), uploadJobPhotos, [
  body('type').isIn(['INSTALLATION', 'REPAIR']).optional(),
  body('customerId').isString().optional(),
  body('address').isLength({ min: 5 }).trim().optional(),
  body('description').optional().trim(),
  body('priority').isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  body('status').isIn(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const jobId = req.params.id;
    const { type, customerId, address, description, priority, status } = req.body;

    // Check if job exists
    const existingJob = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!existingJob) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Update job
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        ...(type && { type }),
        ...(customerId && { customerId }),
        ...(address && { address }),
        ...(description !== undefined && { description }),
        ...(priority && { priority }),
        ...(status && { status })
      },
      include: {
        customer: true,
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        technicians: {
          include: {
            technician: true
          }
        }
      }
    });

    // Broadcast real-time update
    try {
      broadcastJobUpdate(updatedJob, 'UPDATED');
    } catch (wsError) {
      console.error('WebSocket broadcast error:', wsError);
    }

    res.json({ 
      success: true,
      message: 'Pekerjaan berhasil diperbarui', 
      data: updatedJob 
    });
  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({ error: 'Gagal memperbarui pekerjaan' });
  }
});

module.exports = router;
