import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../../contexts/AuthContext'
import { useRealtime } from '../../contexts/RealtimeContext'
import { useRealtimeData } from '../../hooks/useRealtimeData'
import Layout from '../../components/Layout'
import ProtectedRoute from '../../components/ProtectedRoute'
import Breadcrumb from '../../components/Breadcrumb'
import { api } from '../../lib/api'
import { 
  Search, 
  Filter, 
  Plus, 
  Eye, 
  Edit, 
  Trash2,
  Clock,
  CheckCircle,
  AlertTriangle,
  User,
  Phone,
  MapPin,
  Calendar,
  WifiOff,
  ArrowLeft,
  AlertCircle,
  Activity,
  TrendingUp
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function GangguanPage() {
  const { user } = useAuth()
  const { isConnected } = useRealtime()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  // Read query parameters from URL
  useEffect(() => {
    const { status, search: searchQuery } = router.query
    
    if (status) setStatusFilter(status as string)
    if (searchQuery) setSearch(searchQuery as string)
  }, [router.query])

  // Real-time data hook - only GANGGUAN jobs
  const endpoint = `/jobs?${new URLSearchParams({
    category: 'GANGGUAN',
    ...(search && { search }),
    ...(statusFilter && { status: statusFilter }),
    page: page.toString(),
    limit: '10'
  }).toString()}`
  
  const { data: jobsData, total: totalCount, loading: isLoading, updateData, setData: setJobsData, refetch } = useRealtimeData<any>({
    endpoint,
    dependencies: [search, statusFilter, page]
  })


  const handleDeleteJob = useCallback(async (jobId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus tiket gangguan ini?')) {
      return
    }

    try {
      await api.delete(`/jobs/${jobId}`)
      toast.success('Tiket gangguan berhasil dihapus!')
      setJobsData((prev: any[]) => prev.filter((job: any) => job.id !== jobId))
    } catch (error: any) {
      console.error('Error deleting job:', error)
      toast.error('Gagal menghapus tiket gangguan')
    }
  }, [setJobsData])

  const jobs = Array.isArray(jobsData) ? jobsData : []
  const totalPages = Math.ceil((totalCount || 0) / 10)

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

  const getStatusText = (status: string) => {
    const texts = {
      OPEN: 'Terbuka',
      ASSIGNED: 'Ditugaskan',
      IN_PROGRESS: 'Dikerjakan',
      COMPLETED: 'Selesai',
      CANCELLED: 'Dibatalkan',
    }
    return texts[status as keyof typeof texts] || status
  }

  const getPriorityBadge = (priority: string) => {
    const badges = {
      LOW: 'badge-gray',
      MEDIUM: 'badge-info',
      HIGH: 'badge-warning',
      URGENT: 'badge-danger',
    }
    return badges[priority as keyof typeof badges] || 'badge-gray'
  }

  const getProblemTypeText = (problemType: string) => {
    const types = {
      modem_rusak: 'Modem Rusak',
      kabel_putus: 'Kabel Putus',
      redaman_tinggi: 'Redaman Tinggi',
      ganti_modem_cas: 'Ganti Modem/CAS Rusak',
      masalah_settingan: 'Masalah Settingan',
      internet_lambat: 'Internet Lambat'
    }
    return types[problemType as keyof typeof types] || problemType
  }

  return (
    <ProtectedRoute>
      <Layout title="Tiket Gangguan">
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50/30 to-orange-50/40">
          <div className="container-responsive">
            <div className="space-y-8 py-6">
              {/* Breadcrumb */}
              <Breadcrumb 
                items={[
                  { name: 'Pekerjaan', href: '/jobs' },
                  { name: 'Tiket Gangguan', current: true }
                ]} 
              />
              
              {/* Modern Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Kembali"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent flex items-center">
                      <WifiOff className="h-7 w-7 mr-3 text-red-600" />
                      Tiket Gangguan
                    </h1>
                    <p className="text-lg text-gray-600">Kelola laporan gangguan WiFi</p>
                  </div>
                </div>
                {user?.role !== 'user' && (
                  <button
                    onClick={() => router.push('/jobs/create?type=gangguan')}
                    className="btn btn-primary"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Buat Tiket Gangguan
                  </button>
                )}
              </div>

              {/* Modern Real-time Status */}
              <div className="card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      isConnected ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <span className="text-sm font-medium text-gray-700">
                      {isConnected ? 'Real-time updates active' : 'Reconnecting...'}
                    </span>
                  </div>
                  <button
                    onClick={refetch}
                    className="btn btn-ghost btn-sm"
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    Refresh
                  </button>
                </div>
              </div>

              {/* Modern Filters */}
              <div className="card">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <Filter className="h-5 w-5 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Filter:</span>
                  </div>
                  <div className="flex-1 flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        className="form-input pl-10"
                        placeholder="Cari tiket gangguan, pelanggan, atau alamat..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    
                    <select
                      className="form-input"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="">Semua Status</option>
                      <option value="OPEN">Terbuka</option>
                      <option value="ASSIGNED">Ditugaskan</option>
                      <option value="IN_PROGRESS">Dikerjakan</option>
                      <option value="COMPLETED">Selesai</option>
                      <option value="CANCELLED">Dibatalkan</option>
                    </select>
                  </div>
                </div>
              </div>

          {/* Jobs Table */}
          <div className="table-container">
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th className="table-cell-nowrap">
                      Tiket Gangguan
                    </th>
                    <th className="table-cell-nowrap">
                      Pelanggan
                    </th>
                    <th className="table-cell-nowrap">
                      Jenis Gangguan
                    </th>
                    <th className="table-cell-nowrap">
                      Teknisi
                    </th>
                    <th className="table-cell-center table-cell-nowrap">
                      Status
                    </th>
                    <th className="table-cell-nowrap">
                      Tanggal
                    </th>
                    <th className="table-cell-center table-cell-nowrap">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="table-cell-center">
                        <div className="flex items-center justify-center">
                          <div className="loading-spinner"></div>
                          <span className="ml-2">Memuat tiket gangguan...</span>
                        </div>
                      </td>
                    </tr>
                  ) : jobs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="table-cell-center text-gray-500">
                        <div className="flex flex-col items-center py-8">
                          <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
                          <p className="text-lg font-medium text-gray-900 mb-2">Tidak ada tiket gangguan</p>
                          <p className="text-gray-500">Laporan gangguan WiFi akan muncul di sini</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    jobs.map((job: any) => (
                      <tr key={job.id} className="hover:bg-gray-50">
                        <td className="table-cell-nowrap">
                          <div>
                            <div className="flex items-center space-x-2">
                              <div className="text-sm font-medium text-gray-900">
                                {job.jobNumber}
                              </div>
                              <span className="badge badge-warning">
                                Gangguan
                              </span>
                              <span className={`badge ${getPriorityBadge(job.priority)}`}>
                                {job.priority}
                              </span>
                            </div>
                            <div className="text-sm text-gray-500 truncate max-w-xs">
                              {job.title}
                            </div>
                          </div>
                        </td>
                        
                        <td className="table-cell-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {job.customer.name}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center">
                              <Phone className="h-4 w-4 mr-1" />
                              {job.customer.phone}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center">
                              <MapPin className="h-4 w-4 mr-1" />
                              <span className="truncate max-w-xs">{job.address}</span>
                            </div>
                          </div>
                        </td>
                        
                        <td className="table-cell-nowrap">
                          <div className="flex items-center">
                            <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
                            <span className="text-sm text-gray-900">
                              {getProblemTypeText(job.problemType)}
                            </span>
                          </div>
                        </td>
                        
                        <td className="table-cell-nowrap">
                          <div>
                            {job.technicians.length === 0 ? (
                              <div>
                                <span className="text-sm text-gray-500">Belum ditugaskan</span>
                                <div className="text-xs text-green-600 mt-1">
                                  📋 Tersedia (0/1 teknisi)
                                </div>
                              </div>
                            ) : (
                              <div>
                                {job.technicians.map((jt: any, index: number) => (
                                  <div key={jt.id} className="text-sm text-gray-900 mb-1">
                                    <div className="flex items-center">
                                      <User className="h-4 w-4 mr-1" />
                                      {jt.technician.name}
                                    </div>
                                  </div>
                                ))}
                                <div className="text-xs text-blue-600 mt-1">
                                  🔧 {job.technicians.length}/1 teknisi ditugaskan
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        
                        <td className="table-cell-center">
                          <span className={`badge ${getStatusBadge(job.status)}`}>
                            {getStatusText(job.status)}
                          </span>
                        </td>
                        
                        <td className="table-cell-nowrap">
                          {new Date(job.createdAt).toLocaleDateString('id-ID')}
                        </td>
                        
                        <td className="table-cell-center">
                          <div className="table-actions">
                            <button
                              onClick={() => router.push(`/jobs/${job.id}`)}
                              className="table-action-btn-view"
                              title="Lihat Detail"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {(user?.role === 'admin' || user?.role === 'superadmin') && (
                              <>
                                <button
                                  onClick={() => router.push(`/jobs/${job.id}/edit`)}
                                  className="table-action-btn-edit"
                                  title="Edit Tiket"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteJob(job.id)}
                                  className="table-action-btn-delete"
                                  title="Hapus Tiket"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Menampilkan {((page - 1) * 10) + 1} sampai {Math.min(page * 10, totalCount || 0)} dari {totalCount || 0} tiket
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sebelumnya
                  </button>
                  <span className="px-3 py-1 text-sm bg-primary-100 text-primary-800 rounded-md">
                    {page} dari {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Selanjutnya
                  </button>
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
