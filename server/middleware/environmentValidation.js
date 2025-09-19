/**
 * Environment Validation Middleware
 * Memastikan semua environment variables yang diperlukan tersedia dan valid
 */

const requiredEnvVars = {
  // Database
  DATABASE_URL: {
    required: true,
    description: 'Database connection URL',
    validate: (value) => {
      if (!value) return 'DATABASE_URL is required';
      if (value.includes('file:') && process.env.NODE_ENV === 'production') {
        return 'SQLite tidak boleh digunakan di production. Gunakan PostgreSQL.';
      }
      return null;
    }
  },

  // JWT Secrets
  JWT_SECRET: {
    required: true,
    description: 'JWT secret key untuk access tokens',
    validate: (value) => {
      if (!value) return 'JWT_SECRET is required';
      if (value.length < 32) return 'JWT_SECRET harus minimal 32 karakter';
      if (value === 'your-super-secret-jwt-key-here' || value === 'change_me') {
        return 'JWT_SECRET tidak boleh menggunakan nilai default';
      }
      return null;
    }
  },

  JWT_REFRESH_SECRET: {
    required: true,
    description: 'JWT secret key untuk refresh tokens',
    validate: (value) => {
      if (!value) return 'JWT_REFRESH_SECRET is required';
      if (value.length < 32) return 'JWT_REFRESH_SECRET harus minimal 32 karakter';
      if (value === 'your-super-secret-refresh-key-here' || value === 'change_me') {
        return 'JWT_REFRESH_SECRET tidak boleh menggunakan nilai default';
      }
      if (value === process.env.JWT_SECRET) {
        return 'JWT_REFRESH_SECRET harus berbeda dari JWT_SECRET';
      }
      return null;
    }
  },

  // CSRF Secret
  CSRF_SECRET: {
    required: true,
    description: 'CSRF secret key',
    validate: (value) => {
      if (!value) return 'CSRF_SECRET is required';
      if (value.length < 32) return 'CSRF_SECRET harus minimal 32 karakter';
      if (value === 'csrf-secret') {
        return 'CSRF_SECRET tidak boleh menggunakan nilai default';
      }
      return null;
    }
  },

  // Server Configuration
  PORT: {
    required: false,
    description: 'Server port',
    default: '3001',
    validate: (value) => {
      const port = parseInt(value);
      if (isNaN(port) || port < 1024 || port > 65535) {
        return 'PORT harus berupa angka antara 1024-65535';
      }
      return null;
    }
  },

  NODE_ENV: {
    required: true,
    description: 'Environment mode',
    validate: (value) => {
      const validEnvs = ['development', 'production', 'test'];
      if (!validEnvs.includes(value)) {
        return `NODE_ENV harus salah satu dari: ${validEnvs.join(', ')}`;
      }
      return null;
    }
  }
};

/**
 * Validasi environment variables
 */
function validateEnvironment() {
  const errors = [];
  const warnings = [];

  // Check required variables
  for (const [key, config] of Object.entries(requiredEnvVars)) {
    const value = process.env[key];
    
    if (config.required && !value) {
      errors.push(`${key}: ${config.description} - REQUIRED`);
    } else if (value && config.validate) {
      const validationError = config.validate(value);
      if (validationError) {
        errors.push(`${key}: ${validationError}`);
      }
    } else if (!value && config.default) {
      process.env[key] = config.default;
      warnings.push(`${key}: Menggunakan nilai default: ${config.default}`);
    }
  }

  // Additional security checks
  if (process.env.NODE_ENV === 'production') {
    // Check for development secrets in production
    const devSecrets = [
      'your-super-secret-jwt-key-here',
      'your-super-secret-refresh-key-here',
      'csrf-secret',
      'change_me'
    ];

    for (const secret of devSecrets) {
      if (process.env.JWT_SECRET === secret || 
          process.env.JWT_REFRESH_SECRET === secret || 
          process.env.CSRF_SECRET === secret) {
        errors.push(`SECURITY: Menggunakan secret development di production: ${secret}`);
      }
    }

    // Check for SQLite in production
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('file:')) {
      errors.push('SECURITY: SQLite tidak boleh digunakan di production. Gunakan PostgreSQL.');
    }

    // Check for debug mode
    if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
      warnings.push('WARNING: Debug mode aktif di production');
    }
  }

  return { errors, warnings };
}

/**
 * Generate secure random secrets
 */
function generateSecureSecrets() {
  const crypto = require('crypto');
  
  return {
    JWT_SECRET: crypto.randomBytes(64).toString('hex'),
    JWT_REFRESH_SECRET: crypto.randomBytes(64).toString('hex'),
    CSRF_SECRET: crypto.randomBytes(64).toString('hex')
  };
}

/**
 * Middleware untuk validasi environment
 */
function environmentValidationMiddleware(req, res, next) {
  // Only validate once at startup
  if (!global.envValidated) {
    const { errors, warnings } = validateEnvironment();
    
    if (errors.length > 0) {
      console.error('❌ Environment validation failed:');
      errors.forEach(error => console.error(`  - ${error}`));
      
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      } else {
        console.error('⚠️  Aplikasi akan berjalan dengan konfigurasi yang tidak aman!');
      }
    }

    if (warnings.length > 0) {
      console.warn('⚠️  Environment warnings:');
      warnings.forEach(warning => console.warn(`  - ${warning}`));
    }

    if (errors.length === 0) {
      console.log('✅ Environment validation passed');
    }

    global.envValidated = true;
  }

  next();
}

/**
 * Helper untuk mendapatkan environment variable dengan validasi
 */
function getEnvVar(key, defaultValue = null) {
  const value = process.env[key];
  if (!value && defaultValue === null) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value || defaultValue;
}

/**
 * Helper untuk mengecek apakah aplikasi berjalan di production
 */
function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Helper untuk mengecek apakah aplikasi berjalan di development
 */
function isDevelopment() {
  return process.env.NODE_ENV === 'development';
}

module.exports = {
  validateEnvironment,
  generateSecureSecrets,
  environmentValidationMiddleware,
  getEnvVar,
  isProduction,
  isDevelopment,
  requiredEnvVars
};
