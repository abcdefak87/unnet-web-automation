/**
 * WhatsApp Routes - Integrated Version
 * Direct integration with WhatsApp Bot process
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../../middleware/auth');
const logger = require('../../utils/logger');

// Debug endpoint
router.get('/debug', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const statusFilePath = path.join(process.cwd(), '..', 'scripts', 'whatsapp-status.json');
  
  const debug = {
    cwd: process.cwd(),
    __dirname: __dirname,
    statusFilePath: statusFilePath,
    fileExists: fs.existsSync(statusFilePath),
    fileContent: null
  };
  
  if (fs.existsSync(statusFilePath)) {
    try {
      debug.fileContent = JSON.parse(fs.readFileSync(statusFilePath, 'utf8'));
    } catch (error) {
      debug.fileError = error.message;
    }
  }
  
  res.json(debug);
});

// Simple test endpoint (no auth required) - renamed to avoid conflict
router.get('/test-simple', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const statusFilePath = path.join(process.cwd(), '..', 'scripts', 'whatsapp-status.json');
  
  if (fs.existsSync(statusFilePath)) {
    const data = JSON.parse(fs.readFileSync(statusFilePath, 'utf8'));
    res.json({
      success: true,
      connected: data.connected,
      status: data.status,
      message: 'File read successfully'
    });
  } else {
    res.json({
      success: false,
      message: 'File not found',
      path: statusFilePath
    });
  }
});

// Public status endpoint (no auth required)
router.get('/public-status', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const statusFilePath = path.join(process.cwd(), '..', 'scripts', 'whatsapp-status.json');
  
  let status = {
    connected: false,
    user: null,
    status: 'disconnected',
    lastUpdate: null,
    uptime: 0,
    commandCount: 0
  };
  
  if (fs.existsSync(statusFilePath)) {
    try {
      const statusData = JSON.parse(fs.readFileSync(statusFilePath, 'utf8'));
      status = {
        ...status,
        ...statusData,
        status: statusData.connected ? 'active' : 'offline'
      };
    } catch (error) {
      console.error('Failed to parse status file:', error);
    }
  }
  
  res.json(status);
});

// Get WhatsApp connection status (no auth required)
router.get('/status', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const statusFilePath = path.join(process.cwd(), '..', 'scripts', 'whatsapp-status.json');
    
    let status = {
      connected: false,
      user: null,
      status: 'disconnected',
      lastUpdate: null,
      uptime: 0,
      commandCount: 0
    };
    
    // Try to read status from file (written by bot process)
    if (fs.existsSync(statusFilePath)) {
      try {
        const statusData = JSON.parse(fs.readFileSync(statusFilePath, 'utf8'));
        status = {
          ...status,
          ...statusData,
          status: statusData.connected ? 'active' : 'offline'
        };
      } catch (error) {
        console.error('Failed to parse status file:', error);
        logger.warn('Failed to parse status file, using default status');
      }
    }
    
    // Fallback to global socket if available (for backward compatibility)
    if (!status.connected && global.whatsappSocket && global.whatsappSocket.user) {
      status = {
        connected: true,
        user: global.whatsappSocket.user,
        status: 'active',
        lastUpdate: new Date().toISOString()
      };
    }
    
    res.json(status);
  } catch (error) {
    logger.error('Failed to get WhatsApp status:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// Get WhatsApp statistics
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
    
    // Initialize stats object
    const stats = {
      connection: {
        status: isConnected ? 'connected' : 'disconnected',
        uptime: 0,
        lastConnected: null,
        user: null
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
        averageResponseTime: 0,
        successRate: 0,
        lastHourMessages: 0
      }
    };
    
    // Update connection info if connected
    if (isConnected && global.whatsappSocket && global.whatsappSocket.user) {
      const user = global.whatsappSocket.user;
      // Add comprehensive null check for user.id to prevent undefined error
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
      
      stats.performance.lastHourMessages = global.whatsappStats.lastHourMessages || 0;
      stats.performance.averageResponseTime = global.whatsappStats.avgResponseTime || 0;
    }
    
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get WhatsApp stats:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// Send message
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const { number, message } = req.body;
    
    if (!number || !message) {
      return res.status(400).json({ error: 'Number and message are required' });
    }
    
    // Check if WhatsApp is connected
    if (!global.whatsappSocket || !global.whatsappSocket.user) {
      return res.status(503).json({ error: 'WhatsApp not connected' });
    }
    
    // Format number
    let targetNumber = number.toString().replace(/[^0-9]/g, '');
    if (targetNumber.startsWith('0')) {
      targetNumber = '62' + targetNumber.substring(1);
    }
    if (!targetNumber.startsWith('62')) {
      targetNumber = '62' + targetNumber;
    }
    
    const jid = targetNumber.includes('@') ? targetNumber : targetNumber + '@s.whatsapp.net';
    
    // Send message
    await global.whatsappSocket.sendMessage(jid, { text: message });
    
    logger.info(`Message sent to ${targetNumber}`);
    res.json({ 
      success: true, 
      message: 'Message sent successfully',
      to: targetNumber 
    });
  } catch (error) {
    logger.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Broadcast message
router.post('/broadcast', authenticateToken, requireRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const { numbers, message } = req.body;
    
    if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({ 
        error: 'Numbers array and message are required' 
      });
    }
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Check if WhatsApp is connected
    if (!global.whatsappSocket || !global.whatsappSocket.user) {
      return res.status(503).json({ error: 'WhatsApp not connected' });
    }
    
    const results = [];
    const errors = [];
    
    for (const number of numbers) {
      try {
        // Format number
        let targetNumber = number.toString().replace(/[^0-9]/g, '');
        if (targetNumber.startsWith('0')) {
          targetNumber = '62' + targetNumber.substring(1);
        }
        if (!targetNumber.startsWith('62')) {
          targetNumber = '62' + targetNumber;
        }
        
        const jid = targetNumber + '@s.whatsapp.net';
        
        // Send message with delay to avoid spam
        await global.whatsappSocket.sendMessage(jid, { text: message });
        results.push({ number: targetNumber, status: 'sent' });
        
        // Small delay between messages
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        errors.push({ number, error: error.message });
      }
    }
    
    res.json({
      success: results.length > 0,
      sent: results.length,
      failed: errors.length,
      results,
      errors
    });
  } catch (error) {
    logger.error('Broadcast error:', error);
    res.status(500).json({ error: 'Failed to broadcast message' });
  }
});

// Get message history (stub for now)
router.get('/messages', authenticateToken, async (req, res) => {
  try {
    res.json({
      messages: [],
      note: 'Message history not implemented yet'
    });
  } catch (error) {
    logger.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Test connection - support both GET and POST
const testHandler = async (req, res) => {
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
        message: 'WhatsApp not connected'
      });
    }
    
    const phoneNumber = user.phone || user.id?.split(':')[0] || user.id?.split('@')[0];
    
    res.json({
      success: true,
      message: 'WhatsApp connected successfully',
      details: {
        number: phoneNumber,
        name: user.name || 'Not set',
        platform: 'WhatsApp Web'
      }
    });
  } catch (error) {
    logger.error('Test connection error:', error);
    res.status(500).json({ error: 'Failed to test connection' });
  }
};

router.get('/test', authenticateToken, testHandler);
router.post('/test', authenticateToken, testHandler);

module.exports = router;
