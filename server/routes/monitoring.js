const express = require('express');
const router = express.Router();
const prisma = require('../utils/database');
// WhatsApp Integration (New Modular Structure)
const WhatsApp = require('../whatsapp');

// Initialize monitor
let monitor = null;

const getMonitor = () => {
    if (!monitor) {
        const client = WhatsApp.getWhatsAppClient();
        // Create a simple monitor object with basic functionality
        monitor = {
            getMetrics: () => ({
                messages: { sent: 0, failed: 0, queued: 0 },
                connections: 0,
                disconnects: 0,
                errors: 0,
                startTime: Date.now()
            }),
            getHealthStatus: () => {
                const client = WhatsApp.getWhatsAppClient();
                const status = client && client.isConnected ? 'healthy' : 'unhealthy';
                return {
                    status,
                    connected: client ? client.isConnected : false,
                    timestamp: new Date().toISOString()
                };
            },
            renderDashboard: async () => {
                return `
                <html>
                <head><title>WhatsApp Monitoring Dashboard</title></head>
                <body>
                    <h1>WhatsApp Bot Status</h1>
                    <p>Status: ${client && client.isConnected ? 'Connected' : 'Disconnected'}</p>
                    <p>Last Updated: ${new Date().toISOString()}</p>
                </body>
                </html>
                `;
            },
            metrics: {
                messages: { sent: 0, failed: 0, queued: 0 },
                connections: 0,
                disconnects: 0,
                errors: 0,
                startTime: Date.now()
            }
        };
    }
    return monitor;
};

/**
 * GET /api/monitoring/whatsapp/dashboard
 * Render monitoring dashboard
 */
router.get('/whatsapp/dashboard', async (req, res) => {
    try {
        const monitor = getMonitor();
        const html = await monitor.renderDashboard();
        res.set('Content-Type', 'text/html');
        res.send(html);
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Failed to render dashboard' });
    }
});

/**
 * GET /api/monitoring/whatsapp/metrics
 * Get current metrics
 */
router.get('/whatsapp/metrics', async (req, res) => {
    try {
        const monitor = getMonitor();
        const metrics = monitor.getMetrics();
        res.json(metrics);
    } catch (error) {
        console.error('Metrics error:', error);
        res.status(500).json({ error: 'Failed to get metrics' });
    }
});

/**
 * GET /api/monitoring/whatsapp/health
 * Health check endpoint
 */
router.get('/whatsapp/health', async (req, res) => {
    try {
        const monitor = getMonitor();
        const health = monitor.getHealthStatus();
        
        const status = health.status === 'healthy' ? 200 : 
                       health.status === 'degraded' ? 503 : 500;
        
        res.status(status).json(health);
    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({ 
            status: 'error',
            message: error.message 
        });
    }
});

/**
 * GET /api/monitoring/whatsapp/alerts
 * Get active alerts
 */
router.get('/whatsapp/alerts', async (req, res) => {
    try {
        const { level, resolved } = req.query;
        
        const where = {};
        if (level) where.level = level;
        if (resolved !== undefined) where.resolved = resolved === 'true';
        
        const alerts = await prisma.whatsAppAlert.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 100
        });
        
        res.json(alerts);
    } catch (error) {
        console.error('Alerts error:', error);
        res.status(500).json({ error: 'Failed to get alerts' });
    }
});

/**
 * POST /api/monitoring/whatsapp/alerts/:id/resolve
 * Resolve an alert
 */
router.post('/whatsapp/alerts/:id/resolve', async (req, res) => {
    try {
        const { id } = req.params;
        
        const alert = await prisma.whatsAppAlert.update({
            where: { id },
            data: {
                resolved: true,
                resolvedAt: new Date()
            }
        });
        
        res.json(alert);
    } catch (error) {
        console.error('Resolve alert error:', error);
        res.status(500).json({ error: 'Failed to resolve alert' });
    }
});

/**
 * GET /api/monitoring/whatsapp/messages
 * Get message logs with pagination
 */
router.get('/whatsapp/messages', async (req, res) => {
    try {
        const { 
            status, 
            from, 
            to, 
            page = 1, 
            limit = 50,
            startDate,
            endDate 
        } = req.query;
        
        const where = {};
        if (status) where.status = status;
        if (from) where.from = { contains: from };
        if (to) where.to = { contains: to };
        
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const [messages, total] = await Promise.all([
            prisma.whatsAppMessage.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit)
            }),
            prisma.whatsAppMessage.count({ where })
        ]);
        
        res.json({
            messages,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Messages error:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

/**
 * GET /api/monitoring/whatsapp/metrics/history
 * Get historical metrics
 */
router.get('/whatsapp/metrics/history', async (req, res) => {
    try {
        const { hours = 24 } = req.query;
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);
        
        const metrics = await prisma.whatsAppMetrics.findMany({
            where: {
                timestamp: { gte: since }
            },
            orderBy: { timestamp: 'asc' }
        });
        
        // Aggregate by hour
        const hourly = {};
        metrics.forEach(m => {
            const hour = new Date(m.timestamp).toISOString().slice(0, 13);
            if (!hourly[hour]) {
                hourly[hour] = {
                    timestamp: hour,
                    messagesSent: 0,
                    messagesFailed: 0,
                    messagesQueued: 0,
                    connections: 0,
                    disconnects: 0,
                    errors: 0,
                    count: 0
                };
            }
            
            hourly[hour].messagesSent += m.messagesSent;
            hourly[hour].messagesFailed += m.messagesFailed;
            hourly[hour].messagesQueued += m.messagesQueued;
            hourly[hour].connections += m.connections;
            hourly[hour].disconnects += m.disconnects;
            hourly[hour].errors += m.errors;
            hourly[hour].count++;
        });
        
        // Calculate averages
        const result = Object.values(hourly).map(h => ({
            ...h,
            messagesSent: Math.round(h.messagesSent / h.count),
            messagesFailed: Math.round(h.messagesFailed / h.count),
            messagesQueued: Math.round(h.messagesQueued / h.count)
        }));
        
        res.json(result);
    } catch (error) {
        console.error('Metrics history error:', error);
        res.status(500).json({ error: 'Failed to get metrics history' });
    }
});

/**
 * GET /api/monitoring/whatsapp/stats
 * Get overall statistics
 */
router.get('/whatsapp/stats', async (req, res) => {
    try {
        const [
            totalMessages,
            successMessages,
            failedMessages,
            pendingMessages,
            totalAlerts,
            unresolvedAlerts
        ] = await Promise.all([
            prisma.whatsAppMessage.count(),
            prisma.whatsAppMessage.count({ where: { status: 'delivered' } }),
            prisma.whatsAppMessage.count({ where: { status: 'failed' } }),
            prisma.whatsAppMessage.count({ where: { status: 'pending' } }),
            prisma.whatsAppAlert.count(),
            prisma.whatsAppAlert.count({ where: { resolved: false } })
        ]);
        
        const successRate = totalMessages > 0 
            ? ((successMessages / totalMessages) * 100).toFixed(2)
            : 0;
            
        res.json({
            messages: {
                total: totalMessages,
                success: successMessages,
                failed: failedMessages,
                pending: pendingMessages,
                successRate: `${successRate}%`
            },
            alerts: {
                total: totalAlerts,
                unresolved: unresolvedAlerts
            },
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

/**
 * POST /api/monitoring/whatsapp/test
 * Send test message
 */
router.post('/whatsapp/test', async (req, res) => {
    try {
        const { phone, message = 'Test message from monitoring dashboard' } = req.body;
        
        if (!phone) {
            return res.status(400).json({ error: 'Phone number required' });
        }
        
        // Check if WhatsApp bot is connected by reading status file
        const fs = require('fs');
        const path = require('path');
        const statusFilePath = path.join(process.cwd(), '..', 'scripts', 'whatsapp-status.json');
        
        console.log('Debug - process.cwd():', process.cwd());
        console.log('Debug - statusFilePath:', statusFilePath);
        console.log('Debug - file exists:', fs.existsSync(statusFilePath));
        
        let isConnected = false;
        if (fs.existsSync(statusFilePath)) {
            try {
                const statusData = JSON.parse(fs.readFileSync(statusFilePath, 'utf8'));
                console.log('Debug - statusData:', statusData);
                isConnected = statusData.connected || false;
                console.log('Debug - isConnected:', isConnected);
            } catch (error) {
                console.warn('Failed to parse status file:', error.message);
            }
        } else {
            console.warn('Status file does not exist at:', statusFilePath);
        }
        
        if (!isConnected) {
            return res.status(503).json({ 
                success: false,
                error: 'WhatsApp bot not connected' 
            });
        }
        
        // Write test message to file for bot to process
        const testMessagePath = path.join(process.cwd(), '..', 'scripts', 'test-message.json');
        const messageData = {
            phone: phone,
            message: message,
            timestamp: Date.now(),
            type: 'test'
        };
        
        fs.writeFileSync(testMessagePath, JSON.stringify(messageData, null, 2));
        
        res.json({
            success: true,
            message: 'Test message queued for delivery',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Test message error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

/**
 * DELETE /api/monitoring/whatsapp/cache
 * Clear cache and reset metrics
 */
router.delete('/whatsapp/cache', async (req, res) => {
    try {
        const monitor = getMonitor();
        
        // Reset in-memory metrics
        monitor.metrics = {
            messages: { sent: 0, failed: 0, queued: 0 },
            connections: 0,
            disconnects: 0,
            errors: 0,
            startTime: Date.now()
        };
        
        res.json({ 
            success: true,
            message: 'Cache cleared and metrics reset' 
        });
    } catch (error) {
        console.error('Clear cache error:', error);
        res.status(500).json({ error: 'Failed to clear cache' });
    }
});

module.exports = router;
