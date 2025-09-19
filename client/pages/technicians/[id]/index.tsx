import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../../../contexts/AuthContext'
import Layout from '../../../components/Layout'
import ProtectedRoute from '../../../components/ProtectedRoute'
import { api } from '../../../lib/api'
import { 
  ArrowLeft, 
  User, 
  Phone, 
  MapPin, 
  Shield, 
  ShieldCheck, 
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  Edit,
  Trash2,
  MessageCircle,
  Briefcase
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Technician {
  id: string
  name: string
  phone: string
  telegramChatId?: string
  telegramUsername?: string
  isActive: boolean
  isAdmin: boolean
  createdAt: string
  updatedAt: string
  _count?: {
    jobAssignments: number
  }
}

interface JobAssignment {
  id: string
  job: {
    id: string
    customerName: string
    customerAddress: string
    type: string
    status: string
    createdAt: string
  }
  assignedAt: string
  completedAt?: string
}

export default function TechnicianDetailPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { id } = router.query
  const [technician, setTechnician] = useState<Technician | null>(null)
  const [jobAssignments, setJobAssignments] = useState<JobAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [jobsLoading, setJobsLoading] = useState(true)

  useEffect(() => {
    if (id) {
      fetchTechnician()
      fetchJobAssignments()
    }
  }, [id])

  const fetchTechnician = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/technicians/${id}`)
      setTechnician(response.data)
    } catch (error) {
      console.error('Failed to fetch technician:', error)
      toast.error('Gagal memuat data teknisi')
      router.push('/technicians')
    } finally {
      setLoading(false)
    }
  }

  const fetchJobAssignments = async () => {
    try {
      setJobsLoading(true)
      const response = await api.get(`/technicians/${id}/jobs`)
      setJobAssignments(response.data)
    } catch (error) {
      console.error('Failed to fetch job assignments:', error)
    } finally {
      setJobsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!technician) return
    
    if (!confirm(`Apakah Anda yakin ingin menghapus teknisi ${technician.name}?`)) {
      return
    }

    try {
      await api.delete(`/technicians/${id}`)
      toast.success('Teknisi berhasil dihapus')
      router.push('/technicians')
    } catch (error: any) {
      console.error('Failed to delete technician:', error)
      toast.error(error.response?.data?.error || 'Gagal menghapus teknisi')
    }
  }

  const toggleAdminRole = async () => {
    if (!technician) return

    try {
      const response = await api.patch(`/technicians/${id}/admin-role`, {
        isAdmin: !technician.isAdmin
      })
      
      setTechnician(prev => prev ? { ...prev, isAdmin: !prev.isAdmin } : null)
      toast.success(`Role berhasil diubah menjadi ${!technician.isAdmin ? 'Admin Bot' : 'Teknisi Biasa'}`)
    } catch (error: any) {
      console.error('Failed to toggle admin role:', error)
      toast.error(error.response?.data?.error || 'Gagal mengubah role')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-blue-100 text-blue-800'
      case 'ASSIGNED': return 'bg-yellow-100 text-yellow-800'
      case 'IN_PROGRESS': return 'bg-purple-100 text-purple-800'
      case 'COMPLETED': return 'bg-green-100 text-green-800'
      case 'CANCELLED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OPEN': return <Clock className="h-4 w-4" />
      case 'ASSIGNED': return <User className="h-4 w-4" />
      case 'IN_PROGRESS': return <AlertTriangle className="h-4 w-4" />
      case 'COMPLETED': return <CheckCircle className="h-4 w-4" />
      case 'CANCELLED': return <AlertTriangle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </Layout>
      </ProtectedRoute>
    )
  }

  if (!technician) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Teknisi Tidak Ditemukan</h2>
            <p className="text-gray-500 mb-4">Data teknisi yang Anda cari tidak ditemukan</p>
            <button
              onClick={() => router.push('/technicians')}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Kembali ke Daftar Teknisi
            </button>
          </div>
        </Layout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/technicians')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Kembali"
                >
                  <ArrowLeft className="h-5 w-5 text-gray-600" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                    <User className="h-8 w-8 text-blue-600 mr-3" />
                    {technician.name}
                  </h1>
                  <p className="text-gray-600 mt-1">
                    Detail informasi teknisi
                  </p>
                </div>
              </div>
              
              {(user?.role === 'superadmin' || user?.role === 'admin') && (
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => router.push(`/technicians/${id}/edit`)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors flex items-center"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Hapus
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Technician Info */}
            <div className="lg:col-span-1">
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Informasi Teknisi</h2>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <User className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Nama</p>
                      <p className="font-medium">{technician.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Phone className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Nomor HP</p>
                      <p className="font-medium">{technician.phone}</p>
                    </div>
                  </div>

                  {technician.telegramChatId && (
                    <div className="flex items-center space-x-3">
                      <MessageCircle className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Telegram</p>
                        <p className="font-medium">@{technician.telegramUsername || 'tidak ada'}</p>
                        <p className="text-xs text-gray-400">ID: {technician.telegramChatId}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center space-x-3">
                    <Calendar className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Bergabung</p>
                      <p className="font-medium">
                        {new Date(technician.createdAt).toLocaleDateString('id-ID', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status & Role */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Status</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        technician.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {technician.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Role Bot</span>
                      {(user?.role === 'superadmin' || user?.role === 'admin') ? (
                        <button
                          onClick={toggleAdminRole}
                          className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                            technician.isAdmin
                              ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                              : 'bg-green-100 text-green-800 hover:bg-green-200'
                          }`}
                        >
                          {technician.isAdmin ? (
                            <>
                              <ShieldCheck className="h-3 w-3" />
                              <span>Admin Bot</span>
                            </>
                          ) : (
                            <>
                              <Shield className="h-3 w-3" />
                              <span>Teknisi Biasa</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
                          technician.isAdmin
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {technician.isAdmin ? (
                            <>
                              <ShieldCheck className="h-3 w-3" />
                              <span>Admin Bot</span>
                            </>
                          ) : (
                            <>
                              <Shield className="h-3 w-3" />
                              <span>Teknisi Biasa</span>
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {(user?.role === 'superadmin' || user?.role === 'admin') && (
                    <div className="mt-3 text-xs text-gray-500">
                      {technician.isAdmin ? (
                        <span>🚫 Tidak menerima notifikasi job • ✅ Dapat membuat job</span>
                      ) : (
                        <span>✅ Menerima notifikasi job • 🚫 Tidak dapat membuat job</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Statistics */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Statistik</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Total Job</span>
                      <span className="font-medium">{technician._count?.jobAssignments || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Job Assignments */}
            <div className="lg:col-span-2">
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Briefcase className="h-5 w-5 mr-2" />
                  Riwayat Pekerjaan
                </h2>

                {jobsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index}>
                        <div className="h-20 bg-gray-200 rounded-lg"></div>
                      </div>
                    ))}
                  </div>
                ) : jobAssignments.length === 0 ? (
                  <div className="text-center py-8">
                    <Briefcase className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Belum ada pekerjaan</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Teknisi ini belum pernah ditugaskan pada pekerjaan apapun.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {jobAssignments.map((assignment) => (
                      <div key={assignment.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h3 className="font-medium text-gray-900">
                                {assignment.job.customerName}
                              </h3>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(assignment.job.status)}`}>
                                {getStatusIcon(assignment.job.status)}
                                <span className="ml-1">{assignment.job.status}</span>
                              </span>
                            </div>
                            
                            <p className="text-sm text-gray-600 mb-2 flex items-center">
                              <MapPin className="h-4 w-4 mr-1" />
                              {assignment.job.customerAddress}
                            </p>
                            
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <span>Tipe: {assignment.job.type}</span>
                              <span>Ditugaskan: {new Date(assignment.assignedAt).toLocaleDateString('id-ID')}</span>
                              {assignment.completedAt && (
                                <span>Selesai: {new Date(assignment.completedAt).toLocaleDateString('id-ID')}</span>
                              )}
                            </div>
                          </div>
                          
                          <button
                            onClick={() => router.push(`/jobs/${assignment.job.id}`)}
                            className="ml-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Lihat Detail
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
