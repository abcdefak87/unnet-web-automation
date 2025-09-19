const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/database');
const { createOTP, verifyOTP } = require('../utils/otp');
const { sendOTP, sendPasswordResetSuccess } = require('../services/whatsapp/otpService');

const router = express.Router();

// Request password reset - Send OTP
router.post('/forgot-password', async (req, res) => {
  try {
    const { identifier } = req.body; // Can be username or WhatsApp number

    if (!identifier) {
      return res.status(400).json({ error: 'Username or WhatsApp number is required' });
    }

    // Try to find user by username or WhatsApp number
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: identifier },
          { whatsappNumber: identifier },
          { 
            whatsappNumber: identifier.startsWith('62') ? identifier : '62' + identifier.replace(/\D/g, '')
          }
        ]
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.whatsappNumber) {
      return res.status(400).json({ error: 'No WhatsApp number registered for this account' });
    }

    // Create OTP
    const otp = await createOTP(user.whatsappNumber, 'RESET_PASSWORD');
    
    // Send OTP via WhatsApp
    const sent = await sendOTP(user.whatsappNumber, otp.code, 'RESET_PASSWORD');
    
    if (!sent) {
      return res.status(500).json({ error: 'Failed to send OTP. Make sure WhatsApp is connected.' });
    }

    res.status(200).json({ 
      message: 'OTP sent to WhatsApp',
      whatsappNumber: user.whatsappNumber.replace(/(\d{2})(\d{3})(\d{4})/, '$1****$3') // Partially hidden
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Verify OTP for password reset
router.post('/verify-reset-otp', async (req, res) => {
  try {
    const { identifier, otp } = req.body;

    if (!identifier || !otp) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Find user
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: identifier },
          { whatsappNumber: identifier },
          { 
            whatsappNumber: identifier.startsWith('62') ? identifier : '62' + identifier.replace(/\D/g, '')
          }
        ]
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify OTP
    const verification = await verifyOTP(user.whatsappNumber, otp, 'RESET_PASSWORD');
    
    if (!verification.success) {
      return res.status(400).json({ error: verification.message });
    }

    // Generate temporary token for password reset
    const resetToken = jwt.sign(
      { userId: user.id, type: 'password-reset' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '15m' }
    );

    res.status(200).json({ 
      message: 'OTP verified successfully',
      resetToken
    });
  } catch (error) {
    console.error('Verify reset OTP error:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Verify reset token
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET || 'your-secret-key');
      if (decoded.type !== 'password-reset') {
        throw new Error('Invalid token type');
      }
    } catch (error) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    const user = await prisma.user.update({
      where: { id: decoded.userId },
      data: { password: hashedPassword }
    });

    // Send success notification
    if (user.whatsappNumber) {
      await sendPasswordResetSuccess(user.whatsappNumber, user.name);
    }

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Resend OTP for password reset
router.post('/resend-reset-otp', async (req, res) => {
  try {
    const { identifier } = req.body;

    if (!identifier) {
      return res.status(400).json({ error: 'Username or WhatsApp number is required' });
    }

    // Find user
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: identifier },
          { whatsappNumber: identifier },
          { 
            whatsappNumber: identifier.startsWith('62') ? identifier : '62' + identifier.replace(/\D/g, '')
          }
        ]
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.whatsappNumber) {
      return res.status(400).json({ error: 'No WhatsApp number registered for this account' });
    }

    // Create new OTP
    const otp = await createOTP(user.whatsappNumber, 'RESET_PASSWORD');
    
    // Send OTP via WhatsApp
    const sent = await sendOTP(user.whatsappNumber, otp.code, 'RESET_PASSWORD');
    
    if (!sent) {
      return res.status(500).json({ error: 'Failed to send OTP. Make sure WhatsApp is connected.' });
    }

    res.status(200).json({ message: 'OTP resent successfully' });
  } catch (error) {
    console.error('Resend reset OTP error:', error);
    res.status(500).json({ error: 'Failed to resend OTP' });
  }
});

module.exports = router;
