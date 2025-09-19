const express = require('express');
// PrismaClient imported from utils/database
const bcrypt = require('bcryptjs');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { createOTP, verifyOTP } = require('../utils/otp');
const { sendOTP, sendWelcomeMessage } = require('../services/whatsapp/otpService');

const router = express.Router();
const prisma = require('../utils/database');

// Get all users
router.get('/', authenticateToken, requirePermission('users:view'), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
        whatsappNumber: true,
        whatsappJid: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({ data: users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user by ID
router.get('/:id', authenticateToken, requirePermission('users:view'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id: id },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
        whatsappNumber: true,
        whatsappJid: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Step 1: Create new user and send OTP
router.post('/', authenticateToken, requirePermission('users:create'), async (req, res) => {
  try {
    const { name, whatsappNumber, username, password, role } = req.body;

    // Validate required fields
    if (!name || !whatsappNumber || !username || !password || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Format WhatsApp number
    let formattedNumber = whatsappNumber.replace(/\D/g, '');
    if (!formattedNumber.startsWith('62')) {
      formattedNumber = '62' + formattedNumber;
    }

    // Check if username already exists
    const existingUsername = await prisma.user.findUnique({
      where: { username }
    });

    if (existingUsername) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Check if WhatsApp number already exists
    const existingPhone = await prisma.user.findUnique({
      where: { whatsappNumber: formattedNumber }
    });

    if (existingPhone) {
      return res.status(400).json({ error: 'WhatsApp number already registered' });
    }

    // Create OTP
    const otp = await createOTP(formattedNumber, 'REGISTRATION');
    
    // Send OTP via WhatsApp
    const sent = await sendOTP(formattedNumber, otp.code, 'REGISTRATION');
    
    if (!sent) {
      return res.status(500).json({ error: 'Failed to send OTP. Make sure WhatsApp is connected.' });
    }

    // Store user data temporarily in session or return to frontend
    res.status(200).json({ 
      message: 'OTP sent to WhatsApp', 
      tempData: {
        name,
        username,
        password, // Will be hashed after OTP verification
        role,
        whatsappNumber: formattedNumber
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Step 2: Verify OTP and create user
router.post('/verify-otp', authenticateToken, requirePermission('users:create'), async (req, res) => {
  try {
    const { otp, name, username, password, role, whatsappNumber } = req.body;

    // Verify OTP
    const verification = await verifyOTP(whatsappNumber, otp, 'REGISTRATION');
    
    if (!verification.success) {
      return res.status(400).json({ error: verification.message });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        username,
        password: hashedPassword,
        role,
        whatsappNumber,
        phone: whatsappNumber,
        isActive: true,
        isVerified: true
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        isActive: true,
        whatsappNumber: true,
        createdAt: true
      }
    });

    // Send welcome message
    await sendWelcomeMessage(whatsappNumber, name, username);

    res.status(201).json(user);
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Failed to verify OTP and create user' });
  }
});

// Resend OTP
router.post('/resend-otp', authenticateToken, requirePermission('users:create'), async (req, res) => {
  try {
    const { whatsappNumber, type = 'REGISTRATION' } = req.body;

    if (!whatsappNumber) {
      return res.status(400).json({ error: 'WhatsApp number is required' });
    }

    // Format WhatsApp number
    let formattedNumber = whatsappNumber.replace(/\D/g, '');
    if (!formattedNumber.startsWith('62')) {
      formattedNumber = '62' + formattedNumber;
    }

    // Create new OTP
    const otp = await createOTP(formattedNumber, type);
    
    // Send OTP via WhatsApp
    const sent = await sendOTP(formattedNumber, otp.code, type);
    
    if (!sent) {
      return res.status(500).json({ error: 'Failed to send OTP. Make sure WhatsApp is connected.' });
    }

    res.status(200).json({ message: 'OTP resent successfully' });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ error: 'Failed to resend OTP' });
  }
});

// Update user
router.put('/:id', authenticateToken, requirePermission('users:edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, isActive } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: id }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if email is taken by another user
    if (email && email !== existingUser.email) {
      const emailTaken = await prisma.user.findUnique({
        where: { email }
      });

      if (emailTaken) {
        return res.status(400).json({ error: 'Email is already taken' });
      }
    }

    // Update user
    const user = await prisma.user.update({
      where: { id: id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(role && { role }),
        ...(typeof isActive === 'boolean' && { isActive })
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
        whatsappNumber: true,
        whatsappJid: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/:id', authenticateToken, requirePermission('users:delete'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: id }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting the last superadmin user
    if (existingUser.role === 'superadmin') {
      const superadminCount = await prisma.user.count({
        where: { role: 'superadmin', isActive: true }
      });

      if (superadminCount <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last superadmin user' });
      }
    }

    // Delete user
    await prisma.user.delete({
      where: { id: id }
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Toggle user status
router.patch('/:id/toggle-status', authenticateToken, requirePermission('users:edit'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: id }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deactivating the last superadmin user
    if (existingUser.role === 'superadmin' && existingUser.isActive) {
      const activeSuperadminCount = await prisma.user.count({
        where: { role: 'superadmin', isActive: true }
      });

      if (activeSuperadminCount <= 1) {
        return res.status(400).json({ error: 'Cannot deactivate the last superadmin user' });
      }
    }

    // Toggle status
    const user = await prisma.user.update({
      where: { id: id },
      data: {
        isActive: !existingUser.isActive
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
        whatsappNumber: true,
        whatsappJid: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json(user);
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({ error: 'Failed to toggle user status' });
  }
});

module.exports = router;
