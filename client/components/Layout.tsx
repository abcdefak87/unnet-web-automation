import React, { ReactNode, useState, useEffect } from 'react'
import Head from 'next/head'
import { useAuth } from '../contexts/AuthContext'
import { useRouter } from '../lib/router'
import { OptimizedIcons } from '../lib/optimizedIcons'
import { Suspense } from 'react'
import Link from 'next/link'
import DevTools from './DevTools'

interface LayoutProps {
  children: React.ReactNode
  title?: string
}

// Clean and consistent navigation configuration
const navigationGroups = [
  {
    title: 'RINGKASAN',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: OptimizedIcons.LayoutDashboard, roles: ['superadmin', 'admin', 'gudang', 'technician'] },
    ]
  },
  {
    title: 'OPERASI',
    items: [
      { name: 'Persetujuan', href: '/persetujuan', icon: OptimizedIcons.CheckCircle, roles: ['superadmin', 'admin'] },
      { name: 'Semua Tiket', href: '/jobs', icon: OptimizedIcons.Briefcase, roles: ['superadmin', 'admin', 'user', 'technician'] },
      { name: 'PSB', href: '/psb', icon: OptimizedIcons.CheckCircle, roles: ['superadmin', 'admin', 'user', 'technician'] },
      { name: 'Gangguan', href: '/gangguan', icon: OptimizedIcons.AlertTriangle, roles: ['superadmin', 'admin', 'user', 'technician'] },
      { name: 'Teknisi', href: '/technicians', icon: OptimizedIcons.Users, roles: ['superadmin', 'admin', 'user', 'technician'] },
    ]
  },
  {
    title: 'MANAJEMEN',
    items: [
      { name: 'Pelanggan', href: '/pelanggan', icon: OptimizedIcons.UserCheck, roles: ['superadmin', 'admin'] },
      { name: 'Inventori', href: '/inventory', icon: OptimizedIcons.Package, roles: ['superadmin', 'gudang', 'admin'] },
    ]
  },
  {
    title: 'SISTEM',
    items: [
      { name: 'Laporan', href: '/reports', icon: OptimizedIcons.BarChart3, roles: ['superadmin', 'admin', 'gudang'] },
      { name: 'WhatsApp', href: '/whatsapp', icon: OptimizedIcons.MessageSquare, roles: ['superadmin'] },
      { name: 'Pengguna', href: '/users', icon: OptimizedIcons.Settings, roles: ['superadmin'] },
    ]
  }
]

// Enhanced consistent styling constants
const SIDEBAR_CONSTANTS = {
  // Spacing - Standardized for better visual hierarchy
  ITEM_PADDING: 'px-4 py-3',
  GROUP_PADDING: 'px-4 py-2',
  CONTAINER_PADDING: 'px-4',
  SUBITEM_PADDING: 'px-4 py-2.5',
  SUBITEM_INDENT: 'ml-6',
  
  // Sizing - Consistent icon and avatar sizing
  ICON_SIZE: 'h-5 w-5',
  ICON_SIZE_SM: 'h-4 w-4',
  ICON_SIZE_XS: 'h-3.5 w-3.5',
  AVATAR_SIZE: 'w-8 h-8',
  AVATAR_SIZE_SM: 'w-6 h-6',
  
  // Transitions - Smooth and consistent animations
  TRANSITION_DURATION: 'duration-300',
  TRANSITION_EASING: 'ease-in-out',
  TRANSITION_FAST: 'duration-200',
  
  // Typography - Standardized text styling
  TEXT_SIZE: 'text-sm',
  TEXT_SIZE_SM: 'text-xs',
  TEXT_WEIGHT: 'font-medium',
  TEXT_WEIGHT_SEMIBOLD: 'font-semibold',
  
  // Colors - Enhanced color system matching design
  ACTIVE_GRADIENT: 'bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600',
  HOVER_GRADIENT: 'hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50',
  SUBITEM_ACTIVE: 'bg-blue-50 text-blue-700 border-l-2 border-blue-600',
  SUBITEM_HOVER: 'hover:bg-gray-50 hover:text-gray-900',
  
  // Text colors
  TEXT_ACTIVE: 'text-white',
  TEXT_INACTIVE: 'text-gray-700',
  TEXT_HOVER: 'hover:text-blue-700',
  TEXT_MUTED: 'text-gray-500',
  TEXT_GROUP: 'text-gray-500',
  
  // Icon colors
  ICON_ACTIVE: 'text-white',
  ICON_INACTIVE: 'text-gray-500',
  ICON_HOVER: 'group-hover:text-blue-600',
  ICON_SUBITEM: 'text-gray-400',
  ICON_SUBITEM_ACTIVE: 'text-blue-600',
  
  // Borders and shadows
  BORDER_ACTIVE: 'shadow-lg shadow-blue-500/20',
  BORDER_HOVER: 'hover:shadow-md',
  DIVIDER: 'border-gray-200/60',
  
  // Spacing between elements
  GROUP_SPACING: 'space-y-1',
  ITEM_SPACING: 'space-y-0.5',
  SUBITEM_SPACING: 'space-y-1'
}

// Reusable Navigation Item Component
interface NavItemProps {
  item: any
  isActive: boolean
  isExpanded: boolean
  shouldShowExpanded: boolean
  onToggleSubmenu?: (itemName: string) => void
  isSubmenuExpanded?: (itemName: string) => boolean
  isSubmenuItemActive?: (submenu: any[]) => boolean
  onHoverSubmenu?: (itemName: string, isHovering: boolean) => void
}

const NavItem: React.FC<NavItemProps> = ({ 
  item, 
  isActive, 
  isExpanded, 
  shouldShowExpanded, 
  onToggleSubmenu, 
  isSubmenuExpanded,
  isSubmenuItemActive,
  onHoverSubmenu
}) => {
  const Icon = item.icon
  const hasSubmenu = item.submenu && item.submenu.length > 0
  const isSubExpanded = isSubmenuExpanded ? isSubmenuExpanded(item.name) : false
  // Enable hover for Pekerjaan menu
  const enableHover = item.name === 'Pekerjaan'

  // Enhanced base classes with consistent styling
  const baseClasses = `sidebar-nav-item group ${!shouldShowExpanded ? 'justify-center' : ''}`
  
  // Enhanced active and inactive states
  const activeClasses = isActive ? 'sidebar-nav-item-active' : ''
  const inactiveClasses = !isActive ? 'sidebar-nav-item-inactive' : ''

  // Special styling for parent menu with active submenu
  const hasActiveSubmenu = hasSubmenu && isSubmenuItemActive && isSubmenuItemActive(item.submenu)
  const parentWithActiveSubmenu = hasSubmenu && hasActiveSubmenu && !isActive

  const itemClasses = `${baseClasses} ${
    isActive ? activeClasses : 
    parentWithActiveSubmenu ? 'bg-blue-50 text-blue-700 border-l-2 border-blue-600' :
    inactiveClasses
  }`

  const menuContent = (
    <>
      <Icon className={`sidebar-icon ${
        isActive ? 'sidebar-icon-active' : 
        parentWithActiveSubmenu ? 'text-blue-600' :
        'sidebar-icon-inactive'
      }`} />
      
      <span className={`sidebar-text ${
        shouldShowExpanded ? 'sidebar-text-expanded' : 'sidebar-text-collapsed'
      }`}>
        {item.name}
      </span>
      
      {hasSubmenu && shouldShowExpanded && (
        <Suspense fallback={<div className="h-3.5 w-3.5 bg-gray-200 rounded "></div>}>
          <OptimizedIcons.ChevronUp aria-hidden="true" className={`${SIDEBAR_CONSTANTS.ICON_SIZE_SM} transition-transform duration-300 ease-in-out ${
          isSubExpanded ? 'rotate-180' : 'rotate-0'
        } ${
          isActive ? SIDEBAR_CONSTANTS.ICON_ACTIVE : 
          parentWithActiveSubmenu ? 'text-blue-600' :
          SIDEBAR_CONSTANTS.TEXT_MUTED
        }`} />
        </Suspense>
      )}
      
      {isActive && shouldShowExpanded && !hasSubmenu && (
        <div className="w-2 h-2 bg-white rounded-full ml-auto" />
      )}
    </>
  )

  if (hasSubmenu) {
    const wrapperClasses = enableHover ? "relative group/submenu" : "relative"
    
    return (
      <div 
        className={wrapperClasses}
        onMouseEnter={() => enableHover && onHoverSubmenu?.(item.name, true)}
        onMouseLeave={() => enableHover && onHoverSubmenu?.(item.name, false)}
        style={enableHover ? { paddingBottom: isSubExpanded ? '0' : undefined } : undefined}
      >
        <button
          onClick={() => !enableHover && onToggleSubmenu?.(item.name)}
          className={itemClasses}
          title={!shouldShowExpanded ? item.name : ''}
          aria-expanded={isSubExpanded}
          aria-haspopup="true"
          role="menuitem"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggleSubmenu?.(item.name)
            }
            if (e.key === 'ArrowRight' && !isSubExpanded) {
              onToggleSubmenu?.(item.name)
            }
            if (e.key === 'ArrowLeft' && isSubExpanded) {
              onToggleSubmenu?.(item.name)
            }
          }}
        >
          {menuContent}
        </button>
        
        {isSubExpanded && shouldShowExpanded && (
          <div 
            className="mt-1 space-y-0.5 ml-2 mr-2"
            style={enableHover ? { marginTop: '-2px' } : undefined}
          >
            {item.submenu.map((subItem: any) => {
              const SubIcon = subItem.icon
              const subActive = isSubmenuItemActive ? isSubmenuItemActive([subItem]) : false
              
              return (
                <Link
                  key={subItem.name}
                  href={subItem.href}
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all duration-200 ${
                    subActive 
                      ? 'bg-blue-50 text-blue-700 font-medium border-l-3 border-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                  }`}
                >
                  <SubIcon className={`h-4 w-4 transition-colors duration-200 flex-shrink-0 ${
                    subActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
                  }`} />
                  <span className="text-sm font-medium">
                    {subItem.name}
                  </span>
                  {subActive && (
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full ml-auto" />
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <Link 
      href={item.href}
      className={itemClasses}
      title={!shouldShowExpanded ? item.name : ''}
      role="menuitem"
      aria-current={isActive ? 'page' : undefined}
    >
      {menuContent}
    </Link>
  )
}

export default function Layout({ children, title }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true)
  const [isHovering, setIsHovering] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const [expandedSubmenus, setExpandedSubmenus] = useState<Set<string>>(new Set())
  const [hoveredSubmenus, setHoveredSubmenus] = useState<Set<string>>(new Set())
  const { user, logout } = useAuth()
  const router = useRouter()



  useEffect(() => {
    setMounted(true)
    // Load sidebar state from localStorage
    const savedState = localStorage.getItem('sidebarExpanded')
    if (savedState !== null) {
      setDesktopSidebarOpen(JSON.parse(savedState))
    }
  }, [])

  useEffect(() => {
    // Save sidebar state to localStorage
    if (mounted) {
      localStorage.setItem('sidebarExpanded', JSON.stringify(desktopSidebarOpen))
    }
  }, [desktopSidebarOpen, mounted])

  // Auto close profile dropdown when sidebar closes
  useEffect(() => {
    if (!desktopSidebarOpen && !isHovering) {
      setProfileDropdownOpen(false)
    }
  }, [desktopSidebarOpen, isHovering])

  // Filter navigation groups based on user role
  const filteredNavigationGroups = navigationGroups.map(group => ({
    ...group,
    items: group.items.filter(item => user?.role && item.roles.includes(user.role))
  })).filter(group => group.items.length > 0)


  // Auto-expand/collapse logic
  const shouldShowExpanded = desktopSidebarOpen || isHovering

  const isActive = (href: string) => {
    return router.pathname.startsWith(href)
  }

  const isSubmenuItemActive = (submenu: any[]) => {
    return submenu.some(subItem => router.pathname.startsWith(subItem.href))
  }

  const toggleSubmenu = (itemName: string) => {
    setExpandedSubmenus(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemName)) {
        newSet.delete(itemName)
      } else {
        newSet.add(itemName)
      }
      return newSet
    })
  }

  const handleHoverSubmenu = (itemName: string, isHovering: boolean) => {
    // Only handle hover for Pekerjaan menu
    if (itemName === 'Pekerjaan') {
      setHoveredSubmenus(prev => {
        const newSet = new Set(prev)
        if (isHovering) {
          newSet.add(itemName)
        } else {
          newSet.delete(itemName)
        }
        return newSet
      })
    }
  }

  const isSubmenuExpanded = (itemName: string) => {
    // Check both clicked and hovered states
    return expandedSubmenus.has(itemName) || hoveredSubmenus.has(itemName)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      {/* Mobile sidebar backdrop */}
      <div className={`fixed inset-0 flex z-40 lg:hidden ${sidebarOpen ? '' : 'pointer-events-none'}`}>
        <div 
          className={`fixed inset-0 bg-white/20 backdrop-blur-sm transition-all duration-300 ease-out ${
            sidebarOpen ? 'opacity-100' : 'opacity-0'
          }`} 
          onClick={() => setSidebarOpen(false)} 
        />
        
        {/* Mobile sidebar */}
        <div className={`relative h-screen max-w-80 w-full bg-white/98 backdrop-blur-xl border-r border-gray-200/20 shadow-2xl transform transition-all duration-300 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="absolute top-4 right-4 z-10">
            <button
              type="button"
              className="flex items-center justify-center h-10 w-10 rounded-xl bg-gray-50/80 hover:bg-gray-100/80 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-sm hover:shadow-md"
              onClick={() => setSidebarOpen(false)}
            >
              <Suspense fallback={<div className="h-5 w-5 bg-gray-200 rounded "></div>}>
                <OptimizedIcons.XIcon className={`${SIDEBAR_CONSTANTS.ICON_SIZE} text-gray-600`} />
              </Suspense>
            </button>
          </div>
          
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-center px-6 pt-14 pb-4">
            <div className="text-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent tracking-tight">
                UNNET
              </h1>
              <p className="text-xs font-medium text-gray-400 tracking-[0.15em] uppercase mt-0.5">
                MANAGEMENT
              </p>
            </div>
          </div>
          
          {/* Navigation with scroll */}
          <div className="overflow-y-auto scrollbar-hide" style={{position: 'absolute', top: '120px', bottom: '80px', left: 0, right: 0}}>
            <nav className="px-3 space-y-2 pb-2">
              {filteredNavigationGroups.map((group, groupIndex) => (
                <div key={group.title}>
                  {/* Group title */}
                  <div className="px-4 py-2">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      {group.title}
                    </h3>
                  </div>
                  
                  {/* Group items */}
                  <div className={SIDEBAR_CONSTANTS.ITEM_SPACING}>
                    {group.items.map((item) => {
                      const active = Boolean(isActive(item.href))
                      const isExpanded = isSubmenuExpanded(item.name) || false
                      
                      return (
                        <div key={item.name}>
                          <NavItem
                            item={item}
                            isActive={active}
                            isExpanded={isExpanded}
                            shouldShowExpanded={true}
                            onToggleSubmenu={toggleSubmenu}
                            isSubmenuExpanded={isSubmenuExpanded}
                            isSubmenuItemActive={isSubmenuItemActive}
                            onHoverSubmenu={handleHoverSubmenu}
                          />
                        </div>
                      )
                    })}
                  </div>
                  
                  {/* Divider between groups (except last group) */}
                  {groupIndex < filteredNavigationGroups.length - 1 && (
                    <div className="mt-4 mb-2">
                      <div className="border-t border-gray-100"></div>
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>
          
          {/* User Profile Section - Fixed at bottom */}
          <div className="absolute bottom-0 left-0 right-0 border-t border-gray-100 bg-white/95 backdrop-blur-sm" style={{height: '75px'}}>
            <div className="relative p-3">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50/80 transition-all duration-200 group"
              >
                <div className="flex-shrink-0">
                  <div className="w-9 h-9 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <Suspense fallback={<div className="h-4 w-4 bg-gray-200 rounded "></div>}>
                      <OptimizedIcons.User className="h-4 w-4 text-white" />
                    </Suspense>
                  </div>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.role === 'superadmin' ? 'Super Administrator' : 
                     user?.role === 'admin' ? 'Administrator' :
                     user?.role === 'gudang' ? 'Gudang' : 
                     user?.role === 'user' ? 'User' : 
                     user?.role === 'technician' ? 'Technician' : user?.name || user?.email?.split('@')[0]}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                        <span className="text-xs text-gray-500">Aktif</span>
                  </div>
                </div>
                {profileDropdownOpen ? (
                  <Suspense fallback={<div className="h-4 w-4 bg-gray-200 rounded "></div>}>
                    <OptimizedIcons.ChevronUp className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                  </Suspense>
                ) : (
                  <Suspense fallback={<div className="h-4 w-4 bg-gray-200 rounded "></div>}>
                    <OptimizedIcons.ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                  </Suspense>
                )}
              </button>
              
              {/* Profile dropdown menu */}
              {profileDropdownOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-xs text-gray-500">Masuk sebagai</p>
                      <p className="text-sm font-medium text-gray-900 truncate">{user?.email}</p>
                      <div className="text-xs text-blue-600 font-medium capitalize">
                        {user?.role === 'superadmin' ? 'Super Admin' : 
                         user?.role === 'admin' ? 'Admin' :
                         user?.role === 'gudang' ? 'Gudang' : 
                         user?.role === 'user' ? 'Pengguna' : 
                         user?.role === 'technician' ? 'Teknisi' : user?.role}
                      </div>
                    </div>
                  <Link 
                    href="/profile" 
                    className="flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50/80 transition-all duration-200 rounded-lg mx-2"
                    onClick={() => setProfileDropdownOpen(false)}
                  >
                    <Suspense fallback={<div className="h-4 w-4 mr-3 bg-gray-200 rounded "></div>}>
                      <OptimizedIcons.Settings className="h-4 w-4 mr-3 text-gray-500" />
                    </Suspense>
                    Pengaturan Profil
                  </Link>
                  <button 
                    onClick={() => {
                      setProfileDropdownOpen(false)
                      logout()
                    }}
                    className="w-full flex items-center px-4 py-2.5 text-sm text-red-600 hover:bg-red-50/80 transition-all duration-200 rounded-lg mx-2"
                  >
                    <Suspense fallback={<div className="h-4 w-4 mr-3 bg-gray-200 rounded "></div>}>
                      <OptimizedIcons.LogOut className="h-4 w-4 mr-3" />
                    </Suspense>
                    Keluar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div 
        className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 transition-all duration-300 ease-out z-30 ${
          shouldShowExpanded ? 'lg:w-72' : 'lg:w-20'
        }`}
        onMouseEnter={() => !desktopSidebarOpen && setIsHovering(true)}
        onMouseLeave={() => !desktopSidebarOpen && setIsHovering(false)}
      >
        <div className="relative h-screen border-r border-gray-200/20 bg-white/98 backdrop-blur-xl shadow-2xl">
          {/* Header with brand and toggle */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 pt-6 pb-4">
            <div className={`transition-all duration-300 ease-out ${
              shouldShowExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'
            } overflow-hidden`}>
              <div className="text-center">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent tracking-tight">
                  UNNET
                </h1>
                <p className="text-[10px] font-medium text-gray-400 tracking-[0.15em] uppercase mt-0.5">
                  MANAGEMENT
                </p>
              </div>
            </div>
            
            {/* Toggle button */}
            <button
              onClick={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
              className={`p-2.5 rounded-xl bg-gray-50/80 hover:bg-gray-100/80 text-gray-500 hover:text-gray-700 transition-all duration-200 flex-shrink-0 shadow-sm hover:shadow-md ${
                shouldShowExpanded ? 'ml-auto' : 'mx-auto'
              }`}
              title={desktopSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {shouldShowExpanded ? (
                <Suspense fallback={<div className="h-3.5 w-3.5 bg-gray-200 rounded "></div>}>
                  <OptimizedIcons.ChevronLeft className={`${SIDEBAR_CONSTANTS.ICON_SIZE_SM}`} />
                </Suspense>
              ) : (
                <Suspense fallback={<div className="h-3.5 w-3.5 bg-gray-200 rounded "></div>}>
                  <OptimizedIcons.ChevronRight className={`${SIDEBAR_CONSTANTS.ICON_SIZE_SM}`} />
                </Suspense>
              )}
            </button>
          </div>
          
          {/* Navigation with proper scroll container */}
          <div className="overflow-y-auto scrollbar-hide" style={{position: 'absolute', top: '100px', bottom: '75px', left: 0, right: 0}}>
            <nav className="px-2 py-2 space-y-2">
              {filteredNavigationGroups.map((group, groupIndex) => (
                <div key={group.title}>
                  {/* Group title - only show when expanded */}
                  {shouldShowExpanded && (
                    <div className="px-4 py-2">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {group.title}
                      </h3>
                    </div>
                  )}
                  
                  {/* Group items */}
                  <div className={SIDEBAR_CONSTANTS.ITEM_SPACING}>
                    {group.items.map((item) => {
                      const active = Boolean(isActive(item.href))
                      const isExpanded = isSubmenuExpanded(item.name) || false
                      
                      return (
                        <div key={item.name}>
                          <NavItem
                            item={item}
                            isActive={active}
                            isExpanded={isExpanded}
                            shouldShowExpanded={shouldShowExpanded}
                            onToggleSubmenu={toggleSubmenu}
                            isSubmenuExpanded={isSubmenuExpanded}
                            isSubmenuItemActive={isSubmenuItemActive}
                            onHoverSubmenu={handleHoverSubmenu}
                          />
                        </div>
                      )
                    })}
                  </div>
                  
                  {/* Divider between groups (except last group) - only when expanded */}
                  {shouldShowExpanded && groupIndex < filteredNavigationGroups.length - 1 && (
                    <div className="mt-4 mb-2">
                      <div className="border-t border-gray-100"></div>
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>
          
          {/* User Profile Section - Fixed at bottom */}
          <div className="absolute bottom-0 left-0 right-0 border-t border-gray-100 bg-white/95 backdrop-blur-sm" style={{height: '70px'}}>
            <div className="relative p-2.5">
                {shouldShowExpanded ? (
                  <button
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-gray-50/80 transition-all duration-200 group"
                  >
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <Suspense fallback={<div className="h-4 w-4 bg-gray-200 rounded "></div>}>
                      <OptimizedIcons.User className="h-4 w-4 text-white" />
                    </Suspense>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-xs font-medium text-gray-900 truncate">
                        {user?.role === 'superadmin' ? 'Super Administrator' : 
                         user?.role === 'admin' ? 'Administrator' :
                         user?.role === 'gudang' ? 'Gudang' : 
                         user?.role === 'user' ? 'User' : 
                         user?.role === 'technician' ? 'Technician' : user?.name || user?.email?.split('@')[0]}
                      </p>
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                        <span className="text-[10px] text-gray-500">Aktif</span>
                      </div>
                    </div>
                    {profileDropdownOpen ? (
                      <Suspense fallback={<div className="h-3.5 w-3.5 bg-gray-200 rounded "></div>}>
                        <OptimizedIcons.ChevronUp className="h-3.5 w-3.5 text-gray-400 group-hover:text-gray-600" />
                      </Suspense>
                    ) : (
                      <Suspense fallback={<div className="h-3.5 w-3.5 bg-gray-200 rounded "></div>}>
                        <OptimizedIcons.ChevronDown className="h-3.5 w-3.5 text-gray-400 group-hover:text-gray-600" />
                      </Suspense>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    className="w-full flex justify-center p-2 rounded-xl hover:bg-gray-50/80 transition-all duration-200 relative"
                    title={user?.name || user?.email}
                  >
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <Suspense fallback={<div className="h-4 w-4 bg-gray-200 rounded "></div>}>
                      <OptimizedIcons.User className="h-4 w-4 text-white" />
                    </Suspense>
                    </div>
                    <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-white" />
                  </button>
                )}
                
                {/* Profile dropdown menu */}
                {profileDropdownOpen && (
                  <div className={`absolute bottom-full mb-2 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-100 py-2 z-50 ${
                    shouldShowExpanded ? 'left-0 right-0' : 'left-1/2 transform -translate-x-1/2 w-64'
                  }`}>
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-xs text-gray-500">Masuk sebagai</p>
                      <p className="text-sm font-medium text-gray-900 truncate">{user?.email}</p>
                      <div className="text-xs text-blue-600 font-medium capitalize">
                        {user?.role === 'superadmin' ? 'Super Admin' : 
                         user?.role === 'admin' ? 'Admin' :
                         user?.role === 'gudang' ? 'Gudang' : 
                         user?.role === 'user' ? 'Pengguna' : user?.role}
                      </div>
                    </div>
                    <Link 
                      href="/profile" 
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <Suspense fallback={<div className="h-4 w-4 mr-3 bg-gray-200 rounded "></div>}>
                      <OptimizedIcons.Settings className="h-4 w-4 mr-3 text-gray-500" />
                    </Suspense>
                      Pengaturan Profil
                    </Link>
                    <button 
                      onClick={() => {
                        setProfileDropdownOpen(false)
                        logout()
                      }}
                      className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Suspense fallback={<div className="h-4 w-4 mr-3 bg-gray-200 rounded "></div>}>
                      <OptimizedIcons.LogOut className="h-4 w-4 mr-3" />
                    </Suspense>
                      Keluar
                    </button>
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={`flex flex-col flex-1 transition-all duration-300 ease-out ${
        shouldShowExpanded ? 'lg:pl-72' : 'lg:pl-20'
      }`}>
        {/* Mobile header */}
        <div className="sticky top-0 z-10 lg:hidden bg-white/98 backdrop-blur-xl border-b border-gray-200/20 shadow-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              type="button"
              className="p-2 rounded-xl bg-gray-50/80 hover:bg-gray-100/80 text-gray-500 hover:text-gray-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-sm hover:shadow-md"
              onClick={() => setSidebarOpen(true)}
            >
              <Suspense fallback={<div className="h-5 w-5 bg-gray-200 rounded "></div>}>
                <OptimizedIcons.Menu className={`${SIDEBAR_CONSTANTS.ICON_SIZE}`} />
              </Suspense>
            </button>
            
            <div className="text-center">
              <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                UNNET
              </h1>
            </div>
            
            <div className="w-9" /> {/* Spacer for centering */}
          </div>
        </div>
        
        <main className="flex-1 min-h-0">
          <div className="h-full">
            <div className="container-responsive section-padding h-full">
              {title && (
                <div className="mb-8">
                  <div className="page-header rounded-2xl p-6 mb-6">
                    <h1 className="page-title">{title}</h1>
                    <div className="flex items-center mt-2 space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full " />
                      <span className="text-sm text-gray-600">Sistem Aktif</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="h-full">
                {children}
              </div>
            </div>
          </div>
        </main>
      </div>
      
      {/* Development Tools - Only in development mode */}
      <DevTools />
    </div>
  )
}

