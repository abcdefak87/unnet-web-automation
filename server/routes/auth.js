const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const tokenManager = require('../utils/tokenManager');
const { body, validationResult } = require('express-validator');
// PrismaClient imported from utils/database
const { authenticateToken } = require('../middleware/auth');
const { rateLimits } = require('../middleware/userRateLimit');
const { createOTP, verifyOTP } = require('../utils/otp');
const whatsappMessenger = require('../utils/whatsappMessenger');

const router = express.Router();
const prisma = require('../utils/database');

// Password validation function
const validatePassword = (password) => {
  const minLength = parseInt(process.env.MIN_PASSWORD_LENGTH) || 8;
  const requireComplexity = process.env.REQUIRE_PASSWORD_COMPLEXITY === 'true';
  
  if (password.length < minLength) {
    return `Password harus minimal ${minLength} karakter`;
  }
  
  if (requireComplexity) {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      return 'Password harus mengandung minimal satu huruf besar, satu huruf kecil, satu angka, dan satu karakter khusus';
    }
  }
  
  return null;
};

// Register new user
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').custom((value) => {
    const error = validatePassword(value);
    if (error) throw new Error(error);
    return true;
  }),
  body('name').isLength({ min: 2 }).trim(),
  body('role').isIn(['superadmin', 'admin', 'gudang', 'user']).optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name, role = 'admin' } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        email: email
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Pengguna dengan email ini sudah ada' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });

    res.status(201).json({ message: 'Pengguna berhasil dibuat', user });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Gagal membuat pengguna' });
  }
});

// Login
router.post('/login', [
  body('username').notEmpty().trim(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    // Find user by username
    const user = await prisma.user.findFirst({
      where: {
        username: username,
        isActive: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Kredensial tidak valid' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Kredensial tidak valid' });
    }

    // Generate tokens using TokenManager
    const token = tokenManager.generateAccessToken({ 
      userId: user.id, 
      role: user.role 
    });

    // Generate refresh token
    const { refreshToken, tokenId } = await tokenManager.generateRefreshToken(user.id);

    // Persist hashed refresh token for server-side verification and update lastLogin
    try {
      const refreshTokenHash = await bcrypt.hash(refreshToken, 12);
      await prisma.user.update({ 
        where: { id: user.id }, 
        data: { 
          refreshTokenHash,
          lastLogin: new Date()
        } 
      });
    } catch (e) {
      console.error('Store refresh token hash failed:', e);
    }

    // Get updated user data with lastLogin
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        isVerified: true,
        lastLogin: true,
        whatsappNumber: true,
        whatsappJid: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({
      message: 'Login berhasil',
      token,
      refreshToken,
      user: updatedUser
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login gagal' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Gagal mengambil profil' });
  }
});

// Update profile
router.put('/profile', authenticateToken, [
  body('name').isLength({ min: 2 }).trim().optional(),
  body('email').isEmail().normalizeEmail().optional(),
  body('currentPassword').optional(),
  body('newPassword').custom((value) => {
    if (value) {
      const error = validatePassword(value);
      if (error) throw new Error(error);
    }
    return true;
  }).optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, currentPassword, newPassword } = req.body;
    const updateData = {};

    // Handle basic profile updates
    if (name) updateData.name = name;
    if (email) updateData.email = email;

    // Handle password change if provided
    if (newPassword && currentPassword) {
      // Get user with password to verify current password
      const userWithPassword = await prisma.user.findUnique({
        where: { id: req.user.id }
      });

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, userWithPassword.password);
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Password saat ini tidak benar' });
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 12);
      updateData.password = hashedNewPassword;
    } else if (newPassword && !currentPassword) {
      return res.status(400).json({ error: 'Password saat ini diperlukan untuk mengubah password' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({ message: 'Profil berhasil diperbarui', user });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Gagal memperbarui profil' });
  }
});

// Change password
router.put('/change-password', authenticateToken, [
  body('currentPassword').notEmpty(),
  body('newPassword').custom((value) => {
    const error = validatePassword(value);
    if (error) throw new Error(error);
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Password saat ini tidak benar' });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedNewPassword }
    });

    res.json({ message: 'Password berhasil diubah' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Gagal mengubah password' });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token diperlukan' });
    }

    // Verify refresh token via tokenManager
    let decoded;
    try {
      decoded = await tokenManager.verifyToken(refreshToken, 'refresh');
    } catch (e) {
      return res.status(401).json({ error: 'Refresh token tidak valid atau sudah kedaluwarsa' });
    }

    // Get user and verify refresh token hash
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        refreshTokenHash: true
      }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Pengguna tidak ditemukan atau tidak aktif' });
    }

    // Verify refresh token hash (optional security check)
    if (user.refreshTokenHash) {
      const isValidRefreshToken = await bcrypt.compare(refreshToken, user.refreshTokenHash);
      if (!isValidRefreshToken) {
        return res.status(401).json({ error: 'Refresh token tidak valid' });
      }
    }

    // Rotate refresh token and generate new access token
    let rotated;
    try {
      rotated = await tokenManager.rotateRefreshToken(decoded.tokenId, user.id);
    } catch (rotationError) {
      return res.status(401).json({ error: 'Refresh token tidak valid' });
    }

    // Store new refresh token hash
    try {
      const newHash = await bcrypt.hash(rotated.refreshToken, 12);
      await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: newHash } });
    } catch (e) {
      console.error('Rotate refresh token hash failed:', e);
    }

    const newToken = tokenManager.generateAccessToken({ userId: user.id, role: user.role });

    res.json({
      message: 'Token berhasil diperbarui',
      token: newToken,
      refreshToken: rotated.refreshToken
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Refresh token tidak valid atau sudah kedaluwarsa' });
    }
    res.status(500).json({ error: 'Gagal memperbarui token' });
  }
});

// Logout endpoint (revoke refresh token)
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Revoke in-memory refresh tokens and clear DB hash
    try { await tokenManager.revokeUserTokens(req.user.id); } catch (e) {}
    await prisma.user.update({
      where: { id: req.user.id },
      data: { refreshTokenHash: null }
    });

    res.json({ message: 'Logout berhasil' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout gagal' });
  }
});

// Forgot password - send OTP
router.post('/forgot-password', [
  body('identifier').notEmpty().trim() // Can be username, email, or phone
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { identifier } = req.body;

    // Find user by username, email, or phone
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: identifier },
          { email: identifier },
          { phone: identifier },
          { whatsappNumber: identifier }
        ],
        isActive: true
      }
    });

    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({ 
        message: 'Jika akun dengan identifier ini ada, OTP akan dikirim.' 
      });
    }

    // Create OTP
    const otp = await createOTP(user.id, 'PASSWORD_RESET');

    // Check if user has WhatsApp number for sending OTP
    if (user.whatsappNumber) {
      try {
        await whatsappMessenger.sendOTP(user.whatsappNumber, otp.code);
        console.log('OTP sent via WhatsApp to:', user.whatsappNumber);
      } catch (whatsappError) {
        console.error('WhatsApp OTP send error:', whatsappError);
        // Continue even if WhatsApp fails
      }
    }

    // Log OTP for development (remove in production)
    console.log(`OTP for user ${user.username}: ${otp.code}`);

    res.json({ 
      message: 'OTP telah dikirim. Silakan periksa WhatsApp Anda.',
      identifier: user.id, // Send back user ID for OTP verification
      // In development, also send OTP (remove in production)
      ...(process.env.NODE_ENV === 'development' && { otp: otp.code })
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Gagal memproses permintaan lupa password' });
  }
});

// Resend OTP for password reset
router.post('/resend-reset-otp', [
  body('identifier').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { identifier } = req.body;

    // Get user by ID
    const user = await prisma.user.findUnique({
      where: { id: identifier }
    });

    if (!user) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }

    // Create new OTP
    const otp = await createOTP(user.id, 'PASSWORD_RESET');

    // Check if user has WhatsApp number for sending OTP
    if (user.whatsappNumber) {
      try {
        await whatsappMessenger.sendOTP(user.whatsappNumber, otp.code);
        console.log('OTP resent via WhatsApp to:', user.whatsappNumber);
      } catch (whatsappError) {
        console.error('WhatsApp OTP resend error:', whatsappError);
        return res.status(500).json({ error: 'Failed to send OTP. Make sure WhatsApp is connected.' });
      }
    }

    // Log OTP for development
    console.log(`Resent OTP for user ${user.username}: ${otp.code}`);

    res.json({ 
      message: 'OTP telah dikirim ulang. Silakan periksa WhatsApp Anda.',
      // In development, also send OTP
      ...(process.env.NODE_ENV === 'development' && { otp: otp.code })
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ error: 'Gagal mengirim ulang OTP' });
  }
});

// Verify OTP and get reset token
router.post('/verify-reset-otp', [
  body('identifier').notEmpty(),
  body('otp').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { identifier, otp } = req.body;

    // Verify OTP
    const result = await verifyOTP(identifier, otp, 'PASSWORD_RESET');
    
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    // Generate a temporary reset token
    const resetToken = jwt.sign(
      { userId: identifier, type: 'password-reset' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' } // Token valid for 15 minutes
    );

    res.json({ 
      message: 'OTP berhasil diverifikasi',
      resetToken 
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Gagal memverifikasi OTP' });
  }
});

// Reset password with reset token
router.post('/reset-password', [
  body('resetToken').notEmpty(),
  body('newPassword').custom((value) => {
    const error = validatePassword(value);
    if (error) throw new Error(error);
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { resetToken, newPassword } = req.body;

    // Verify reset token
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
      if (decoded.type !== 'password-reset') {
        return res.status(401).json({ error: 'Reset token tidak valid' });
      }
    } catch (tokenError) {
      return res.status(401).json({ error: 'Reset token tidak valid atau sudah kedaluwarsa' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update user password
    const user = await prisma.user.update({
      where: { id: decoded.userId },
      data: { 
        password: hashedPassword,
        refreshTokenHash: null // Invalidate any existing sessions
      },
      select: {
        id: true,
        username: true,
        email: true
      }
    });

    res.json({ 
      message: 'Password berhasil direset. Silakan login dengan password baru Anda.',
      user 
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Gagal mereset password' });
  }
});

module.exports = router;
