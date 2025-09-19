const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Store for tracking user-specific rate limits
const userRateLimitStore = new Map();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of userRateLimitStore.entries()) {
    if (now > data.resetTime) {
      userRateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// User-specific rate limiting middleware
const createUserRateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // requests per window
    message = 'Too many requests from this user, please try again later.',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = (req) => req.user?.id || req.ip,
    onLimitReached = null
  } = options;

  return async (req, res, next) => {
    try {
      const key = keyGenerator(req);
      const now = Date.now();
      const windowStart = now - windowMs;

      // Get or create user rate limit data
      let userData = userRateLimitStore.get(key);
      if (!userData || now > userData.resetTime) {
        userData = {
          count: 0,
          resetTime: now + windowMs,
          firstRequest: now
        };
        userRateLimitStore.set(key, userData);
      }

      // Increment count
      userData.count++;

      // Check if limit exceeded
      if (userData.count > max) {
        // Log rate limit violation
        if (req.user?.id) {
          try {
            await prisma.auditLog.create({
              data: {
                action: 'RATE_LIMIT_EXCEEDED',
                entityType: 'USER',
                entityId: req.user.id,
                details: JSON.stringify({
                  endpoint: req.originalUrl,
                  method: req.method,
                  ip: req.ip,
                  userAgent: req.get('User-Agent'),
                  count: userData.count,
                  limit: max,
                  windowMs
                }),
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                userId: req.user.id
              }
            });
          } catch (logError) {
            console.error('Failed to log rate limit violation:', logError);
          }
        }

        // Call custom handler if provided
        if (onLimitReached) {
          onLimitReached(req, res, userData);
          return;
        }

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': max,
          'X-RateLimit-Remaining': 0,
          'X-RateLimit-Reset': new Date(userData.resetTime).toISOString(),
          'Retry-After': Math.ceil((userData.resetTime - now) / 1000)
        });

        return res.status(429).json({
          error: 'Rate limit exceeded',
          message,
          retryAfter: Math.ceil((userData.resetTime - now) / 1000),
          limit: max,
          remaining: 0,
          resetTime: new Date(userData.resetTime).toISOString()
        });
      }

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': max,
        'X-RateLimit-Remaining': Math.max(0, max - userData.count),
        'X-RateLimit-Reset': new Date(userData.resetTime).toISOString()
      });

      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      // If rate limiting fails, continue without limiting
      next();
    }
  };
};

// Predefined rate limit configurations
const rateLimits = {
  // General API requests
  general: createUserRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes
    message: 'Too many API requests, please slow down.'
  }),

  // Authentication endpoints
  auth: createUserRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts per 15 minutes
    message: 'Too many authentication attempts, please try again later.',
    keyGenerator: (req) => `auth:${req.ip}` // Use IP for auth endpoints
  }),

  // File uploads
  upload: createUserRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 uploads per hour
    message: 'Too many file uploads, please try again later.'
  }),

  // Registration endpoints
  registration: createUserRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 registrations per hour per IP
    message: 'Too many registration attempts, please try again later.',
    keyGenerator: (req) => `reg:${req.ip}`
  }),

  // WhatsApp operations
  whatsapp: createUserRateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // 10 WhatsApp operations per 5 minutes
    message: 'Too many WhatsApp operations, please slow down.'
  }),

  // Job creation
  jobCreation: createUserRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // 50 jobs per hour
    message: 'Too many job creation requests, please slow down.'
  }),

  // Customer creation
  customerCreation: createUserRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 30, // 30 customers per hour
    message: 'Too many customer creation requests, please slow down.'
  }),

  // Reports generation
  reports: createUserRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 reports per hour
    message: 'Too many report generation requests, please slow down.'
  }),

  // Admin operations
  admin: createUserRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // 200 admin operations per 15 minutes
    message: 'Too many admin operations, please slow down.'
  }),

  // Strict rate limit for sensitive operations
  strict: createUserRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per 15 minutes
    message: 'Too many requests for this sensitive operation, please try again later.'
  })
};

// Middleware to get current rate limit status
const getRateLimitStatus = (req, res, next) => {
  const key = req.user?.id || req.ip;
  const userData = userRateLimitStore.get(key);
  
  if (userData) {
    res.set({
      'X-RateLimit-Limit': 100, // Default limit
      'X-RateLimit-Remaining': Math.max(0, 100 - userData.count),
      'X-RateLimit-Reset': new Date(userData.resetTime).toISOString()
    });
  }
  
  next();
};

// Utility function to reset rate limit for a user
const resetUserRateLimit = (userId) => {
  userRateLimitStore.delete(userId);
};

// Utility function to get rate limit info for a user
const getUserRateLimitInfo = (userId) => {
  const userData = userRateLimitStore.get(userId);
  if (!userData) return null;
  
  return {
    count: userData.count,
    resetTime: userData.resetTime,
    remaining: Math.max(0, 100 - userData.count), // Default limit
    isLimited: userData.count >= 100
  };
};

module.exports = {
  createUserRateLimit,
  rateLimits,
  getRateLimitStatus,
  resetUserRateLimit,
  getUserRateLimitInfo
};
