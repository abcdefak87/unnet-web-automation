const EventEmitter = require('events');

class WhatsAppMonitor extends EventEmitter {
    constructor(bot) {
        super();
        this.bot = bot;
        this.metrics = {
            messages: {
                sent: 0,
                received: 0,
                failed: 0,
                queued: 0,
            },
            connections: {
                connects: 0,
                disconnects: 0,
                qrScans: 0,
                errors: 0,
            },
            performance: {
                avgResponseTime: 0,
                responseTimes: [],
                maxResponseTime: 0,
                minResponseTime: Infinity,
            },
            health: {
                status: 'initializing',
                lastCheck: null,
                uptime: 0,
                memory: {},
            },
        };
        
        this.alerts = [];
        this.maxAlerts = 100;
        
        // Start monitoring
        this.startMonitoring();
    }
    
    startMonitoring() {
        // Monitor bot events
        if (this.bot) {
            this.bot.on('connected', () => this.onConnected());
            this.bot.on('disconnected', (reason) => this.onDisconnected(reason));
            this.bot.on('qr', () => this.onQRCode());
            this.bot.on('error', (error) => this.onError(error));
            
            // Monitor message queue if available
            if (this.bot.messageQueue) {
                this.bot.on('message-sent', () => this.onMessageSent());
                this.bot.on('message-failed', () => this.onMessageFailed());
                this.bot.on('message-queued', () => this.onMessageQueued());
            }
        }
        
        // Health check interval
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, 30000); // Every 30 seconds
        
        // Metrics cleanup interval
        this.metricsInterval = setInterval(() => {
            this.cleanupMetrics();
        }, 300000); // Every 5 minutes
    }
    
    onConnected() {
        this.metrics.connections.connects++;
        this.metrics.health.status = 'connected';
        this.addAlert('info', 'WhatsApp connected');
    }
    
    onDisconnected(reason) {
        this.metrics.connections.disconnects++;
        this.metrics.health.status = 'disconnected';
        this.addAlert('warning', `WhatsApp disconnected: ${reason}`);
        
        // Check for critical disconnection patterns
        if (this.metrics.connections.disconnects > 5 && 
            this.metrics.connections.disconnects > this.metrics.connections.connects * 2) {
            this.addAlert('critical', 'High disconnection rate detected');
        }
    }
    
    onQRCode() {
        this.metrics.connections.qrScans++;
        this.addAlert('info', 'QR code generated');
    }
    
    onError(error) {
        this.metrics.connections.errors++;
        this.addAlert('error', `Error: ${error.message}`);
    }
    
    onMessageSent() {
        this.metrics.messages.sent++;
    }
    
    onMessageFailed() {
        this.metrics.messages.failed++;
        
        // Alert on high failure rate
        const failureRate = this.metrics.messages.failed / 
            (this.metrics.messages.sent + this.metrics.messages.failed);
        
        if (failureRate > 0.1 && this.metrics.messages.sent > 10) {
            this.addAlert('warning', `High message failure rate: ${(failureRate * 100).toFixed(2)}%`);
        }
    }
    
    onMessageQueued() {
        this.metrics.messages.queued++;
    }
    
    recordResponseTime(duration) {
        this.metrics.performance.responseTimes.push(duration);
        
        // Keep only last 100 response times
        if (this.metrics.performance.responseTimes.length > 100) {
            this.metrics.performance.responseTimes.shift();
        }
        
        // Update statistics
        this.metrics.performance.maxResponseTime = Math.max(
            this.metrics.performance.maxResponseTime,
            duration
        );
        
        this.metrics.performance.minResponseTime = Math.min(
            this.metrics.performance.minResponseTime,
            duration
        );
        
        // Calculate average
        const sum = this.metrics.performance.responseTimes.reduce((a, b) => a + b, 0);
        this.metrics.performance.avgResponseTime = 
            sum / this.metrics.performance.responseTimes.length;
    }
    
    performHealthCheck() {
        const health = {
            timestamp: Date.now(),
            status: 'unknown',
            checks: {},
        };
        
        // Check bot connection
        if (this.bot) {
            health.checks.connected = this.bot.isConnected;
            health.checks.queueLength = this.bot.messageQueue?.length || 0;
            health.checks.sessions = this.bot.sessions?.size || 0;
        }
        
        // Check memory usage
        const memUsage = process.memoryUsage();
        health.checks.memory = {
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
            external: Math.round(memUsage.external / 1024 / 1024), // MB
        };
        
        // Check CPU usage
        const cpuUsage = process.cpuUsage();
        health.checks.cpu = {
            user: Math.round(cpuUsage.user / 1000), // ms
            system: Math.round(cpuUsage.system / 1000), // ms
        };
        
        // Check uptime
        health.checks.uptime = Math.round(process.uptime());
        
        // Determine overall health status
        if (health.checks.connected) {
            health.status = 'healthy';
        } else if (this.bot?.isInitializing) {
            health.status = 'initializing';
        } else {
            health.status = 'unhealthy';
        }
        
        // Check for warning conditions
        if (health.checks.memory.heapUsed > 500) {
            this.addAlert('warning', `High memory usage: ${health.checks.memory.heapUsed}MB`);
        }
        
        if (health.checks.queueLength > 100) {
            this.addAlert('warning', `Large message queue: ${health.checks.queueLength} messages`);
        }
        
        this.metrics.health = health;
        this.emit('health-check', health);
        
        return health;
    }
    
    cleanupMetrics() {
        // Reset some metrics periodically
        this.metrics.performance.responseTimes = 
            this.metrics.performance.responseTimes.slice(-50); // Keep last 50
        
        // Cleanup old alerts
        if (this.alerts.length > this.maxAlerts) {
            this.alerts = this.alerts.slice(-this.maxAlerts);
        }
    }
    
    addAlert(level, message) {
        const alert = {
            timestamp: Date.now(),
            level,
            message,
        };
        
        this.alerts.push(alert);
        this.emit('alert', alert);
        
        // Log based on level
        switch (level) {
            case 'critical':
            case 'error':
                console.error(`[WhatsApp Monitor] ${level.toUpperCase()}: ${message}`);
                break;
            case 'warning':
                console.warn(`[WhatsApp Monitor] WARNING: ${message}`);
                break;
            case 'info':
                console.log(`[WhatsApp Monitor] INFO: ${message}`);
                break;
        }
    }
    
    getMetrics() {
        return {
            ...this.metrics,
            alertCount: this.alerts.length,
            recentAlerts: this.alerts.slice(-10),
        };
    }
    
    getHealthStatus() {
        return this.metrics.health;
    }
    
    getAlerts(level = null, limit = 10) {
        let alerts = this.alerts;
        
        if (level) {
            alerts = alerts.filter(a => a.level === level);
        }
        
        return alerts.slice(-limit);
    }
    
    reset() {
        // Reset all metrics
        this.metrics = {
            messages: {
                sent: 0,
                received: 0,
                failed: 0,
                queued: 0,
            },
            connections: {
                connects: 0,
                disconnects: 0,
                qrScans: 0,
                errors: 0,
            },
            performance: {
                avgResponseTime: 0,
                responseTimes: [],
                maxResponseTime: 0,
                minResponseTime: Infinity,
            },
            health: {
                status: 'initializing',
                lastCheck: null,
                uptime: 0,
                memory: {},
            },
        };
        
        this.alerts = [];
    }
    
    stop() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }
        
        this.removeAllListeners();
    }
}

// Dashboard data generator
class WhatsAppDashboard {
    constructor(monitor) {
        this.monitor = monitor;
    }
    
    getDashboardData() {
        const metrics = this.monitor.getMetrics();
        const health = this.monitor.getHealthStatus();
        
        return {
            overview: {
                status: health.status || 'unknown',
                uptime: this.formatUptime(health.checks?.uptime || 0),
                connected: health.checks?.connected || false,
                queueLength: health.checks?.queueLength || 0,
            },
            messages: {
                total: metrics.messages.sent + metrics.messages.received,
                sent: metrics.messages.sent,
                received: metrics.messages.received,
                failed: metrics.messages.failed,
                queued: metrics.messages.queued,
                successRate: this.calculateSuccessRate(metrics.messages),
            },
            connections: {
                total: metrics.connections.connects,
                disconnects: metrics.connections.disconnects,
                errors: metrics.connections.errors,
                stability: this.calculateStability(metrics.connections),
            },
            performance: {
                avgResponseTime: `${metrics.performance.avgResponseTime.toFixed(2)}ms`,
                maxResponseTime: `${metrics.performance.maxResponseTime}ms`,
                minResponseTime: metrics.performance.minResponseTime === Infinity ? 
                    '0ms' : `${metrics.performance.minResponseTime}ms`,
            },
            resources: {
                memory: health.checks?.memory || {},
                cpu: health.checks?.cpu || {},
            },
            alerts: {
                total: metrics.alertCount,
                recent: metrics.recentAlerts,
                critical: this.monitor.getAlerts('critical', 5),
                warnings: this.monitor.getAlerts('warning', 5),
            },
        };
    }
    
    calculateSuccessRate(messages) {
        const total = messages.sent + messages.failed;
        if (total === 0) return '100%';
        
        const rate = (messages.sent / total) * 100;
        return `${rate.toFixed(2)}%`;
    }
    
    calculateStability(connections) {
        if (connections.connects === 0) return 'N/A';
        
        const stability = 100 - ((connections.disconnects / connections.connects) * 100);
        return `${Math.max(0, stability).toFixed(2)}%`;
    }
    
    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        
        return parts.join(' ') || '0m';
    }
    
    getHTMLReport() {
        const data = this.getDashboardData();
        
        return `
<!DOCTYPE html>
<html>
<head>
    <title>WhatsApp Bot Monitoring</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .card { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .status { display: inline-block; padding: 5px 10px; border-radius: 4px; color: white; font-weight: bold; }
        .status.connected { background: #4caf50; }
        .status.disconnected { background: #f44336; }
        .status.initializing { background: #ff9800; }
        .metric { display: inline-block; margin-right: 30px; }
        .metric-label { color: #666; font-size: 14px; }
        .metric-value { font-size: 24px; font-weight: bold; color: #333; }
        .alert { padding: 10px; margin: 5px 0; border-radius: 4px; }
        .alert.critical { background: #ffebee; border-left: 4px solid #f44336; }
        .alert.warning { background: #fff3e0; border-left: 4px solid #ff9800; }
        .alert.info { background: #e3f2fd; border-left: 4px solid #2196f3; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f5f5f5; }
    </style>
</head>
<body>
    <div class="container">
        <h1>WhatsApp Bot Monitoring Dashboard</h1>
        
        <div class="card">
            <h2>System Status</h2>
            <span class="status ${data.overview.status}">${data.overview.status.toUpperCase()}</span>
            <div style="margin-top: 15px;">
                <div class="metric">
                    <div class="metric-label">Uptime</div>
                    <div class="metric-value">${data.overview.uptime}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Queue Length</div>
                    <div class="metric-value">${data.overview.queueLength}</div>
                </div>
            </div>
        </div>
        
        <div class="card">
            <h2>Message Statistics</h2>
            <table>
                <tr>
                    <th>Metric</th>
                    <th>Value</th>
                </tr>
                <tr>
                    <td>Total Messages</td>
                    <td>${data.messages.total}</td>
                </tr>
                <tr>
                    <td>Sent</td>
                    <td>${data.messages.sent}</td>
                </tr>
                <tr>
                    <td>Failed</td>
                    <td>${data.messages.failed}</td>
                </tr>
                <tr>
                    <td>Success Rate</td>
                    <td>${data.messages.successRate}</td>
                </tr>
            </table>
        </div>
        
        <div class="card">
            <h2>Recent Alerts</h2>
            ${data.alerts.recent.map(alert => `
                <div class="alert ${alert.level}">
                    <strong>${alert.level.toUpperCase()}:</strong> ${alert.message}
                    <span style="float: right; color: #999;">${new Date(alert.timestamp).toLocaleString()}</span>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
    }
}

module.exports = {
    WhatsAppMonitor,
    WhatsAppDashboard,
};
