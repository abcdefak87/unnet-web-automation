/**
 * Migration Helper for WhatsApp Bot
 * Helps migrate from old bot implementation to new architecture
 */

const logger = require('../../utils/logger');
const path = require('path');
const fs = require('fs');

class MigrationHelper {
  constructor() {
    this.oldBotPath = path.join(__dirname, '../../../scripts/whatsapp-bot-integrated.js');
    this.newServicePath = path.join(__dirname, '../WhatsAppBotService.js');
    this.backupPath = path.join(__dirname, '../../../backups');
  }

  /**
   * Check if migration is needed
   */
  async checkMigrationStatus() {
    try {
      const oldBotExists = fs.existsSync(this.oldBotPath);
      const newServiceExists = fs.existsSync(this.newServicePath);
      
      return {
        needsMigration: oldBotExists && !newServiceExists,
        oldBotExists,
        newServiceExists,
        canMigrate: oldBotExists && newServiceExists
      };
    } catch (error) {
      logger.error('Error checking migration status', error);
      return { needsMigration: false, error: error.message };
    }
  }

  /**
   * Backup old bot files
   */
  async backupOldBot() {
    try {
      if (!fs.existsSync(this.backupPath)) {
        fs.mkdirSync(this.backupPath, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(this.backupPath, `whatsapp-bot-integrated-${timestamp}.js`);
      
      if (fs.existsSync(this.oldBotPath)) {
        fs.copyFileSync(this.oldBotPath, backupFile);
        logger.info('Old bot backed up', { backupFile });
        return { success: true, backupFile };
      }
      
      return { success: false, message: 'Old bot file not found' };
    } catch (error) {
      logger.error('Error backing up old bot', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create migration script
   */
  async createMigrationScript() {
    const migrationScript = `#!/usr/bin/env node

/**
 * WhatsApp Bot Migration Script
 * Migrates from old bot implementation to new architecture
 */

const WhatsAppBotService = require('../services/whatsapp/WhatsAppBotService');
const logger = require('./utils/logger');

async function migrate() {
  console.log('🔄 Starting WhatsApp Bot Migration...');
  
  try {
    // Initialize new bot service
    const botService = new WhatsAppBotService();
    
    // Start the new bot
    console.log('🚀 Starting new WhatsApp Bot Service...');
    const result = await botService.start();
    
    if (result.success) {
      console.log('✅ Migration completed successfully!');
      console.log('📱 New WhatsApp Bot is running');
      console.log('🔧 Old bot can be safely stopped');
    } else {
      console.error('❌ Migration failed:', result.message);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\\n🛑 Shutting down...');
  if (global.botService) {
    await global.botService.shutdown();
  }
  process.exit(0);
});

// Run migration
migrate().catch(console.error);
`;

    const scriptPath = path.join(__dirname, '../../../migrate-whatsapp-bot.js');
    
    try {
      fs.writeFileSync(scriptPath, migrationScript);
      fs.chmodSync(scriptPath, '755'); // Make executable
      
      logger.info('Migration script created', { scriptPath });
      return { success: true, scriptPath };
    } catch (error) {
      logger.error('Error creating migration script', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate new service configuration
   */
  async validateNewService() {
    try {
      const WhatsAppBotService = require('../WhatsAppBotService');
      
      // Check if service can be instantiated
      const botService = new WhatsAppBotService();
      
      // Check required methods
      const requiredMethods = ['start', 'stop', 'sendMessage', 'getStatus'];
      const missingMethods = requiredMethods.filter(method => typeof botService[method] !== 'function');
      
      if (missingMethods.length > 0) {
        return {
          valid: false,
          errors: [`Missing methods: ${missingMethods.join(', ')}`]
        };
      }
      
      // Check status
      const status = botService.getStatus();
      const requiredStatusFields = ['connected', 'connecting', 'user'];
      const missingFields = requiredStatusFields.filter(field => !(field in status));
      
      if (missingFields.length > 0) {
        return {
          valid: false,
          errors: [`Missing status fields: ${missingFields.join(', ')}`]
        };
      }
      
      return { valid: true, status };
      
    } catch (error) {
      return {
        valid: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Create integration guide
   */
  async createIntegrationGuide() {
    const guide = `# WhatsApp Bot Integration Guide

## Overview
This guide explains how to integrate the new WhatsApp Bot Service into your existing application.

## Migration Steps

### 1. Backup Old Implementation
\`\`\`bash
# Backup old bot files
cp scripts/whatsapp-bot-integrated.js backups/
\`\`\`

### 2. Update Server Index
Add the new bot service to your server/index.js:

\`\`\`javascript
const WhatsAppBotService = require('./services/whatsapp/WhatsAppBotService');

// Initialize bot service
const botService = new WhatsAppBotService();

// Start bot (optional - can be started manually)
botService.start().then(result => {
  if (result.success) {
    console.log('WhatsApp Bot started successfully');
  }
});

// Export for API routes
global.whatsappBotService = botService;
\`\`\`

### 3. Update API Routes
Update your WhatsApp routes to use the new service:

\`\`\`javascript
// In server/routes/whatsapp.js or similar
const botService = global.whatsappBotService;

router.get('/status', async (req, res) => {
  try {
    const status = botService.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get bot status' });
  }
});

router.post('/send', async (req, res) => {
  try {
    const { number, message } = req.body;
    await botService.sendMessage(number, message);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});
\`\`\`

### 4. Update Environment Variables
Add new configuration options to your .env:

\`\`\`env
# WhatsApp Bot Configuration
WHATSAPP_SESSION_PATH=./server/auth_info_baileys
WHATSAPP_STATUS_FILE=./scripts/whatsapp-status.json
WHATSAPP_VERSION=2,2413,1
WHATSAPP_BROWSER=Chrome (Windows),Chrome,120.0.0.0

# Rate Limiting
WHATSAPP_RATE_LIMIT_WINDOW=60000
WHATSAPP_RATE_LIMIT_MAX=30
WHATSAPP_RATE_LIMIT_BLOCK=300000

# Session Management
WHATSAPP_SESSION_TIMEOUT=1800000
WHATSAPP_SESSION_CLEANUP=300000
\`\`\`

## New Features

### 1. Command System
The new bot uses a modular command system:

\`\`\`javascript
// Register new commands
botService.commandProcessor.registerCommand('custom', new CustomCommand());
\`\`\`

### 2. Rate Limiting
Built-in rate limiting prevents abuse:

\`\`\`javascript
// Check rate limit
const allowed = botService.rateLimiter.isAllowed(userJid);
\`\`\`

### 3. Session Management
Improved session handling:

\`\`\`javascript
// Get user session
const session = botService.sessionManager.getSession(userJid);

// Update session
botService.sessionManager.updateSession(userJid, { currentJob: job });
\`\`\`

### 4. Error Handling
Comprehensive error handling:

\`\`\`javascript
// Handle errors gracefully
try {
  await botService.sendMessage(number, message);
} catch (error) {
  const errorResponse = botService.errorHandler.handleError(error);
  // errorResponse contains user-friendly message
}
\`\`\`

## Testing

### 1. Test Bot Connection
\`\`\`bash
# Test bot status
curl http://localhost:3001/api/whatsapp/status
\`\`\`

### 2. Test Commands
Send test commands to the bot:
- /ping - Test connectivity
- /menu - Show available commands

### 3. Test Rate Limiting
Send multiple commands quickly to test rate limiting.

## Troubleshooting

### Common Issues

1. **Bot not connecting**
   - Check session files in auth_info_baileys/
   - Verify WhatsApp version compatibility
   - Check network connectivity

2. **Commands not working**
   - Verify command registration
   - Check user authentication
   - Review error logs

3. **Rate limiting issues**
   - Adjust rate limit configuration
   - Check user session status
   - Review rate limiter stats

### Debug Mode
Enable debug logging:

\`\`\`javascript
// In your environment
NODE_ENV=development
LOG_LEVEL=debug
\`\`\`

## Support
For issues or questions:
1. Check the logs in server/logs/
2. Review the error handler output
3. Test with minimal configuration
4. Check rate limiter and session manager stats
`;

    const guidePath = path.join(__dirname, '../../../WHATSAPP_BOT_INTEGRATION.md');
    
    try {
      fs.writeFileSync(guidePath, guide);
      logger.info('Integration guide created', { guidePath });
      return { success: true, guidePath };
    } catch (error) {
      logger.error('Error creating integration guide', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Run full migration
   */
  async runMigration() {
    try {
      logger.info('Starting WhatsApp Bot migration...');
      
      // Check migration status
      const status = await this.checkMigrationStatus();
      if (!status.canMigrate) {
        return { success: false, message: 'Migration not possible', status };
      }
      
      // Backup old bot
      const backup = await this.backupOldBot();
      if (!backup.success) {
        return { success: false, message: 'Backup failed', error: backup.error };
      }
      
      // Validate new service
      const validation = await this.validateNewService();
      if (!validation.valid) {
        return { success: false, message: 'New service validation failed', errors: validation.errors };
      }
      
      // Create migration script
      const script = await this.createMigrationScript();
      if (!script.success) {
        return { success: false, message: 'Failed to create migration script', error: script.error };
      }
      
      // Create integration guide
      const guide = await this.createIntegrationGuide();
      if (!guide.success) {
        return { success: false, message: 'Failed to create integration guide', error: guide.error };
      }
      
      logger.info('WhatsApp Bot migration completed successfully');
      
      return {
        success: true,
        message: 'Migration completed successfully',
        results: {
          backup: backup.backupFile,
          script: script.scriptPath,
          guide: guide.guidePath,
          validation: validation.status
        }
      };
      
    } catch (error) {
      logger.error('Migration failed', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = MigrationHelper;
