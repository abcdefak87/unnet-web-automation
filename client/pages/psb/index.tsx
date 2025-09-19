import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../../contexts/AuthContext'
import { useRealtime } from '../../contexts/RealtimeContext'
import { useRealtimeData } from '../../hooks/useRealtimeData'
import Layout from '../../components/Layout'
import ProtectedRoute from '../../components/ProtectedRoute'
import Breadcrumb from '../../components/Breadcrumb'
import { api, jobsAPI } from '../../lib/api'
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
  Ticket,
  Wifi,
  ArrowLeft,
  Activity,
  TrendingUp,
  CheckCircle2
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function PSBPage() {
  const { user } = useAuth()
  const { isConnected } = useRealtime()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const isTech = user?.role === 'user' || user?.role === 'technician'

  // Read query parameters from URL
  useEffect(() => {
    const { status, search: searchQuery } = router.query
    
    if (status) setStatusFilter(status as string)
    if (searchQuery) setSearch(searchQuery as string)
  }, [router.query])

  // Real-time data hook - only PSB jobs
  const endpoint = `/jobs?${new URLSearchParams({
    category: 'PSB',
    ...(search && { search }),
    ...(statusFilter && { status: statusFilter }),
    page: page.toString(),
    limit: '10'
  }).toString()}`
  
  const { data: jobs, total: totalCount, loading: isLoading, setData, refetch } = useRealtimeData<any>({
    endpoint,
    dependencies: [search, statusFilter, page]
  })

  const handleDeleteJob = useCallback(async (jobId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus tiket PSB ini?')) {
      return
    }

    try {
      await api.delete(`/jobs/${jobId}`)
      toast.success('Tiket PSB berhasil dihapus!')
      setData((prev: any[]) => prev.filter((job: any) => job.id !== jobId))
    } catch (error: any) {
      console.error('Error deleting job:', error)
      toast.error('Gagal menghapus tiket PSB')
    }
  }, [setData])

  const handleAssignJob = async (jobId: string) => {
    try {
      const idsInput = prompt('Masukkan ID teknisi, pisahkan dengan koma (maks 2):')
      if (!idsInput) return
      const technicianIds = idsInput.split(',').map(s => s.trim()).filter(Boolean)
      if (technicianIds.length === 0 || technicianIds.length > 2) {
        toast.error('Jumlah teknisi harus 1 atau 2')
        return
      }
      const dateInput = prompt('Jadwal (opsional, format YYYY-MM-DDTHH:mm):')
      const payload: any = { technicianIds }
      if (dateInput) payload.scheduledDate = new Date(dateInput).toISOString()
      await jobsAPI.assign(jobId, payload)
      toast.success('Teknisi berhasil ditugaskan!')
      await refetch()
    } catch (error) {
      console.error('Assign error:', error)
      toast.error('Gagal menugaskan teknisi')
    }
  }

  const handleConfirmAssignment = async (jobId: string, action: 'ACCEPT' | 'DECLINE') => {
    try {
      await jobsAPI.confirm(jobId, { action })
      toast.success(action === 'ACCEPT' ? 'Penugasan diterima!' : 'Penugasan ditolak!')
      await refetch()
    } catch (error) {
      console.error('Confirm error:', error)
      toast.error('Gagal konfirmasi penugasan')
    }
  }

  const handleSelfAssign = async (jobId: string) => {
    try {
      await jobsAPI.selfAssign(jobId)
      toast.success('Berhasil mengambil tiket!')
      await refetch()
    } catch (error) {
      console.error('Self-assign error:', error)
      toast.error('Gagal mengambil tiket')
    }
  }

  const limit = 10
  const totalPages = Math.ceil((totalCount || 0) / limit)

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

  return (
    <ProtectedRoute>
      <Layout title="Tiket PSB">
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
          <div className="container-responsive">
            <div className="space-y-8 py-6">
              {/* Breadcrumb */}
              <Breadcrumb 
                items={[
                  { name: 'Pekerjaan', href: '/jobs' },
                  { name: 'Tiket PSB', current: true }
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
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center">
                      <Ticket className="h-7 w-7 mr-3 text-blue-600" />
                      Tiket PSB
                    </h1>
                    <p className="text-lg text-gray-600">Kelola tiket pemasangan WiFi</p>
                  </div>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => router.push('/jobs/create?type=psb')}
                    className="btn btn-primary"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Buat Tiket PSB
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
                        placeholder="Cari tiket PSB, pelanggan, atau alamat..."
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
                      Tiket PSB
                    </th>
                    <th className="table-cell-nowrap">
                      Pelanggan
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
                      <td colSpan={6} className="table-cell-center">
                        <div className="flex items-center justify-center">
                          <div className="loading-spinner"></div>
                          <span className="ml-2">Memuat tiket PSB...</span>
                        </div>
                      </td>
                    </tr>
                  ) : jobs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="table-cell-center text-gray-500">
                        Tidak ada tiket PSB ditemukan
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
                              <span className="badge badge-info">
                                PSB
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
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => router.push(`/jobs/${job.id}/edit`)}
                                  className="table-action-btn-edit"
                                  title="Edit Tiket"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                {job.status === 'OPEN' && (
                                  <button
                                    onClick={() => handleAssignJob(job.id)}
                                    className="table-action-btn-view"
                                    title="Assign Teknisi"
                                  >
                                    <User className="h-4 w-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteJob(job.id)}
                                  className="table-action-btn-delete"
                                  title="Hapus Tiket"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            {isTech && (job.status === 'OPEN' || (job.status === 'ASSIGNED' && (job.technicians?.length || 0) < 2)) && (
                              <button
                                onClick={() => handleSelfAssign(job.id)}
                                className="table-action-btn-view"
                                title="Ambil Tiket (self-assign)"
                              >
                                <User className="h-4 w-4" />
                              </button>
                            )}
                            {isTech && job.status === 'ASSIGNED' && (
                              <>
                                <button
                                  onClick={() => handleConfirmAssignment(job.id, 'ACCEPT')}
                                  className="table-action-btn-view"
                                  title="Terima Penugasan"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleConfirmAssignment(job.id, 'DECLINE')}
                                  className="table-action-btn-delete"
                                  title="Tolak Penugasan"
                                >
                                  <AlertTriangle className="h-4 w-4" />
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
                  Menampilkan {((page - 1) * limit) + 1} sampai {Math.min(page * limit, totalCount || 0)} dari {totalCount || 0} tiket
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
