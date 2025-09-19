const express = require('express');
const { body, validationResult } = require('express-validator');
// PrismaClient imported from utils/database
const { authenticateToken, requirePermission } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

const router = express.Router();
const prisma = require('../utils/database');

// Get all pending registrations
router.get('/', authenticateToken, requirePermission('technicians:view'), async (req, res) => {
  try {
    const registrations = await prisma.technicianRegistration.findMany({
      include: {
        approvedBy: { select: { name: true } },
        rejectedBy: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: registrations
    });
  } catch (error) {
    console.error('Get registrations error:', error);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// Approve registration
router.post('/:id/approve', authenticateToken, requirePermission('technicians:create'), [
  body('name').isLength({ min: 2 }).trim(),
  body('phone').isMobilePhone('id-ID').trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, phone } = req.body;
    
    // Auto-detect admin bot status based on approver's role
    const approver = await prisma.user.findUnique({
      where: { id: req.user.id }
    });
    const isAdmin = approver && (approver.role === 'superadmin' || approver.role === 'admin');
    const registrationId = req.params.id;

    // Helper: normalize phone to 62 format
    const normalizePhone = (p) => {
      if (!p) return null;
      let n = p.toString().replace(/\D/g, '');
      if (n.startsWith('0')) n = '62' + n.substring(1);
      if (!n.startsWith('62')) n = '62' + n;
      return n;
    };
    const normalizedPhone = normalizePhone(phone);

    // Get registration
    const registration = await prisma.technicianRegistration.findUnique({
      where: { id: registrationId }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    if (registration.status !== 'PENDING') {
      return res.status(400).json({ error: 'Registration already processed' });
    }

    // Check if phone already exists as an active technician
    const existingTechnician = await prisma.technician.findFirst({
      where: { 
        phone: normalizedPhone,
        isActive: true
      }
    });

    if (existingTechnician) {
      return res.status(400).json({ error: 'Phone number already registered as active technician' });
    }

    // Check if there's a deleted technician with this phone that can be reactivated
    const deletedTechnician = await prisma.technician.findFirst({
      where: { phone: normalizedPhone }
    });

    let technician;
    if (deletedTechnician) {
      // Reactivate existing technician
      technician = await prisma.technician.update({
        where: { id: deletedTechnician.id },
        data: {
          name,
          whatsappJid: registration.telegramChatId || (normalizedPhone ? `${normalizedPhone}@s.whatsapp.net` : null),
          isActive: true,
          isAvailable: true,
          isAdmin: false  // Regular technicians are not admin bots
        }
      });
    } else {
      // Create new technician
      technician = await prisma.technician.create({
        data: {
          name,
          phone: normalizedPhone,
          whatsappJid: registration.telegramChatId || (normalizedPhone ? `${normalizedPhone}@s.whatsapp.net` : null),
          isActive: true,
          isAvailable: true,
          isAdmin: false  // Regular technicians are not admin bots
        }
      });
    }


    // Update registration status
    await prisma.technicianRegistration.update({
      where: { id: registrationId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedById: req.user.id
      }
    });

    // Create/login user account and send credentials via WhatsApp (integrated)
    try {
      // Username and password
      const slugify = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 10);
      const generatePassword = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
        let pass = '';
        for (let i = 0; i < 10; i++) pass += chars[Math.floor(Math.random() * chars.length)];
        return pass;
      };

      const baseUsername = `${slugify(name)}${(normalizedPhone || '').slice(-4)}` || `tech${Date.now().toString().slice(-4)}`;
      let username = baseUsername;
      let counter = 0;
      while (await prisma.user.findUnique({ where: { username } })) {
        counter += 1;
        username = `${baseUsername}${counter}`;
      }

      // Reuse existing user by phone/whatsapp, else create
      let user = await prisma.user.findFirst({ where: { OR: [{ whatsappNumber: normalizedPhone }, { phone: normalizedPhone }] } });
      let plainPassword = null;
      if (!user) {
        plainPassword = generatePassword();
        const passwordHash = await bcrypt.hash(plainPassword, 10);
        user = await prisma.user.create({
          data: {
            name: name || username,
            username,
            password: passwordHash,
            role: 'technician',
            isActive: true,
            isVerified: true,
            phone: normalizedPhone,
            whatsappNumber: normalizedPhone
          }
        });
      } else {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            role: user.role || 'technician',
            isActive: true,
            isVerified: true,
            phone: user.phone || normalizedPhone,
            whatsappNumber: user.whatsappNumber || normalizedPhone
          }
        });
      }

      const recipientJid = registration.telegramChatId || (normalizedPhone ? `${normalizedPhone}@s.whatsapp.net` : null);
      if (recipientJid) {
        await prisma.notification.create({
          data: {
            type: 'WHATSAPP',
            recipient: recipientJid,
            message: `🎉 *Registrasi Disetujui!*\n\nAkun login dashboard telah dibuat:\n👤 Username: ${user.username}\n🔑 Password: ${plainPassword ? plainPassword : '(akun sudah ada)'}\n\n🔗 Dashboard: http://localhost:3000\n\nSegera login dan ganti password.\n\nPerintah bot: /jobs, /myjobs, /ambil, /mulai, /selesai, /stats`,
            status: 'PENDING'
          }
        });
      }

      // Try direct send via socket (non-blocking)
      try {
        if (normalizedPhone && global.whatsappSocket && global.whatsappSocket.user) {
          const jid = `${normalizedPhone}@s.whatsapp.net`;
          const directMsg = `🎉 *Akun Teknisi Dibuat*\n\n👤 Nama: ${user.name || 'Teknisi'}\n👥 Username: ${user.username}\n🔑 Password: ${plainPassword ? plainPassword : '(akun sudah ada)'}\n\n🔗 Dashboard: http://localhost:3000\n\nSegera login dan ganti password.`;
          await global.whatsappSocket.sendMessage(jid, { text: directMsg });
        }
      } catch (e) {
        console.warn('Direct WA credential send failed (non-blocking):', e.message);
      }
    } catch (notifyError) {
      console.error('Failed to create user/send credentials:', notifyError);
    }

    res.json({
      success: true,
      message: 'Registration approved successfully',
      data: { technician }
    });
  } catch (error) {
    console.error('Approve registration error:', error);
    res.status(500).json({ error: 'Failed to approve registration' });
  }
});

// Reject registration
router.post('/:id/reject', authenticateToken, requirePermission('technicians:edit'), [
  body('reason').isLength({ min: 3 }).trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { reason } = req.body;
    const registrationId = req.params.id;

    // Get registration
    const registration = await prisma.technicianRegistration.findUnique({
      where: { id: registrationId }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    if (registration.status !== 'PENDING') {
      return res.status(400).json({ error: 'Registration already processed' });
    }

    // Update registration status
    await prisma.technicianRegistration.update({
      where: { id: registrationId },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectedById: req.user.id,
        rejectionReason: reason
      }
    });

    // Notify technician via WhatsApp (queue)
    try {
      const normalizePhone = (p) => {
        if (!p) return null;
        let n = p.toString().replace(/\D/g, '');
        if (n.startsWith('0')) n = '62' + n.substring(1);
        if (!n.startsWith('62')) n = '62' + n;
        return n;
      };
      const phone62 = normalizePhone(registration.phone);
      const recipientJid = registration.telegramChatId || (phone62 ? `${phone62}@s.whatsapp.net` : null);
      if (recipientJid) {
        await prisma.notification.create({
          data: {
            type: 'WHATSAPP',
            recipient: recipientJid,
            message: `❌ *Registrasi Ditolak*\n\nMaaf, registrasi Anda sebagai teknisi UNNET tidak dapat disetujui.\n\n📝 Alasan: ${reason}\n\nAnda dapat mendaftar ulang dengan /daftar setelah memperbaiki data.`,
            status: 'PENDING'
          }
        });
      }
    } catch (notifyError) {
      console.error('Failed to notify technician (reject):', notifyError);
    }

    res.json({
      success: true,
      message: 'Registration rejected successfully'
    });
  } catch (error) {
    console.error('Reject registration error:', error);
    res.status(500).json({ error: 'Failed to reject registration' });
  }
});

// Delete registration
router.delete('/:id', authenticateToken, requirePermission('technicians:delete'), async (req, res) => {
  try {
    await prisma.technicianRegistration.delete({
      where: { id: req.params.id }
    });

    res.json({ 
      success: true,
      message: 'Registration deleted successfully' 
    });
  } catch (error) {
    console.error('Delete registration error:', error);
    res.status(500).json({ error: 'Failed to delete registration' });
  }
});

module.exports = router;
