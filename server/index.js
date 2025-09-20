const express = require('express');
const cors = require('cors');
const { corsOptions, sanitizeAllInputs, createRateLimiter } = require('./middleware/security');
const { rateLimits } = require('./middleware/userRateLimit');
const { environmentValidationMiddleware, getEnvVar, isProduction, isDevelopment } = require('./middleware/environmentValidation');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const prisma = require('./utils/database');

const { createServer } = require('http');
const { initializeWebSocket } = require('./services/websocketService');
const logger = require('./utils/logger');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const authOtpRoutes = require('./routes/auth-otp');
const jobRoutes = require('./routes/jobs');
const technicianRoutes = require('./routes/technicians');
const inventoryRoutes = require('./routes/inventory');
const customerRoutes = require('./routes/customers');
const reportRoutes = require('./routes/reports');
// Telegram routes removed - using WhatsApp instead
const monitoringRoutes = require('./routes/monitoring');
const userRoutes = require('./routes/users');
const uploadRoutes = require('./routes/upload');
const registrationRoutes = require('./routes/registrations');
const notificationRoutes = require('./routes/notifications');

const app = express();
const PORT = getEnvVar('PORT', '3001');

// Environment validation - must be first
app.use(environmentValidationMiddleware);

// Security middleware with CSP configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: process.env.NODE_ENV === 'production' ? ["'self'"] : ["'self'", "'unsafe-inline'"],
      styleSrc: process.env.NODE_ENV === 'production' ? ["'self'"] : ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: (() => {
        const list = ["'self'"];
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
        if (apiUrl) list.push(apiUrl);
        const wsOrigin = (process.env.WS_ORIGIN || '').trim();
        if (wsOrigin) list.push(wsOrigin);
        if (process.env.NODE_ENV !== 'production') {
          list.push('http://localhost:3001', 'http://localhost:3000', 'ws://localhost:3001', 'ws://localhost:3000');
        }
        list.push('https:','wss:');
        return list;
      })(),
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));
// CORS Configuration - Use only cors middleware to avoid conflicts
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',') 
      : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001'];
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // For development, allow all localhost origins
    if (process.env.NODE_ENV === 'development' || 
        origin.includes('localhost') || 
        origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // Don't throw error, just return false to prevent CORS header from being set
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['X-Total-Count', 'Content-Range'],
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 200
}));

// Enhanced rate limiting with user-specific limits
const limiter = rateLimit({
  windowMs: parseInt(getEnvVar('RATE_LIMIT_WINDOW_MS', '900000')), // 15 minutes
  max: parseInt(getEnvVar('RATE_LIMIT_MAX_REQUESTS', '1000')), // 1000 requests per window
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => {
    // Always apply basic rate limiting, but be more lenient in development
    return req.method === 'OPTIONS'
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.'
    });
  }
});

// Apply rate limiting with different limits for development vs production
if (isDevelopment()) {
  // More lenient rate limiting in development
  const devLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5000, // Higher limit for development
    message: 'Too many requests from this IP, please try again later.',
    skip: (req) => req.method === 'OPTIONS'
  });
  app.use('/api/', devLimiter);
} else {
  // Strict rate limiting in production
  app.use('/api/', limiter);
  app.use('/api/', rateLimits.general);
}

// Additional specific rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  skip: (req) => req.method === 'OPTIONS' // Skip OPTIONS requests
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 uploads per hour
  message: 'Too many file uploads, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS' // Skip OPTIONS requests
});

// Apply specific rate limiting with different limits for development vs production
if (isDevelopment()) {
  // More lenient specific rate limiting in development
  const devAuthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Higher limit for development
    message: 'Too many login attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    skip: (req) => req.method === 'OPTIONS'
  });
  
  app.use('/api/auth/login', devAuthLimiter);
  app.use('/api/auth/register', devAuthLimiter);
  app.use('/api/upload', uploadLimiter);
} else {
  // Strict specific rate limiting in production
  app.use('/api/auth/login', authLimiter, rateLimits.auth);
  app.use('/api/auth/register', authLimiter, rateLimits.registration);
  app.use('/api/upload', uploadLimiter, rateLimits.upload);
  app.use('/api/jobs', rateLimits.jobCreation);
  app.use('/api/customers', rateLimits.customerCreation);
  app.use('/api/reports', rateLimits.reports);
  app.use('/api/whatsapp', rateLimits.whatsapp);
}

// Body parsing middleware - Skip for multipart requests
app.use(compression());
app.use((req, res, next) => {
  // Skip body parsing for multipart/form-data requests
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    return next();
  }
  express.json({ limit: '10mb' })(req, res, next);
});
app.use((req, res, next) => {
  // Skip URL encoding for multipart/form-data requests
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    return next();
  }
  express.urlencoded({ extended: true, limit: '10mb' })(req, res, next);
});

// Sanitize all inputs globally
app.use(sanitizeAllInputs);

// Logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Static files for uploads
app.use('/uploads', express.static('uploads'));

// Static files for QR codes
app.use('/qr', express.static('public/qr'));

// Serve frontend files (if built)
const path = require('path');
const frontendPath = path.join(__dirname, '../client/.next');
const clientBuildPath = path.join(__dirname, '../client/out');
const clientDistPath = path.join(__dirname, '../client/dist');

// Try to serve built frontend files
if (require('fs').existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
} else if (require('fs').existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
} else if (require('fs').existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
}

// Enhanced health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API health check with database
app.get('/api/health', async (req, res) => {
  try {
    // Check database connection using the global prisma instance
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: 'Connected',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      database: 'Disconnected',
      error: error.message
    });
  }
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/auth', require('./routes/auth-otp')); // OTP endpoints for password reset
app.use('/api/technicians', require('./routes/technicians'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/users', require('./routes/users'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/rating', require('./routes/rating'));

// Debug: Log all registered routes
console.log('Registered API routes:');
console.log('- /api/customers/register/csrf-token (GET)');
console.log('- /api/customers/register/test-csrf (GET)');
console.log('- /api/customers/register (POST)');
const whatsappRoutes = require('./whatsapp/consolidated/routes-integrated');
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/technician-registrations', require('./routes/technicianRegistration'));
app.use('/api/registrations', require('./routes/registrations'));


// WhatsApp initialization DISABLED - using scripts/whatsapp-bot-integrated.js instead
// To prevent auto-reply issues, WhatsApp bot runs separately
// const WhatsApp = require('./whatsapp');
// setTimeout(() => {
//   WhatsApp.initialize().then(result => {
//     if (result.success) {
//       console.log('✅ WhatsApp module initialized');
//     } else {
//       console.error('❌ WhatsApp initialization failed:', result.error);
//     }
//   }).catch(error => {
//     console.error('❌ WhatsApp initialization error:', error.message);
//   });
// }, 1000);

app.use('/api', require('./routes/setup'));

// Error handling middleware
app.use((err, req, res, next) => {
  // Log error details
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // CORS error handling
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'CORS Error',
      message: 'Origin not allowed'
    });
  }

  // Validation error handling
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message
    });
  }

  // JWT error handling
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Authentication Error',
      message: 'Invalid token'
    });
  }

  // Prisma error handling
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'Duplicate Entry',
      message: 'Resource already exists'
    });
  }

  // Generic error response
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ 
    error: statusCode === 500 ? 'Internal Server Error' : err.message,
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Serve index.html for frontend routes (SPA fallback)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }

  const fs = require('fs');
  const clientIndexPath = path.join(__dirname, '../client/out/index.html');
  const clientDistIndexPath = path.join(__dirname, '../client/dist/index.html');

  if (fs.existsSync(clientIndexPath)) {
    return res.sendFile(clientIndexPath);
  }
  if (fs.existsSync(clientDistIndexPath)) {
    return res.sendFile(clientDistIndexPath);
  }

  return res.status(404).send('Not Found');
});

// Create HTTP server and initialize WebSocket
const server = createServer(app);
const io = initializeWebSocket(server);

server.listen(PORT, '0.0.0.0', async () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📊 Health check: http://localhost:${PORT}/health`);
  logger.info(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`⚡ WebSocket server initialized`);
  
  // WhatsApp bot initialization is handled by the modular WhatsApp system
  // during server startup via the WhatsApp.initialize() call above
  logger.info('📱 WhatsApp modular system ready');
}).on('error', (err) => {
  logger.error('❌ Server failed to start:', err.message);
  if (err.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use. Please kill the process or use a different port.`);
    
    // Try to find and kill the process using the port
    const { exec } = require('child_process');
    const isWindows = process.platform === 'win32';
    
    if (isWindows) {
      exec(`netstat -ano | findstr :${PORT}`, (error, stdout) => {
        if (stdout) {
          const lines = stdout.trim().split('\n');
          const pids = new Set();
          lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 5) {
              pids.add(parts[4]);
            }
          });
          
          if (pids.size > 0) {
            logger.info(`Found processes using port ${PORT}: ${Array.from(pids).join(', ')}`);
            logger.info('You can kill them with: taskkill /PID <PID> /F');
            logger.info('Or run: scripts/kill-port-3001.bat');
          }
        }
      });
    } else {
      exec(`lsof -ti:${PORT}`, (error, stdout) => {
        if (stdout) {
          const pids = stdout.trim().split('\n');
          logger.info(`Found processes using port ${PORT}: ${pids.join(', ')}`);
          logger.info('You can kill them with: kill -9 <PID>');
        }
      });
    }
    
    // Exit gracefully
    process.exit(1);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});
