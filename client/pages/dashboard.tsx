import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import ProtectedRoute from '../components/ProtectedRoute'
import EmptyState from '../components/EmptyState'
import { DashboardSkeleton } from '../components/SkeletonLoader'
import { LoadingErrorFallback } from '../components/ErrorFallback'
import { useAuth } from '../contexts/AuthContext'
import { api, customersAPI } from '../lib/api'
import websocketService from '../lib/websocket'
import { OptimizedIcons } from '../lib/optimizedIcons'
import { Suspense } from 'react'
import { Users } from 'lucide-react'

// Enhanced loading skeleton component with modern design - Mobile Optimized
const StatCardSkeleton = () => (
  <div className="card min-h-[120px] sm:min-h-[140px]">
    <div className="flex items-center justify-between h-full">
      <div className="flex-1">
        <div className="h-3 sm:h-4 bg-gray-200 rounded w-20 sm:w-24 mb-2"></div>
        <div className="h-6 sm:h-8 bg-gray-200 rounded w-12 sm:w-16 mb-2"></div>
        <div className="h-2.5 sm:h-3 bg-gray-200 rounded w-16 sm:w-20"></div>
      </div>
      <div className="h-10 w-10 sm:h-12 sm:w-12 bg-gray-200 rounded-xl"></div>
    </div>
  </div>
)

// Modern stat card component - Mobile Optimized
const StatCard = ({ stat, onClick }: { stat: any, onClick: () => void }) => {
  const Icon = stat.icon
  return (
    <div 
      className="card card-interactive group cursor-pointer min-h-[120px] sm:min-h-[140px]"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      title={`Klik untuk melihat ${stat.name.toLowerCase()}`}
    >
      <div className="flex items-center justify-between h-full">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{stat.name}</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-gray-900">{stat.value ?? 0}</p>
          <div className="mt-2">
            <span className="inline-flex items-center rounded-full bg-gray-50 px-2 sm:px-2.5 py-1 text-xs font-medium text-gray-600">
              {Number(stat.value) > 0 ? (stat.change || 'Tersedia') : 'Belum ada data'}
            </span>
          </div>
        </div>
        <div className={`flex h-10 w-10 sm:h-12 sm:w-12 flex-none items-center justify-center rounded-xl ${stat.color} text-white shadow-lg transition-transform duration-200`}>
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
      </div>
    </div>
  )
}

// Enhanced error fallback component - Mobile Optimized
const ErrorFallback = ({ error, resetError }: { error: Error, resetError: () => void }) => (
  <div className="card bg-red-50 border-red-200">
    <div className="text-center p-4 sm:p-6">
        <Suspense fallback={<div className="h-10 w-10 sm:h-12 sm:w-12 bg-gray-200 rounded mx-auto mb-4"></div>}>
        <OptimizedIcons.AlertTriangle className="h-10 w-10 sm:h-12 sm:w-12 text-red-500 mx-auto mb-4" />
      </Suspense>
      <h3 className="text-lg sm:text-xl font-semibold text-red-800 mb-2">Terjadi Kesalahan</h3>
      <p className="text-sm sm:text-base text-red-600 mb-4">{error?.message || 'Gagal memuat data'}</p>
      <button 
        onClick={resetError}
        className="btn btn-danger min-h-[44px] text-sm sm:text-base"
      >
        Coba Lagi
      </button>
    </div>
  </div>
)

export default function Dashboard() {
  const router = useRouter()
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const isGudang = user?.role === 'gudang'
  const isTech = user?.role === 'technician' || user?.role === 'user'
  const [customers, setCustomers] = useState<any[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)

  const fetchDashboard = useCallback(async () => {
    try {
      setError(null)
      setIsLoading(true)

      // Cancel previous request if exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController()

      if (isAdmin) {
        // Admin/superadmin use reports endpoint
        const response = await api.get('/reports/dashboard', {
          signal: abortControllerRef.current.signal
        })
        setDashboardData(response.data)
      } else if (!isGudang) {
        // Everyone except gudang uses dashboard stats endpoint
        const res = await api.get('/dashboard/stats', {
          signal: abortControllerRef.current.signal
        })
        const d = res.data || {}
        // Normalize into the same shape used by the UI (response.data.data.stats ...)
        const normalized = {
          success: true,
          data: {
            stats: {
              totalCustomers: d.customers?.total ?? 0,
              totalTechnicians: d.technicians?.total ?? 0,
              activeTechnicians: d.technicians?.active ?? 0,
              lowStockItems: d.inventory?.lowStock ?? 0,
              psbPending: d.psb?.pending ?? 0,
              psbCompleted: d.psb?.completed ?? 0,
              gangguanPending: d.gangguan?.pending ?? 0,
              gangguanCompleted: d.gangguan?.completed ?? 0,
              // Back-compat fields
              openJobs: d.jobs?.pending ?? 0,
              completedJobs: d.jobs?.completed ?? 0,
              totalJobs: d.jobs?.total ?? 0,
              todayJobs: 0,
              thisMonthJobs: 0
            },
            recentJobs: [],
            topTechnicians: []
          }
        }
        setDashboardData(normalized)
      } else {
        // Gudang: no dashboard fetch
        setDashboardData(null)
      }
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err)
      if (err.name === 'AbortError' || err.message?.includes('Abort')) {
        console.log('Request was cancelled, ignoring error')
        return
      }
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [isAdmin, isGudang])

  const resetError = useCallback(() => {
    setError(null)
    setIsLoading(true)
    fetchDashboard()
  }, [fetchDashboard])

  useEffect(() => {
    // Only fetch if component is mounted and user exists
    if (typeof window !== 'undefined' && user) {
      const timer = setTimeout(() => {
        fetchDashboard()
      }, 100)
      
      return () => clearTimeout(timer)
    }
  }, [user, isAdmin, isGudang, fetchDashboard])

  // Fetch customers (latest) for list
  useEffect(() => {
    const load = async () => {
      try {
        setLoadingCustomers(true)
        const res = await customersAPI.getAll({ page: 1, limit: 6 })
        const payload = res.data?.data
        const list = payload?.customers || payload || []
        setCustomers(Array.isArray(list) ? list.slice(0, 6) : [])
      } catch (e) {
        console.error('Fetch customers error:', e)
        setCustomers([])
      } finally {
        setLoadingCustomers(false)
      }
    }
    load()
  }, [])

  // Setup WebSocket for real-time updates
  useEffect(() => {
    if (!user) return

    // Connect to WebSocket
    websocketService.connect(user.id.toString(), user.role)

    const jobUpdateCallback = (data: any) => {
      console.log('Real-time job update:', data)
      if (!isGudang) fetchDashboard()
    }

    const inventoryUpdateCallback = (data: any) => {
      console.log('Real-time inventory update:', data)
      if (!isGudang) fetchDashboard()
    }

    websocketService.onJobUpdate(jobUpdateCallback)
    websocketService.onInventoryUpdate(inventoryUpdateCallback)

    return () => {
      websocketService.offJobUpdate(jobUpdateCallback)
      websocketService.offInventoryUpdate(inventoryUpdateCallback)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [user, isGudang, fetchDashboard])

  // Memoized data extraction untuk performa yang lebih baik
  const { stats, recentJobs, topTechnicians } = useMemo(() => ({
    stats: dashboardData?.data?.stats || {},
    recentJobs: dashboardData?.data?.recentJobs || [],
    topTechnicians: dashboardData?.data?.topTechnicians || []
  }), [dashboardData])

  // Memoized primary stats untuk performa yang lebih baik
  const primaryStats = useMemo(() => [
    {
      name: 'Tiket PSB',
      value: stats.psbPending || 0,
      icon: OptimizedIcons.Ticket,
      color: 'bg-gradient-to-r from-blue-500 to-blue-600',
      change: 'Menunggu pemasangan',
      description: 'Orang yang mau pasang WiFi',
      route: '/psb'
    },
    {
      name: 'PSB Terpasang',
      value: stats.psbCompleted || 0,
      icon: OptimizedIcons.Wifi,
      color: 'bg-gradient-to-r from-green-500 to-green-600',
      change: 'Berhasil dipasang',
      description: 'Yang sudah dipasang',
      route: '/psb/completed'
    },
    {
      name: 'Tiket Gangguan',
      value: stats.gangguanPending || 0,
      icon: OptimizedIcons.WifiOff,
      color: 'bg-gradient-to-r from-red-500 to-red-600',
      change: 'Menunggu perbaikan',
      description: 'Laporan gangguan WiFi',
      route: '/gangguan'
    },
    {
      name: 'Tiket Teratasi',
      value: stats.gangguanCompleted || 0,
      icon: OptimizedIcons.Shield,
      color: 'bg-gradient-to-r from-purple-500 to-purple-600',
      change: 'Berhasil diperbaiki',
      description: 'Yang sudah diperbaiki',
      route: '/gangguan/completed'
    }
  ], [stats])

  // Informasi Sistem dan stok rendah dihilangkan dari dashboard ini

  const getStatusBadge = (status: string) => {
    const badges = {
      OPEN: 'badge-warning',
      ASSIGNED: 'badge-info',
      IN_PROGRESS: 'badge-info',
      COMPLETED: 'badge-success',
      CANCELLED: 'badge-danger',
    }
    return badges[status as keyof typeof badges] || 'badge-gray'
  }

  const getTypeBadge = (type: string, category: string) => {
    if (category === 'PSB') return 'badge-info'
    if (category === 'GANGGUAN') return 'badge-warning'
    return type === 'INSTALLATION' ? 'badge-info' : 'badge-warning'
  }

  const getCategoryLabel = (category: string) => {
    return category === 'PSB' ? 'PSB' : 'Gangguan'
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
          <div className="container-responsive">
            <div className="space-y-6 sm:space-y-8 py-4 sm:py-6">
            {/* Modern Header - Mobile Optimized */}
            <div className="text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                Dashboard Tiket
              </h1>
              <p className="text-sm sm:text-base lg:text-lg text-gray-600 px-4 sm:px-0">Sistem manajemen tiket PSB dan gangguan WiFi</p>
            </div>

            {/* Modern Statistik Utama - Mobile Optimized */}
            <div className="space-y-4 sm:space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center justify-center sm:justify-start">
                  <Suspense fallback={<div className="h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3 bg-gray-200 rounded "></div>}>
                    <OptimizedIcons.Activity className="h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3 text-blue-600" />
                  </Suspense>
                  Status Tiket
                </h2>
                <div className="flex items-center justify-center sm:justify-end space-x-2 text-xs sm:text-sm text-gray-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full "></div>
                  <span>Real-time</span>
                </div>
              </div>
              
              {error ? (
                <LoadingErrorFallback 
                  retry={resetError} 
                  message="Gagal memuat data dashboard" 
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  {isLoading ? (
                    // Show skeleton loading cards
                    Array.from({ length: 4 }).map((_, index) => (
                      <StatCardSkeleton key={index} />
                    ))
                  ) : (
                    primaryStats.map((stat) => (
                      <StatCard 
                        key={stat.name} 
                        stat={stat} 
                        onClick={() => router.push(stat.route)} 
                      />
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Informasi Sistem dihapus */}

            {/* Modern Daftar Pelanggan - Mobile Optimized */}
            <div className="card">
              <div className="card-header bg-gradient-to-r from-blue-50 to-indigo-50 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-4 sm:mb-6 rounded-t-xl p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                  <div className="text-center sm:text-left">
                    <h3 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center justify-center sm:justify-start">
                      <Suspense fallback={<div className="h-4 w-4 sm:h-5 sm:w-5 mr-2 bg-gray-200 rounded"></div>}>
                        <OptimizedIcons.Users className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-blue-600" />
                      </Suspense>
                      Daftar Pelanggan
                    </h3>
                    <p className="mt-1 text-xs sm:text-sm text-gray-600">Pelanggan terbaru yang terdaftar</p>
                  </div>
                  <div className="flex items-center justify-center sm:justify-end space-x-2">
                    <Suspense fallback={<div className="h-3 w-3 sm:h-4 sm:w-4 bg-gray-200 rounded "></div>}>
                      <OptimizedIcons.TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                    </Suspense>
                    <span className="text-xs sm:text-sm text-gray-500">{customers.length} pelanggan</span>
                  </div>
                </div>
              </div>
              <div className="card-body">
                {loadingCustomers ? (
                  <div className="space-y-3 sm:space-y-4">
                    {[1,2,3].map((i) => (
                      <div key={i} className="flex items-center space-x-3 sm:space-x-4 p-3 sm:p-4">
                        <div className="h-8 w-8 sm:h-10 sm:w-10 bg-gray-200 rounded-full flex-shrink-0"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/3"></div>
                          <div className="h-2.5 sm:h-3 bg-gray-200 rounded w-1/2"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : customers.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="Belum ada pelanggan"
                    description="Belum ada data pelanggan yang terdaftar. Pelanggan akan muncul di sini setelah mendaftar."
                    action={
                      <button
                        onClick={() => router.push('/pelanggan')}
                        className="btn btn-primary min-h-[44px] text-sm sm:text-base"
                      >
                        <Suspense fallback={<div className="h-4 w-4 mr-2 bg-gray-200 rounded "></div>}>
                          <OptimizedIcons.UserPlus className="h-4 w-4 mr-2" />
                        </Suspense>
                        Kelola Pelanggan
                      </button>
                    }
                    size="sm"
                  />
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {customers.map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                          <div className="h-8 w-8 sm:h-10 sm:w-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-semibold text-sm sm:text-base flex-shrink-0">
                            {c.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{c.name || 'Tanpa Nama'}</p>
                            <p className="text-xs text-gray-500 truncate">{c.phone || '-'} • {c.address || '-'}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => router.push(`/pelanggan?id=${c.id}`)}
                          className="btn btn-ghost btn-sm min-h-[36px] px-3 sm:px-4 text-xs sm:text-sm flex-shrink-0"
                        >
                          Detail
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="card-footer">
                <button 
                  onClick={() => router.push('/pelanggan')}
                  className="btn btn-outline w-full min-h-[44px] text-sm sm:text-base"
                >
                  Lihat semua pelanggan →
                </button>
              </div>
            </div>
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}

