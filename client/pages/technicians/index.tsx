import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../../contexts/AuthContext'
import Layout from '../../components/Layout'
import ProtectedRoute from '../../components/ProtectedRoute'
import { api } from '../../lib/api'
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  MapPin, 
  Phone, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Edit,
  Eye,
  Trash2,
  ShieldCheck,
  UserCheck,
  Settings,
  Bot,
  User,
  Shield
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function Technicians() {
  const { user } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('technicians')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [technicians, setTechnicians] = useState([])
  const [registrations, setRegistrations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingRegistrations, setIsLoadingRegistrations] = useState(false)

  useEffect(() => {
    fetchTechnicians()
    fetchRegistrations() // Always fetch registrations for badge count
  }, [search, statusFilter])

  useEffect(() => {
    if (activeTab === 'registrations') {
      fetchRegistrations()
    }
  }, [activeTab])

  const fetchTechnicians = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (statusFilter) params.append('status', statusFilter)
      
      const response = await api.get(`/technicians?search=${search}&status=${statusFilter}`)
      setTechnicians(response.data.data?.technicians || [])
    } catch (error) {
      console.error('Failed to fetch technicians:', error)
      toast.error('Gagal memuat data teknisi')
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      AVAILABLE: 'badge-success',
      BUSY: 'badge-warning',
      OFFLINE: 'badge-gray',
    }
    return badges[status as keyof typeof badges] || 'badge-gray'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return <CheckCircle className="h-4 w-4" />
      case 'BUSY':
        return <Clock className="h-4 w-4" />
      case 'OFFLINE':
        return <AlertTriangle className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  const deleteTechnician = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus teknisi ini?')) return

    try {
      await api.delete(`/technicians/${id}`)
      toast.success('Teknisi berhasil dihapus')
      fetchTechnicians()
    } catch (error: any) {
      const message = error.response?.data?.error || 'Gagal menghapus teknisi'
      toast.error(message)
    }
  }

  const fetchRegistrations = async () => {
    try {
      setIsLoadingRegistrations(true)
      const response = await api.get('/registrations')
      setRegistrations(response.data.data || [])
    } catch (error) {
      console.error('Failed to fetch registrations:', error)
      setRegistrations([]) // Ensure registrations is always an array
      toast.error('Gagal memuat data registrasi')
    } finally {
      setIsLoadingRegistrations(false)
    }
  }

  const toggleAdminRole = async (id: string, currentIsAdmin: boolean, technicianName: string) => {
    const newRole = !currentIsAdmin
    const roleText = newRole ? 'Admin Bot' : 'Teknisi Biasa'
    const confirmMessage = `Apakah Anda yakin ingin mengubah ${technicianName} menjadi ${roleText}?\n\n${newRole ? '⚠️ Admin Bot dapat membuat job tetapi TIDAK menerima notifikasi job' : '✅ Teknisi Biasa akan menerima notifikasi job baru'}`
    
    if (!confirm(confirmMessage)) return

    try {
      await api.put(`/technicians/${id}`, { isAdmin: newRole })
      toast.success(`${technicianName} berhasil diubah menjadi ${roleText}`)
      fetchTechnicians()
    } catch (error: any) {
      const message = error.response?.data?.error || 'Gagal mengubah role teknisi'
      toast.error(message)
    }
  }

  const approveRegistration = async (registrationId: string, formData: any) => {
    try {
      await api.post(`/registrations/${registrationId}/approve`, formData)
      toast.success('Registrasi berhasil disetujui')
      fetchRegistrations()
    } catch (error: any) {
      const message = error.response?.data?.error || 'Gagal menyetujui registrasi'
      toast.error(message)
    }
  }

  const rejectRegistration = async (registrationId: string, reason: string) => {
    try {
      await api.post(`/registrations/${registrationId}/reject`, { reason })
      toast.success('Registrasi berhasil ditolak')
      fetchRegistrations()
    } catch (error: any) {
      const message = error.response?.data?.error || 'Gagal menolak registrasi'
      toast.error(message)
    }
  }

  return (
    <ProtectedRoute>
      <Layout title="Kelola Teknisi">
        <div className="space-y-6">
          {/* Header with Tabs */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                  <Users className="h-8 w-8 text-blue-600 mr-3" />
                  Kelola Teknisi
                </h1>
                <div className="flex space-x-2">
                  {activeTab === 'technicians' && user?.role !== 'user' && (
                    <button
                      onClick={() => router.push('/technicians/create')}
                      className="btn-primary flex items-center space-x-2"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Tambah Teknisi</span>
                    </button>
                  )}
                </div>
              </div>
              
              {/* Tabs */}
              <div className="mt-4">
                <nav className="flex space-x-8">
                  <button
                    onClick={() => setActiveTab('technicians')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'technicians'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Daftar Teknisi
                  </button>
                  {(user?.role === 'superadmin' || user?.role === 'admin') && (
                    <button
                      onClick={() => setActiveTab('registrations')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        activeTab === 'registrations'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Registrasi Pending
                      {Array.isArray(registrations) && registrations.filter(r => r.status === 'PENDING').length > 0 && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {registrations.filter(r => r.status === 'PENDING').length}
                        </span>
                      )}
                    </button>
                  )}
                </nav>
              </div>
            </div>
          </div>

          {/* Search and Filters - Only show for technicians tab */}
          {activeTab === 'technicians' && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-4">
                  <div className="relative flex-1 max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      className="form-input pl-10"
                      placeholder="Cari nama atau nomor HP..."
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
                    <option value="AVAILABLE">Tersedia</option>
                    <option value="BUSY">Sibuk</option>
                    <option value="OFFLINE">Offline</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Content based on active tab */}
          {activeTab === 'technicians' ? (
            /* Technicians Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="card p-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-300 rounded mb-2"></div>
                      <div className="h-3 bg-gray-300 rounded w-2/3"></div>
                    </div>
                  </div>
                </div>
              ))
            ) : technicians.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <User className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Belum ada teknisi</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Mulai dengan menambahkan teknisi pertama.
                </p>
                {user?.role !== 'user' && (
                  <div className="mt-6">
                    <button
                      onClick={() => router.push('/technicians/create')}
                      className="btn-primary"
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      Tambah Teknisi
                    </button>
                  </div>
                )}
              </div>
            ) : (
              technicians.map((technician: any) => (
                <div key={technician.id} className="card p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                        <User className="h-6 w-6 text-primary-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-medium text-gray-900">
                            {technician.name}
                          </h3>
                          <span className={`badge ${getStatusBadge(technician.status)} flex items-center space-x-1`}>
                            {getStatusIcon(technician.status)}
                            <span>
                              {technician.status === 'AVAILABLE' && 'Tersedia'}
                              {technician.status === 'BUSY' && 'Sibuk'}
                              {technician.status === 'OFFLINE' && 'Offline'}
                            </span>
                          </span>
                        </div>
                        
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center text-sm text-gray-500">
                            <Phone className="h-4 w-4 mr-2" />
                            {technician.phone}
                          </div>
                          {technician.address && (
                            <div className="flex items-center text-sm text-gray-500">
                              <MapPin className="h-4 w-4 mr-2" />
                              {technician.address}
                            </div>
                          )}
                        </div>

                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-500">
                              <span className="font-medium">{technician._count?.jobAssignments || 0}</span> jobs selesai
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => router.push(`/technicians/${technician.id}`)}
                                className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                                title="Lihat detail"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              {user?.role !== 'user' && (
                                <>
                                  <button
                                    onClick={() => router.push(`/technicians/${technician.id}/edit`)}
                                    className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                                    title="Edit"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => deleteTechnician(technician.id)}
                                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                    title="Hapus"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Skills/Specialties */}
                  {technician.skills && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex flex-wrap gap-2">
                        {technician.skills.split(',').map((skill: string, index: number) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {skill.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
            </div>
          ) : (
            /* Registrations List */
            <div className="card overflow-hidden">
              <div className="card-header">
                <h3 className="text-lg font-medium text-gray-900">Registrasi Teknisi Pending</h3>
                <p className="text-sm text-gray-500 mt-1">Kelola persetujuan registrasi teknisi dari Telegram bot</p>
              </div>
              
              {isLoadingRegistrations ? (
                <div className="card-body">
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
                          <div className="flex-1">
                            <div className="h-4 bg-gray-300 rounded mb-2"></div>
                            <div className="h-3 bg-gray-300 rounded w-2/3"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : !Array.isArray(registrations) || registrations.length === 0 ? (
                <div className="card-body text-center">
                  <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Tidak ada registrasi pending</h3>
                  <p className="text-gray-500">Semua registrasi teknisi sudah diproses</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {Array.isArray(registrations) && registrations.map((registration) => (
                    <div key={registration.id} className="card-body">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="h-6 w-6 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="text-lg font-medium text-gray-900">
                              {registration.firstName} {registration.lastName || ''}
                            </h4>
                            <div className="text-sm text-gray-500 space-y-1">
                              <p>📱 {registration.phone || 'Tidak ada nomor HP'}</p>
                              <p>📧 @{registration.telegramUsername || 'Tidak ada username'}</p>
                              <p>📅 {new Date(registration.createdAt).toLocaleDateString('id-ID')}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            registration.status === 'PENDING' 
                              ? 'bg-yellow-100 text-yellow-800'
                              : registration.status === 'APPROVED'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {registration.status === 'PENDING' && 'Menunggu'}
                            {registration.status === 'APPROVED' && 'Disetujui'}
                            {registration.status === 'REJECTED' && 'Ditolak'}
                          </span>
                          
                          {registration.status === 'PENDING' && (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => approveRegistration(registration.id, {
                                  name: `${registration.firstName} ${registration.lastName || ''}`.trim(),
                                  phone: registration.phone || ''
                                })}
                                className="btn btn-sm btn-success"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Setujui
                              </button>
                              <button
                                onClick={() => rejectRegistration(registration.id, 'Ditolak oleh admin')}
                                className="btn btn-sm btn-danger"
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Tolak
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}

