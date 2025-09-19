/**
 * JWT Token Manager
 * Fixes: Token expiration mismatch, refresh token rotation, token invalidation
 * Enhanced: Persistent storage with Redis fallback to memory
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getEnvVar, isProduction } = require('../middleware/environmentValidation');

class TokenManager {
  constructor() {
    this.blacklistedTokens = new Set();
    this.refreshTokenStore = new Map();
    this.redisClient = null;
    this.useRedis = false;
    
    // Initialize Redis if available
    this.initializeRedis();
    
    // Clean up expired tokens every hour
    setInterval(() => this.cleanupExpiredTokens(), 3600000);
  }

  /**
   * Initialize Redis connection for persistent storage
   */
  async initializeRedis() {
    try {
      // Try to use Redis if REDIS_URL is provided
      const redisUrl = process.env.REDIS_URL;
      if (redisUrl) {
        const redis = require('redis');
        this.redisClient = redis.createClient({ 
          url: redisUrl,
          socket: {
            connectTimeout: 5000,
            lazyConnect: true
          }
        });
        
        this.redisClient.on('error', (err) => {
          console.log('ℹ️  Redis not available, using memory storage (development mode)');
          this.useRedis = false;
        });

        this.redisClient.on('connect', () => {
          console.log('✅ Redis connected for token storage');
          this.useRedis = true;
        });

        // Try to connect with timeout
        await Promise.race([
          this.redisClient.connect(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Redis connection timeout')), 3000)
          )
        ]);
      } else {
        console.log('ℹ️  Redis not configured, using memory storage (development mode)');
        this.useRedis = false;
      }
    } catch (error) {
      console.log('ℹ️  Redis not available, using memory storage (development mode)');
      this.useRedis = false;
    }
  }

  /**
   * Store data in Redis or memory
   */
  async storeData(key, data, ttl = null) {
    try {
      if (this.useRedis && this.redisClient) {
        const value = JSON.stringify(data);
        if (ttl) {
          await this.redisClient.setEx(key, ttl, value);
        } else {
          await this.redisClient.set(key, value);
        }
      } else {
        // Fallback to memory storage
        this.refreshTokenStore.set(key, data);
      }
    } catch (error) {
      console.error('Failed to store data:', error);
      // Fallback to memory
      this.refreshTokenStore.set(key, data);
    }
  }

  /**
   * Retrieve data from Redis or memory
   */
  async getData(key) {
    try {
      if (this.useRedis && this.redisClient) {
        const value = await this.redisClient.get(key);
        return value ? JSON.parse(value) : null;
      } else {
        // Fallback to memory storage
        return this.refreshTokenStore.get(key) || null;
      }
    } catch (error) {
      console.error('Failed to retrieve data:', error);
      // Fallback to memory
      return this.refreshTokenStore.get(key) || null;
    }
  }

  /**
   * Delete data from Redis or memory
   */
  async deleteData(key) {
    try {
      if (this.useRedis && this.redisClient) {
        await this.redisClient.del(key);
      } else {
        // Fallback to memory storage
        this.refreshTokenStore.delete(key);
      }
    } catch (error) {
      console.error('Failed to delete data:', error);
      // Fallback to memory
      this.refreshTokenStore.delete(key);
    }
  }

  /**
   * Generate access token
   */
  generateAccessToken(payload) {
    const secret = getEnvVar('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    return jwt.sign(
      {
        ...payload,
        type: 'access',
        iat: Math.floor(Date.now() / 1000),
        jti: crypto.randomBytes(16).toString('hex') // Unique token ID
      },
      secret,
      {
        expiresIn: '15m', // Short-lived access token
        issuer: 'isp-management',
        audience: 'isp-client'
      }
    );
  }

  /**
   * Generate refresh token with rotation
   */
  async generateRefreshToken(userId) {
    const secret = getEnvVar('JWT_REFRESH_SECRET');
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET not configured');
    }

    const tokenId = crypto.randomBytes(32).toString('hex');
    const refreshToken = jwt.sign(
      {
        userId,
        type: 'refresh',
        tokenId,
        iat: Math.floor(Date.now() / 1000)
      },
      secret,
      {
        expiresIn: '7d', // Long-lived refresh token
        issuer: 'isp-management',
        audience: 'isp-client'
      }
    );

    // Store refresh token metadata for rotation with TTL
    const tokenData = {
      userId,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      rotationCount: 0
    };

    await this.storeData(`refresh_token:${tokenId}`, tokenData, 7 * 24 * 60 * 60); // 7 days TTL

    return { refreshToken, tokenId };
  }

  /**
   * Verify and decode token
   */
  async verifyToken(token, type = 'access') {
    try {
      const secret = type === 'refresh' 
        ? getEnvVar('JWT_REFRESH_SECRET')
        : getEnvVar('JWT_SECRET');

      if (!secret) {
        throw new Error('JWT secret not configured');
      }

      // Check if token is blacklisted
      const isBlacklisted = await this.getData(`blacklisted:${token}`);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      const decoded = jwt.verify(token, secret, {
        issuer: 'isp-management',
        audience: 'isp-client'
      });

      // Validate token type
      if (decoded.type !== type) {
        throw new Error(`Invalid token type. Expected ${type}, got ${decoded.type}`);
      }

      // For refresh tokens, check if it exists in store
      if (type === 'refresh' && decoded.tokenId) {
        const tokenData = await this.getData(`refresh_token:${decoded.tokenId}`);
        if (!tokenData) {
          throw new Error('Refresh token not found or expired');
        }
        
        // Update last used time
        tokenData.lastUsed = Date.now();
        await this.storeData(`refresh_token:${decoded.tokenId}`, tokenData, 7 * 24 * 60 * 60);
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      throw error;
    }
  }

  /**
   * Rotate refresh token
   */
  async rotateRefreshToken(oldTokenId, userId) {
    // Invalidate old token
    const oldTokenData = await this.getData(`refresh_token:${oldTokenId}`);
    if (oldTokenData) {
      // Check rotation count to prevent abuse
      if (oldTokenData.rotationCount >= 5) {
        // Too many rotations, possible attack
        await this.deleteData(`refresh_token:${oldTokenId}`);
        throw new Error('Refresh token rotation limit exceeded');
      }
    }

    // Delete old token
    await this.deleteData(`refresh_token:${oldTokenId}`);

    // Generate new refresh token
    const { refreshToken, tokenId } = await this.generateRefreshToken(userId);
    
    // Track rotation
    const newTokenData = await this.getData(`refresh_token:${tokenId}`);
    if (newTokenData) {
      newTokenData.rotationCount = (oldTokenData?.rotationCount || 0) + 1;
      await this.storeData(`refresh_token:${tokenId}`, newTokenData, 7 * 24 * 60 * 60);
    }

    return { refreshToken, tokenId };
  }

  /**
   * Revoke token
   */
  async revokeToken(token) {
    // Add to blacklist with TTL
    const decoded = jwt.decode(token);
    const ttl = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 3600; // 1 hour default
    
    await this.storeData(`blacklisted:${token}`, true, ttl);
    
    // If it's a refresh token, remove from store
    if (decoded?.tokenId) {
      await this.deleteData(`refresh_token:${decoded.tokenId}`);
    }
  }

  /**
   * Revoke all tokens for a user
   */
  async revokeUserTokens(userId) {
    try {
      if (this.useRedis && this.redisClient) {
        // Use Redis pattern matching to find all user tokens
        const keys = await this.redisClient.keys(`refresh_token:*`);
        for (const key of keys) {
          const tokenData = await this.getData(key);
          if (tokenData && tokenData.userId === userId) {
            await this.deleteData(key);
          }
        }
      } else {
        // Fallback to memory storage
        for (const [tokenId, data] of this.refreshTokenStore.entries()) {
          if (data.userId === userId) {
            this.refreshTokenStore.delete(tokenId);
          }
        }
      }
    } catch (error) {
      console.error('Failed to revoke user tokens:', error);
    }
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens() {
    try {
      if (this.useRedis && this.redisClient) {
        // Redis handles TTL automatically, no manual cleanup needed
        return;
      } else {
        // Clean memory storage
        const now = Date.now();
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

        for (const [tokenId, data] of this.refreshTokenStore.entries()) {
          if (now - data.createdAt > maxAge) {
            this.refreshTokenStore.delete(tokenId);
          }
        }

        // Clean blacklisted tokens (remove very old ones)
        if (this.blacklistedTokens.size > 10000) {
          this.blacklistedTokens.clear(); // Reset if too many
        }
      }
    } catch (error) {
      console.error('Failed to cleanup expired tokens:', error);
    }
  }

  /**
   * Generate CSRF token
   */
  generateCSRFToken(sessionId) {
    const token = crypto.randomBytes(32).toString('hex');
    const csrfSecret = getEnvVar('CSRF_SECRET');
    const hash = crypto
      .createHmac('sha256', csrfSecret)
      .update(sessionId + token)
      .digest('hex');
    
    return `${token}.${hash}`;
  }

  /**
   * Validate CSRF token
   */
  validateCSRFToken(token, sessionId) {
    if (!token || !sessionId) return false;
    
    const [tokenPart, hashPart] = token.split('.');
    if (!tokenPart || !hashPart) return false;
    
    const csrfSecret = getEnvVar('CSRF_SECRET');
    const expectedHash = crypto
      .createHmac('sha256', csrfSecret)
      .update(sessionId + tokenPart)
      .digest('hex');
    
    return hashPart === expectedHash;
  }

  /**
   * Get token expiry time
   */
  getTokenExpiry(token) {
    try {
      const decoded = jwt.decode(token);
      if (decoded?.exp) {
        return new Date(decoded.exp * 1000);
      }
    } catch (error) {
      // Ignore errors
    }
    return null;
  }

  /**
   * Check if token is about to expire
   */
  isTokenExpiringSoon(token, thresholdMinutes = 5) {
    const expiry = this.getTokenExpiry(token);
    if (!expiry) return true;
    
    const now = new Date();
    const timeUntilExpiry = expiry - now;
    const threshold = thresholdMinutes * 60 * 1000;
    
    return timeUntilExpiry <= threshold;
  }
}

// Singleton instance
const tokenManager = new TokenManager();

module.exports = tokenManager;
