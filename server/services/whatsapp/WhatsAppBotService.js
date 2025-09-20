/**
 * WhatsApp Bot Service - Refactored and Improved
 * Central service for managing WhatsApp bot with proper architecture
 */

const { 
  default: makeWASocket, 
  DisconnectReason, 
  useMultiFileAuthState,
  makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const logger = require('../../utils/logger');
const CommandProcessor = require('./CommandProcessor');
const SessionManager = require('./SessionManager');
const ErrorHandler = require('./ErrorHandler');
const RateLimiter = require('./RateLimiter');
const InputValidator = require('./InputValidator');

// Import command handlers
const PingCommand = require('./commands/PingCommand');
const MenuCommand = require('./commands/MenuCommand');
const RegisterCommand = require('./commands/RegisterCommand');
const JobsCommand = require('./commands/JobsCommand');
const MyJobsCommand = require('./commands/MyJobsCommand');
const StatsCommand = require('./commands/StatsCommand');
const TakeJobCommand = require('./commands/TakeJobCommand');
const StartJobCommand = require('./commands/StartJobCommand');
const CompleteJobCommand = require('./commands/CompleteJobCommand');
const CancelJobCommand = require('./commands/CancelJobCommand');

class WhatsAppBotService {
  constructor(options = {}) {
    this.options = {
      sessionPath: options.sessionPath || path.join(__dirname, '../../auth_info_baileys'),
      statusFilePath: options.statusFilePath || path.join(__dirname, '../../../scripts/whatsapp-status.json'),
      version: options.version || [2, 2413, 1],
      browser: options.browser || ['Chrome (Windows)', 'Chrome', '120.0.0.0'],
      ...options
    };

    // Initialize components
    this.commandProcessor = new CommandProcessor();
    this.sessionManager = new SessionManager();
    this.errorHandler = new ErrorHandler();
    this.rateLimiter = new RateLimiter();
    this.inputValidator = new InputValidator();

    // Bot state
    this.sock = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 5;
    this.lastConnectionTime = null;
    this.commandCount = 0;

    // Initialize command handlers
    this.initializeCommands();

    // Setup middlewares
    this.setupMiddlewares();

    logger.info('WhatsAppBotService initialized', {
      sessionPath: this.options.sessionPath,
      version: this.options.version.join('.')
    });
  }

  /**
   * Initialize command handlers
   */
  initializeCommands() {
    // Register basic commands
    this.commandProcessor.registerCommand('ping', new PingCommand());
    this.commandProcessor.registerCommand('menu', new MenuCommand(this.commandProcessor));
    
    // Register technician commands
    this.commandProcessor.registerCommand('daftar', new RegisterCommand());
    this.commandProcessor.registerCommand('pekerjaan', new JobsCommand());
    this.commandProcessor.registerCommand('pekerjaanku', new MyJobsCommand());
    this.commandProcessor.registerCommand('statistik', new StatsCommand());
    
    // Register job action commands
    this.commandProcessor.registerCommand('ambil', new TakeJobCommand());
    this.commandProcessor.registerCommand('mulai', new StartJobCommand());
    this.commandProcessor.registerCommand('selesai', new CompleteJobCommand());
    this.commandProcessor.registerCommand('batal', new CancelJobCommand());
    
    logger.info('Command handlers initialized', {
      commandCount: this.commandProcessor.getCommands().length,
      commands: this.commandProcessor.getCommands().map(cmd => cmd.name)
    });
  }

  /**
   * Setup command processing middlewares
   */
  setupMiddlewares() {
    // Authentication middleware
    this.commandProcessor.addMiddleware(async (userJid, commandInfo, args, context) => {
      if (commandInfo.requiresAuth && !context.isAuthenticated) {
        return {
          success: false,
          message: '🔒 Anda perlu login terlebih dahulu.',
          type: 'auth_required'
        };
      }
      return { success: true };
    });

    // Rate limiting middleware
    this.commandProcessor.addMiddleware(async (userJid, commandInfo, args, context) => {
      const rateLimitResult = this.rateLimiter.isAllowed(userJid, commandInfo.rateLimit);
      
      if (!rateLimitResult.allowed) {
        return this.rateLimiter.createRateLimitResponse(userJid, rateLimitResult.retryAfter);
      }
      
      return { success: true };
    });

    // Input validation middleware
    this.commandProcessor.addMiddleware(async (userJid, commandInfo, args, context) => {
      const validation = this.inputValidator.validateCommandInputs(
        `/${commandInfo.name}`, 
        args, 
        context
      );
      
      if (!validation.valid) {
        return {
          success: false,
          message: `❌ *Validasi Gagal*\n\n${validation.errors.join('\n')}`,
          type: 'validation_error'
        };
      }
      
      return { success: true, validated: validation.validated };
    });
  }

  /**
   * Start WhatsApp bot
   */
  async start() {
    if (this.isConnecting || this.isConnected) {
      logger.warn('Bot is already starting or connected');
      return { success: false, message: 'Bot sudah berjalan atau sedang menyambung' };
    }

    try {
      this.isConnecting = true;
      logger.info('Starting WhatsApp bot...');

      // Create session directory
      await this.ensureSessionDirectory();

      // Load authentication state
      const { state, saveCreds } = await useMultiFileAuthState(this.options.sessionPath);

      // Create WhatsApp socket
      this.sock = makeWASocket({
        version: this.options.version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        browser: this.options.browser,
        qrTimeout: 120000,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 120000,
        keepAliveIntervalMs: 30000,
        markOnlineOnConnect: true,
        syncFullHistory: false,
        getMessage: async () => undefined
      });

      // Setup event handlers
      this.setupEventHandlers(saveCreds);

      // Export socket globally for API access
      global.whatsappSocket = this.sock;

      logger.info('WhatsApp bot started successfully');
      return { success: true, message: 'Bot berhasil dimulai' };

    } catch (error) {
      logger.error('Failed to start WhatsApp bot', error);
      this.isConnecting = false;
      return this.errorHandler.handleError(error, { action: 'start_bot' });
    }
  }

  /**
   * Setup WhatsApp socket event handlers
   */
  setupEventHandlers(saveCreds) {
    // Handle credential updates
    this.sock.ev.on('creds.update', saveCreds);

    // Handle connection updates
    this.sock.ev.on('connection.update', async (update) => {
      await this.handleConnectionUpdate(update);
    });

    // Handle incoming messages
    this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
      await this.handleMessages(messages, type);
    });

    // Handle message status updates
    this.sock.ev.on('messages.update', (updates) => {
      this.handleMessageUpdates(updates);
    });
  }

  /**
   * Handle connection updates
   */
  async handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info('QR code generated');
      await this.handleQRCode(qr);
    }

    if (connection === 'close') {
      await this.handleConnectionClose(lastDisconnect);
    } else if (connection === 'open') {
      await this.handleConnectionOpen();
    }

    // Update status file
    await this.updateStatusFile();
  }

  /**
   * Handle QR code generation
   */
  async handleQRCode(qr) {
    try {
      // Save QR code to file
      const qrPath = path.join(__dirname, '../../../server/public/qr/qr.png');
      await QRCode.toFile(qrPath, qr, { width: 300 });

      logger.info('QR code saved', { path: qrPath });

      // Broadcast QR code update via WebSocket
      const { broadcastWhatsAppStatusUpdate } = require('../websocketService');
      broadcastWhatsAppStatusUpdate({
        status: 'qr_required',
        connected: false,
        qrCode: qr,
        lastUpdate: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to handle QR code', error);
    }
  }

  /**
   * Handle connection close
   */
  async handleConnectionClose(lastDisconnect) {
    this.isConnected = false;
    this.isConnecting = false;

    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
    
    if (shouldReconnect && this.connectionAttempts < this.maxConnectionAttempts) {
      this.connectionAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.connectionAttempts), 30000);
      
      logger.warn(`Connection closed, reconnecting in ${delay}ms (attempt ${this.connectionAttempts})`);
      
      setTimeout(() => {
        this.start().catch(error => {
          logger.error('Reconnection failed', error);
        });
      }, delay);
    } else {
      logger.error('Max reconnection attempts reached or logged out');
    }

    // Broadcast disconnection
    const { broadcastWhatsAppStatusUpdate } = require('../websocketService');
    broadcastWhatsAppStatusUpdate({
      status: 'disconnected',
      connected: false,
      lastUpdate: new Date().toISOString()
    });
  }

  /**
   * Handle connection open
   */
  async handleConnectionOpen() {
    this.isConnected = true;
    this.isConnecting = false;
    this.connectionAttempts = 0;
    this.lastConnectionTime = new Date();

    logger.info('WhatsApp bot connected successfully', {
      user: this.sock.user?.id,
      name: this.sock.user?.name
    });

    // Broadcast connection
    const { broadcastWhatsAppStatusUpdate } = require('../websocketService');
    broadcastWhatsAppStatusUpdate({
      status: 'connected',
      connected: true,
      user: this.sock.user,
      lastUpdate: new Date().toISOString()
    });
  }

  /**
   * Handle incoming messages
   */
  async handleMessages(messages, type) {
    for (const message of messages) {
      try {
        await this.processMessage(message, type);
      } catch (error) {
        logger.error('Error processing message', {
          messageId: message.key.id,
          error: error.message
        });
      }
    }
  }

  /**
   * Process individual message
   */
  async processMessage(message, type) {
    if (!message.message || message.key.fromMe) return;

    const from = message.key.remoteJid;
    const pushName = message.pushName || 'User';
    
    // Extract text content
    const text = this.extractMessageText(message.message);
    if (!text) return;

    // Update command count
    this.commandCount++;

    // Handle interactive buttons (1-4)
    if (['1', '2', '3', '4'].includes(text.trim())) {
      await this.handleInteractiveButton(from, text.trim(), pushName);
      return;
    }

    // Handle slash commands
    if (text.startsWith('/')) {
      await this.handleSlashCommand(from, text, pushName);
      return;
    }

    // Handle regular messages (could be responses to prompts)
    await this.handleRegularMessage(from, text, pushName);
  }

  /**
   * Extract text content from message
   */
  extractMessageText(messageContent) {
    if (messageContent.conversation) {
      return messageContent.conversation;
    }
    
    if (messageContent.extendedTextMessage?.text) {
      return messageContent.extendedTextMessage.text;
    }
    
    if (messageContent.imageMessage?.caption) {
      return messageContent.imageMessage.caption;
    }
    
    if (messageContent.videoMessage?.caption) {
      return messageContent.videoMessage.caption;
    }
    
    if (messageContent.documentMessage?.caption) {
      return messageContent.documentMessage.caption;
    }
    
    return null;
  }

  /**
   * Handle interactive button presses
   */
  async handleInteractiveButton(from, button, pushName) {
    try {
      logger.info(`Interactive button pressed: ${button} from ${pushName}`);
      
      // Get current session
      const session = this.sessionManager.getSession(from);
      if (!session || !session.currentJob) {
        await this.sendMessage(from, '❌ Tidak ada job yang sedang aktif.\n\nGunakan /jobs untuk melihat job tersedia.');
        return;
      }

      // Process button action based on current job state
      const result = await this.processInteractiveAction(from, button, session.currentJob, pushName);
      
      if (result.success) {
        // Update session if needed
        if (result.updateSession) {
          this.sessionManager.updateSession(from, result.updateSession);
        }
      }

      await this.sendMessage(from, result.message);

    } catch (error) {
      logger.error('Error handling interactive button', error);
      await this.sendMessage(from, '❌ Terjadi kesalahan saat memproses tombol. Silakan coba lagi.');
    }
  }

  /**
   * Handle slash commands
   */
  async handleSlashCommand(from, text, pushName) {
    try {
      const parts = text.split(' ');
      const command = parts[0];
      const args = parts.slice(1);

      logger.info(`Command received: ${command} from ${pushName}`, { args });

      // Process command
      const result = await this.commandProcessor.processCommand(from, command, args, {
        isAuthenticated: true, // TODO: Implement proper authentication
        pushName,
        session: this.sessionManager.getSession(from)
      });

      await this.sendMessage(from, result.message);

    } catch (error) {
      logger.error('Error handling slash command', error);
      await this.sendMessage(from, '❌ Terjadi kesalahan saat memproses perintah. Silakan coba lagi.');
    }
  }

  /**
   * Handle regular messages
   */
  async handleRegularMessage(from, text, pushName) {
    // For now, just log regular messages
    logger.debug(`Regular message from ${pushName}: ${text.substring(0, 100)}...`);
    
    // TODO: Implement conversation flow handling
  }

  /**
   * Process interactive actions
   */
  async processInteractiveAction(from, button, currentJob, pushName) {
    // TODO: Implement interactive action processing
    // This should handle job assignment, starting, completing, etc.
    
    return {
      success: false,
      message: '⚠️ Fitur tombol interaktif sedang dalam pengembangan.',
      updateSession: null
    };
  }

  /**
   * Send message to WhatsApp
   */
  async sendMessage(to, message) {
    if (!this.isConnected || !this.sock) {
      throw new Error('WhatsApp bot is not connected');
    }

    try {
      await this.sock.sendMessage(to, { text: message });
      return { success: true };
    } catch (error) {
      logger.error('Failed to send WhatsApp message', error);
      throw error;
    }
  }

  /**
   * Handle message status updates
   */
  handleMessageUpdates(updates) {
    for (const update of updates) {
      logger.debug('Message status update', {
        messageId: update.key.id,
        status: update.status
      });
    }
  }

  /**
   * Ensure session directory exists
   */
  async ensureSessionDirectory() {
    if (!fs.existsSync(this.options.sessionPath)) {
      fs.mkdirSync(this.options.sessionPath, { recursive: true });
      logger.info('Session directory created', { path: this.options.sessionPath });
    }
  }

  /**
   * Update status file
   */
  async updateStatusFile() {
    try {
      const status = {
        connected: this.isConnected,
        connecting: this.isConnecting,
        user: this.sock?.user || null,
        status: this.isConnected ? 'connected' : 'disconnected',
        lastUpdate: new Date().toISOString(),
        uptime: this.lastConnectionTime ? Date.now() - this.lastConnectionTime.getTime() : 0,
        commandCount: this.commandCount,
        connectionAttempts: this.connectionAttempts
      };

      fs.writeFileSync(this.options.statusFilePath, JSON.stringify(status, null, 2));
    } catch (error) {
      logger.error('Failed to update status file', error);
    }
  }

  /**
   * Get bot status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      connecting: this.isConnecting,
      user: this.sock?.user || null,
      uptime: this.lastConnectionTime ? Date.now() - this.lastConnectionTime.getTime() : 0,
      commandCount: this.commandCount,
      connectionAttempts: this.connectionAttempts,
      sessionStats: this.sessionManager.getStats(),
      rateLimitStats: this.rateLimiter.getStats()
    };
  }

  /**
   * Shutdown bot
   */
  async shutdown() {
    logger.info('Shutting down WhatsApp bot service...');
    
    this.isConnected = false;
    this.isConnecting = false;
    
    if (this.sock) {
      this.sock.end();
    }
    
    this.sessionManager.shutdown();
    this.rateLimiter.shutdown();
    
    logger.info('WhatsApp bot service shutdown complete');
  }
}

module.exports = WhatsAppBotService;
