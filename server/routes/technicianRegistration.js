const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateToken, requireRole } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const { sendWelcomeMessage } = require('../services/whatsapp/otpService');

// Get all pending registrations
router.get('/pending', authenticateToken, requireRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const registrations = await prisma.technicianRegistration.findMany({
      where: {
        status: 'PENDING'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    res.json(registrations);
  } catch (error) {
    console.error('Error fetching pending registrations:', error);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// Get all registrations (with filters)
router.get('/', authenticateToken, requireRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const { status } = req.query;
    
    const where = status ? { status } : {};
    
    const registrations = await prisma.technicianRegistration.findMany({
      where,
      include: {
        approvedBy: {
          select: {
            id: true,
            name: true
          }
        },
        rejectedBy: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    res.json(registrations);
  } catch (error) {
    console.error('Error fetching registrations:', error);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// Approve registration
router.post('/:id/approve', authenticateToken, requireRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Get registration details
    const registration = await prisma.technicianRegistration.findUnique({
      where: { id }
    });
    
    if (!registration) {
      return res.status(404).json({ error: 'Registrasi tidak ditemukan' });
    }
    
    if (registration.status !== 'PENDING') {
      return res.status(400).json({ error: 'Registrasi sudah diproses' });
    }
    
    // Helper: normalize phone to 62 format
    const normalizePhone = (phone) => {
      if (!phone) return null;
      let p = phone.toString().replace(/\D/g, '');
      if (p.startsWith('0')) p = '62' + p.substring(1);
      if (!p.startsWith('62')) p = '62' + p;
      return p;
    };

    // Helper: generate username and strong password
    const slugify = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 10);
    const generatePassword = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
      let pass = '';
      for (let i = 0; i < 10; i++) pass += chars[Math.floor(Math.random() * chars.length)];
      return pass;
    };

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update registration status
      const updatedReg = await tx.technicianRegistration.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedById: userId
        }
      });
      
      // Create technician record
      const techPhone = normalizePhone(registration.phone || registration.telegramChatId);
      const technician = await tx.technician.create({
        data: {
          name: `${registration.firstName} ${registration.lastName || ''}`.trim(),
          phone: techPhone,
          whatsappJid: registration.telegramChatId || (techPhone ? `${techPhone}@s.whatsapp.net` : null),
          isActive: true,
          isAvailable: true
        }
      });
      
      // Create or link user account for login
      // Strategy: username from name + last4 phone, ensure unique
      const baseUsername = `${slugify(registration.firstName)}${(techPhone || '').slice(-4) || ''}` || `tech${Date.now().toString().slice(-4)}`;
      let username = baseUsername;
      let counter = 0;
      // Ensure unique username
      while (await tx.user.findUnique({ where: { username } })) {
        counter += 1;
        username = `${baseUsername}${counter}`;
      }

      // If a user with same whatsappNumber exists, reuse and update role/phone
      let user = await tx.user.findFirst({ where: { OR: [{ whatsappNumber: techPhone }, { phone: techPhone }] } });

      let plainPassword = null;
      if (!user) {
        plainPassword = generatePassword();
        const passwordHash = await bcrypt.hash(plainPassword, 10);
        user = await tx.user.create({
          data: {
            name: `${registration.firstName} ${registration.lastName || ''}`.trim() || username,
            username,
            password: passwordHash,
            role: 'technician',
            isActive: true,
            isVerified: true,
            phone: techPhone,
            whatsappNumber: techPhone
          }
        });
      } else {
        // Ensure role and linkage are correct
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            role: user.role || 'technician',
            isActive: true,
            isVerified: true,
            phone: user.phone || techPhone,
            whatsappNumber: user.whatsappNumber || techPhone
          }
        });
      }

      // Create notification for technician
      const notif = await tx.notification.create({
        data: {
          type: 'WHATSAPP',
          recipient: registration.telegramChatId || (techPhone ? `${techPhone}@s.whatsapp.net` : null),
          message: `🎉 *Selamat!*\n\nPendaftaran Anda sebagai teknisi telah *DISETUJUI*.\n\nAkun login dashboard telah dibuat:\n👤 Username: ${user.username}\n🔑 Password: ${plainPassword ? plainPassword : '(akun sudah ada)'}\n\n🔗 Dashboard: http://localhost:3000\n\nSegera masuk dan ganti password di menu Profil.\n\nAnda juga dapat:\n✅ Melihat pekerjaan tersedia (/jobs)\n✅ Mengambil pekerjaan (/ambil)\n✅ Melihat statistik (/stats)\n\nSelamat bekerja! 💪`,
          status: 'PENDING'
        }
      });
      console.log('Notification queued for technician credentials:', { id: notif.id, recipient: notif.recipient, status: notif.status });
      
      return { registration: updatedReg, technician, user, plainPassword };
    });
    
    // Kirim kredensial langsung via WhatsApp socket jika tersedia (non-blocking)
    try {
      const phone = result?.user?.whatsappNumber;
      if (phone && global.whatsappSocket && global.whatsappSocket.user) {
        const jid = phone.replace(/\D/g, '').replace(/^0/, '62').replace(/^(?!62)/, '62') + '@s.whatsapp.net';
        const directMsg = `🎉 *Akun Teknisi Dibuat*\n\n👤 Nama: ${result.user.name || 'Teknisi'}\n👥 Username: ${result.user.username}\n🔑 Password: ${result.plainPassword ? result.plainPassword : '(akun sudah ada)'}\n\n🔗 Dashboard: http://localhost:3000\n\nSegera login dan ganti password di menu Profil.`;
        await global.whatsappSocket.sendMessage(jid, { text: directMsg });
      }
    } catch (e) {
      console.warn('Direct WA credential send failed (non-blocking):', e.message);
    }

    res.json({
      success: true,
      message: 'Registration approved successfully',
      data: result
    });
  } catch (error) {
    console.error('Error approving registration:', error);
    res.status(500).json({ error: 'Failed to approve registration' });
  }
});

// Reject registration
router.post('/:id/reject', authenticateToken, requireRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;
    
    // Get registration details
    const registration = await prisma.technicianRegistration.findUnique({
      where: { id }
    });
    
    if (!registration) {
      return res.status(404).json({ error: 'Registrasi tidak ditemukan' });
    }
    
    if (registration.status !== 'PENDING') {
      return res.status(400).json({ error: 'Registrasi sudah diproses' });
    }
    
    // Update registration status
    const updatedReg = await prisma.technicianRegistration.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectedById: userId,
        rejectionReason: reason || 'Tidak memenuhi persyaratan'
      }
    });
    
    // Create notification for technician
    await prisma.notification.create({
      data: {
        type: 'WHATSAPP',
        recipient: registration.telegramUsername || `${registration.phone}@s.whatsapp.net`,
        message: `❌ *Pendaftaran Ditolak*\n\nMaaf, pendaftaran Anda sebagai teknisi telah ditolak.\n\nAlasan: ${reason || 'Tidak memenuhi persyaratan'}\n\nAnda dapat mendaftar kembali setelah memenuhi persyaratan yang diperlukan.`,
        status: 'PENDING'
      }
    });
    
    res.json({
      success: true,
      message: 'Registration rejected',
      data: updatedReg
    });
  } catch (error) {
    console.error('Error rejecting registration:', error);
    res.status(500).json({ error: 'Failed to reject registration' });
  }
});

// Get registration statistics
router.get('/stats', authenticateToken, requireRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const [total, pending, approved, rejected] = await Promise.all([
      prisma.technicianRegistration.count(),
      prisma.technicianRegistration.count({ where: { status: 'PENDING' } }),
      prisma.technicianRegistration.count({ where: { status: 'APPROVED' } }),
      prisma.technicianRegistration.count({ where: { status: 'REJECTED' } })
    ]);
    
    res.json({
      total,
      pending,
      approved,
      rejected
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;
