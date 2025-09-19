import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../../../contexts/AuthContext'
import Layout from '../../../components/Layout'
import ProtectedRoute from '../../../components/ProtectedRoute'
import Breadcrumb from '../../../components/Breadcrumb'
import { api } from '../../../lib/api'
import { 
  ArrowLeft,
  User,
  Phone,
  MapPin,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  FileText,
  Users,
  Activity
} from 'lucide-react'

export default function JobDetail() {
  const router = useRouter()
  const { id } = router.query
  const { user } = useAuth()
  const [job, setJob] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || typeof id !== 'string') {
      setIsLoading(false)
      return
    }

    let isMounted = true

    const loadJob = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const response = await api.get(`/jobs/${id}`)
        if (isMounted) {
          setJob(response.data.job)
        }
      } catch (error: any) {
        console.error('Failed to fetch job:', error)
        if (isMounted) {
          setJob(null)
          setError(error.response?.data?.error || 'Failed to load job details')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadJob()

    return () => {
      isMounted = false
    }
  }, [id])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-green-100 text-green-800'
      case 'ASSIGNED': return 'bg-yellow-100 text-yellow-800'
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800'
      case 'COMPLETED': return 'bg-gray-100 text-gray-800'
      case 'CANCELLED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'OPEN': return 'Terbuka'
      case 'ASSIGNED': return 'Ditugaskan'
      case 'IN_PROGRESS': return 'Dikerjakan'
      case 'COMPLETED': return 'Selesai'
      case 'CANCELLED': return 'Dibatalkan'
      default: return status
    }
  }

  const getAvailabilityStatus = (technicians: any[]) => {
    const assignedCount = technicians.length
    const maxTechnicians = 1

    if (assignedCount === 0) {
      return {
        text: 'Tersedia',
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        icon: '📋',
        description: 'Job masih terbuka untuk teknisi'
      }
    } else if (assignedCount < maxTechnicians) {
      return {
        text: 'Butuh Teknisi',
        color: 'text-orange-600',
        bgColor: 'bg-orange-100',
        icon: '⚡',
        description: `Masih butuh ${maxTechnicians - assignedCount} teknisi lagi`
      }
    } else {
      return {
        text: 'Penuh',
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        icon: '🔒',
        description: 'Sudah mencapai kapasitas maksimal teknisi'
      }
    }
  }

  if (error) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="text-center py-12">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Terjadi Kesalahan</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => router.push('/jobs')}
              className="btn btn-primary"
            >
              Kembali ke Daftar Job
            </button>
          </div>
        </Layout>
      </ProtectedRoute>
    )
  }

  if (isLoading) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
          </div>
        </Layout>
      </ProtectedRoute>
    )
  }

  if (!job) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900">Job tidak ditemukan</h2>
            <button
              onClick={() => router.push('/jobs')}
              className="mt-4 btn btn-primary"
            >
              Kembali ke Daftar Job
            </button>
          </div>
        </Layout>
      </ProtectedRoute>
    )
  }

  const availabilityStatus = getAvailabilityStatus(job.technicians || [])

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          {/* Breadcrumb */}
          <Breadcrumb 
            items={[
              { name: 'Pekerjaan', href: '/jobs' },
              { name: `Tiket ${job?.jobNumber}`, current: true }
            ]} 
          />
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/jobs')}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Detail Job {job.jobNumber}
                </h1>
                <p className="text-gray-600">{job.title}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <span className={`badge ${getStatusBadge(job.status)}`}>
                {getStatusText(job.status)}
              </span>
              {job.status === 'OPEN' || job.status === 'ASSIGNED' ? (
                <button
                  onClick={() => router.push(`/jobs/${job.id}/edit`)}
                  className="btn btn-secondary"
                >
                  Edit Job
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Job Info Card */}
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-semibold">Informasi Job</h3>
                </div>
                <div className="card-body space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Job Number</label>
                      <p className="text-lg font-semibold">{job.jobNumber}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Tipe</label>
                      <p className="text-lg">{job.type === 'INSTALLATION' ? 'Pemasangan' : 'Perbaikan'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Prioritas</label>
                      <p className="text-lg">{job.priority}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Tanggal Dibuat</label>
                      <p className="text-lg flex items-center">
                        <Calendar className="h-4 w-4 mr-2" />
                        {new Date(job.createdAt).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                  </div>
                  
                  {job.description && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Deskripsi</label>
                      <p className="text-gray-900 whitespace-pre-wrap">{job.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Info Card */}
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-semibold">Informasi Pelanggan</h3>
                </div>
                <div className="card-body space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Nama</label>
                      <p className="text-lg flex items-center">
                        <User className="h-4 w-4 mr-2" />
                        {job.customer.name}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Telepon</label>
                      <p className="text-lg flex items-center">
                        <Phone className="h-4 w-4 mr-2" />
                        {job.customer.phone}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Alamat</label>
                    <p className="text-lg flex items-start">
                      <MapPin className="h-4 w-4 mr-2 mt-1 flex-shrink-0" />
                      {job.address}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Assignment Status Card */}
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-semibold flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    Status Assignment
                  </h3>
                </div>
                <div className="card-body space-y-4">
                  {/* Availability Status */}
                  <div className={`p-4 rounded-lg ${availabilityStatus.bgColor}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-semibold">
                        {availabilityStatus.icon} {availabilityStatus.text}
                      </span>
                      <span className={`text-sm font-medium ${availabilityStatus.color}`}>
                        {job.technicians?.length || 0}/2 teknisi
                      </span>
                    </div>
                    <p className={`text-sm ${availabilityStatus.color}`}>
                      {availabilityStatus.description}
                    </p>
                  </div>

                  {/* Assigned Technicians */}
                  <div>
                    <label className="text-sm font-medium text-gray-500 mb-2 block">
                      Teknisi yang Ditugaskan
                    </label>
                    {job.technicians && job.technicians.length > 0 ? (
                      <div className="space-y-2">
                        {job.technicians.map((jt: any) => (
                          <div key={jt.id} className="flex items-center p-3 bg-gray-50 rounded-lg">
                            <User className="h-5 w-5 text-gray-400 mr-3" />
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{jt.technician.name}</p>
                              <p className="text-sm text-gray-500">{jt.technician.phone}</p>
                            </div>
                            <div className="text-xs text-gray-400">
                              {new Date(jt.assignedAt).toLocaleDateString('id-ID')}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Users className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                        <p>Belum ada teknisi yang ditugaskan</p>
                        <p className="text-sm">Job masih tersedia untuk diambil</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Activity Status */}
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-semibold flex items-center">
                    <Activity className="h-5 w-5 mr-2" />
                    Status Aktivitas
                  </h3>
                </div>
                <div className="card-body space-y-3">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">Job Dibuat</p>
                      <p className="text-sm text-gray-500">
                        {new Date(job.createdAt).toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>
                  
                  {job.technicians && job.technicians.length > 0 && (
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="font-medium">Teknisi Ditugaskan</p>
                        <p className="text-sm text-gray-500">
                          {job.technicians.length} teknisi assigned
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {job.completedAt ? (
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="font-medium">Job Selesai</p>
                        <p className="text-sm text-gray-500">
                          {new Date(job.completedAt).toLocaleString('id-ID')}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-3">
                      <Clock className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-600">Menunggu Penyelesaian</p>
                        <p className="text-sm text-gray-500">Job belum selesai</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
