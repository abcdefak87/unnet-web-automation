import { LucideIcon } from 'lucide-react'
import { lazy, ComponentType } from 'react'

// Dynamic icon loader with fallback
const createDynamicIcon = (iconName: string): ComponentType<any> => {
  return lazy(async () => {
    try {
      const iconModule = await import('lucide-react')
      const IconComponent = (iconModule as any)[iconName]
      
      if (!IconComponent) {
        console.warn(`Icon ${iconName} not found, using fallback`)
        return { default: iconModule.AlertTriangle }
      }
      
      return { default: IconComponent }
    } catch (error) {
      console.error(`Failed to load icon ${iconName}:`, error)
      // Fallback to a basic icon
      const { AlertTriangle } = await import('lucide-react')
      return { default: AlertTriangle }
    }
  })
}

// Pre-defined dynamic icons for common use cases
export const DynamicIcons = {
  // Navigation icons
  LayoutDashboard: createDynamicIcon('LayoutDashboard'),
  UserCheck: createDynamicIcon('UserCheck'),
  BarChart3: createDynamicIcon('BarChart3'),
  MessageSquare: createDynamicIcon('MessageSquare'),
  CheckCircle: createDynamicIcon('CheckCircle'),
  Briefcase: createDynamicIcon('Briefcase'),
  Users: createDynamicIcon('Users'),
  Package: createDynamicIcon('Package'),
  Settings: createDynamicIcon('Settings'),
  AlertTriangle: createDynamicIcon('AlertTriangle'),
  
  // Action icons
  Search: createDynamicIcon('Search'),
  Filter: createDynamicIcon('Filter'),
  Plus: createDynamicIcon('Plus'),
  Eye: createDynamicIcon('Eye'),
  Edit: createDynamicIcon('Edit'),
  Trash2: createDynamicIcon('Trash2'),
  RefreshCw: createDynamicIcon('RefreshCw'),
  Download: createDynamicIcon('Download'),
  Upload: createDynamicIcon('Upload'),
  
  // Status icons
  Clock: createDynamicIcon('Clock'),
  CheckCircle2: createDynamicIcon('CheckCircle2'),
  X: createDynamicIcon('X'),
  Wifi: createDynamicIcon('Wifi'),
  WifiOff: createDynamicIcon('WifiOff'),
  Shield: createDynamicIcon('Shield'),
  Activity: createDynamicIcon('Activity'),
  TrendingUp: createDynamicIcon('TrendingUp'),
  
  // User interface icons
  Menu: createDynamicIcon('Menu'),
  XIcon: createDynamicIcon('X'),
  ChevronLeft: createDynamicIcon('ChevronLeft'),
  ChevronRight: createDynamicIcon('ChevronRight'),
  ChevronDown: createDynamicIcon('ChevronDown'),
  ChevronUp: createDynamicIcon('ChevronUp'),
  LogOut: createDynamicIcon('LogOut'),
  User: createDynamicIcon('User'),
  Phone: createDynamicIcon('Phone'),
  MapPin: createDynamicIcon('MapPin'),
  Calendar: createDynamicIcon('Calendar'),
  Ticket: createDynamicIcon('Ticket'),
  
  // WhatsApp specific icons
  Smartphone: createDynamicIcon('Smartphone'),
  QrCode: createDynamicIcon('QrCode'),
  MessageCircle: createDynamicIcon('MessageCircle'),
  Send: createDynamicIcon('Send'),
  Power: createDynamicIcon('Power'),
  Check: createDynamicIcon('Check'),
  
  // Form icons
  UserPlus: createDynamicIcon('UserPlus'),
  Mail: createDynamicIcon('Mail'),
  Lock: createDynamicIcon('Lock'),
  EyeOff: createDynamicIcon('EyeOff'),
  
  // Utility icons
  Home: createDynamicIcon('Home'),
  Bug: createDynamicIcon('Bug'),
  Info: createDynamicIcon('Info'),
  HelpCircle: createDynamicIcon('HelpCircle'),
  ExternalLink: createDynamicIcon('ExternalLink'),
  Copy: createDynamicIcon('Copy'),
  Share: createDynamicIcon('Share'),
  Star: createDynamicIcon('Star'),
  Heart: createDynamicIcon('Heart'),
  ThumbsUp: createDynamicIcon('ThumbsUp'),
  ThumbsDown: createDynamicIcon('ThumbsDown')
}

// Hook for using dynamic icons with loading state
export const useDynamicIcon = (iconName: keyof typeof DynamicIcons) => {
  const IconComponent = DynamicIcons[iconName]
  
  return {
    IconComponent,
    isLoading: IconComponent === null
  }
}

// Utility function to get icon by name
export const getDynamicIcon = (iconName: string) => {
  return DynamicIcons[iconName as keyof typeof DynamicIcons] || DynamicIcons.AlertTriangle
}

export default DynamicIcons
