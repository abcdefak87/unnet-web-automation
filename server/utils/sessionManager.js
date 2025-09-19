/**
 * WhatsApp Session Manager
 * Fixes: Session corruption, persistence, and multiple instance issues
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SessionManager {
  constructor(sessionPath = './server/auth_info_baileys') {
    this.sessionPath = sessionPath;
    this.backupPath = path.join(path.dirname(sessionPath), 'session_backups');
    this.isInitialized = false;
    this.sessionLock = false;
  }

  /**
   * Initialize session directory
   */
  async initialize(forceClean = false) {
    try {
      // Check if force clean is requested
      if (forceClean || process.argv.includes('--clean')) {
        console.log('🧹 Cleaning session directory...');
        await this.cleanSession();
      } else {
        // Check for existing session
        if (await this.hasValidSession()) {
          console.log('✅ Found existing valid session');
          await this.restoreSession();
        } else {
          console.log('📁 Creating new session directory');
          await this.createSessionDirectory();
        }
      }
      
      this.isInitialized = true;
      return { success: true };
    } catch (error) {
      console.error('❌ Session initialization failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if valid session exists
   */
  async hasValidSession() {
    try {
      if (!fs.existsSync(this.sessionPath)) {
        return false;
      }

      // Check for required session files
      const requiredFiles = ['creds.json'];
      for (const file of requiredFiles) {
        const filePath = path.join(this.sessionPath, file);
        if (!fs.existsSync(filePath)) {
          return false;
        }
      }

      // Validate session integrity
      const credsPath = path.join(this.sessionPath, 'creds.json');
      const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
      
      // Check if session has required fields
      if (!creds.me || !creds.myAppStateKeyId) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Session validation error:', error);
      return false;
    }
  }

  /**
   * Create session directory
   */
  async createSessionDirectory() {
    if (!fs.existsSync(this.sessionPath)) {
      fs.mkdirSync(this.sessionPath, { recursive: true });
    }
    
    if (!fs.existsSync(this.backupPath)) {
      fs.mkdirSync(this.backupPath, { recursive: true });
    }
  }

  /**
   * Clean session directory
   */
  async cleanSession() {
    // Backup existing session before cleaning
    if (fs.existsSync(this.sessionPath)) {
      await this.backupSession();
      fs.rmSync(this.sessionPath, { recursive: true, force: true });
    }
    
    await this.createSessionDirectory();
  }

  /**
   * Backup current session
   */
  async backupSession() {
    try {
      if (!fs.existsSync(this.sessionPath)) {
        return { success: false, message: 'No session to backup' };
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.join(this.backupPath, `backup_${timestamp}`);
      
      // Create backup directory
      fs.mkdirSync(backupDir, { recursive: true });
      
      // Copy all session files
      const files = fs.readdirSync(this.sessionPath);
      for (const file of files) {
        const srcPath = path.join(this.sessionPath, file);
        const destPath = path.join(backupDir, file);
        
        if (fs.lstatSync(srcPath).isFile()) {
          fs.copyFileSync(srcPath, destPath);
        }
      }

      // Clean old backups (keep only last 5)
      await this.cleanOldBackups(5);

      console.log(`📦 Session backed up to: ${backupDir}`);
      return { success: true, backupPath: backupDir };
    } catch (error) {
      console.error('Backup error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Restore session from backup
   */
  async restoreSession(backupName = null) {
    try {
      let backupDir;
      
      if (backupName) {
        backupDir = path.join(this.backupPath, backupName);
      } else {
        // Get latest backup
        const backups = this.getBackupList();
        if (backups.length === 0) {
          return { success: false, message: 'No backups available' };
        }
        backupDir = backups[0].path;
      }

      if (!fs.existsSync(backupDir)) {
        return { success: false, message: 'Backup not found' };
      }

      // Clean current session
      if (fs.existsSync(this.sessionPath)) {
        fs.rmSync(this.sessionPath, { recursive: true, force: true });
      }
      
      // Create session directory
      fs.mkdirSync(this.sessionPath, { recursive: true });
      
      // Restore files
      const files = fs.readdirSync(backupDir);
      for (const file of files) {
        const srcPath = path.join(backupDir, file);
        const destPath = path.join(this.sessionPath, file);
        
        if (fs.lstatSync(srcPath).isFile()) {
          fs.copyFileSync(srcPath, destPath);
        }
      }

      console.log(`✅ Session restored from: ${backupDir}`);
      return { success: true };
    } catch (error) {
      console.error('Restore error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get list of available backups
   */
  getBackupList() {
    try {
      if (!fs.existsSync(this.backupPath)) {
        return [];
      }

      const backups = fs.readdirSync(this.backupPath)
        .filter(dir => dir.startsWith('backup_'))
        .map(dir => {
          const dirPath = path.join(this.backupPath, dir);
          const stats = fs.statSync(dirPath);
          return {
            name: dir,
            path: dirPath,
            created: stats.birthtime,
            size: this.getDirectorySize(dirPath)
          };
        })
        .sort((a, b) => b.created - a.created);

      return backups;
    } catch (error) {
      console.error('Error getting backup list:', error);
      return [];
    }
  }

  /**
   * Clean old backups
   */
  async cleanOldBackups(keepCount = 5) {
    try {
      const backups = this.getBackupList();
      
      if (backups.length <= keepCount) {
        return;
      }

      // Remove old backups
      const toRemove = backups.slice(keepCount);
      for (const backup of toRemove) {
        fs.rmSync(backup.path, { recursive: true, force: true });
        console.log(`🗑️ Removed old backup: ${backup.name}`);
      }
    } catch (error) {
      console.error('Error cleaning old backups:', error);
    }
  }

  /**
   * Get directory size
   */
  getDirectorySize(dirPath) {
    let size = 0;
    
    try {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile()) {
          size += stats.size;
        } else if (stats.isDirectory()) {
          size += this.getDirectorySize(filePath);
        }
      }
    } catch (error) {
      console.error('Error calculating size:', error);
    }
    
    return size;
  }

  /**
   * Lock session to prevent multiple instances
   */
  async acquireLock() {
    const lockFile = path.join(this.sessionPath, '.lock');
    
    if (fs.existsSync(lockFile)) {
      const lockData = JSON.parse(fs.readFileSync(lockFile, 'utf-8'));
      const lockAge = Date.now() - lockData.timestamp;
      
      // If lock is older than 5 minutes, consider it stale
      if (lockAge > 300000) {
        console.log('⚠️ Removing stale lock file');
        fs.unlinkSync(lockFile);
      } else {
        throw new Error(`Session locked by process ${lockData.pid}`);
      }
    }
    
    // Create lock file
    fs.writeFileSync(lockFile, JSON.stringify({
      pid: process.pid,
      timestamp: Date.now()
    }));
    
    this.sessionLock = true;
    
    // Remove lock on process exit
    process.on('exit', () => this.releaseLock());
    process.on('SIGINT', () => this.releaseLock());
    process.on('SIGTERM', () => this.releaseLock());
  }

  /**
   * Release session lock
   */
  releaseLock() {
    if (!this.sessionLock) return;
    
    const lockFile = path.join(this.sessionPath, '.lock');
    if (fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile);
    }
    
    this.sessionLock = false;
  }

  /**
   * Encrypt session data
   */
  encryptSession(data, password) {
    const algorithm = 'aes-256-gcm';
    const salt = crypto.randomBytes(32);
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  /**
   * Decrypt session data
   */
  decryptSession(encryptedData, password) {
    const algorithm = 'aes-256-gcm';
    const salt = Buffer.from(encryptedData.salt, 'hex');
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }
}

module.exports = SessionManager;
