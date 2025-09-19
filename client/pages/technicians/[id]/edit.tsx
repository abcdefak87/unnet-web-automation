import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../../../contexts/AuthContext'
import Layout from '../../../components/Layout'
import ProtectedRoute from '../../../components/ProtectedRoute'
import { api } from '../../../lib/api'
import { ArrowLeft, Save, User, Phone, MapPin, Shield } from 'lucide-react'
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
}

export default function EditTechnicianPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { id } = router.query
  const [technician, setTechnician] = useState<Technician | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    isActive: true,
    isAdmin: false
  })

  useEffect(() => {
    if (id) {
      fetchTechnician()
    }
  }, [id])

  const fetchTechnician = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/technicians/${id}`)
      const technicianData = response.data
      setTechnician(technicianData)
      setFormData({
        name: technicianData.name || '',
        phone: technicianData.phone || '',
        isActive: technicianData.isActive,
        isAdmin: technicianData.isAdmin || false
      })
    } catch (error) {
      console.error('Failed to fetch technician:', error)
      toast.error('Gagal memuat data teknisi')
      router.push('/technicians')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim() || !formData.phone.trim()) {
      toast.error('Nama dan nomor HP wajib diisi')
      return
    }

    try {
      setSaving(true)
      await api.put(`/technicians/${id}`, formData)
      toast.success('Data teknisi berhasil diperbarui')
      router.push('/technicians')
    } catch (error: any) {
      console.error('Failed to update technician:', error)
      toast.error(error.response?.data?.error || 'Gagal memperbarui data teknisi')
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
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
                    Edit Teknisi
                  </h1>
                  <p className="text-gray-600 mt-1">
                    Perbarui informasi teknisi
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Edit Form */}
          <div className="bg-white shadow rounded-lg p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Name Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <User className="h-4 w-4 inline mr-2" />
                    Nama Lengkap *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Masukkan nama lengkap"
                    required
                  />
                </div>

                {/* Phone Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Phone className="h-4 w-4 inline mr-2" />
                    Nomor HP *
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="08xxxxxxxxxx"
                    required
                  />
                </div>
              </div>

              {/* Telegram Info (Read Only) */}
              {technician.telegramChatId && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Informasi Telegram</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Username:</span> @{technician.telegramUsername || 'tidak ada'}
                    </div>
                    <div>
                      <span className="font-medium">Chat ID:</span> <code>{technician.telegramChatId}</code>
                    </div>
                  </div>
                </div>
              )}

              {/* Status Toggles */}
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => handleInputChange('isActive', e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                    Status Aktif
                  </label>
                  <span className="text-xs text-gray-500">
                    (Teknisi dapat menerima job baru)
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="isAdmin"
                    checked={formData.isAdmin}
                    onChange={(e) => handleInputChange('isAdmin', e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="isAdmin" className="text-sm font-medium text-gray-700 flex items-center">
                    <Shield className="h-4 w-4 mr-1" />
                    Admin Bot
                  </label>
                  <span className="text-xs text-gray-500">
                    (Dapat membuat job, tidak menerima notifikasi job)
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => router.push('/technicians')}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  disabled={saving}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
