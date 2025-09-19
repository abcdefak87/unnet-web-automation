const express = require('express');
const { body, query, validationResult } = require('express-validator');
// PrismaClient imported from utils/database
const { authenticateToken, requireRole, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/permissions');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Import security middleware
const {
  registrationRateLimit,
  sanitizeRegistrationInput,
  validateGPS,
  validateUploadedFiles,
  sanitizeErrorResponse,
  auditRegistrationAttempt,
  generateCSRFToken,
  validateCSRFToken
} = require('../middleware/registrationSecurity');

// Email verification service removed - no longer required

const router = express.Router();
const prisma = require('../utils/database');

// Enhanced multer configuration for customer registration uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/customers/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate secure filename with crypto
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${file.fieldname}-${uniqueSuffix}-${sanitizedName}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 2 // Maximum 2 files (KTP and house photo)
  },
  fileFilter: (req, file, cb) => {
    // Allow files to be optional
    if (!file) {
      return cb(null, true);
    }
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    
    // Check MIME type
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
    }
    
    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return cb(new Error('Invalid file extension. Only .jpg, .jpeg, .png, and .webp files are allowed.'));
    }
    
    // Check for suspicious file names
    if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
      return cb(new Error('Invalid file name. File name contains invalid characters.'));
    }
    
    cb(null, true);
  }
});

// Get all customers
router.get('/', authenticateToken, requirePermission('customers:view'), [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('search').optional()
], async (req, res) => {
  try {
    console.log('=== CUSTOMERS API REQUEST ===');
    console.log('User:', req.user?.email, 'Role:', req.user?.role, 'Permissions:', req.user?.permissions);
    console.log('Query params:', req.query);
    console.log('Headers:', req.headers.authorization ? 'Token present' : 'No token');
    
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Customer query validation errors:', errors.array());
      return res.status(400).json({ 
        error: 'Invalid query parameters',
        details: errors.array()
      });
    }

    const { page = 1, limit = 20, search } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { phone: { contains: search.trim() } },
        { address: { contains: search.trim(), mode: 'insensitive' } }
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          _count: {
            select: { jobs: true }
          }
        },
        orderBy: { name: 'asc' },
        skip: parseInt(skip),
        take: parseInt(limit)
      }),
      prisma.customer.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        customers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get customers error:', error);
    
    // Handle specific Prisma errors
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Tidak ada pelanggan ditemukan' });
    }
    
    // Handle search query errors
    if (error.message.includes('Invalid') || error.message.includes('contains')) {
      return res.status(400).json({ error: 'Query pencarian tidak valid' });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Gagal mengambil data pelanggan',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get single customer with jobs
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        jobs: {
          include: {
            technicians: {
              include: {
                technician: {
                  select: { id: true, name: true }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
    }

    res.json({ customer });
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({ error: 'Gagal mengambil data pelanggan' });
  }
});

// Create new customer
router.post('/', authenticateToken, requirePermission('customers:create'), [
  body('name').isLength({ min: 2 }).trim(),
  body('phone').notEmpty().trim(),
  body('address').isLength({ min: 5 }).trim(),
  // KTP validation for new installations
  body('ktpName').optional().isLength({ min: 2 }).trim(),
  body('ktpNumber').optional().isLength({ min: 14, max: 16 }).trim(),
  body('ktpAddress').optional().isLength({ min: 5 }).trim(),
  body('ktpPhotoUrl').optional().trim(),
  body('shareLocation').optional().trim(),
  body('installationType').optional().isIn(['NEW_INSTALLATION', 'RELOCATION', 'UPGRADE'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Customer validation errors:', errors.array());
      return res.status(400).json({ 
        error: 'Validasi gagal',
        details: errors.array(),
        message: errors.array().map(e => `${e.path}: ${e.msg}`).join(', ')
      });
    }

    const { 
      name, 
      phone, 
      address, 
      latitude,
      longitude,
      ktpName,
      ktpNumber,
      ktpAddress,
      ktpPhotoUrl,
      shareLocation,
      installationType
    } = req.body;

    // Validate KTP requirements for new installations
    if (installationType === 'NEW_INSTALLATION') {
      if (!ktpName || !ktpNumber || !shareLocation || !ktpPhotoUrl) {
        return res.status(400).json({ 
          error: 'Data KTP lengkap wajib untuk pemasangan baru',
          required: ['ktpName', 'ktpNumber', 'shareLocation', 'ktpPhotoUrl']
        });
      }
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        phone,
        address,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        ktpName: ktpName || null,
        ktpNumber: ktpNumber || null,
        ktpAddress: ktpAddress || null,
        ktpPhotoUrl: ktpPhotoUrl || null,
        shareLocation: shareLocation || null,
        installationType: installationType || null,
        isVerified: false
      },
      include: {
        _count: {
          select: {
            jobs: true
          }
        }
      }
    });

    try {
      const broadcastCustomerUpdate = require('../services/websocketService').broadcastCustomerUpdate;
      broadcastCustomerUpdate(customer, 'created');
    } catch (wsError) {
      console.error('WebSocket broadcast error:', wsError);
    }

    res.status(201).json(customer);
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ error: 'Gagal membuat pelanggan' });
  }
});

// Update customer
router.put('/:id', authenticateToken, requirePermission('customers:edit'), [
  body('name').isLength({ min: 2 }).trim().optional(),
  body('phone').notEmpty().trim().optional(),
  body('address').isLength({ min: 5 }).trim().optional(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, phone, address } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (address) updateData.address = address;

    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: updateData
    });

    try {
      const broadcastCustomerUpdate = require('../services/websocketService').broadcastCustomerUpdate;
      broadcastCustomerUpdate(customer, 'updated');
    } catch (wsError) {
      console.error('WebSocket broadcast error:', wsError);
    }

    res.json({ 
      success: true,
      message: 'Pelanggan berhasil diperbarui', 
      data: { customer }
    });
  } catch (error) {
    console.error('Update customer error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
    }
    res.status(500).json({ error: 'Gagal memperbarui pelanggan' });
  }
});

// Delete customer
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Check if customer has jobs
    const jobCount = await prisma.job.count({
      where: { customerId: req.params.id }
    });

    if (jobCount > 0) {
      return res.status(400).json({ 
        error: 'Tidak dapat menghapus pelanggan yang memiliki pekerjaan',
        details: `Pelanggan memiliki ${jobCount} pekerjaan. Silakan selesaikan atau pindahkan pekerjaan terlebih dahulu.`
      });
    }

    const customer = await prisma.customer.delete({
      where: { id: req.params.id }
    });

    try {
      const broadcastCustomerUpdate = require('../services/websocketService').broadcastCustomerUpdate;
      broadcastCustomerUpdate(customer, 'deleted');
    } catch (wsError) {
      console.error('WebSocket broadcast error:', wsError);
    }

    res.json({ 
      success: true,
      message: 'Pelanggan berhasil dihapus' 
    });
  } catch (error) {
    console.error('Delete customer error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
    }
    res.status(500).json({ error: 'Gagal menghapus pelanggan' });
  }
});

// Get CSRF token for registration form
router.get('/register/csrf-token', generateCSRFToken, (req, res) => {
  try {
    console.log('CSRF token endpoint called:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      hasToken: !!req.csrfToken,
      timestamp: new Date().toISOString()
    });
    
    if (!req.csrfToken) {
      console.error('CSRF token not generated');
      return res.status(500).json({
        success: false,
        error: 'Failed to generate CSRF token'
      });
    }
    
    res.json({
      success: true,
      csrfToken: req.csrfToken,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('CSRF token endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Test endpoint to verify CSRF token is working
router.get('/register/test-csrf', generateCSRFToken, (req, res) => {
  res.json({
    success: true,
    message: 'CSRF endpoint is working',
    csrfToken: req.csrfToken,
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint to test form data parsing
router.post('/register/debug', upload.any(), (req, res) => {
  console.log('=== DEBUG ENDPOINT ===');
  console.log('Body:', req.body);
  console.log('Files:', req.files);
  console.log('Headers:', req.headers);
  console.log('=====================');
  
  res.json({
    success: true,
    message: 'Debug endpoint working',
    receivedData: {
      body: req.body,
      files: req.files,
      bodyKeys: Object.keys(req.body || {}),
      bodyValues: Object.values(req.body || {})
    }
  });
});

// Simple test endpoint without middleware
router.post('/register/simple', upload.any(), [
  body('name').isLength({ min: 2 }).trim().withMessage('Nama harus minimal 2 karakter'),
  body('phone').notEmpty().trim().withMessage('Nomor HP wajib diisi'),
  body('packageType').isIn(['10MBPS', '20MBPS', '50MBPS', '100MBPS']).withMessage('Paket internet wajib dipilih')
], async (req, res) => {
  try {
    console.log('=== SIMPLE REGISTRATION TEST ===');
    console.log('Body:', req.body);
    console.log('Files:', req.files);
    console.log('================================');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        error: 'Data tidak valid', 
        details: errors.array().map(e => ({ field: e.param, message: e.msg })) 
      });
    }

    res.json({
      success: true,
      message: 'Test registrasi sederhana berhasil',
      data: req.body
    });

  } catch (error) {
    console.error('Simple registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registrasi gagal',
      message: error.message
    });
  }
});

// Check phone number availability
router.post('/check-phone', [
  body('phone')
    .customSanitizer(v => (v || '').toString().replace(/\s+/g, '').replace(/^\+62/, '0'))
    .matches(/^0[0-9]{9,13}$/)
    .withMessage('Nomor HP tidak valid')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        error: 'Nomor HP tidak valid',
        details: errors.array()
      });
    }

    const { phone } = req.body;
    
    // Check if phone exists in customers table
    const existingCustomer = await prisma.customer.findFirst({
      where: { phone: phone },
      select: { id: true, name: true, registeredAt: true }
    });

    // Check if phone exists in users table (technicians)
    const existingUser = await prisma.user.findFirst({
      where: { 
        OR: [
          { phone: phone },
          { whatsappNumber: phone }
        ]
      },
      select: { id: true, name: true, role: true }
    });

    const exists = !!(existingCustomer || existingUser);
    
    res.json({
      success: true,
      exists: exists,
      data: {
        customer: existingCustomer,
        user: existingUser
      }
    });
  } catch (error) {
    console.error('Phone check error:', error);
    res.status(500).json({
      success: false,
      error: 'Gagal memeriksa nomor HP'
    });
  }
});

// Enhanced customer registration endpoint with comprehensive security (CAPTCHA removed)
router.post('/register', 
  registrationRateLimit, // Rate limiting
  upload.any(), // Accept any files (more flexible)
  sanitizeRegistrationInput, // Input sanitization
  validateCSRFToken, // CSRF protection
  validateGPS, // GPS validation
  validateUploadedFiles, // File validation
  auditRegistrationAttempt, // Audit logging
  [
    // Enhanced validation rules
    body('name')
      .isLength({ min: 2, max: 100 })
      .trim()
      .withMessage('Nama harus 2-100 karakter'),
    
    body('phone')
      .customSanitizer(v => (v || '').toString().replace(/\s+/g, '').replace(/^\+62/, '0'))
      .matches(/^0[0-9]{9,13}$/)
      .withMessage('Nomor HP tidak valid. Gunakan format 08xxxxxxxxxx'),
    
    body('address')
      .isLength({ min: 5, max: 500 })
      .trim()
      .withMessage('Alamat wajib diisi minimal 5 karakter'),
    
    body('ktpNumber')
      .optional({ checkFalsy: true, nullable: true })
      .matches(/^[0-9]{16}$/)
      .withMessage('Nomor KTP harus 16 digit'),
    
    body('ktpName')
      .optional({ checkFalsy: true, nullable: true })
      .isLength({ min: 2, max: 100 })
      .trim()
      .withMessage('Nama KTP harus 2-100 karakter'),
    
    body('ktpAddress')
      .optional({ checkFalsy: true, nullable: true })
      .isLength({ min: 0, max: 500 })
      .trim()
      .withMessage('Alamat KTP maksimal 500 karakter'),
    
    body('packageType')
      .isIn(['10MBPS', '20MBPS', '50MBPS', '100MBPS'])
      .withMessage('Paket internet wajib dipilih'),
    
    body('installationType')
      .optional()
      .isIn(['NEW_INSTALLATION', 'RELOCATION', 'UPGRADE'])
      .withMessage('Tipe instalasi tidak valid')
  ],
  async (req, res) => {
    try {
      // Debug logging
      console.log('=== REGISTRATION REQUEST DEBUG ===');
      console.log('Body:', req.body);
      console.log('Files:', req.files);
      console.log('Headers:', req.headers);
      console.log('===================================');

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({ 
          success: false,
          error: 'Data tidak valid', 
          details: errors.array().map(e => ({ field: e.param, message: e.msg })) 
        });
      }

      const {
        name, phone, address, ktpNumber, ktpName,
        ktpAddress, shareLocation, latitude, longitude, packageType, installationType
      } = req.body;

      // Use database transaction to prevent race conditions
      const result = await prisma.$transaction(async (tx) => {
        // Check for existing customer with unique constraints
        const existingCustomer = await tx.customer.findFirst({
          where: {
            OR: [
              { phone: phone },
              ...(ktpNumber ? [{ ktpNumber: ktpNumber }] : [])
            ]
          }
        });

        if (existingCustomer) {
          throw new Error('Customer already exists with this phone or KTP number');
        }

        // Prepare customer data with security fields
        const customerData = {
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(), // Address is now required
          ktpNumber: ktpNumber?.trim() || null,
          ktpName: ktpName?.trim() || null,
          ktpAddress: ktpAddress?.trim() || null,
          shareLocation: shareLocation?.trim() || null,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          installationType: installationType || 'NEW_INSTALLATION',
          isVerified: true, // Auto-verify customers without email verification
          registrationStatus: 'PENDING',
          packageType: packageType,
          registeredAt: new Date(),
          registrationIP: req.ip,
          userAgent: req.get('User-Agent')
        };

        // Add photo URLs
        if (req.files?.ktpPhoto) {
          customerData.ktpPhotoUrl = `/uploads/customers/${req.files.ktpPhoto[0].filename}`;
        }
        if (req.files?.housePhoto) {
          customerData.housePhotoUrl = `/uploads/customers/${req.files.housePhoto[0].filename}`;
        }

        // Create customer record
        const customer = await tx.customer.create({
          data: customerData
        });

        // Auto-create PSB ticket
        const jobCount = await tx.job.count();
        const jobNumber = `PSB-${Date.now()}-${String(jobCount + 1).padStart(4, '0')}`;

        const job = await tx.job.create({
          data: {
            jobNumber,
            type: 'PSB',
            category: 'PSB',
            title: `Pemasangan WiFi - ${name}`,
            description: `Tiket pemasangan WiFi untuk pelanggan baru`,
            address: customerData.address,
            customerId: customer.id,
            status: 'OPEN',
            priority: 'MEDIUM',
            housePhotoUrl: customerData.housePhotoUrl,
            idCardPhotoUrl: customerData.ktpPhotoUrl,
            createdById: null
          }
        });

        // Send notification to admin via WhatsApp (if available)
        try {
          const WhatsAppBot = require('../services/whatsapp/WhatsAppBot');
          const bot = WhatsAppBot.getInstance();
          const adminMessage = `🎫 *TIKET PSB BARU*

👤 <b>Nama:</b> ${name}
📞 <b>HP:</b> ${phone}
📍 <b>Alamat:</b> ${address}
📦 <b>Paket:</b> ${packageType}
🆔 <b>KTP:</b> ${ktpNumber || 'Tidak ada'}

🎫 <b>Tiket:</b> ${jobNumber}
📋 <b>Kategori:</b> PSB (Pasang WiFi)
✅ <b>Status:</b> Menunggu pemasangan

Silakan assign teknisi untuk pemasangan WiFi.`;

          console.log('Admin notification:', adminMessage);
        } catch (whatsappError) {
          console.error('WhatsApp notification error:', whatsappError);
        }

        return { customer, job };
      });

      res.status(201).json({
        success: true,
        message: 'Pendaftaran berhasil! Kami akan menghubungi Anda dalam 1x24 jam.',
        data: {
          id: result.customer.id,
          name: result.customer.name,
          phone: result.customer.phone,
          registrationStatus: result.customer.registrationStatus,
          jobNumber: result.job.jobNumber
        }
      });

    } catch (error) {
      // Use error sanitization middleware
      return sanitizeErrorResponse(error, req, res);
    }
  }
);

// Email verification endpoints removed - no longer required

// Get pending registrations (admin only)
router.get('/registrations/pending', authenticateToken, requirePermission('customers:view'), async (req, res) => {
  try {
    const pendingCustomers = await prisma.customer.findMany({
      where: {
        registrationStatus: 'PENDING'
      },
      orderBy: {
        registeredAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: pendingCustomers
    });
  } catch (error) {
    console.error('Get pending registrations error:', error);
    res.status(500).json({ error: 'Failed to fetch pending registrations' });
  }
});

// Approve customer registration
router.put('/registrations/:id/approve', authenticateToken, requirePermission('customers:edit'), async (req, res) => {
  try {
    const customerId = req.params.id;
    
    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        registrationStatus: 'APPROVED',
        isVerified: true,
        approvedAt: new Date(),
        approvedById: req.user.id
      }
    });

    // Find and activate the installation job
    const job = await prisma.job.findFirst({
      where: {
        customerId: customerId,
        type: 'INSTALLATION',
        status: 'OPEN'
      }
    });

    if (job) {
      // Broadcast job to technicians
      try {
        const { broadcastNewJob } = require('../utils/whatsappJobIntegration');
        await broadcastNewJob(job);
      } catch (broadcastError) {
        console.error('Job broadcast error:', broadcastError);
      }
    }

    res.json({
      success: true,
      message: 'Pendaftaran pelanggan disetujui',
      data: customer
    });
  } catch (error) {
    console.error('Approve registration error:', error);
    res.status(500).json({ error: 'Failed to approve registration' });
  }
});

// Reject customer registration
router.put('/registrations/:id/reject', authenticateToken, requirePermission('customers:edit'), [
  body('reason').isLength({ min: 1 }).trim().withMessage('Alasan penolakan wajib diisi')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const customerId = req.params.id;
    const { reason } = req.body;
    
    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        registrationStatus: 'REJECTED',
        rejectionReason: reason,
        rejectedAt: new Date(),
        rejectedById: req.user.id
      }
    });

    // Cancel related installation job
    await prisma.job.updateMany({
      where: {
        customerId: customerId,
        type: 'INSTALLATION',
        status: 'OPEN'
      },
      data: {
        status: 'CANCELLED',
        completionNotes: `Pendaftaran ditolak: ${reason}`
      }
    });

    res.json({
      success: true,
      message: 'Pendaftaran pelanggan ditolak',
      data: customer
    });
  } catch (error) {
    console.error('Reject registration error:', error);
    res.status(500).json({ error: 'Failed to reject registration' });
  }
});

module.exports = router;
