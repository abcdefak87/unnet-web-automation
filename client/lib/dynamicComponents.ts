import React, { lazy, ComponentType } from 'react'

// Simple fallback component
const FallbackComponent: React.FC = () => React.createElement('div', {
  className: 'flex items-center justify-center p-4 text-gray-500'
}, 
  React.createElement('div', {
    className: 'animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400'
  }),
  React.createElement('span', {
    className: 'ml-2'
  }, 'Loading...')
)

// Dynamic component loader with error boundary
const createDynamicComponent = <T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> => {
  return lazy(async () => {
    try {
      const importedModule = await importFn()
      return { default: importedModule.default }
    } catch (error) {
      console.error('Failed to load dynamic component:', error)
      // Return fallback component with proper typing
      return { default: FallbackComponent as T }
    }
  })
}

// Dynamic page components
export const DynamicPages = {
  // Dashboard
  Dashboard: createDynamicComponent(() => import('../pages/dashboard')),
  Login: createDynamicComponent(() => import('../pages/login')),
  Register: createDynamicComponent(() => import('../pages/register')),
  Setup: createDynamicComponent(() => import('../pages/setup')),
  
  // Operations
  PSB: createDynamicComponent(() => import('../pages/psb')),
  Gangguan: createDynamicComponent(() => import('../pages/gangguan')),
  Reports: createDynamicComponent(() => import('../pages/reports')),
  
  // Management
  WhatsApp: createDynamicComponent(() => import('../pages/whatsapp')),
  Users: createDynamicComponent(() => import('../pages/users')),
  Profile: createDynamicComponent(() => import('../pages/profile')),
  
  // Inventory & Jobs
  Inventory: createDynamicComponent(() => import('../pages/inventory')),
  Customers: createDynamicComponent(() => import('../pages/pelanggan')),
  Technicians: createDynamicComponent(() => import('../pages/technicians')),
  Persetujuan: createDynamicComponent(() => import('../pages/persetujuan')),
  Jobs: createDynamicComponent(() => import('../pages/jobs')),
}

// Dynamic modal components
export const DynamicModals = {
  // Customer modals
  DualCustomerModal: createDynamicComponent(() => import('../components/modals/DualCustomerModal')),
  EnhancedCustomerModal: createDynamicComponent(() => import('../components/modals/EnhancedCustomerModal')),
  QuickAddCustomerModal: createDynamicComponent(() => import('../components/QuickAddCustomerModal')),
  
  // Job modals (commented out - modals don't exist)
  // JobCreateModal: createDynamicComponent(() => import('../components/modals/JobCreateModal')),
  // JobEditModal: createDynamicComponent(() => import('../components/modals/JobEditModal')),
  
  // Inventory modals
  InventoryCreateModal: createDynamicComponent(() => import('../components/modals/InventoryCreateModal')),
  InventoryOutModal: createDynamicComponent(() => import('../components/modals/InventoryOutModal')),
  
  // Other modals
  ModemScannerModal: createDynamicComponent(() => import('../components/ModemScannerModal')),
  SmartModemOutModal: createDynamicComponent(() => import('../components/SmartModemOutModal')),
  SmartModemReturnModal: createDynamicComponent(() => import('../components/SmartModemReturnModal')),
}

// Dynamic UI components
export const DynamicUIComponents = {
  Layout: createDynamicComponent(() => import('../components/Layout')),
  ErrorBoundary: createDynamicComponent(() => import('../components/ErrorBoundary')),
  ErrorFallback: createDynamicComponent(() => import('../components/ErrorFallback')),
  SkeletonLoader: createDynamicComponent(() => import('../components/SkeletonLoader')),
  WhatsAppManager: createDynamicComponent(() => import('../components/WhatsAppManager')),
  RegistrationForm: createDynamicComponent(() => import('../components/RegistrationForm')),
  NotificationSystem: createDynamicComponent(() => import('../components/NotificationSystem')),
  ProtectedRoute: createDynamicComponent(() => import('../components/ProtectedRoute')),
  Breadcrumb: createDynamicComponent(() => import('../components/Breadcrumb')),
  EmptyState: createDynamicComponent(() => import('../components/EmptyState')),
}

// Function to preload critical components
export const preloadCriticalComponents = () => {
  // Note: React.lazy components don't have preload method by default
  // This is a placeholder for future preloading implementation
  console.log('Preloading critical components...')
}

// Export default for backward compatibility
const dynamicComponents = {
  DynamicPages,
  DynamicModals,
  DynamicUIComponents,
  preloadCriticalComponents
}

export default dynamicComponents