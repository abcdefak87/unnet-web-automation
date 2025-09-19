const EventEmitter = require('events');

class MessageQueue extends EventEmitter {
    constructor(options = {}) {
        super();
        this.queue = [];
        this.processing = false;
        this.config = {
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 2000,
            messageDelay: options.messageDelay || 1000,
            maxQueueSize: options.maxQueueSize || 1000,
            ttl: options.ttl || 300000, // 5 minutes
            batchSize: options.batchSize || 10,
        };
        
        // Priority levels
        this.PRIORITY = {
            HIGH: 3,
            NORMAL: 2,
            LOW: 1,
        };
        
        // Statistics
        this.stats = {
            sent: 0,
            failed: 0,
            expired: 0,
            retried: 0,
        };
        
        // Start cleanup interval
        this.startCleanup();
    }
    
    startCleanup() {
        setInterval(() => {
            const now = Date.now();
            const expired = [];
            
            // Remove expired messages
            this.queue = this.queue.filter(item => {
                if (now - item.timestamp > this.config.ttl) {
                    expired.push(item);
                    return false;
                }
                return true;
            });
            
            // Handle expired messages
            expired.forEach(item => {
                this.stats.expired++;
                item.reject(new Error('Message expired'));
                this.emit('expired', item);
            });
        }, 60000); // Every minute
    }
    
    add(message, options = {}) {
        return new Promise((resolve, reject) => {
            // Check queue size
            if (this.queue.length >= this.config.maxQueueSize) {
                reject(new Error('Queue is full'));
                return;
            }
            
            const item = {
                id: this.generateId(),
                message,
                options,
                priority: options.priority || this.PRIORITY.NORMAL,
                timestamp: Date.now(),
                retries: 0,
                resolve,
                reject,
            };
            
            // Add to queue based on priority
            if (item.priority === this.PRIORITY.HIGH) {
                // Add to front of queue
                const normalIndex = this.queue.findIndex(i => i.priority < this.PRIORITY.HIGH);
                if (normalIndex === -1) {
                    this.queue.push(item);
                } else {
                    this.queue.splice(normalIndex, 0, item);
                }
            } else {
                this.queue.push(item);
            }
            
            this.emit('added', item);
            
            // Start processing if not already
            if (!this.processing) {
                this.process();
            }
        });
    }
    
    async process() {
        if (this.processing || this.queue.length === 0) {
            return;
        }
        
        this.processing = true;
        
        while (this.queue.length > 0) {
            const batch = this.queue.splice(0, this.config.batchSize);
            
            for (const item of batch) {
                try {
                    // Check if expired
                    if (Date.now() - item.timestamp > this.config.ttl) {
                        this.stats.expired++;
                        item.reject(new Error('Message expired'));
                        this.emit('expired', item);
                        continue;
                    }
                    
                    // Process message
                    const result = await this.processMessage(item);
                    this.stats.sent++;
                    item.resolve(result);
                    this.emit('sent', item);
                    
                    // Delay between messages
                    if (this.queue.length > 0) {
                        await this.delay(this.config.messageDelay);
                    }
                    
                } catch (error) {
                    // Handle retry
                    if (item.retries < this.config.maxRetries) {
                        item.retries++;
                        this.stats.retried++;
                        
                        // Calculate backoff delay
                        const delay = this.config.retryDelay * Math.pow(2, item.retries - 1);
                        
                        // Re-add to queue for retry
                        setTimeout(() => {
                            this.queue.unshift(item); // Add to front for retry
                            if (!this.processing) {
                                this.process().catch(err => {
                                    console.error('Error in retry process:', err);
                                    this.emit('error', err);
                                });
                            }
                        }, delay);
                        
                        this.emit('retry', item);
                    } else {
                        // Max retries reached
                        this.stats.failed++;
                        item.reject(error);
                        this.emit('failed', item, error);
                    }
                }
            }
        }
        
        this.processing = false;
    }
    
    async processMessage(item) {
        // This should be overridden by implementation
        throw new Error('processMessage must be implemented');
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    clear() {
        const items = [...this.queue];
        this.queue = [];
        
        items.forEach(item => {
            item.reject(new Error('Queue cleared'));
        });
        
        return items.length;
    }
    
    getStats() {
        return {
            ...this.stats,
            queueLength: this.queue.length,
            processing: this.processing,
        };
    }
    
    getQueue() {
        return this.queue.map(item => ({
            id: item.id,
            priority: item.priority,
            timestamp: item.timestamp,
            retries: item.retries,
        }));
    }
}

// WhatsApp specific implementation
class WhatsAppMessageQueue extends MessageQueue {
    constructor(whatsappBot, options = {}) {
        super(options);
        this.bot = whatsappBot;
        
        // Rate limiting per number
        this.rateLimits = new Map();
        this.rateLimitConfig = {
            perMinute: options.rateLimitPerMinute || 30,
            perHour: options.rateLimitPerHour || 500,
        };
    }
    
    async processMessage(item) {
        const { jid, message, options } = item.message;
        
        // Check rate limit
        if (!this.checkRateLimit(jid)) {
            throw new Error('Rate limit exceeded');
        }
        
        // Send via bot
        return await this.bot.sendMessageDirect(jid, message, options);
    }
    
    checkRateLimit(jid) {
        const number = jid.split('@')[0];
        const now = Date.now();
        
        if (!this.rateLimits.has(number)) {
            this.rateLimits.set(number, {
                minute: { count: 0, resetTime: now + 60000 },
                hour: { count: 0, resetTime: now + 3600000 },
            });
        }
        
        const limits = this.rateLimits.get(number);
        
        // Reset counters if needed
        if (now > limits.minute.resetTime) {
            limits.minute.count = 0;
            limits.minute.resetTime = now + 60000;
        }
        
        if (now > limits.hour.resetTime) {
            limits.hour.count = 0;
            limits.hour.resetTime = now + 3600000;
        }
        
        // Check limits
        if (limits.minute.count >= this.rateLimitConfig.perMinute) {
            return false;
        }
        
        if (limits.hour.count >= this.rateLimitConfig.perHour) {
            return false;
        }
        
        // Increment counters
        limits.minute.count++;
        limits.hour.count++;
        
        return true;
    }
    
    // Add broadcast functionality
    async broadcast(numbers, message, options = {}) {
        const results = {
            success: [],
            failed: [],
        };
        
        for (const number of numbers) {
            try {
                const jid = this.bot.formatJid(number);
                await this.add(
                    { jid, message, options },
                    { priority: options.priority || this.PRIORITY.NORMAL }
                );
                results.success.push(number);
            } catch (error) {
                results.failed.push({ number, error: error.message });
            }
        }
        
        return results;
    }
}

module.exports = {
    MessageQueue,
    WhatsAppMessageQueue,
};
