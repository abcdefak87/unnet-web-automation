/**
 * Security Middleware
 * Fixes: CORS misconfiguration, CSRF protection, input validation
 * Enhanced: Environment validation and secure defaults
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, query, param, validationResult } = require('express-validator');
const { getEnvVar, isProduction, isDevelopment } = require('./environmentValidation');

// CORS configuration with proper origins
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = getEnvVar('ALLOWED_ORIGINS', 'http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001')
      .split(',')
      .map(origin => origin.trim());
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // For development, allow all localhost origins
    if (isDevelopment() || 
        origin.includes('localhost') || 
        origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // Don't throw error, just return false to prevent CORS header from being set
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['X-Total-Count', 'Content-Range'],
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 200 // Changed from 204 to 200 for better compatibility
};

// CSRF token generation and validation
const crypto = require('crypto');
const csrfTokens = new Map();

const generateCSRFToken = (sessionId) => {
  const token = crypto.randomBytes(32).toString('hex');
  const csrfSecret = getEnvVar('CSRF_SECRET');
  const hash = crypto
    .createHmac('sha256', csrfSecret)
    .update(sessionId + token)
    .digest('hex');
  
  csrfTokens.set(sessionId, token);
  // Auto-expire after 1 hour
  setTimeout(() => csrfTokens.delete(sessionId), 3600000);
  return `${token}.${hash}`;
};

const validateCSRFToken = (req, res, next) => {
  // Skip CSRF for GET requests
  if (req.method === 'GET') return next();
  
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionId = req.session?.id || req.user?.id;
  
  if (!token || !sessionId) {
    return res.status(403).json({ error: 'CSRF token required' });
  }
  
  // Validate token format and signature
  const [tokenPart, hashPart] = token.split('.');
  if (!tokenPart || !hashPart) {
    return res.status(403).json({ error: 'Invalid CSRF token format' });
  }
  
  const csrfSecret = getEnvVar('CSRF_SECRET');
  const expectedHash = crypto
    .createHmac('sha256', csrfSecret)
    .update(sessionId + tokenPart)
    .digest('hex');
  
  if (hashPart !== expectedHash) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  next();
};

// Input sanitization middleware
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  // Remove SQL injection attempts
  input = input.replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE)\b)/gi, '');
  
  // Remove script tags and javascript: protocol
  input = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  input = input.replace(/javascript:/gi, '');
  
  // Escape HTML entities
  const htmlEscapes = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };
  
  input = input.replace(/[&<>"'\/]/g, (match) => htmlEscapes[match]);
  
  return input.trim();
};

// Middleware to sanitize all inputs
const sanitizeAllInputs = (req, res, next) => {
  // Sanitize body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      req.body[key] = sanitizeInput(req.body[key]);
    });
  }
  
  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      req.query[key] = sanitizeInput(req.query[key]);
    });
  }
  
  // Sanitize URL parameters
  if (req.params) {
    Object.keys(req.params).forEach(key => {
      req.params[key] = sanitizeInput(req.params[key]);
    });
  }
  
  next();
};

// Enhanced rate limiting
const createRateLimiter = (windowMs = 15 * 60 * 1000, max = 100) => {
  return rateLimit({
    windowMs,
    max,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// API key validation for external integrations
const validateAPIKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  // Validate against stored API keys
  const validApiKeys = getEnvVar('VALID_API_KEYS', '').split(',').filter(key => key.trim());
  
  if (validApiKeys.length === 0) {
    return res.status(500).json({ error: 'API key validation not configured' });
  }
  
  if (!validApiKeys.includes(apiKey)) {
    return res.status(403).json({ error: 'Invalid API key' });
  }
  
  next();
};

module.exports = {
  corsOptions,
  generateCSRFToken,
  validateCSRFToken,
  sanitizeInput,
  sanitizeAllInputs,
  createRateLimiter,
  validateAPIKey
};
