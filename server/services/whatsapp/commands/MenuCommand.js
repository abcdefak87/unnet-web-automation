/**
 * Menu Command - Show available commands
 */

const BaseCommand = require('./BaseCommand');

class MenuCommand extends BaseCommand {
  constructor(commandProcessor) {
    super('menu', {
      description: 'Tampilkan daftar perintah yang tersedia',
      usage: '/menu',
      aliases: ['help', 'h', 'commands'],
      rateLimit: {
        windowMs: 60000,
        maxRequests: 10, // Less frequent for menu
        blockDuration: 60000
      }
    });
    
    this.commandProcessor = commandProcessor;
  }

  async execute(userJid, args, context = {}) {
    try {
      const helpText = this.commandProcessor.getHelpText();
      
      return this.formatSuccess(helpText);
      
    } catch (error) {
      return this.formatError(
        'Gagal menampilkan menu. Silakan coba lagi.',
        'menu_error'
      );
    }
  }
}

module.exports = MenuCommand;
