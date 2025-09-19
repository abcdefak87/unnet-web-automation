/**
 * WhatsApp Command Processor
 * Centralized command handling with proper validation and error handling
 */

const logger = require('../../utils/logger');

class CommandProcessor {
  constructor() {
    this.commands = new Map();
    this.middlewares = [];
    this.rateLimiter = new Map();
    this.rateLimitConfig = {
      windowMs: 60000, // 1 minute
      maxRequests: 30, // 30 requests per minute
      blockDuration: 300000 // 5 minutes block
    };
  }

  /**
   * Register a command handler
   */
  registerCommand(name, handler) {
    if (this.commands.has(name)) {
      logger.warn(`Command ${name} already registered, overriding`);
    }
    
    this.commands.set(name, {
      handler,
      name,
      description: handler.description || 'No description',
      usage: handler.usage || `/${name}`,
      aliases: handler.aliases || [],
      permissions: handler.permissions || [],
      rateLimit: handler.rateLimit || this.rateLimitConfig
    });
    
    logger.info(`Command ${name} registered successfully`);
  }

  /**
   * Add middleware to command processing pipeline
   */
  addMiddleware(middleware) {
    this.middlewares.push(middleware);
  }

  /**
   * Process incoming command
   */
  async processCommand(userJid, command, args, context = {}) {
    try {
      // Extract command name
      const commandName = command.toLowerCase().replace('/', '');
      
      // Find command (including aliases)
      const commandInfo = this.findCommand(commandName);
      if (!commandInfo) {
        return this.handleUnknownCommand(commandName, userJid);
      }

      // Rate limiting check
      if (!this.checkRateLimit(userJid, commandInfo)) {
        return {
          success: false,
          message: '⏱️ Terlalu banyak permintaan. Silakan tunggu sebentar.',
          type: 'rate_limited'
        };
      }

      // Execute middlewares
      for (const middleware of this.middlewares) {
        const result = await middleware(userJid, commandInfo, args, context);
        if (!result.success) {
          return result;
        }
      }

      // Execute command
      const result = await commandInfo.handler.execute(userJid, args, context);
      
      // Log command execution
      logger.info(`Command executed: ${commandName} by ${userJid}`, {
        userJid,
        command: commandName,
        args,
        success: result.success
      });

      return result;

    } catch (error) {
      logger.error(`Command processing error: ${command}`, {
        userJid,
        command,
        args,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        message: '❌ Terjadi kesalahan saat memproses perintah. Silakan coba lagi.',
        type: 'error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  }

  /**
   * Find command by name or alias
   */
  findCommand(commandName) {
    // Direct match
    if (this.commands.has(commandName)) {
      return this.commands.get(commandName);
    }

    // Alias match
    for (const [name, commandInfo] of this.commands) {
      if (commandInfo.aliases.includes(commandName)) {
        return commandInfo;
      }
    }

    return null;
  }

  /**
   * Handle unknown command
   */
  handleUnknownCommand(commandName, userJid) {
    logger.warn(`Unknown command: ${commandName} from ${userJid}`);
    
    return {
      success: false,
      message: `❓ Perintah tidak dikenal: /${commandName}\n\n💡 Ketik /menu untuk melihat daftar perintah yang tersedia.`,
      type: 'unknown_command'
    };
  }

  /**
   * Check rate limiting for user
   */
  checkRateLimit(userJid, commandInfo) {
    const now = Date.now();
    const userKey = `${userJid}:${commandInfo.name}`;
    const limit = commandInfo.rateLimit;

    if (!this.rateLimiter.has(userKey)) {
      this.rateLimiter.set(userKey, {
        requests: [],
        blockedUntil: 0
      });
    }

    const userLimit = this.rateLimiter.get(userKey);

    // Check if user is blocked
    if (userLimit.blockedUntil > now) {
      return false;
    }

    // Clean old requests
    userLimit.requests = userLimit.requests.filter(
      timestamp => now - timestamp < limit.windowMs
    );

    // Check if limit exceeded
    if (userLimit.requests.length >= limit.maxRequests) {
      userLimit.blockedUntil = now + limit.blockDuration;
      return false;
    }

    // Add current request
    userLimit.requests.push(now);
    return true;
  }

  /**
   * Get all registered commands
   */
  getCommands() {
    return Array.from(this.commands.values());
  }

  /**
   * Get help text for all commands
   */
  getHelpText() {
    const commands = this.getCommands();
    
    let helpText = '📱 *Bot WhatsApp ISP*\n\n';
    helpText += '⚡ *Aksi Cepat*\n';
    helpText += '1️⃣ Ambil/Mulai/Selesaikan Job\n';
    helpText += '2️⃣ Batal Notifikasi\n';
    helpText += '3️⃣ Mulai Job\n';
    helpText += '4️⃣ Batal Job\n\n';

    // Group commands by category
    const categories = {
      '👷 Teknisi': [],
      '🔧 Manual': [],
      '📱 Sistem': []
    };

    commands.forEach(cmd => {
      if (cmd.name.includes('daftar') || cmd.name.includes('pekerjaan') || cmd.name.includes('statistik')) {
        categories['👷 Teknisi'].push(cmd);
      } else if (cmd.name.includes('ambil') || cmd.name.includes('mulai') || cmd.name.includes('selesai')) {
        categories['🔧 Manual'].push(cmd);
      } else {
        categories['📱 Sistem'].push(cmd);
      }
    });

    // Build help text
    Object.entries(categories).forEach(([category, categoryCommands]) => {
      if (categoryCommands.length > 0) {
        helpText += `*${category}*\n`;
        categoryCommands.forEach(cmd => {
          helpText += `${cmd.usage.padEnd(20)} ${cmd.description}\n`;
        });
        helpText += '\n';
      }
    });

    helpText += '💡 *Tips:*\n';
    helpText += '• Gunakan tombol angka untuk aksi cepat\n';
    helpText += '• Job ID opsional jika ada session aktif\n';
    helpText += '• Ketik /menu untuk melihat menu ini\n';

    return helpText;
  }

  /**
   * Clean up rate limiter data
   */
  cleanup() {
    const now = Date.now();
    for (const [key, data] of this.rateLimiter.entries()) {
      // Remove old entries
      if (now - Math.max(...data.requests, 0) > 300000) { // 5 minutes
        this.rateLimiter.delete(key);
      }
    }
  }
}

module.exports = CommandProcessor;
