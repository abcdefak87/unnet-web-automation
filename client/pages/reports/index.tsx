import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../../contexts/AuthContext'
import Layout from '../../components/Layout'
import ProtectedRoute from '../../components/ProtectedRoute'
import { api } from '../../lib/api'
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Package, 
  Calendar,
  Download,
  Filter,
  Activity,
  Clock,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react'

export default function Reports() {
  const { user } = useAuth()
  const router = useRouter()
  const [reportType, setReportType] = useState('dashboard')
  const [dateRange, setDateRange] = useState('30')
  const [reportData, setReportData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchReportData = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await api.get(`/reports/${reportType}?days=${dateRange}`)
      setReportData(response.data)
    } catch (error: any) {
      console.error('Failed to fetch report data:', error)
      if (error.response?.status === 403) {
        console.error('Access denied - insufficient permissions for reports')
      }
    } finally {
      setIsLoading(false)
    }
  }, [reportType, dateRange])

  useEffect(() => {
    fetchReportData()
  }, [fetchReportData])

  // Memoized stats cards untuk performa yang lebih baik
  const statsCards = useMemo(() => [
    {
      title: 'Total Jobs',
      value: reportData?.totalJobs || 0,
      icon: BarChart3,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-600'
    },
    {
      title: 'Completion Rate',
      value: `${reportData?.completionRate || 0}%`,
      icon: TrendingUp,
      color: 'bg-green-500',
      bgColor: 'bg-green-100',
      textColor: 'text-green-600'
    },
    {
      title: 'Active Technicians',
      value: reportData?.activeTechnicians || 0,
      icon: Users,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-100',
      textColor: 'text-purple-600'
    },
    {
      title: 'Inventory Value',
      value: `Rp ${(reportData?.inventoryValue || 0).toLocaleString('id-ID')}`,
      icon: Package,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-100',
      textColor: 'text-orange-600'
    }
  ], [reportData])

  return (
    <ProtectedRoute>
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
          <div className="container-responsive">
            <div className="space-y-8 py-6">
              {/* Modern Header */}
              <div className="text-center sm:text-left">
                <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                  Laporan & Analytics
                </h1>
                <p className="text-lg text-gray-600">Analisis performa dan statistik sistem</p>
              </div>
              
              {/* Modern Controls */}
              <div className="card">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Filter className="h-5 w-5 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Filter:</span>
                    </div>
                    <select
                      value={reportType}
                      onChange={(e) => setReportType(e.target.value)}
                      className="form-input"
                    >
                      <option value="dashboard">Dashboard</option>
                      <option value="jobs">Laporan Jobs</option>
                      <option value="inventory">Laporan Inventory</option>
                      <option value="technicians">Performa Teknisi</option>
                    </select>
                    
                    <select
                      value={dateRange}
                      onChange={(e) => setDateRange(e.target.value)}
                      className="form-input"
                    >
                      <option value="7">7 Hari Terakhir</option>
                      <option value="30">30 Hari Terakhir</option>
                      <option value="90">3 Bulan Terakhir</option>
                      <option value="365">1 Tahun Terakhir</option>
                    </select>
                  </div>
                  
                  <button className="btn btn-primary">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </button>
                </div>
              </div>

              {/* Modern Stats Cards */}
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="loading-spinner"></div>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Stats Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    {statsCards.map((stat, index) => {
                      const Icon = stat.icon
                      return (
                        <div key={index} className="card">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                              <p className="mt-1 text-3xl font-bold text-gray-900">{stat.value}</p>
                            </div>
                            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bgColor}`}>
                              <Icon className={`h-6 w-6 ${stat.textColor}`} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Charts Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="card">
                      <div className="card-header">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                          <Activity className="h-5 w-5 mr-2 text-blue-600" />
                          Jobs Trend
                        </h3>
                      </div>
                      <div className="card-body">
                        <div className="h-64 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg flex items-center justify-center">
                          <div className="text-center">
                            <BarChart3 className="h-12 w-12 text-blue-400 mx-auto mb-2" />
                            <p className="text-gray-500">Chart akan ditampilkan di sini</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="card">
                      <div className="card-header">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                          <Users className="h-5 w-5 mr-2 text-purple-600" />
                          Technician Performance
                        </h3>
                      </div>
                      <div className="card-body">
                        <div className="h-64 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg flex items-center justify-center">
                          <div className="text-center">
                            <TrendingUp className="h-12 w-12 text-purple-400 mx-auto mb-2" />
                            <p className="text-gray-500">Chart akan ditampilkan di sini</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}

