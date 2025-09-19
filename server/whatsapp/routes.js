const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// WhatsApp routes - redirect to consolidated routes
// This file exists to prevent "testConnection is not a function" errors
// from old code that might still reference this file

// Test connection endpoint - fixed version
router.get('/test', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const statusFilePath = path.join(process.cwd(), '..', 'scripts', 'whatsapp-status.json');
    
    let isConnected = false;
    let user = null;
    
    // Try to read status from file
    if (fs.existsSync(statusFilePath)) {
      try {
        const statusData = JSON.parse(fs.readFileSync(statusFilePath, 'utf8'));
        isConnected = statusData.connected || false;
        user = statusData.user || null;
      } catch (error) {
        logger.warn('Failed to parse status file for test');
      }
    }
    
    // Fallback to global socket
    if (!isConnected && global.whatsappSocket && global.whatsappSocket.user) {
      isConnected = true;
      user = global.whatsappSocket.user;
    }
    
    if (!isConnected || !user) {
      return res.json({
        success: false,
        message: 'WhatsApp tidak terhubung'
      });
    }
    
    const phoneNumber = user.phone || user.id?.split(':')[0] || user.id?.split('@')[0];
    
    res.json({
      success: true,
      message: 'WhatsApp berhasil terhubung',
      details: {
        number: phoneNumber,
        name: user.name || 'Tidak diatur',
        platform: 'WhatsApp Web'
      }
    });
  } catch (error) {
    logger.error('Test connection error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Gagal menguji koneksi' 
    });
  }
});

// Stats endpoint - fixed version
router.get('/stats', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const statusFilePath = path.join(process.cwd(), '..', 'scripts', 'whatsapp-status.json');
    
    let isConnected = false;
    let user = null;
    
    // Try to read status from file
    if (fs.existsSync(statusFilePath)) {
      try {
        const statusData = JSON.parse(fs.readFileSync(statusFilePath, 'utf8'));
        isConnected = statusData.connected || false;
        user = statusData.user || null;
      } catch (error) {
        logger.warn('Failed to parse status file for stats');
      }
    }
    
    // Fallback to global socket
    if (!isConnected && global.whatsappSocket && global.whatsappSocket.user) {
      isConnected = true;
      user = global.whatsappSocket.user;
    }
    
    const stats = {
      connection: {
        connected: isConnected,
        status: isConnected ? 'active' : 'offline',
        user: null,
        uptime: 0,
        lastConnected: null
      },
      messages: {
        sent: 0,
        received: 0,
        failed: 0,
        pending: 0,
        total: 0
      },
      queue: {
        size: 0,
        processed: 0,
        failed: 0
      },
      performance: {
        successRate: 0,
        lastHourMessages: 0
      }
    };
    
    // Update connection info if connected
    if (isConnected && user) {
      let phoneNumber = 'Unknown';
      if (user && user.id) {
        try {
          phoneNumber = user.id.split(':')[0] || user.id.split('@')[0] || 'Unknown';
        } catch (error) {
          console.error('Error parsing user ID:', error);
          phoneNumber = 'Unknown';
        }
      }
      
      stats.connection.user = {
        number: phoneNumber,
        name: (user && user.name) || 'Not set',
        platform: 'WhatsApp Web'
      };
      
      // Calculate uptime if we have a connection start time
      if (global.whatsappConnectionTime) {
        stats.connection.uptime = Math.floor((Date.now() - global.whatsappConnectionTime) / 1000);
        stats.connection.lastConnected = new Date(global.whatsappConnectionTime).toISOString();
      }
    }
    
    // Get message stats from global counters if available
    if (global.whatsappStats) {
      stats.messages = {
        sent: global.whatsappStats.sent || 0,
        received: global.whatsappStats.received || 0,
        failed: global.whatsappStats.failed || 0,
        pending: global.whatsappStats.pending || 0,
        total: (global.whatsappStats.sent || 0) + (global.whatsappStats.received || 0)
      };
      
      stats.queue = {
        size: global.whatsappStats.queueSize || 0,
        processed: global.whatsappStats.queueProcessed || 0,
        failed: global.whatsappStats.queueFailed || 0
      };
      
      // Calculate performance metrics
      const totalAttempts = stats.messages.sent + stats.messages.failed;
      if (totalAttempts > 0) {
        stats.performance.successRate = Math.round((stats.messages.sent / totalAttempts) * 100);
      }
    }
    
    res.json(stats);
  } catch (error) {
    logger.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

module.exports = router;
