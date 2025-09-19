import React, { useState } from 'react'
import { useRouter } from 'next/router'
import { useForm } from 'react-hook-form'
import { useAuth } from '../../contexts/AuthContext'
import Layout from '../../components/Layout'
import ProtectedRoute from '../../components/ProtectedRoute'
import { api } from '../../lib/api'
import { User, Phone, Smartphone } from 'lucide-react'
import toast from 'react-hot-toast'

interface TechnicianForm {
  name: string
  phone: string
  telegramChatId?: string
  isActive: boolean
  isAvailable: boolean
  isAdmin: boolean
}

export default function CreateTechnician() {
  const { user } = useAuth()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TechnicianForm>({
    defaultValues: {
      isActive: true,
      isAvailable: true,
      isAdmin: false
    }
  })

  const onSubmit = async (data: TechnicianForm) => {
    setIsLoading(true)
    try {
      await api.post('/technicians', data)

      toast.success('Teknisi berhasil ditambahkan!')
      router.push('/technicians')
    } catch (error: any) {
      const message = error.response?.data?.error || 'Gagal menambahkan teknisi'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ProtectedRoute>
      <Layout title="Tambah Teknisi">
        <div className="max-w-2xl mx-auto">
          <div className="card p-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Tambah Teknisi Baru</h1>
              <p className="text-gray-600">Tambahkan teknisi baru ke sistem</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="form-label">Nama Lengkap *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      {...register('name', { required: 'Nama lengkap wajib diisi' })}
                      className="form-input pl-10"
                      placeholder="Contoh: John Doe"
                    />
                  </div>
                  {errors.name && (
                    <p className="form-error">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="form-label">Nomor HP *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      {...register('phone', { 
                        required: 'Nomor HP wajib diisi',
                        pattern: {
                          value: /^(\+62|62|0)8[1-9][0-9]{6,9}$/,
                          message: 'Format nomor HP tidak valid'
                        }
                      })}
                      className="form-input pl-10"
                      placeholder="Contoh: 081234567890"
                    />
                  </div>
                  {errors.phone && (
                    <p className="form-error">{errors.phone.message}</p>
                  )}
                </div>
              </div>

              {/* Telegram Chat ID */}
              <div>
                <label className="form-label">Telegram Chat ID (Opsional)</label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    {...register('telegramChatId')}
                    className="form-input pl-10"
                    placeholder="Contoh: 123456789"
                  />
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Chat ID Telegram untuk integrasi bot (dapatkan dari @userinfobot)
                </p>
              </div>

              {/* Status Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Konfigurasi Teknisi</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('isActive')}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      Aktif
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('isAvailable')}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      Tersedia untuk Job
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('isAdmin')}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      Admin Bot
                    </label>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600 space-y-2">
                    <p><strong>Aktif:</strong> Teknisi dapat login dan menggunakan sistem</p>
                    <p><strong>Tersedia:</strong> Teknisi dapat menerima assignment job baru</p>
                    <div className="pt-2 border-t border-gray-200">
                      <p><strong>Admin Bot:</strong></p>
                      <ul className="ml-4 space-y-1 text-xs">
                        <li>✅ Dapat membuat job melalui Telegram bot</li>
                        <li>🚫 <strong>TIDAK menerima notifikasi job baru</strong></li>
                        <li>✅ Akses semua fitur admin bot</li>
                      </ul>
                      <p className="mt-2 text-xs"><strong>Teknisi Biasa:</strong></p>
                      <ul className="ml-4 space-y-1 text-xs">
                        <li>✅ <strong>Menerima notifikasi job baru</strong></li>
                        <li>✅ Dapat mengambil dan menyelesaikan job</li>
                        <li>🚫 Tidak dapat membuat job</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
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
                      Menyimpan...
                    </div>
                  ) : (
                    'Simpan Teknisi'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}

