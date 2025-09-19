const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

// Rate limiting for WhatsApp API endpoints
const whatsappRateLimit = rateLimit({
    windowMs: parseInt(process.env.WHATSAPP_API_RATE_WINDOW || '60000'), // 1 minute
    max: parseInt(process.env.WHATSAPP_API_RATE_MAX || '30'), // 30 requests per minute
    message: 'Too many requests to WhatsApp API. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: 'Rate limit exceeded',
            retryAfter: res.getHeader('Retry-After'),
        });
    },
});

// Webhook signature verification
const verifyWebhookSignature = (secret) => {
    return (req, res, next) => {
        if (!secret) {
            return next(); // Skip if no secret configured
        }
        
        const signature = req.headers['x-whatsapp-signature'];
        if (!signature) {
            return res.status(401).json({
                success: false,
                error: 'Missing webhook signature',
            });
        }
        
        const payload = JSON.stringify(req.body);
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');
        
        if (signature !== expectedSignature) {
            return res.status(401).json({
                success: false,
                error: 'Invalid webhook signature',
            });
        }
        
        next();
    };
};

// Sanitize phone numbers
const sanitizePhoneNumber = (req, res, next) => {
    // Check various possible fields for phone numbers
    const fields = ['phone', 'phoneNumber', 'number', 'to', 'recipient'];
    
    for (const field of fields) {
        if (req.body[field]) {
            // Remove all non-numeric characters
            let cleaned = req.body[field].toString().replace(/\D/g, '');
            
            // Validate length (minimum 10 digits)
            if (cleaned.length < 10) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid phone number format in field: ${field}`,
                });
            }
            
            // Store cleaned number
            req.body[field] = cleaned;
        }
        
        if (req.params[field]) {
            let cleaned = req.params[field].toString().replace(/\D/g, '');
            
            if (cleaned.length < 10) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid phone number format in param: ${field}`,
                });
            }
            
            req.params[field] = cleaned;
        }
    }
    
    next();
};

// Message content validation
const validateMessageContent = (req, res, next) => {
    if (req.body.message) {
        const message = req.body.message;
        
        // Check message length
        const maxLength = parseInt(process.env.WHATSAPP_MAX_MESSAGE_LENGTH || '4096');
        if (typeof message === 'string' && message.length > maxLength) {
            return res.status(400).json({
                success: false,
                error: `Message exceeds maximum length of ${maxLength} characters`,
            });
        }
        
        // Check for forbidden content (customize as needed)
        const forbiddenPatterns = [
            /\x00/, // Null bytes
            /<script[^>]*>/gi, // Script tags
            /javascript:/gi, // JavaScript protocol
        ];
        
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
        for (const pattern of forbiddenPatterns) {
            if (pattern.test(messageStr)) {
                return res.status(400).json({
                    success: false,
                    error: 'Message contains forbidden content',
                });
            }
        }
    }
    
    next();
};

// IP whitelist middleware
const ipWhitelist = (whitelist = []) => {
    return (req, res, next) => {
        if (whitelist.length === 0) {
            return next(); // No whitelist configured
        }
        
        const clientIp = req.ip || req.connection.remoteAddress;
        
        // Check if IP is in whitelist
        const allowed = whitelist.some(ip => {
            if (ip.includes('*')) {
                // Support wildcards
                const pattern = ip.replace(/\./g, '\\.').replace(/\*/g, '.*');
                const regex = new RegExp(`^${pattern}$`);
                return regex.test(clientIp);
            }
            return ip === clientIp;
        });
        
        if (!allowed) {
            return res.status(403).json({
                success: false,
                error: 'Access denied from this IP address',
            });
        }
        
        next();
    };
};

// Request logging middleware
const logWhatsAppRequests = (req, res, next) => {
    const start = Date.now();
    
    // Log request
    console.log(`[WhatsApp API] ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
    
    // Override res.json to log response
    const originalJson = res.json;
    res.json = function(data) {
        const duration = Date.now() - start;
        console.log(`[WhatsApp API] Response ${res.statusCode} - ${duration}ms`);
        
        // Log errors
        if (res.statusCode >= 400) {
            console.error('[WhatsApp API] Error:', data);
        }
        
        return originalJson.call(this, data);
    };
    
    next();
};

// Combined security middleware
const whatsappSecurity = {
    rateLimit: whatsappRateLimit,
    verifySignature: verifyWebhookSignature,
    sanitizePhone: sanitizePhoneNumber,
    validateMessage: validateMessageContent,
    ipWhitelist,
    logRequests: logWhatsAppRequests,
    
    // Apply all security measures
    full: (options = {}) => {
        const middlewares = [
            logWhatsAppRequests,
            whatsappRateLimit,
            sanitizePhoneNumber,
            validateMessageContent,
        ];
        
        if (options.webhookSecret) {
            middlewares.push(verifyWebhookSignature(options.webhookSecret));
        }
        
        if (options.ipWhitelist && options.ipWhitelist.length > 0) {
            middlewares.push(ipWhitelist(options.ipWhitelist));
        }
        
        return middlewares;
    },
};

module.exports = whatsappSecurity;
