/**
 * WhatsApp Bot Error Handler
 * Centralized error handling with proper logging and user feedback
 */

const logger = require('../../utils/logger');

class ErrorHandler {
  constructor() {
    this.errorTypes = {
      VALIDATION_ERROR: 'validation_error',
      AUTHENTICATION_ERROR: 'auth_error',
      AUTHORIZATION_ERROR: 'authorization_error',
      RATE_LIMIT_ERROR: 'rate_limit_error',
      DATABASE_ERROR: 'database_error',
      WHATSAPP_API_ERROR: 'whatsapp_api_error',
      NETWORK_ERROR: 'network_error',
      UNKNOWN_ERROR: 'unknown_error'
    };
  }

  /**
   * Handle and format errors
   */
  handleError(error, context = {}) {
    try {
      // Log the error
      this.logError(error, context);

      // Determine error type
      const errorType = this.categorizeError(error);

      // Format user-friendly message
      const userMessage = this.formatUserMessage(error, errorType);

      // Return structured error response
      return {
        success: false,
        message: userMessage,
        type: errorType,
        timestamp: new Date().toISOString(),
        errorId: this.generateErrorId(),
        ...(process.env.NODE_ENV === 'development' && {
          debug: {
            message: error.message,
            stack: error.stack,
            context
          }
        })
      };

    } catch (handlingError) {
      logger.error('Error in error handler', {
        originalError: error.message,
        handlingError: handlingError.message
      });

      return {
        success: false,
        message: '❌ Terjadi kesalahan yang tidak terduga. Silakan coba lagi.',
        type: this.errorTypes.UNKNOWN_ERROR,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Log error with context
   */
  logError(error, context = {}) {
    const logData = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      context,
      timestamp: new Date().toISOString()
    };

    // Determine log level based on error type
    if (this.isCriticalError(error)) {
      logger.error('Critical error in WhatsApp bot', logData);
    } else if (this.isWarningError(error)) {
      logger.warn('Warning in WhatsApp bot', logData);
    } else {
      logger.info('Error in WhatsApp bot', logData);
    }
  }

  /**
   * Categorize error type
   */
  categorizeError(error) {
    if (error.name === 'ValidationError' || error.message.includes('validation')) {
      return this.errorTypes.VALIDATION_ERROR;
    }
    
    if (error.name === 'AuthenticationError' || error.message.includes('auth')) {
      return this.errorTypes.AUTHENTICATION_ERROR;
    }
    
    if (error.name === 'AuthorizationError' || error.message.includes('permission')) {
      return this.errorTypes.AUTHORIZATION_ERROR;
    }
    
    if (error.name === 'RateLimitError' || error.message.includes('rate limit')) {
      return this.errorTypes.RATE_LIMIT_ERROR;
    }
    
    if (error.name === 'DatabaseError' || error.message.includes('database') || error.message.includes('prisma')) {
      return this.errorTypes.DATABASE_ERROR;
    }
    
    if (error.name === 'WhatsAppAPIError' || error.message.includes('whatsapp') || error.message.includes('baileys')) {
      return this.errorTypes.WHATSAPP_API_ERROR;
    }
    
    if (error.name === 'NetworkError' || error.message.includes('network') || error.message.includes('timeout')) {
      return this.errorTypes.NETWORK_ERROR;
    }
    
    return this.errorTypes.UNKNOWN_ERROR;
  }

  /**
   * Format user-friendly error message
   */
  formatUserMessage(error, errorType) {
    switch (errorType) {
      case this.errorTypes.VALIDATION_ERROR:
        return '❌ *Data tidak valid*\n\nSilakan periksa input Anda dan coba lagi.';
      
      case this.errorTypes.AUTHENTICATION_ERROR:
        return '🔒 *Autentikasi gagal*\n\nAnda perlu login terlebih dahulu.';
      
      case this.errorTypes.AUTHORIZATION_ERROR:
        return '🚫 *Akses ditolak*\n\nAnda tidak memiliki izin untuk melakukan aksi ini.';
      
      case this.errorTypes.RATE_LIMIT_ERROR:
        return '⏱️ *Terlalu banyak permintaan*\n\nSilakan tunggu sebentar sebelum mencoba lagi.';
      
      case this.errorTypes.DATABASE_ERROR:
        return '💾 *Kesalahan database*\n\nSilakan coba lagi dalam beberapa saat.';
      
      case this.errorTypes.WHATSAPP_API_ERROR:
        return '📱 *Kesalahan WhatsApp*\n\nKoneksi WhatsApp sedang bermasalah. Silakan coba lagi.';
      
      case this.errorTypes.NETWORK_ERROR:
        return '🌐 *Kesalahan jaringan*\n\nPeriksa koneksi internet Anda dan coba lagi.';
      
      default:
        return '❌ *Terjadi kesalahan*\n\nSilakan coba lagi atau hubungi administrator.';
    }
  }

  /**
   * Check if error is critical
   */
  isCriticalError(error) {
    const criticalPatterns = [
      'database',
      'prisma',
      'connection',
      'timeout',
      'memory',
      'disk'
    ];
    
    return criticalPatterns.some(pattern => 
      error.message.toLowerCase().includes(pattern)
    );
  }

  /**
   * Check if error is warning level
   */
  isWarningError(error) {
    const warningPatterns = [
      'validation',
      'rate limit',
      'permission',
      'not found'
    ];
    
    return warningPatterns.some(pattern => 
      error.message.toLowerCase().includes(pattern)
    );
  }

  /**
   * Generate unique error ID
   */
  generateErrorId() {
    return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Handle WhatsApp API specific errors
   */
  handleWhatsAppError(error, context = {}) {
    let userMessage = '📱 *Kesalahan WhatsApp*\n\n';
    
    if (error.message.includes('disconnected')) {
      userMessage += 'Koneksi WhatsApp terputus. Bot sedang mencoba menyambung kembali.';
    } else if (error.message.includes('rate limit')) {
      userMessage += 'Terlalu banyak pesan. Silakan tunggu sebentar.';
    } else if (error.message.includes('not found')) {
      userMessage += 'Nomor WhatsApp tidak ditemukan atau tidak valid.';
    } else if (error.message.includes('blocked')) {
      userMessage += 'Nomor ini diblokir atau tidak dapat menerima pesan.';
    } else {
      userMessage += 'Terjadi kesalahan saat mengirim pesan. Silakan coba lagi.';
    }
    
    return {
      success: false,
      message: userMessage,
      type: this.errorTypes.WHATSAPP_API_ERROR,
      timestamp: new Date().toISOString(),
      errorId: this.generateErrorId()
    };
  }

  /**
   * Handle database specific errors
   */
  handleDatabaseError(error, context = {}) {
    let userMessage = '💾 *Kesalahan Database*\n\n';
    
    if (error.message.includes('unique constraint')) {
      userMessage += 'Data sudah ada dalam sistem.';
    } else if (error.message.includes('foreign key')) {
      userMessage += 'Data yang terkait tidak ditemukan.';
    } else if (error.message.includes('connection')) {
      userMessage += 'Koneksi database bermasalah. Silakan coba lagi.';
    } else {
      userMessage += 'Terjadi kesalahan saat mengakses data.';
    }
    
    return {
      success: false,
      message: userMessage,
      type: this.errorTypes.DATABASE_ERROR,
      timestamp: new Date().toISOString(),
      errorId: this.generateErrorId()
    };
  }

  /**
   * Create custom error
   */
  createError(type, message, context = {}) {
    const error = new Error(message);
    error.name = type;
    error.context = context;
    return error;
  }

  /**
   * Validate error response format
   */
  validateErrorResponse(response) {
    const requiredFields = ['success', 'message', 'type', 'timestamp'];
    return requiredFields.every(field => response.hasOwnProperty(field));
  }
}

module.exports = ErrorHandler;
