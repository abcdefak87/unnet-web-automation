const jwt = require('jsonwebtoken');
const prisma = require('../utils/database');

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Check token type
    if (decoded.type && decoded.type !== 'access') {
      return res.status(403).json({ error: 'Invalid token type' });
    }

    try {
      // Get user from database to ensure they still exist and are active
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          phone: true,
          whatsappNumber: true
        }
      });

      if (!user || !user.isActive) {
        return res.status(403).json({ error: 'User not found or inactive' });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(500).json({ error: 'Authentication failed' });
    }
  });
};

const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        userRole: req.user.role,
        allowedRoles: allowedRoles
      });
    }

    next();
  };
};

// Check specific permission
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Super Admin has all permissions
    if (req.user.role === 'superadmin') {
      return next();
    }

    // Admin has limited access
    if (req.user.role === 'admin') {
      const adminPermissions = [
        'jobs:view', 'jobs:create', 'jobs:edit', 'jobs:delete', 'jobs:assign',
        'customers:view', 'customers:create', 'customers:edit', 'customers:delete',
        'technicians:view', 'technicians:create', 'technicians:edit', 'technicians:delete',
        'inventory:view', 'inventory:create', 'inventory:edit', 'inventory:delete', 'inventory:transactions',
        'reports:view', 'reports:export',
        'telegram:view', 'telegram:manage'
      ];
      if (adminPermissions.includes(permission)) {
        return next();
      }
    }

    // Gudang has inventory-only access (reports excluded per policy)
    if (req.user.role === 'gudang') {
      const gudangPermissions = ['inventory:view', 'inventory:create', 'inventory:edit', 'inventory:delete', 'inventory:transactions'];
      if (gudangPermissions.includes(permission)) {
        return next();
      }
    }

    // User/Technician has view-only access
    if (req.user.role === 'user' || req.user.role === 'technician') {
      const userPermissions = ['jobs:view', 'technicians:view', 'reports:view'];
      if (userPermissions.includes(permission)) {
        return next();
      }
    }

    return res.status(403).json({ 
      error: 'Insufficient permissions',
      required: permission,
      userRole: req.user.role
    });
  };
};

// Check multiple permissions (user needs at least one)
const requireAnyPermission = (permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Super Admin has all permissions
    if (req.user.role === 'superadmin') {
      return next();
    }

    // Admin has limited access + reports
    if (req.user.role === 'admin') {
      const adminPermissions = [
        'jobs:view', 'jobs:create', 'jobs:edit', 'jobs:assign', 
        'customers:view', 'customers:create', 'customers:edit', 
        'technicians:view', 'technicians:create', 'technicians:edit', 'technicians:delete',
        'inventory:view', 'inventory:create', 'inventory:edit', 'inventory:delete', 'inventory:transactions',
        'reports:view', 'reports:export', 'telegram:view', 'telegram:manage'
      ];
      const hasAnyPermission = permissions.some(perm => adminPermissions.includes(perm));
      if (hasAnyPermission) {
        return next();
      }
    }

    // Gudang has inventory-only access (reports excluded per policy)
    if (req.user.role === 'gudang') {
      const gudangPermissions = ['inventory:view', 'inventory:create', 'inventory:edit', 'inventory:delete', 'inventory:transactions'];
      const hasAnyPermission = permissions.some(perm => gudangPermissions.includes(perm));
      if (hasAnyPermission) {
        return next();
      }
    }

    // User/Technician has view-only access
    if (req.user.role === 'user' || req.user.role === 'technician') {
      const userPermissions = ['jobs:view', 'technicians:view', 'reports:view'];
      const hasAnyPermission = permissions.some(perm => userPermissions.includes(perm));
      if (hasAnyPermission) {
        return next();
      }
    }

    return res.status(403).json({ 
      error: 'Insufficient permissions',
      required: permissions,
      userRole: req.user.role
    });
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  requirePermission,
  requireAnyPermission
};
