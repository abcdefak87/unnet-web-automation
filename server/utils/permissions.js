// Role-based permissions configuration
const PERMISSIONS = {
  // Job Management
  JOBS_VIEW: 'jobs:view',
  JOBS_CREATE: 'jobs:create',
  JOBS_EDIT: 'jobs:edit',
  JOBS_DELETE: 'jobs:delete',
  JOBS_ASSIGN: 'jobs:assign',

  // Customer Management
  CUSTOMERS_VIEW: 'customers:view',
  CUSTOMERS_CREATE: 'customers:create',
  CUSTOMERS_EDIT: 'customers:edit',
  CUSTOMERS_DELETE: 'customers:delete',

  // Technician Management
  TECHNICIANS_VIEW: 'technicians:view',
  TECHNICIANS_CREATE: 'technicians:create',
  TECHNICIANS_EDIT: 'technicians:edit',
  TECHNICIANS_DELETE: 'technicians:delete',

  // Inventory Management
  INVENTORY_VIEW: 'inventory:view',
  INVENTORY_CREATE: 'inventory:create',
  INVENTORY_EDIT: 'inventory:edit',
  INVENTORY_DELETE: 'inventory:delete',
  INVENTORY_TRANSACTIONS: 'inventory:transactions',

  // Reports & Analytics
  REPORTS_VIEW: 'reports:view',
  REPORTS_EXPORT: 'reports:export',

  // System Administration
  USERS_VIEW: 'users:view',
  USERS_CREATE: 'users:create',
  USERS_EDIT: 'users:edit',
  USERS_DELETE: 'users:delete',
  SYSTEM_SETTINGS: 'system:settings',

  // Telegram Bot Management
  TELEGRAM_VIEW: 'telegram:view',
  TELEGRAM_MANAGE: 'telegram:manage',

  // All Access (Super Admin)
  ALL_ACCESS: 'all:access'
};

// Role-based permission sets
const ROLE_PERMISSIONS = {
  superadmin: [PERMISSIONS.ALL_ACCESS],
  admin: [
    PERMISSIONS.JOBS_VIEW, PERMISSIONS.JOBS_CREATE, PERMISSIONS.JOBS_EDIT, PERMISSIONS.JOBS_DELETE, PERMISSIONS.JOBS_ASSIGN,
    PERMISSIONS.CUSTOMERS_VIEW, PERMISSIONS.CUSTOMERS_CREATE, PERMISSIONS.CUSTOMERS_EDIT, PERMISSIONS.CUSTOMERS_DELETE,
    PERMISSIONS.TECHNICIANS_VIEW, PERMISSIONS.TECHNICIANS_CREATE, PERMISSIONS.TECHNICIANS_EDIT, PERMISSIONS.TECHNICIANS_DELETE,
    PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_CREATE, PERMISSIONS.INVENTORY_EDIT, PERMISSIONS.INVENTORY_DELETE, PERMISSIONS.INVENTORY_TRANSACTIONS,
    PERMISSIONS.REPORTS_VIEW, PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.TELEGRAM_VIEW, PERMISSIONS.TELEGRAM_MANAGE,
    PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_CREATE, PERMISSIONS.USERS_EDIT, PERMISSIONS.USERS_DELETE
  ],
  gudang: [
    PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_CREATE, PERMISSIONS.INVENTORY_EDIT, PERMISSIONS.INVENTORY_DELETE, PERMISSIONS.INVENTORY_TRANSACTIONS,
    PERMISSIONS.REPORTS_VIEW
  ],
  user: [
    PERMISSIONS.JOBS_VIEW,
    PERMISSIONS.TECHNICIANS_VIEW,
    PERMISSIONS.REPORTS_VIEW
  ]
};

// Get permissions for a role
const getPermissionsForRole = (role) => {
  return ROLE_PERMISSIONS[role] || [];
};

// Check if role has permission
const roleHasPermission = (role, permission) => {
  const rolePermissions = getPermissionsForRole(role);
  return rolePermissions.includes(PERMISSIONS.ALL_ACCESS) || 
         rolePermissions.includes(permission);
};

// Get user-friendly role names
const ROLE_NAMES = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  gudang: 'Gudang',
  user: 'User'
};

// Get accessible routes for each role
const ROLE_ROUTES = {
  superadmin: [
    '/dashboard',
    '/jobs',
    '/customers', 
    '/technicians',
    '/inventory',
    '/reports',
    '/users',
    '/settings'
  ],
  admin: [
    '/dashboard',
    '/jobs',
    '/customers',
    '/technicians',
    '/inventory',
    '/reports',
    '/users',
    '/telegram'
  ],
  gudang: [
    '/dashboard',
    '/inventory',
    '/reports'
  ],
  user: [
    '/dashboard',
    '/jobs',
    '/technicians'
  ]
};

module.exports = {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLE_NAMES,
  ROLE_ROUTES,
  getPermissionsForRole,
  roleHasPermission
};
