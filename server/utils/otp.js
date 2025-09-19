const crypto = require('crypto');
const prisma = require('./database');

// Generate random 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Create and store OTP
async function createOTP(identifier, type) {
  try {
    console.log('Creating OTP for:', { identifier, type });
    
    // Delete any existing OTP for this identifier and type
    const deletedCount = await prisma.oTP.deleteMany({
      where: {
        identifier,
        type,
        verified: false
      }
    });
    
    console.log(`Deleted ${deletedCount.count} existing OTPs`);

    // Generate new OTP
    const code = generateOTP();
    
    // Create OTP with 10 minutes expiry
    const otp = await prisma.oTP.create({
      data: {
        identifier,
        code,
        type,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
      }
    });
    
    console.log('Created OTP:', {
      id: otp.id,
      identifier: otp.identifier,
      code: otp.code,
      type: otp.type,
      expiresAt: otp.expiresAt
    });

    return otp;
  } catch (error) {
    console.error('Error creating OTP:', error);
    throw error;
  }
}

// Verify OTP
async function verifyOTP(identifier, code, type) {
  try {
    console.log('Verifying OTP:', { identifier, code, type });
    
    // First, check if any OTP exists for this identifier
    const existingOtp = await prisma.oTP.findFirst({
      where: {
        identifier,
        type,
        verified: false
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    if (existingOtp) {
      console.log('Found existing OTP:', {
        id: existingOtp.id,
        storedCode: existingOtp.code,
        inputCode: code,
        expiresAt: existingOtp.expiresAt,
        isExpired: existingOtp.expiresAt < new Date(),
        attempts: existingOtp.attempts
      });
    } else {
      console.log('No OTP found for identifier:', identifier);
    }
    
    const otp = await prisma.oTP.findFirst({
      where: {
        identifier,
        code: code.toString(), // Ensure code is a string
        type,
        verified: false,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (!otp) {
      // Increment attempts for wrong OTP
      await prisma.oTP.updateMany({
        where: {
          identifier,
          type,
          verified: false
        },
        data: {
          attempts: {
            increment: 1
          }
        }
      });
      return { success: false, message: 'Invalid or expired OTP' };
    }

    // Check if max attempts reached
    if (otp.attempts >= 5) {
      return { success: false, message: 'Maximum attempts reached. Please request a new OTP' };
    }

    // Mark OTP as verified
    await prisma.oTP.update({
      where: { id: otp.id },
      data: { verified: true }
    });

    return { success: true, message: 'OTP verified successfully' };
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return { success: false, message: 'Error verifying OTP' };
  }
}

// Clean up expired OTPs
async function cleanupExpiredOTPs() {
  try {
    const result = await prisma.oTP.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { verified: true }
        ]
      }
    });
    console.log(`Cleaned up ${result.count} expired/verified OTPs`);
  } catch (error) {
    console.error('Error cleaning up OTPs:', error);
  }
}

// Schedule cleanup every hour
setInterval(cleanupExpiredOTPs, 60 * 60 * 1000);

module.exports = {
  generateOTP,
  createOTP,
  verifyOTP,
  cleanupExpiredOTPs
};
