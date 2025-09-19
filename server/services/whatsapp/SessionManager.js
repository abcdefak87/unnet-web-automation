/**
 * Session Manager for WhatsApp Bot
 * Handles user sessions with proper cleanup and persistence
 */

const logger = require('../../utils/logger');

class SessionManager {
  constructor(options = {}) {
    this.sessions = new Map();
    this.cleanupInterval = options.cleanupInterval || 300000; // 5 minutes
    this.sessionTimeout = options.sessionTimeout || 1800000; // 30 minutes
    this.maxSessions = options.maxSessions || 1000;
    
    // Start cleanup timer
    this.startCleanupTimer();
    
    logger.info('SessionManager initialized', {
      cleanupInterval: this.cleanupInterval,
      sessionTimeout: this.sessionTimeout,
      maxSessions: this.maxSessions
    });
  }

  /**
   * Create or update user session
   */
  setSession(userJid, sessionData) {
    try {
      const session = {
        userJid,
        data: sessionData,
        createdAt: new Date(),
        lastActivity: new Date(),
        isActive: true
      };

      // Check if we need to clean up old sessions
      if (this.sessions.size >= this.maxSessions) {
        this.cleanupOldSessions();
      }

      this.sessions.set(userJid, session);
      
      logger.debug('Session created/updated', {
        userJid,
        sessionData: Object.keys(sessionData),
        totalSessions: this.sessions.size
      });

      return true;
    } catch (error) {
      logger.error('Failed to set session', {
        userJid,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get user session
   */
  getSession(userJid) {
    try {
      const session = this.sessions.get(userJid);
      
      if (!session) {
        return null;
      }

      // Check if session is expired
      if (this.isSessionExpired(session)) {
        this.sessions.delete(userJid);
        logger.debug('Session expired and removed', { userJid });
        return null;
      }

      // Update last activity
      session.lastActivity = new Date();
      
      return session.data;
    } catch (error) {
      logger.error('Failed to get session', {
        userJid,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Update session data
   */
  updateSession(userJid, updates) {
    try {
      const session = this.sessions.get(userJid);
      
      if (!session) {
        return false;
      }

      if (this.isSessionExpired(session)) {
        this.sessions.delete(userJid);
        return false;
      }

      // Merge updates
      session.data = { ...session.data, ...updates };
      session.lastActivity = new Date();
      
      logger.debug('Session updated', {
        userJid,
        updates: Object.keys(updates)
      });

      return true;
    } catch (error) {
      logger.error('Failed to update session', {
        userJid,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Clear user session
   */
  clearSession(userJid) {
    try {
      const existed = this.sessions.has(userJid);
      this.sessions.delete(userJid);
      
      logger.debug('Session cleared', {
        userJid,
        existed,
        totalSessions: this.sessions.size
      });

      return existed;
    } catch (error) {
      logger.error('Failed to clear session', {
        userJid,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Check if session exists and is active
   */
  hasActiveSession(userJid) {
    const session = this.sessions.get(userJid);
    return session && !this.isSessionExpired(session);
  }

  /**
   * Check if session is expired
   */
  isSessionExpired(session) {
    const now = new Date();
    const timeSinceLastActivity = now - session.lastActivity;
    return timeSinceLastActivity > this.sessionTimeout;
  }

  /**
   * Get session statistics
   */
  getStats() {
    const now = new Date();
    let activeSessions = 0;
    let expiredSessions = 0;
    let totalSessions = this.sessions.size;

    for (const session of this.sessions.values()) {
      if (this.isSessionExpired(session)) {
        expiredSessions++;
      } else {
        activeSessions++;
      }
    }

    return {
      totalSessions,
      activeSessions,
      expiredSessions,
      sessionTimeout: this.sessionTimeout,
      maxSessions: this.maxSessions
    };
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions() {
    const now = new Date();
    let cleanedCount = 0;

    for (const [userJid, session] of this.sessions.entries()) {
      if (this.isSessionExpired(session)) {
        this.sessions.delete(userJid);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned up expired sessions', {
        cleanedCount,
        remainingSessions: this.sessions.size
      });
    }

    return cleanedCount;
  }

  /**
   * Clean up old sessions when limit is reached
   */
  cleanupOldSessions() {
    // Sort sessions by last activity
    const sortedSessions = Array.from(this.sessions.entries())
      .sort(([,a], [,b]) => a.lastActivity - b.lastActivity);

    // Remove oldest sessions
    const toRemove = Math.floor(this.maxSessions * 0.1); // Remove 10%
    let removedCount = 0;

    for (let i = 0; i < toRemove && i < sortedSessions.length; i++) {
      const [userJid] = sortedSessions[i];
      this.sessions.delete(userJid);
      removedCount++;
    }

    logger.info('Cleaned up old sessions due to limit', {
      removedCount,
      remainingSessions: this.sessions.size
    });

    return removedCount;
  }

  /**
   * Start cleanup timer
   */
  startCleanupTimer() {
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.cleanupInterval);
  }

  /**
   * Get all active sessions
   */
  getAllActiveSessions() {
    const activeSessions = new Map();
    
    for (const [userJid, session] of this.sessions.entries()) {
      if (!this.isSessionExpired(session)) {
        activeSessions.set(userJid, session.data);
      }
    }
    
    return activeSessions;
  }

  /**
   * Shutdown session manager
   */
  shutdown() {
    logger.info('SessionManager shutting down', {
      totalSessions: this.sessions.size
    });
    
    this.sessions.clear();
  }
}

module.exports = SessionManager;
