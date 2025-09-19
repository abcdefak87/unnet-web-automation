/**
 * Input Validator for WhatsApp Bot
 * Validates and sanitizes user inputs
 */

const logger = require('../../utils/logger');

class InputValidator {
  constructor() {
    this.patterns = {
      phoneNumber: /^(\+62|62|0)[0-9]{8,12}$/,
      jobNumber: /^[A-Z]+-\d+-\d{4}$/,
      username: /^[a-zA-Z0-9_]{3,20}$/,
      name: /^[a-zA-Z\s]{2,50}$/,
      command: /^\/[a-zA-Z0-9_]+$/,
      number: /^\d+$/
    };
    
    this.maxLengths = {
      message: 4096,
      name: 50,
      username: 20,
      phoneNumber: 15,
      jobNumber: 20
    };
    
    this.blockedPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\(/i,
      /expression\(/i,
      /vbscript:/i,
      /data:/i,
      /file:/i
    ];
  }

  /**
   * Validate phone number
   */
  validatePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') {
      return { valid: false, message: 'Nomor telepon harus berupa string' };
    }
    
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length < 8 || cleaned.length > 15) {
      return { valid: false, message: 'Nomor telepon harus 8-15 digit' };
    }
    
    // Check if it's a valid Indonesian phone number
    if (!cleaned.startsWith('62') && !cleaned.startsWith('0')) {
      return { valid: false, message: 'Nomor telepon harus dimulai dengan 62 atau 0' };
    }
    
    return { valid: true, normalized: this.normalizePhoneNumber(cleaned) };
  }

  /**
   * Normalize phone number to 62 format
   */
  normalizePhoneNumber(phone) {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('0')) {
      return '62' + cleaned.substring(1);
    } else if (!cleaned.startsWith('62')) {
      return '62' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Validate job number
   */
  validateJobNumber(jobNumber) {
    if (!jobNumber || typeof jobNumber !== 'string') {
      return { valid: false, message: 'Nomor job harus berupa string' };
    }
    
    const trimmed = jobNumber.trim();
    
    if (trimmed.length === 0) {
      return { valid: false, message: 'Nomor job tidak boleh kosong' };
    }
    
    if (trimmed.length > this.maxLengths.jobNumber) {
      return { valid: false, message: `Nomor job maksimal ${this.maxLengths.jobNumber} karakter` };
    }
    
    // Allow alphanumeric and common separators
    if (!/^[A-Z0-9-_]+$/i.test(trimmed)) {
      return { valid: false, message: 'Nomor job hanya boleh mengandung huruf, angka, dan tanda hubung' };
    }
    
    return { valid: true, normalized: trimmed.toUpperCase() };
  }

  /**
   * Validate username
   */
  validateUsername(username) {
    if (!username || typeof username !== 'string') {
      return { valid: false, message: 'Username harus berupa string' };
    }
    
    const trimmed = username.trim();
    
    if (trimmed.length < 3) {
      return { valid: false, message: 'Username minimal 3 karakter' };
    }
    
    if (trimmed.length > this.maxLengths.username) {
      return { valid: false, message: `Username maksimal ${this.maxLengths.username} karakter` };
    }
    
    if (!this.patterns.username.test(trimmed)) {
      return { valid: false, message: 'Username hanya boleh mengandung huruf, angka, dan underscore' };
    }
    
    return { valid: true, normalized: trimmed.toLowerCase() };
  }

  /**
   * Validate name
   */
  validateName(name) {
    if (!name || typeof name !== 'string') {
      return { valid: false, message: 'Nama harus berupa string' };
    }
    
    const trimmed = name.trim();
    
    if (trimmed.length < 2) {
      return { valid: false, message: 'Nama minimal 2 karakter' };
    }
    
    if (trimmed.length > this.maxLengths.name) {
      return { valid: false, message: `Nama maksimal ${this.maxLengths.name} karakter` };
    }
    
    if (!this.patterns.name.test(trimmed)) {
      return { valid: false, message: 'Nama hanya boleh mengandung huruf dan spasi' };
    }
    
    return { valid: true, normalized: this.sanitizeName(trimmed) };
  }

  /**
   * Sanitize name (capitalize first letter of each word)
   */
  sanitizeName(name) {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .trim();
  }

  /**
   * Validate message content
   */
  validateMessage(message) {
    if (!message || typeof message !== 'string') {
      return { valid: false, message: 'Pesan harus berupa string' };
    }
    
    if (message.length === 0) {
      return { valid: false, message: 'Pesan tidak boleh kosong' };
    }
    
    if (message.length > this.maxLengths.message) {
      return { valid: false, message: `Pesan maksimal ${this.maxLengths.message} karakter` };
    }
    
    // Check for blocked patterns
    for (const pattern of this.blockedPatterns) {
      if (pattern.test(message)) {
        return { valid: false, message: 'Pesan mengandung konten yang tidak diizinkan' };
      }
    }
    
    return { valid: true, normalized: this.sanitizeMessage(message) };
  }

  /**
   * Sanitize message content
   */
  sanitizeMessage(message) {
    return message
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Validate command
   */
  validateCommand(command) {
    if (!command || typeof command !== 'string') {
      return { valid: false, message: 'Command harus berupa string' };
    }
    
    const trimmed = command.trim();
    
    if (!trimmed.startsWith('/')) {
      return { valid: false, message: 'Command harus dimulai dengan /' };
    }
    
    if (trimmed.length < 2) {
      return { valid: false, message: 'Command tidak boleh kosong' };
    }
    
    if (trimmed.length > 50) {
      return { valid: false, message: 'Command maksimal 50 karakter' };
    }
    
    // Extract command name (without arguments)
    const commandName = trimmed.split(' ')[0];
    
    if (!this.patterns.command.test(commandName)) {
      return { valid: false, message: 'Format command tidak valid' };
    }
    
    return { valid: true, normalized: commandName.toLowerCase() };
  }

  /**
   * Validate numeric input
   */
  validateNumber(value, options = {}) {
    if (value === null || value === undefined) {
      return { valid: false, message: 'Nilai tidak boleh kosong' };
    }
    
    const num = parseInt(value);
    
    if (isNaN(num)) {
      return { valid: false, message: 'Nilai harus berupa angka' };
    }
    
    if (options.min !== undefined && num < options.min) {
      return { valid: false, message: `Nilai minimal ${options.min}` };
    }
    
    if (options.max !== undefined && num > options.max) {
      return { valid: false, message: `Nilai maksimal ${options.max}` };
    }
    
    return { valid: true, normalized: num };
  }

  /**
   * Validate interactive button input
   */
  validateInteractiveButton(input) {
    if (!input || typeof input !== 'string') {
      return { valid: false, message: 'Input tombol harus berupa string' };
    }
    
    const trimmed = input.trim();
    
    if (!['1', '2', '3', '4'].includes(trimmed)) {
      return { valid: false, message: 'Tombol harus berupa angka 1-4' };
    }
    
    return { valid: true, normalized: parseInt(trimmed) };
  }

  /**
   * Validate all inputs for a command
   */
  validateCommandInputs(command, args, context = {}) {
    const errors = [];
    const validated = {};
    
    try {
      // Validate command
      const commandValidation = this.validateCommand(command);
      if (!commandValidation.valid) {
        errors.push(commandValidation.message);
      } else {
        validated.command = commandValidation.normalized;
      }
      
      // Validate arguments based on command type
      if (validated.command) {
        const argsValidation = this.validateCommandArgs(validated.command, args);
        if (!argsValidation.valid) {
          errors.push(...argsValidation.errors);
        } else {
          validated.args = argsValidation.normalized;
        }
      }
      
      return {
        valid: errors.length === 0,
        errors,
        validated
      };
      
    } catch (error) {
      logger.error('Input validation error', {
        command,
        args,
        error: error.message
      });
      
      return {
        valid: false,
        errors: ['Terjadi kesalahan saat validasi input'],
        validated: {}
      };
    }
  }

  /**
   * Validate command arguments
   */
  validateCommandArgs(command, args) {
    const errors = [];
    const validated = {};
    
    switch (command) {
      case '/daftar':
        if (args.length < 1) {
          errors.push('Nama harus disertakan');
        } else {
          const nameValidation = this.validateName(args[0]);
          if (!nameValidation.valid) {
            errors.push(nameValidation.message);
          } else {
            validated.name = nameValidation.normalized;
          }
        }
        break;
        
      case '/ambil':
      case '/mulai':
      case '/selesai':
      case '/batal':
        if (args.length > 0) {
          const jobValidation = this.validateJobNumber(args[0]);
          if (!jobValidation.valid) {
            errors.push(jobValidation.message);
          } else {
            validated.jobNumber = jobValidation.normalized;
          }
        }
        break;
        
      default:
        // For other commands, just validate basic string inputs
        validated.args = args.map(arg => this.sanitizeMessage(arg));
    }
    
    return {
      valid: errors.length === 0,
      errors,
      normalized: validated
    };
  }

  /**
   * Check for suspicious patterns
   */
  isSuspicious(input) {
    const suspiciousPatterns = [
      /spam/i,
      /flood/i,
      /attack/i,
      /hack/i,
      /exploit/i,
      /inject/i,
      /sql/i,
      /xss/i
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Get validation statistics
   */
  getStats() {
    return {
      patterns: Object.keys(this.patterns),
      maxLengths: this.maxLengths,
      blockedPatterns: this.blockedPatterns.length
    };
  }
}

module.exports = InputValidator;
