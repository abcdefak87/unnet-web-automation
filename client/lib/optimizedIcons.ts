// Optimized icon imports with lazy loading
import { lazy } from 'react'

// Lazy load icons to reduce bundle size
export const OptimizedIcons = {
  // Navigation icons
  LayoutDashboard: lazy(() => import('lucide-react').then(mod => ({ default: mod.LayoutDashboard }))),
  UserCheck: lazy(() => import('lucide-react').then(mod => ({ default: mod.UserCheck }))),
  BarChart3: lazy(() => import('lucide-react').then(mod => ({ default: mod.BarChart3 }))),
  MessageSquare: lazy(() => import('lucide-react').then(mod => ({ default: mod.MessageSquare }))),
  CheckCircle: lazy(() => import('lucide-react').then(mod => ({ default: mod.CheckCircle }))),
  Briefcase: lazy(() => import('lucide-react').then(mod => ({ default: mod.Briefcase }))),
  Users: lazy(() => import('lucide-react').then(mod => ({ default: mod.Users }))),
  Package: lazy(() => import('lucide-react').then(mod => ({ default: mod.Package }))),
  Settings: lazy(() => import('lucide-react').then(mod => ({ default: mod.Settings }))),
  AlertTriangle: lazy(() => import('lucide-react').then(mod => ({ default: mod.AlertTriangle }))),
  
  // Action icons
  Search: lazy(() => import('lucide-react').then(mod => ({ default: mod.Search }))),
  Filter: lazy(() => import('lucide-react').then(mod => ({ default: mod.Filter }))),
  Plus: lazy(() => import('lucide-react').then(mod => ({ default: mod.Plus }))),
  Eye: lazy(() => import('lucide-react').then(mod => ({ default: mod.Eye }))),
  Edit: lazy(() => import('lucide-react').then(mod => ({ default: mod.Edit }))),
  Trash2: lazy(() => import('lucide-react').then(mod => ({ default: mod.Trash2 }))),
  RefreshCw: lazy(() => import('lucide-react').then(mod => ({ default: mod.RefreshCw }))),
  Download: lazy(() => import('lucide-react').then(mod => ({ default: mod.Download }))),
  Upload: lazy(() => import('lucide-react').then(mod => ({ default: mod.Upload }))),
  
  // Status icons
  Clock: lazy(() => import('lucide-react').then(mod => ({ default: mod.Clock }))),
  CheckCircle2: lazy(() => import('lucide-react').then(mod => ({ default: mod.CheckCircle2 }))),
  X: lazy(() => import('lucide-react').then(mod => ({ default: mod.X }))),
  Wifi: lazy(() => import('lucide-react').then(mod => ({ default: mod.Wifi }))),
  WifiOff: lazy(() => import('lucide-react').then(mod => ({ default: mod.WifiOff }))),
  Shield: lazy(() => import('lucide-react').then(mod => ({ default: mod.Shield }))),
  Activity: lazy(() => import('lucide-react').then(mod => ({ default: mod.Activity }))),
  TrendingUp: lazy(() => import('lucide-react').then(mod => ({ default: mod.TrendingUp }))),
  
  // User interface icons
  Menu: lazy(() => import('lucide-react').then(mod => ({ default: mod.Menu }))),
  XIcon: lazy(() => import('lucide-react').then(mod => ({ default: mod.X }))),
  ChevronLeft: lazy(() => import('lucide-react').then(mod => ({ default: mod.ChevronLeft }))),
  ChevronRight: lazy(() => import('lucide-react').then(mod => ({ default: mod.ChevronRight }))),
  ChevronDown: lazy(() => import('lucide-react').then(mod => ({ default: mod.ChevronDown }))),
  ChevronUp: lazy(() => import('lucide-react').then(mod => ({ default: mod.ChevronUp }))),
  LogOut: lazy(() => import('lucide-react').then(mod => ({ default: mod.LogOut }))),
  User: lazy(() => import('lucide-react').then(mod => ({ default: mod.User }))),
  Phone: lazy(() => import('lucide-react').then(mod => ({ default: mod.Phone }))),
  MapPin: lazy(() => import('lucide-react').then(mod => ({ default: mod.MapPin }))),
  Calendar: lazy(() => import('lucide-react').then(mod => ({ default: mod.Calendar }))),
  Ticket: lazy(() => import('lucide-react').then(mod => ({ default: mod.Ticket }))),
  
  // WhatsApp specific icons
  Smartphone: lazy(() => import('lucide-react').then(mod => ({ default: mod.Smartphone }))),
  QrCode: lazy(() => import('lucide-react').then(mod => ({ default: mod.QrCode }))),
  MessageCircle: lazy(() => import('lucide-react').then(mod => ({ default: mod.MessageCircle }))),
  Send: lazy(() => import('lucide-react').then(mod => ({ default: mod.Send }))),
  Power: lazy(() => import('lucide-react').then(mod => ({ default: mod.Power }))),
  Check: lazy(() => import('lucide-react').then(mod => ({ default: mod.Check }))),
  
  // Form icons
  UserPlus: lazy(() => import('lucide-react').then(mod => ({ default: mod.UserPlus }))),
  Mail: lazy(() => import('lucide-react').then(mod => ({ default: mod.Mail }))),
  Lock: lazy(() => import('lucide-react').then(mod => ({ default: mod.Lock }))),
  EyeOff: lazy(() => import('lucide-react').then(mod => ({ default: mod.EyeOff }))),
  
  // Utility icons
  Home: lazy(() => import('lucide-react').then(mod => ({ default: mod.Home }))),
  Bug: lazy(() => import('lucide-react').then(mod => ({ default: mod.Bug }))),
  Info: lazy(() => import('lucide-react').then(mod => ({ default: mod.Info }))),
  HelpCircle: lazy(() => import('lucide-react').then(mod => ({ default: mod.HelpCircle }))),
  ExternalLink: lazy(() => import('lucide-react').then(mod => ({ default: mod.ExternalLink }))),
  Copy: lazy(() => import('lucide-react').then(mod => ({ default: mod.Copy }))),
  Share: lazy(() => import('lucide-react').then(mod => ({ default: mod.Share }))),
  Star: lazy(() => import('lucide-react').then(mod => ({ default: mod.Star }))),
  Heart: lazy(() => import('lucide-react').then(mod => ({ default: mod.Heart }))),
  ThumbsUp: lazy(() => import('lucide-react').then(mod => ({ default: mod.ThumbsUp }))),
  ThumbsDown: lazy(() => import('lucide-react').then(mod => ({ default: mod.ThumbsDown })))
}

export default OptimizedIcons
