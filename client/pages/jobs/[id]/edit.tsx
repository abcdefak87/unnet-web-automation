import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useForm } from 'react-hook-form'
import { useAuth } from '../../../contexts/AuthContext'
import Layout from '../../../components/Layout'
import ProtectedRoute from '../../../components/ProtectedRoute'
import Breadcrumb from '../../../components/Breadcrumb'
import { api } from '../../../lib/api'
import { ArrowLeft, Save, MapPin, User, Phone, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

interface JobForm {
  type: 'INSTALLATION' | 'REPAIR'
  customerId: string
  description: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
}

export default function EditJob() {
  const { user } = useAuth()
  const router = useRouter()
  const { id } = router.query
  const [job, setJob] = useState<any>(null)
  const [customers, setCustomers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadingJob, setLoadingJob] = useState(true)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<JobForm>()

  const selectedCustomerId = watch('customerId')
  const selectedCustomer = customers.find(c => c.id.toString() === selectedCustomerId)

  useEffect(() => {
    if (id) {
      fetchJob()
      fetchCustomers()
    }
  }, [id])

  const fetchJob = async () => {
    try {
      setLoadingJob(true)
      const response = await api.get(`/jobs/${id}`)
      const jobData = response.data.job || response.data.data
      setJob(jobData)
      
      // Populate form with existing data
      setValue('type', jobData.type)
      setValue('customerId', jobData.customerId)
      setValue('description', jobData.description || '')
      setValue('priority', jobData.priority)
      setValue('status', jobData.status)
    } catch (error) {
      console.error('Failed to fetch job:', error)
      toast.error('Gagal memuat data pekerjaan')
      router.push('/jobs')
    } finally {
      setLoadingJob(false)
    }
  }

  const fetchCustomers = async () => {
    try {
      const response = await api.get('/customers')
      setCustomers(response.data.data.customers || [])
    } catch (error) {
      console.error('Failed to fetch customers:', error)
    }
  }

  const onSubmit = async (data: JobForm) => {
    try {
      setIsLoading(true)
      
      // Get address from selected customer
      const customer = customers.find(c => c.id.toString() === data.customerId)
      const customerAddress = customer?.address || ''
      
      const updateData = {
        ...data,
        address: customerAddress
      }
      
      await api.put(`/jobs/${id}`, updateData)
      
      toast.success('Pekerjaan berhasil diperbarui')
      router.push('/jobs')
    } catch (error: any) {
      console.error('Update job error:', error)
      const message = error.response?.data?.error || 'Gagal memperbarui pekerjaan'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (loadingJob) {
    return (
      <ProtectedRoute>
        <Layout title="Edit Pekerjaan">
          <div className="flex items-center justify-center min-h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </Layout>
      </ProtectedRoute>
    )
  }

  if (!job) {
    return (
      <ProtectedRoute>
        <Layout title="Edit Pekerjaan">
          <div className="text-center py-12">
            <p className="text-gray-500">Pekerjaan tidak ditemukan</p>
          </div>
        </Layout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <Layout title="Edit Pekerjaan">
        <div className="max-w-2xl mx-auto">
          {/* Breadcrumb */}
          <Breadcrumb 
            items={[
              { name: 'Pekerjaan', href: '/jobs' },
              { name: 'Edit Tiket', current: true }
            ]} 
          />
          <div className="mb-6">
            <button
              onClick={() => router.back()}
              className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Kembali
            </button>
            
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Edit Pekerjaan</h1>
                <p className="text-gray-600">Job #{job.jobNumber}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Informasi Pekerjaan
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Jenis Pekerjaan *
                  </label>
                  <select
                    {...register('type', { required: 'Jenis pekerjaan wajib dipilih' })}
                    className="form-input"
                  >
                    <option value="">Pilih jenis pekerjaan</option>
                    <option value="INSTALLATION">Pemasangan</option>
                    <option value="REPAIR">Perbaikan</option>
                  </select>
                  {errors.type && (
                    <p className="text-red-500 text-sm mt-1">{errors.type.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prioritas *
                  </label>
                  <select
                    {...register('priority', { required: 'Prioritas wajib dipilih' })}
                    className="form-input"
                  >
                    <option value="">Pilih prioritas</option>
                    <option value="LOW">Rendah</option>
                    <option value="MEDIUM">Sedang</option>
                    <option value="HIGH">Tinggi</option>
                    <option value="URGENT">Mendesak</option>
                  </select>
                  {errors.priority && (
                    <p className="text-red-500 text-sm mt-1">{errors.priority.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status *
                  </label>
                  <select
                    {...register('status', { required: 'Status wajib dipilih' })}
                    className="form-input"
                  >
                    <option value="OPEN">Terbuka</option>
                    <option value="ASSIGNED">Ditugaskan</option>
                    <option value="IN_PROGRESS">Sedang Dikerjakan</option>
                    <option value="COMPLETED">Selesai</option>
                    <option value="CANCELLED">Dibatalkan</option>
                  </select>
                  {errors.status && (
                    <p className="text-red-500 text-sm mt-1">{errors.status.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pelanggan *
                  </label>
                  <select
                    {...register('customerId', { required: 'Pelanggan wajib dipilih' })}
                    className="form-input"
                  >
                    <option value="">Pilih pelanggan</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} - {customer.phone}
                      </option>
                    ))}
                  </select>
                  {errors.customerId && (
                    <p className="text-red-500 text-sm mt-1">{errors.customerId.message}</p>
                  )}
                </div>
              </div>

              {/* Customer Address Display */}
              {selectedCustomer && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Alamat Pelanggan
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <div className="form-input pl-10 bg-gray-50 min-h-[80px] flex items-start pt-3">
                      <span className="text-gray-700">
                        {selectedCustomer.address || 'Alamat belum tersedia'}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    💡 Alamat diambil otomatis dari data pelanggan
                  </p>
                </div>
              )}

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deskripsi
                </label>
                <textarea
                  {...register('description')}
                  rows={4}
                  className="form-input"
                  placeholder="Deskripsi detail pekerjaan (opsional)"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="btn btn-secondary"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>{isLoading ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
              </button>
            </div>
          </form>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
