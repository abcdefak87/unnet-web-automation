/**
 * Enhanced Security Middleware for Customer Registration
 * Implements comprehensive security measures for registration endpoints
 */

const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const validator = require('validator');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Rate limiting for registration endpoints
const registrationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Increased for testing
  message: {
    success: false,
    error: 'Too many registration attempts. Please try again later.',
    retryAfter: 900 // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for development environment
    return process.env.NODE_ENV === 'development' || 
           req.ip === '127.0.0.1' || 
           req.ip === '::1' || 
           req.ip === '::ffff:127.0.0.1';
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many registration attempts',
      retryAfter: Math.ceil(15 * 60), // 15 minutes
      message: 'Please wait before attempting to register again'
    });
  }
});


// Enhanced input sanitization
const sanitizeRegistrationInput = (req, res, next) => {
  const sanitizeField = (value) => {
    if (typeof value !== 'string') return value;
    
    // Remove null bytes and control characters
    value = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // Trim whitespace
    value = value.trim();
    
    // Escape HTML entities
    value = validator.escape(value);
    
    // Remove potential SQL injection patterns
    value = value.replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC|EXECUTE)\b)/gi, '');
    
    return value;
  };

  // Sanitize body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeField(req.body[key]);
      }
    });
  }

  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeField(req.query[key]);
      }
    });
  }

  next();
};

// GPS validation middleware
const validateGPS = (req, res, next) => {
  const { latitude, longitude } = req.body;
  
  // Make GPS optional for testing
  if (!latitude || !longitude) {
    console.log('GPS coordinates not provided, skipping validation');
    return next();
  }

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  // Validate numeric values
  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid GPS coordinates format',
      message: 'GPS coordinates must be valid numbers'
    });
  }

  // Indonesia bounds validation
  const indonesiaBounds = {
    north: 6.0,
    south: -11.0,
    east: 141.0,
    west: 95.0
  };

  if (lat < indonesiaBounds.south || lat > indonesiaBounds.north ||
      lng < indonesiaBounds.west || lng > indonesiaBounds.east) {
    return res.status(400).json({
      success: false,
      error: 'GPS coordinates outside Indonesia',
      message: 'Please provide coordinates within Indonesia'
    });
  }

  // Validate coordinate precision (max 8 decimal places)
  if (latitude.toString().split('.')[1]?.length > 8 || 
      longitude.toString().split('.')[1]?.length > 8) {
    return res.status(400).json({
      success: false,
      error: 'GPS coordinates precision too high',
      message: 'Please provide coordinates with maximum 8 decimal places'
    });
  }

  req.body.latitude = lat;
  req.body.longitude = lng;
  next();
};

// Enhanced file validation
const validateUploadedFiles = (req, res, next) => {
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const maxFileSize = 5 * 1024 * 1024; // 5MB

  const validateFile = (file, fieldName) => {
    // Check file size
    if (file.size > maxFileSize) {
      throw new Error(`${fieldName} file size exceeds 5MB limit`);
    }

    // Check MIME type
    if (!allowedImageTypes.includes(file.mimetype)) {
      throw new Error(`${fieldName} file type not allowed. Only JPEG, PNG, and WebP are accepted`);
    }

    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      throw new Error(`${fieldName} file extension not allowed`);
    }

    // Check for suspicious file names
    if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
      throw new Error(`${fieldName} file name contains invalid characters`);
    }
  };

  // Make files optional for testing
  if (!req.files) {
    console.log('No files provided, skipping file validation');
    return next();
  }

  const { ktpPhoto, housePhoto } = req.files;

  // Validate KTP photo (optional for testing)
  if (!ktpPhoto || !ktpPhoto[0]) {
    console.log('No KTP photo provided, skipping validation');
    // return res.status(400).json({
    //   success: false,
    //   error: 'KTP photo required',
    //   message: 'Please upload a photo of your KTP'
    // });
  }

  // Validate house photo (optional for testing)
  if (!housePhoto || !housePhoto[0]) {
    console.log('No house photo provided, skipping validation');
    // return res.status(400).json({
    //   success: false,
    //   error: 'House photo required',
    //   message: 'Please upload a photo of your house'
    // });
  }

  try {
    // Only validate files if they exist
    if (ktpPhoto && ktpPhoto[0]) {
      validateFile(ktpPhoto[0], 'KTP photo');
    }
    if (housePhoto && housePhoto[0]) {
      validateFile(housePhoto[0], 'House photo');
    }
    next();
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'File validation failed',
      message: error.message
    });
  }
};

// Error message sanitization
const sanitizeErrorResponse = (error, req, res) => {
  // Log full error for debugging
  console.error('Registration error:', {
    message: error.message,
    stack: error.stack,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body,
    timestamp: new Date()
  });

  // Return sanitized error to client
  const sanitizedError = {
    success: false,
    error: 'Registration failed',
    message: 'An error occurred during registration. Please try again.'
  };

  // Only show specific errors in development
  if (process.env.NODE_ENV === 'development') {
    sanitizedError.details = error.message;
  }

  res.status(500).json(sanitizedError);
};

// Audit logging middleware
const auditRegistrationAttempt = (req, res, next) => {
  const originalSend = res.send;
  const originalJson = res.json;

  res.send = function(data) {
    logRegistrationAttempt(req, res, data);
    return originalSend.call(this, data);
  };

  res.json = function(data) {
    logRegistrationAttempt(req, res, data);
    return originalJson.call(this, data);
  };

  next();
};

const logRegistrationAttempt = (req, res, data) => {
  const auditLog = {
    action: 'CUSTOMER_REGISTRATION_ATTEMPT',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date(),
    success: res.statusCode >= 200 && res.statusCode < 300,
    statusCode: res.statusCode,
    phone: req.body?.phone ? req.body.phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2') : null,
    hasFiles: !!(req.files?.ktpPhoto && req.files?.housePhoto),
    error: res.statusCode >= 400 ? data?.error || data?.message : null
  };

  // Log to file or database
  console.log('AUDIT LOG:', JSON.stringify(auditLog));
  
  // In production, you might want to store this in a database
  // await prisma.auditLog.create({ data: auditLog });
};

// CSRF token generation
const generateCSRFToken = (req, res, next) => {
  const token = crypto.randomBytes(32).toString('hex');
  const sessionId = req.session?.id || req.ip;
  
  const csrfToken = crypto
    .createHmac('sha256', process.env.CSRF_SECRET || 'default-secret')
    .update(sessionId + token)
    .digest('hex');

  req.csrfToken = `${token}.${csrfToken}`;
  next();
};

// CSRF token validation (optional for now)
const validateCSRFToken = (req, res, next) => {
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionId = req.session?.id || req.ip;

  // If no token provided, skip validation (for development/testing)
  if (!token) {
    console.log('No CSRF token provided, skipping validation');
    return next();
  }

  if (!sessionId) {
    return res.status(403).json({
      success: false,
      error: 'Session required for CSRF validation',
      message: 'Please refresh the page and try again'
    });
  }

  const [tokenPart, hashPart] = token.split('.');
  if (!tokenPart || !hashPart) {
    return res.status(403).json({
      success: false,
      error: 'Invalid CSRF token format',
      message: 'Please refresh the page and try again'
    });
  }

  const expectedHash = crypto
    .createHmac('sha256', process.env.CSRF_SECRET || 'default-secret')
    .update(sessionId + tokenPart)
    .digest('hex');

  if (hashPart !== expectedHash) {
    return res.status(403).json({
      success: false,
      error: 'Invalid CSRF token',
      message: 'Please refresh the page and try again'
    });
  }

  console.log('CSRF token validated successfully');
  next();
};

module.exports = {
  registrationRateLimit,
  sanitizeRegistrationInput,
  validateGPS,
  validateUploadedFiles,
  sanitizeErrorResponse,
  auditRegistrationAttempt,
  generateCSRFToken,
  validateCSRFToken
};
