/**
 * Rate Limiter for WhatsApp Bot
 * Prevents abuse and ensures fair usage
 */

const logger = require('../../utils/logger');

class RateLimiter {
  constructor(options = {}) {
    this.requests = new Map();
    this.blocks = new Map();
    
    // Default configuration
    this.config = {
      windowMs: options.windowMs || 60000, // 1 minute
      maxRequests: options.maxRequests || 30, // 30 requests per minute
      blockDuration: options.blockDuration || 300000, // 5 minutes
      cleanupInterval: options.cleanupInterval || 300000, // 5 minutes
      ...options
    };
    
    // Start cleanup timer
    this.startCleanupTimer();
    
    logger.info('RateLimiter initialized', this.config);
  }

  /**
   * Check if request is allowed
   */
  isAllowed(userJid, options = {}) {
    try {
      const now = Date.now();
      const config = { ...this.config, ...options };
      
      // Check if user is blocked
      if (this.isBlocked(userJid, now)) {
        return {
          allowed: false,
          reason: 'blocked',
          retryAfter: this.getBlockRemainingTime(userJid, now)
        };
      }
      
      // Get or create user request history
      if (!this.requests.has(userJid)) {
        this.requests.set(userJid, []);
      }
      
      const userRequests = this.requests.get(userJid);
      
      // Remove old requests outside the window
      const cutoffTime = now - config.windowMs;
      const validRequests = userRequests.filter(timestamp => timestamp > cutoffTime);
      
      // Update user requests
      this.requests.set(userJid, validRequests);
      
      // Check if limit exceeded
      if (validRequests.length >= config.maxRequests) {
        // Block user
        this.blocks.set(userJid, now + config.blockDuration);
        
        logger.warn('User rate limited', {
          userJid,
          requests: validRequests.length,
          limit: config.maxRequests,
          windowMs: config.windowMs
        });
        
        return {
          allowed: false,
          reason: 'rate_limited',
          retryAfter: config.blockDuration
        };
      }
      
      // Add current request
      validRequests.push(now);
      this.requests.set(userJid, validRequests);
      
      return {
        allowed: true,
        remaining: config.maxRequests - validRequests.length,
        resetTime: now + config.windowMs
      };
      
    } catch (error) {
      logger.error('Rate limiter error', {
        userJid,
        error: error.message
      });
      
      // Fail open - allow request if rate limiter fails
      return { allowed: true, reason: 'error' };
    }
  }

  /**
   * Check if user is blocked
   */
  isBlocked(userJid, now = Date.now()) {
    const blockUntil = this.blocks.get(userJid);
    return blockUntil && blockUntil > now;
  }

  /**
   * Get remaining block time
   */
  getBlockRemainingTime(userJid, now = Date.now()) {
    const blockUntil = this.blocks.get(userJid);
    if (!blockUntil || blockUntil <= now) {
      return 0;
    }
    return blockUntil - now;
  }

  /**
   * Block user manually
   */
  blockUser(userJid, duration = null) {
    const blockDuration = duration || this.config.blockDuration;
    const blockUntil = Date.now() + blockDuration;
    this.blocks.set(userJid, blockUntil);
    
    logger.warn('User manually blocked', {
      userJid,
      duration: blockDuration,
      blockUntil: new Date(blockUntil).toISOString()
    });
    
    return blockUntil;
  }

  /**
   * Unblock user
   */
  unblockUser(userJid) {
    const wasBlocked = this.blocks.has(userJid);
    this.blocks.delete(userJid);
    
    if (wasBlocked) {
      logger.info('User unblocked', { userJid });
    }
    
    return wasBlocked;
  }

  /**
   * Reset user request history
   */
  resetUser(userJid) {
    this.requests.delete(userJid);
    this.blocks.delete(userJid);
    
    logger.info('User rate limit reset', { userJid });
  }

  /**
   * Get user statistics
   */
  getUserStats(userJid) {
    const now = Date.now();
    const userRequests = this.requests.get(userJid) || [];
    const isBlocked = this.isBlocked(userJid, now);
    
    // Count requests in current window
    const cutoffTime = now - this.config.windowMs;
    const currentRequests = userRequests.filter(timestamp => timestamp > cutoffTime);
    
    return {
      userJid,
      isBlocked,
      currentRequests: currentRequests.length,
      maxRequests: this.config.maxRequests,
      remainingRequests: Math.max(0, this.config.maxRequests - currentRequests.length),
      blockRemainingTime: isBlocked ? this.getBlockRemainingTime(userJid, now) : 0,
      windowMs: this.config.windowMs
    };
  }

  /**
   * Get global statistics
   */
  getStats() {
    const now = Date.now();
    let totalUsers = 0;
    let blockedUsers = 0;
    let totalRequests = 0;
    
    for (const [userJid, requests] of this.requests.entries()) {
      totalUsers++;
      if (this.isBlocked(userJid, now)) {
        blockedUsers++;
      }
      totalRequests += requests.length;
    }
    
    return {
      totalUsers,
      blockedUsers,
      totalRequests,
      config: this.config
    };
  }

  /**
   * Clean up old data
   */
  cleanup() {
    const now = Date.now();
    let cleanedRequests = 0;
    let cleanedBlocks = 0;
    
    // Clean up old requests
    for (const [userJid, requests] of this.requests.entries()) {
      const cutoffTime = now - (this.config.windowMs * 2); // Keep 2 windows
      const validRequests = requests.filter(timestamp => timestamp > cutoffTime);
      
      if (validRequests.length !== requests.length) {
        if (validRequests.length === 0) {
          this.requests.delete(userJid);
        } else {
          this.requests.set(userJid, validRequests);
        }
        cleanedRequests += requests.length - validRequests.length;
      }
    }
    
    // Clean up expired blocks
    for (const [userJid, blockUntil] of this.blocks.entries()) {
      if (blockUntil <= now) {
        this.blocks.delete(userJid);
        cleanedBlocks++;
      }
    }
    
    if (cleanedRequests > 0 || cleanedBlocks > 0) {
      logger.info('Rate limiter cleanup completed', {
        cleanedRequests,
        cleanedBlocks,
        remainingUsers: this.requests.size,
        remainingBlocks: this.blocks.size
      });
    }
    
    return { cleanedRequests, cleanedBlocks };
  }

  /**
   * Start cleanup timer
   */
  startCleanupTimer() {
    setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    logger.info('Rate limiter config updated', this.config);
  }

  /**
   * Create rate limit response for user
   */
  createRateLimitResponse(userJid, retryAfter) {
    const minutes = Math.ceil(retryAfter / 60000);
    
    return {
      success: false,
      message: `⏱️ *Terlalu banyak permintaan*\n\n` +
               `Anda telah mencapai batas maksimal permintaan.\n` +
               `Silakan tunggu ${minutes} menit sebelum mencoba lagi.\n\n` +
               `💡 *Tips:*\n` +
               `- Batas: ${this.config.maxRequests} permintaan per menit\n` +
               `- Gunakan perintah dengan bijak\n` +
               `- Ketik /menu untuk melihat daftar perintah`,
      type: 'rate_limited',
      retryAfter,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Shutdown rate limiter
   */
  shutdown() {
    logger.info('RateLimiter shutting down', {
      totalUsers: this.requests.size,
      blockedUsers: this.blocks.size
    });
    
    this.requests.clear();
    this.blocks.clear();
  }
}

module.exports = RateLimiter;
