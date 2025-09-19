import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../../contexts/AuthContext'
import { useRealtime } from '../../contexts/RealtimeContext'
import { useRealtimeData } from '../../hooks/useRealtimeData'
import Layout from '../../components/Layout'
import ProtectedRoute from '../../components/ProtectedRoute'
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
  Ticket,
  Wifi,
  ArrowLeft,
  Award
} from 'lucide-react'

export default function PSBCompletedPage() {
  const { user } = useAuth()
  const { isConnected } = useRealtime()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // Read query parameters from URL
  useEffect(() => {
    const { search: searchQuery } = router.query
    
    if (searchQuery) setSearch(searchQuery as string)
  }, [router.query])

  // Real-time data hook - only completed PSB jobs
  const endpoint = `/jobs?${new URLSearchParams({
    category: 'PSB',
    status: 'COMPLETED',
    ...(search && { search }),
    page: page.toString(),
    limit: '10'
  }).toString()}`
  
  const { data: jobs, total: totalCount, loading: isLoading, setData: setJobsData, refetch } = useRealtimeData<any>({
    endpoint,
    dependencies: [search, page]
  })

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus tiket PSB ini?')) {
      return
    }

    try {
      await api.delete(`/jobs/${jobId}`)
      setJobsData((prev: any[]) => prev.filter((job: any) => job.id !== jobId))
    } catch (error: any) {
      console.error('Error deleting job:', error)
      alert('Gagal menghapus tiket PSB')
    }
  }

  const limit = 10
  const totalPages = Math.ceil((totalCount || 0) / limit)

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
      <Layout title="PSB Terpasang">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Kembali"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                  <Award className="h-6 w-6 mr-2 text-green-600" />
                  PSB Terpasang
                </h1>
                <p className="text-gray-600">Tiket PSB yang sudah berhasil dipasang</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => router.push('/psb')}
                className="btn-secondary"
              >
                <Ticket className="h-5 w-5 mr-2" />
                Semua PSB
              </button>
              {user?.role !== 'user' && (
                <button
                  onClick={() => router.push('/jobs/create?type=psb')}
                  className="btn-primary"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Buat Tiket PSB
                </button>
              )}
            </div>
          </div>

          {/* Real-time Status Indicator */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-sm text-gray-600">
                {isConnected ? '🔗 Real-time updates active' : '🔌 Reconnecting...'}
              </span>
            </div>
            <button
              onClick={refetch}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              🔄 Refresh
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-800">Total Terpasang</p>
                  <p className="text-2xl font-bold text-green-900">{jobs.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <Wifi className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-800">Bulan Ini</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {jobs.filter((job: any) => {
                      const jobDate = new Date(job.completedAt || job.createdAt)
                      const now = new Date()
                      return jobDate.getMonth() === now.getMonth() && 
                             jobDate.getFullYear() === now.getFullYear()
                    }).length}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center">
                <Award className="h-8 w-8 text-purple-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-purple-800">Rata-rata</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {jobs.length > 0 ? Math.round(jobs.length / 30) : 0}/hari
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="form-input pl-10"
                placeholder="Cari tiket PSB yang sudah terpasang..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Jobs Table */}
          <div className="card">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tiket PSB
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pelanggan
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Teknisi
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tanggal Selesai
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                          <span className="ml-2">Memuat tiket PSB...</span>
                        </div>
                      </td>
                    </tr>
                  ) : jobs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                        <div className="flex flex-col items-center py-8">
                          <Award className="h-12 w-12 text-gray-400 mb-4" />
                          <p className="text-lg font-medium text-gray-900 mb-2">Belum ada PSB yang terpasang</p>
                          <p className="text-gray-500">Tiket PSB yang sudah selesai akan muncul di sini</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    jobs.map((job: any) => (
                      <tr key={job.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="flex items-center space-x-2">
                              <div className="text-sm font-medium text-gray-900">
                                {job.jobNumber}
                              </div>
                              <span className="badge badge-success">
                                Terpasang
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
                        
                        <td className="px-6 py-4 whitespace-nowrap">
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
                        
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            {job.technicians.length === 0 ? (
                              <span className="text-sm text-gray-500">Tidak ada teknisi</span>
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
                              </div>
                            )}
                          </div>
                        </td>
                        
                        <td className="table-cell-nowrap">
                          <div className="flex items-center text-sm text-gray-900">
                            <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                            {job.completedAt ? 
                              new Date(job.completedAt).toLocaleDateString('id-ID') : 
                              new Date(job.createdAt).toLocaleDateString('id-ID')
                            }
                          </div>
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
                              <button
                                onClick={() => handleDeleteJob(job.id)}
                                className="table-action-btn-delete"
                                title="Hapus Tiket"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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
      </Layout>
    </ProtectedRoute>
  )
}
