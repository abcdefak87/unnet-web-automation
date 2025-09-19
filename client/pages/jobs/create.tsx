import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useForm } from 'react-hook-form'
import { useAuth } from '../../contexts/AuthContext'
import Layout from '../../components/Layout'
import ProtectedRoute from '../../components/ProtectedRoute'
import Breadcrumb from '../../components/Breadcrumb'
import QuickAddCustomerModal from '../../components/QuickAddCustomerModal'
import { api } from '../../lib/api'
import { Upload, MapPin, User, Phone, FileText, Camera, Plus } from 'lucide-react'
import toast from 'react-hot-toast'

interface JobForm {
  type: 'INSTALLATION' | 'REPAIR' | 'PSB' | 'GANGGUAN'
  category: 'PSB' | 'GANGGUAN'
  customerId: string
  problemType?: string
  description?: string
  scheduledDate: string
  housePhoto?: FileList
  customerIdPhoto?: FileList
}

export default function CreateJob() {
  const { user } = useAuth()
  const router = useRouter()
  const [customers, setCustomers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [showQuickAddModal, setShowQuickAddModal] = useState(false)
  
  // Get type from URL query
  const { type: urlType } = router.query

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<JobForm>()

  const selectedCustomerId = watch('customerId')
  const selectedCustomer = customers.find(c => c.id.toString() === selectedCustomerId)

  const jobType = watch('type')
  const jobCategory = watch('category')

  // Auto-update type based on category
  useEffect(() => {
    if (jobCategory) {
      setValue('type', jobCategory)
    }
  }, [jobCategory, setValue])

  useEffect(() => {
    fetchCustomers()
    // Set default date to now
    const now = new Date()
    const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16)
    setValue('scheduledDate', localDateTime)
    
    // Set type and category from URL
    if (urlType === 'psb') {
      setValue('type', 'PSB')
      setValue('category', 'PSB')
    } else if (urlType === 'gangguan') {
      setValue('type', 'GANGGUAN')
      setValue('category', 'GANGGUAN')
    }
  }, [setValue, urlType])

  const fetchCustomers = async () => {
    try {
      const response = await api.get('/customers')
      setCustomers(response.data.data.customers || [])
    } catch (error) {
      console.error('Failed to fetch customers:', error)
      toast.error('Gagal memuat data pelanggan')
    } finally {
      setLoadingCustomers(false)
    }
  }

  const handleCustomerAdded = (newCustomer: any) => {
    setCustomers(prev => [...prev, newCustomer])
    // Auto-select the newly added customer
    const form = document.querySelector('select[name="customerId"]') as HTMLSelectElement
    if (form) {
      form.value = newCustomer.id.toString()
    }
  }

  const onSubmit = async (data: JobForm) => {
    setIsLoading(true)
    try {
      // Validate required fields
      if (!data.customerId) {
        toast.error('Pelanggan harus dipilih')
        return
      }
      
      if (!data.category) {
        toast.error('Kategori tiket harus dipilih')
        return
      }
      
      if (data.category === 'GANGGUAN' && !data.problemType) {
        toast.error('Jenis gangguan harus dipilih')
        return
      }
      
      if (data.category === 'PSB' && !data.scheduledDate) {
        toast.error('Tanggal jadwal harus diisi')
        return
      }

      // Validate file types and sizes for PSB jobs
      if (data.category === 'PSB') {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
        const maxSize = 5 * 1024 * 1024 // 5MB

        if (data.housePhoto?.[0]) {
          const file = data.housePhoto[0]
          if (!allowedTypes.includes(file.type)) {
            toast.error('Format foto rumah tidak didukung. Gunakan JPG, PNG, GIF, atau WebP.')
            return
          }
          if (file.size > maxSize) {
            toast.error('Foto rumah terlalu besar. Maksimal 5MB.')
            return
          }
        }

        if (data.customerIdPhoto?.[0]) {
          const file = data.customerIdPhoto[0]
          if (!allowedTypes.includes(file.type)) {
            toast.error('Format foto KTP tidak didukung. Gunakan JPG, PNG, GIF, atau WebP.')
            return
          }
          if (file.size > maxSize) {
            toast.error('Foto KTP terlalu besar. Maksimal 5MB.')
            return
          }
        }
      }
      
      console.log('=== FRONTEND DEBUG ===');
      console.log('Form data before FormData creation:', data);
      
      const formData = new FormData()
      
      // Add basic job data
      formData.append('type', data.type)
      formData.append('category', data.category)
      formData.append('customerId', data.customerId)
      
      // Get address from selected customer
      const customer = customers.find(c => c.id.toString() === data.customerId)
      const customerAddress = customer?.address || ''
      
      if (!customerAddress) {
        toast.error('Alamat pelanggan tidak ditemukan. Silakan periksa data pelanggan.')
        return
      }
      
      formData.append('address', customerAddress)
      
      if (data.category === 'GANGGUAN') {
        formData.append('problemType', data.problemType || '')
      }
      if (data.category === 'PSB' && data.description) {
        formData.append('description', data.description)
      }
      formData.append('scheduledDate', data.scheduledDate)
      
      console.log('FormData entries:');
      formData.forEach((value, key) => {
        console.log(key, value);
      });

      // Add photos for PSB jobs
      if (data.category === 'PSB') {
        if (data.housePhoto?.[0]) {
          formData.append('housePhoto', data.housePhoto[0])
        }
        if (data.customerIdPhoto?.[0]) {
          formData.append('customerIdPhoto', data.customerIdPhoto[0])
        }
      }

      // Remove Content-Type header to let browser set it automatically with boundary
      const response = await api.post('/jobs', formData)

      toast.success('Tiket berhasil dibuat!')
      router.push('/jobs')
    } catch (error: any) {
      console.error('Create job error:', error)
      
      // Handle specific error types
      let message = 'Gagal membuat tiket'
      
      if (error.response?.data?.error) {
        const serverError = error.response.data.error
        
        // Handle file upload errors
        if (serverError.includes('File type') && serverError.includes('not allowed')) {
          message = 'Format file tidak didukung. Gunakan JPG, PNG, GIF, atau WebP.'
        } else if (serverError.includes('File size')) {
          message = 'Ukuran file terlalu besar. Maksimal 5MB per file.'
        } else if (serverError.includes('Suspicious file')) {
          message = 'File tidak aman. Gunakan file gambar yang valid.'
        } else if (serverError.includes('Empty files')) {
          message = 'File kosong tidak diperbolehkan.'
        } else {
          message = serverError
        }
      } else if (error.code === 'ERR_NETWORK') {
        message = 'Koneksi bermasalah. Periksa koneksi internet Anda.'
      } else if (error.response?.status === 413) {
        message = 'File terlalu besar. Maksimal 5MB per file.'
      } else if (error.response?.status === 400) {
        message = 'Data tidak valid. Periksa kembali form yang diisi.'
      } else if (error.response?.status === 500) {
        message = 'Terjadi kesalahan server. Silakan coba lagi.'
      }
      
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ProtectedRoute>
      <Layout title="Buat Job Baru">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <Breadcrumb 
            items={[
              { name: 'Pekerjaan', href: '/jobs' },
              { name: 'Buat Tiket Baru', current: true }
            ]} 
          />
          <div className="card p-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">
                {urlType === 'psb' ? 'Buat Tiket PSB' : urlType === 'gangguan' ? 'Buat Tiket Gangguan' : 'Buat Tiket Baru'}
              </h1>
              <p className="text-gray-600">
                {urlType === 'psb' ? 'Buat tiket pemasangan WiFi baru' : 
                 urlType === 'gangguan' ? 'Buat tiket laporan gangguan WiFi' : 
                 'Buat tiket PSB atau gangguan WiFi baru'}
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Job Type */}
              <div>
                <label className="form-label">Kategori Tiket *</label>
                <select
                  {...register('category', { required: 'Kategori tiket wajib dipilih' })}
                  className="form-input"
                >
                  <option value="">Pilih kategori tiket</option>
                  <option value="PSB">Tiket PSB (Pasang WiFi)</option>
                  <option value="GANGGUAN">Tiket Gangguan</option>
                </select>
                {errors.category && (
                  <p className="form-error">{errors.category.message}</p>
                )}
              </div>

              {/* Job Type - Auto-set based on category */}
              <input type="hidden" {...register('type')} />

              {/* Customer */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="form-label">Pelanggan *</label>
                  <button
                    type="button"
                    onClick={() => setShowQuickAddModal(true)}
                    className="inline-flex items-center px-3 py-1 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Tambah Pelanggan
                  </button>
                </div>
                {loadingCustomers ? (
                  <div className="form-input flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600 mr-2"></div>
                    Memuat pelanggan...
                  </div>
                ) : (
                  <select
                    {...register('customerId', { required: 'Pelanggan wajib dipilih' })}
                    className="form-input"
                  >
                    <option value="">Pilih pelanggan</option>
                    {customers.map((customer: any) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} - {customer.phone}
                      </option>
                    ))}
                  </select>
                )}
                {errors.customerId && (
                  <p className="form-error">{errors.customerId.message}</p>
                )}
              </div>

              {/* Customer Address Display */}
              {selectedCustomer && (
                <div>
                  <label className="form-label">Alamat Pelanggan</label>
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

              {/* Problem Type for GANGGUAN only */}
              {jobCategory === 'GANGGUAN' && (
                <div>
                  <label className="form-label">Jenis Gangguan *</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <select
                      {...register('problemType', { required: 'Jenis gangguan wajib dipilih' })}
                      className="form-input pl-10"
                    >
                      <option value="">Pilih jenis gangguan</option>
                      <option value="modem_rusak">Modem Rusak</option>
                      <option value="kabel_putus">Kabel Putus</option>
                      <option value="redaman_tinggi">Redaman Tinggi</option>
                      <option value="ganti_modem_cas">Ganti Modem/CAS Rusak</option>
                      <option value="masalah_settingan">Masalah Settingan</option>
                      <option value="internet_lambat">Internet Lambat</option>
                    </select>
                  </div>
                  {errors.problemType && (
                    <p className="form-error">{errors.problemType.message}</p>
                  )}
                </div>
              )}

              {/* Description for PSB only */}
              {jobCategory === 'PSB' && (
                <div>
                  <label className="form-label">Deskripsi Pemasangan</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <textarea
                      {...register('description')}
                      className="form-input pl-10"
                      rows={3}
                      placeholder="Deskripsikan kebutuhan pemasangan WiFi..."
                    />
                  </div>
                </div>
              )}


              {/* Scheduled Date */}
              <div>
                <label className="form-label">Tanggal Dijadwalkan *</label>
                <input
                  type="datetime-local"
                  {...register('scheduledDate', { required: 'Tanggal wajib diisi' })}
                  className="form-input"
                  min={new Date().toISOString().slice(0, 16)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  💡 Otomatis diisi dengan waktu saat ini
                </p>
                {errors.scheduledDate && (
                  <p className="form-error">{errors.scheduledDate.message}</p>
                )}
              </div>


              {/* Photos for PSB */}
              {jobCategory === 'PSB' && (
                <div className="space-y-4">
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Foto Wajib untuk Pemasangan WiFi
                    </h3>
                  </div>

                  {/* House Photo */}
                  <div>
                    <label className="form-label">Foto Rumah *</label>
                    <div className="relative">
                      <Camera className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                        {...register('housePhoto', {
                          required: jobCategory === 'PSB' ? 'Foto rumah wajib untuk pemasangan' : false
                        })}
                        className="form-input pl-10"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      💡 Format yang didukung: JPG, PNG, GIF, WebP (maksimal 5MB)
                    </p>
                    {errors.housePhoto && (
                      <p className="form-error">{errors.housePhoto.message}</p>
                    )}
                  </div>

                  {/* Customer ID Photo */}
                  <div>
                    <label className="form-label">Foto KTP Pelanggan *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                        {...register('customerIdPhoto', {
                          required: jobCategory === 'PSB' ? 'Foto KTP wajib untuk pemasangan' : false
                        })}
                        className="form-input pl-10"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      💡 Format yang didukung: JPG, PNG, GIF, WebP (maksimal 5MB)
                    </p>
                    {errors.customerIdPhoto && (
                      <p className="form-error">{errors.customerIdPhoto.message}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex justify-end space-x-4 pt-6 border-t">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="btn-outline"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary"
                >
                  {isLoading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Membuat Job...
                    </div>
                  ) : (
                    'Buat Job'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Quick Add Customer Modal */}
        <QuickAddCustomerModal
          isOpen={showQuickAddModal}
          onClose={() => setShowQuickAddModal(false)}
          onCustomerAdded={handleCustomerAdded}
        />
      </Layout>
    </ProtectedRoute>
  )
}

