/**
 * Ping Command - Test bot connectivity
 */

const BaseCommand = require('./BaseCommand');

class PingCommand extends BaseCommand {
  constructor() {
    super('ping', {
      description: 'Test bot connectivity',
      usage: '/ping',
      aliases: ['p', 'test'],
      rateLimit: {
        windowMs: 60000,
        maxRequests: 60, // More lenient for ping
        blockDuration: 60000
      }
    });
  }

  async execute(userJid, args, context = {}) {
    try {
      const startTime = Date.now();
      
      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const responseTime = Date.now() - startTime;
      
      return this.formatSuccess(
        `🏓 *Pong!*\n\n` +
        `✅ Bot aktif dan responsif\n` +
        `⏱️ Response time: ${responseTime}ms\n` +
        `🕐 Server time: ${new Date().toLocaleString('id-ID')}\n\n` +
        `💡 Bot siap menerima perintah!`
      );
      
    } catch (error) {
      return this.formatError(
        'Gagal melakukan ping test. Silakan coba lagi.',
        'ping_error'
      );
    }
  }
}

module.exports = PingCommand;
