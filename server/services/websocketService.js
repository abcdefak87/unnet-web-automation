const { Server } = require('socket.io');
const logger = require('../utils/logger');
const prisma = require('../utils/database');
const jwt = require('jsonwebtoken');
let io = null;

// Connection tracking for rate limiting
const connectionAttempts = new Map();
const maxConnectionAttempts = 5;
const connectionWindow = 60000; // 1 minute

// Initialize WebSocket server
const initializeWebSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    },
    // Add connection stability options
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 10000,
    allowUpgrades: true,
    transports: ['websocket', 'polling']
  });

  io.on('connection', (socket) => {
    // Authenticate connection via JWT from query or headers
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token || (socket.handshake.headers?.authorization?.split(' ')[1]);
      if (!token) {
        socket.emit('error', { message: 'Authentication required' });
        return socket.disconnect(true);
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.userId = decoded.userId;
      socket.data.role = decoded.role;
    } catch (authError) {
      logger.warn('WebSocket auth failed', { error: authError.message, socketId: socket.id });
      socket.emit('error', { message: 'Invalid or expired token' });
      return socket.disconnect(true);
    }
    // Rate limiting check
    const clientIP = socket.handshake.address;
    const now = Date.now();
    
    if (connectionAttempts.has(clientIP)) {
      const attempts = connectionAttempts.get(clientIP);
      if (now - attempts.timestamp < connectionWindow && attempts.count >= maxConnectionAttempts) {
        logger.warn('Rate limit exceeded for WebSocket connection', { clientIP, socketId: socket.id });
        socket.emit('error', { message: 'Rate limit exceeded. Please wait before reconnecting.' });
        socket.disconnect(true);
        return;
      }
      
      // Update attempts
      if (now - attempts.timestamp < connectionWindow) {
        attempts.count++;
      } else {
        attempts.count = 1;
        attempts.timestamp = now;
      }
    } else {
      connectionAttempts.set(clientIP, { count: 1, timestamp: now });
    }

    logger.info('WebSocket client connected', { socketId: socket.id, clientIP });

    // Set connection timeout to prevent hanging connections
    let connectionTimeout = setTimeout(() => {
      if (socket.connected) {
        logger.warn('WebSocket connection timeout, disconnecting', { socketId: socket.id });
        socket.disconnect(true);
      }
    }, 30000); // 30 seconds timeout

    // Join user to their rooms based on verified identity
    socket.on('join-room', () => {
      const userId = socket.data.userId;
      const role = socket.data.role;
      if (userId) socket.join(`user-${userId}`);
      if (role) socket.join(`role-${role}`);
      logger.info('User joined WebSocket rooms', { userId, role, socketId: socket.id });
    });

    // Handle heartbeat to prevent timeout
    socket.on('heartbeat', (data) => {
      // Reset the connection timeout when heartbeat is received
      clearTimeout(connectionTimeout);
      
      // Set new timeout
      connectionTimeout = setTimeout(() => {
        if (socket.connected) {
          logger.warn('WebSocket connection timeout after heartbeat, disconnecting', { socketId: socket.id });
          socket.disconnect(true);
        }
      }, 30000); // 30 seconds timeout
      
      // Send heartbeat response
      socket.emit('heartbeat-ack', { timestamp: Date.now() });
      logger.debug('Heartbeat received and acknowledged', { socketId: socket.id });
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      clearTimeout(connectionTimeout);
      logger.info('WebSocket client disconnected', { socketId: socket.id, reason });
      
      // Clean up rate limiting data for this connection
      if (connectionAttempts.has(clientIP)) {
        const attempts = connectionAttempts.get(clientIP);
        if (attempts.count > 1) {
          attempts.count--;
        } else {
          connectionAttempts.delete(clientIP);
        }
      }
      
      // Clean up socket data to prevent memory leaks
      delete socket.data.userId;
      delete socket.data.role;
    });

    // Handle connection errors
    socket.on('error', (error) => {
      logger.error('WebSocket connection error', { socketId: socket.id, error: error.message });
      clearTimeout(connectionTimeout);
    });
  });

  // Clean up old rate limiting data periodically
  setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of connectionAttempts.entries()) {
      if (now - data.timestamp > connectionWindow) {
        connectionAttempts.delete(ip);
      }
    }
  }, connectionWindow);

  return io;
};

// Broadcast job updates to all connected clients
const broadcastJobUpdate = (job, action) => {
  if (!io) return;

  const payload = {
    type: 'JOB_UPDATE',
    action, // 'CREATED', 'UPDATED', 'ASSIGNED', 'COMPLETED'
    job,
    timestamp: new Date().toISOString()
  };

  // Broadcast to all admin users
  io.to('role-ADMIN').emit('job-update', payload);
  
  // Broadcast to CS users for job-related updates
  if (['CREATED', 'UPDATED', 'ASSIGNED', 'COMPLETED'].includes(action)) {
    io.to('role-CS').emit('job-update', payload);
  }

  logger.info('Broadcasted job update via WebSocket', { action, jobNumber: job.jobNumber });
};

// Broadcast inventory updates
const broadcastInventoryUpdate = (item, action) => {
  if (!io) return;

  const payload = {
    type: 'INVENTORY_UPDATE',
    action, // 'CREATED', 'UPDATED', 'DELETED', 'STOCK_LOW'
    item,
    timestamp: new Date().toISOString()
  };

  // Broadcast to admin and manager roles
  io.to('role-ADMIN').emit('inventory-update', payload);
  io.to('role-MANAGER').emit('inventory-update', payload);

  logger.info('Broadcasted inventory update via WebSocket', { action, itemName: item.name });
};

// Broadcast user management updates
const broadcastUserUpdate = (user, action) => {
  if (!io) return;

  const payload = {
    type: 'USER_UPDATE',
    action, // 'CREATED', 'UPDATED', 'DELETED', 'ACTIVATED', 'DEACTIVATED'
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive
    },
    timestamp: new Date().toISOString()
  };

  // Only broadcast to admin users
  io.to('role-ADMIN').emit('user-update', payload);

  logger.info('Broadcasted user update via WebSocket', { action, userName: user.name });
};

// Broadcast customer updates
const broadcastCustomerUpdate = (customer, action) => {
  if (!io) return;

  const payload = {
    type: 'USER_UPDATE',
    action, // 'created', 'updated', 'deleted'
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      address: customer.address
    },
    timestamp: new Date().toISOString()
  };

  // Broadcast to admin and CS users
  io.to('role-ADMIN').emit('user-update', payload);
  io.to('role-CS').emit('user-update', payload);

  logger.info('Broadcasted customer update via WebSocket', { action, customerName: customer.name });
};

// Broadcast system notifications
const broadcastSystemNotification = (notification) => {
  if (!io) return;

  const payload = {
    type: 'SYSTEM_NOTIFICATION',
    notification: {
      id: Date.now(),
      title: notification.title,
      message: notification.message,
      type: notification.type || 'info', // 'success', 'warning', 'error', 'info'
      timestamp: new Date().toISOString()
    }
  };

  // Broadcast to all connected users
  io.emit('system-notification', payload);

  logger.info('Broadcasted system notification via WebSocket', { title: notification.title });
};

// Send notification to specific user
const sendUserNotification = (userId, notification) => {
  if (!io) return;

  const payload = {
    type: 'USER_NOTIFICATION',
    notification: {
      id: Date.now(),
      title: notification.title,
      message: notification.message,
      type: notification.type || 'info',
      timestamp: new Date().toISOString()
    }
  };

  io.to(`user-${userId}`).emit('user-notification', payload);

  logger.info('Sent user notification via WebSocket', { userId, title: notification.title });
};

// Broadcast WhatsApp status updates
const broadcastWhatsAppStatusUpdate = (statusData) => {
  if (!io) return;

  const payload = {
    type: 'WHATSAPP_STATUS_UPDATE',
    status: statusData.status,
    connected: statusData.connected,
    user: statusData.user,
    uptime: statusData.uptime,
    lastUpdate: statusData.lastUpdate,
    commandCount: statusData.commandCount,
    timestamp: new Date().toISOString()
  };

  // Broadcast to all connected users
  io.emit('whatsapp-status-update', payload);

  logger.info('Broadcasted WhatsApp status update via WebSocket', { 
    status: statusData.status, 
    connected: statusData.connected 
  });
};

// Get connected clients count
const getConnectedClientsCount = () => {
  if (!io) return 0;
  return io.engine.clientsCount;
};

// Get clients in specific room
const getClientsInRoom = (room) => {
  if (!io) return 0;
  const clients = io.sockets.adapter.rooms.get(room);
  return clients ? clients.size : 0;
};

module.exports = {
  initializeWebSocket,
  broadcastJobUpdate,
  broadcastInventoryUpdate,
  broadcastUserUpdate,
  broadcastCustomerUpdate,
  broadcastSystemNotification,
  sendUserNotification,
  broadcastWhatsAppStatusUpdate,
  getConnectedClientsCount,
  getClientsInRoom
};
