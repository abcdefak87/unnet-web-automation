require('dotenv').config();

const whatsappConfig = {
    // Connection settings
    connection: {
        sessionPath: process.env.WHATSAPP_SESSION_PATH || './.data/whatsapp/session',
        qrPath: process.env.WHATSAPP_QR_PATH || './.data/whatsapp/qr',
        qrTimeout: parseInt(process.env.WHATSAPP_QR_TIMEOUT || '120000'),
        maxReconnectAttempts: parseInt(process.env.WHATSAPP_MAX_RECONNECTS || '5'),
        reconnectDelay: parseInt(process.env.WHATSAPP_RECONNECT_DELAY || '5000'),
        waVersion: process.env.WHATSAPP_VERSION ? 
            process.env.WHATSAPP_VERSION.split(',').map(v => parseInt(v.trim())) :
            [2, 2413, 1], // Stable hardcoded version
        browser: ['Chrome (Windows)', 'Chrome', '120.0.0.0'],
    },
    
    // Message queue settings
    queue: {
        enabled: process.env.WHATSAPP_QUEUE_ENABLED !== 'false',
        maxSize: parseInt(process.env.WHATSAPP_QUEUE_SIZE || '1000'),
        messageDelay: parseInt(process.env.WHATSAPP_MESSAGE_DELAY || '1000'),
        maxRetries: parseInt(process.env.WHATSAPP_MAX_RETRIES || '3'),
        retryDelay: parseInt(process.env.WHATSAPP_RETRY_DELAY || '2000'),
        ttl: parseInt(process.env.WHATSAPP_MESSAGE_TTL || '300000'), // 5 minutes
        batchSize: parseInt(process.env.WHATSAPP_BATCH_SIZE || '10'),
    },
    
    // Rate limiting
    rateLimit: {
        perMinute: parseInt(process.env.WHATSAPP_RATE_LIMIT || '30'),
        perHour: parseInt(process.env.WHATSAPP_RATE_LIMIT_HOUR || '500'),
        perDay: parseInt(process.env.WHATSAPP_RATE_LIMIT_DAY || '5000'),
    },
    
    // Session management
    session: {
        backupEnabled: process.env.WHATSAPP_SESSION_BACKUP === 'true',
        backupInterval: parseInt(process.env.WHATSAPP_BACKUP_INTERVAL || '3600000'), // 1 hour
        backupProvider: process.env.WHATSAPP_BACKUP_PROVIDER || 'local', // local, database, s3
        encryptionKey: process.env.WHATSAPP_SESSION_ENCRYPTION_KEY,
        multiDevice: process.env.WHATSAPP_MULTI_DEVICE === 'true',
    },
    
    // Admin settings
    admin: {
        number: process.env.WHATSAPP_ADMIN_NUMBER,
        notifyOnConnect: process.env.WHATSAPP_NOTIFY_CONNECT !== 'false',
        notifyOnDisconnect: process.env.WHATSAPP_NOTIFY_DISCONNECT !== 'false',
        notifyOnError: process.env.WHATSAPP_NOTIFY_ERROR !== 'false',
    },
    
    // Features
    features: {
        autoReply: process.env.WHATSAPP_AUTO_REPLY === 'true',
        commands: process.env.WHATSAPP_COMMANDS !== 'false',
        mediaSupport: process.env.WHATSAPP_MEDIA_SUPPORT !== 'false',
        groupSupport: process.env.WHATSAPP_GROUP_SUPPORT === 'true',
        broadcastSupport: process.env.WHATSAPP_BROADCAST !== 'false',
        webhooks: process.env.WHATSAPP_WEBHOOKS === 'true',
    },
    
    // API security
    api: {
        rateWindow: parseInt(process.env.WHATSAPP_API_RATE_WINDOW || '60000'),
        rateMax: parseInt(process.env.WHATSAPP_API_RATE_MAX || '30'),
        webhookSecret: process.env.WHATSAPP_WEBHOOK_SECRET,
        ipWhitelist: process.env.WHATSAPP_IP_WHITELIST ? 
            process.env.WHATSAPP_IP_WHITELIST.split(',').map(ip => ip.trim()) : [],
        maxMessageLength: parseInt(process.env.WHATSAPP_MAX_MESSAGE_LENGTH || '4096'),
    },
    
    // Monitoring
    monitoring: {
        enabled: process.env.WHATSAPP_MONITORING === 'true',
        metricsInterval: parseInt(process.env.WHATSAPP_METRICS_INTERVAL || '60000'),
        healthCheckInterval: parseInt(process.env.WHATSAPP_HEALTH_CHECK || '30000'),
        logLevel: process.env.WHATSAPP_LOG_LEVEL || 'info',
    },
    
    // Database
    database: {
        storeMessages: process.env.WHATSAPP_STORE_MESSAGES === 'true',
        messageRetention: parseInt(process.env.WHATSAPP_MESSAGE_RETENTION || '604800000'), // 7 days
        storeMedia: process.env.WHATSAPP_STORE_MEDIA === 'true',
        mediaPath: process.env.WHATSAPP_MEDIA_PATH || './server/media/whatsapp',
    },
};

// Validate configuration
function validateConfig() {
    const errors = [];
    
    // Check required settings
    if (!whatsappConfig.admin.number) {
        errors.push('WHATSAPP_ADMIN_NUMBER is not configured');
    }
    
    // Check rate limits
    if (whatsappConfig.rateLimit.perMinute > 60) {
        errors.push('Rate limit per minute exceeds WhatsApp recommendations (60)');
    }
    
    // Check queue settings
    if (whatsappConfig.queue.ttl < 60000) {
        errors.push('Message TTL is too short (minimum 60 seconds recommended)');
    }
    
    // Check reconnection settings
    if (whatsappConfig.connection.maxReconnectAttempts < 1) {
        errors.push('Max reconnect attempts must be at least 1');
    }
    
    return errors;
}

// Get environment-specific config
function getEnvironmentConfig() {
    const env = process.env.NODE_ENV || 'development';
    
    const envOverrides = {
        development: {
            monitoring: { enabled: true, logLevel: 'debug' },
            rateLimit: { perMinute: 60 }, // More lenient in dev
        },
        production: {
            session: { backupEnabled: true },
            monitoring: { enabled: true },
            api: { webhookSecret: process.env.WHATSAPP_WEBHOOK_SECRET },
        },
        test: {
            queue: { enabled: false },
            monitoring: { enabled: false },
            rateLimit: { perMinute: 1000 }, // No limit in tests
        },
    };
    
    return { ...whatsappConfig, ...(envOverrides[env] || {}) };
}

module.exports = {
    config: (() => {
        const cfg = getEnvironmentConfig();
        if (process.env.NODE_ENV === 'production') {
            const errs = [];
            if (!cfg.admin.number) errs.push('WHATSAPP_ADMIN_NUMBER missing');
            if (!cfg.api.webhookSecret) errs.push('WHATSAPP_WEBHOOK_SECRET missing');
            if (errs.length) {
                throw new Error('WhatsApp config error: ' + errs.join(', '));
            }
        }
        return cfg;
    })(),
    validate: validateConfig,
    raw: whatsappConfig,
};
