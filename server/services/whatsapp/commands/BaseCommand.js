/**
 * Base Command Class
 * Abstract base class for all WhatsApp bot commands
 */

class BaseCommand {
  constructor(name, options = {}) {
    this.name = name;
    this.description = options.description || 'No description available';
    this.usage = options.usage || `/${name}`;
    this.aliases = options.aliases || [];
    this.permissions = options.permissions || [];
    this.rateLimit = options.rateLimit || {
      windowMs: 60000,
      maxRequests: 30,
      blockDuration: 300000
    };
    this.requiresAuth = options.requiresAuth !== false; // Default true
  }

  /**
   * Execute the command
   * Must be implemented by subclasses
   */
  async execute(userJid, args, context = {}) {
    throw new Error(`Command ${this.name} must implement execute method`);
  }

  /**
   * Validate command arguments
   */
  validateArgs(args) {
    return { valid: true, message: null };
  }

  /**
   * Format error response
   */
  formatError(message, type = 'error') {
    return {
      success: false,
      message: `❌ ${message}`,
      type
    };
  }

  /**
   * Format success response
   */
  formatSuccess(message, data = null) {
    return {
      success: true,
      message,
      data,
      type: 'success'
    };
  }

  /**
   * Format info response
   */
  formatInfo(message, data = null) {
    return {
      success: true,
      message,
      data,
      type: 'info'
    };
  }

  /**
   * Check if user has required permissions
   */
  hasPermission(userJid, context = {}) {
    if (!this.requiresAuth) return true;
    
    // Add permission checking logic here
    // For now, all authenticated users are allowed
    return context.isAuthenticated !== false;
  }

  /**
   * Get command help text
   */
  getHelp() {
    let help = `*${this.usage}*\n`;
    help += `${this.description}\n`;
    
    if (this.aliases.length > 0) {
      help += `\n*Aliases:* ${this.aliases.map(alias => `/${alias}`).join(', ')}\n`;
    }
    
    if (this.permissions.length > 0) {
      help += `\n*Permissions:* ${this.permissions.join(', ')}\n`;
    }
    
    return help;
  }
}

module.exports = BaseCommand;
