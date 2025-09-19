import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../../../contexts/AuthContext'
import Layout from '../../../components/Layout'
import ProtectedRoute from '../../../components/ProtectedRoute'
import { api } from '../../../lib/api'
import { ArrowLeft, Save, Package, Hash, MapPin, DollarSign } from 'lucide-react'
import toast from 'react-hot-toast'

interface InventoryItem {
  id: string
  name: string
  description?: string
  sku: string
  category: string
  quantity: number
  minStock: number
  maxStock: number
  unit: string
  price: number
  location?: string
  createdAt: string
  updatedAt: string
}

export default function EditInventoryPage() {
  const { user } = useAuth()
  const canEdit = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'gudang';
  const router = useRouter()
  const { id } = router.query
  const [item, setItem] = useState<InventoryItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',
    category: '',
    quantity: 0,
    minStock: 0,
    maxStock: 0,
    unit: '',
    price: 0,
    location: ''
  })

  useEffect(() => {
    if (id) {
      fetchItem()
    }
  }, [id])

  const fetchItem = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/inventory/${id}`)
      const itemData = response.data
      setItem(itemData)
      setFormData({
        name: itemData.name || '',
        description: itemData.description || '',
        sku: itemData.sku || '',
        category: itemData.category || '',
        quantity: itemData.quantity || 0,
        minStock: itemData.minStock || 0,
        maxStock: itemData.maxStock || 0,
        unit: itemData.unit || '',
        price: itemData.price || 0,
        location: itemData.location || ''
      })
    } catch (error) {
      console.error('Failed to fetch item:', error)
      toast.error('Gagal memuat data item')
      router.push('/inventory')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim() || !formData.sku.trim() || !formData.unit.trim()) {
      toast.error('Nama, SKU, dan unit wajib diisi')
      return
    }

    if (formData.minStock < 0 || formData.maxStock < 0 || formData.quantity < 0) {
      toast.error('Stok tidak boleh negatif')
      return
    }

    if (formData.minStock > formData.maxStock) {
      toast.error('Stok minimum tidak boleh lebih besar dari stok maksimum')
      return
    }

    try {
      setSaving(true)
      await api.put(`/inventory/items/${id}`, formData)
      toast.success('Data item berhasil diperbarui')
      router.push(`/inventory/${id}`)
    } catch (error: any) {
      console.error('Failed to update item:', error)
      toast.error(error.response?.data?.error || 'Gagal memperbarui data item')
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
      <ProtectedRoute requiredRole="gudang">
        <Layout>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </Layout>
      </ProtectedRoute>
    )
  }

  if (!item) {
    return (
      <ProtectedRoute requiredRole="gudang">
        <Layout>
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Item Tidak Ditemukan</h2>
            <p className="text-gray-500 mb-4">Data item yang Anda cari tidak ditemukan</p>
            <button
              onClick={() => router.push('/inventory')}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Kembali ke Inventory
            </button>
          </div>
        </Layout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute requiredRole="gudang">
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push(`/inventory/${id}`)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Kembali"
                >
                  <ArrowLeft className="h-5 w-5 text-gray-600" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                    <Package className="h-8 w-8 text-blue-600 mr-3" />
                    Edit Item Inventory
                  </h1>
                  <p className="text-gray-600 mt-1">
                    Perbarui informasi item inventory
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
                    <Package className="h-4 w-4 inline mr-2" />
                    Nama Item *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Masukkan nama item"
                    required
                  />
                </div>

                {/* SKU Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Hash className="h-4 w-4 inline mr-2" />
                    SKU *
                  </label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => handleInputChange('sku', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Masukkan SKU"
                    required
                  />
                </div>

                {/* Category Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kategori *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Pilih Kategori</option>
                    <option value="TEKNISI">Teknisi</option>
                    <option value="KEPERLUAN_BERSAMA">Keperluan Bersama</option>
                    <option value="MODEM">Modem</option>
                  </select>
                </div>

                {/* Unit Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unit *
                  </label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => handleInputChange('unit', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="pcs, meter, kg, dll"
                    required
                  />
                </div>

                {/* Quantity Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stok Saat Ini
                  </label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                  />
                </div>

                {/* Price Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <DollarSign className="h-4 w-4 inline mr-2" />
                    Harga per Unit
                  </label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                    step="0.01"
                  />
                </div>

                {/* Min Stock Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stok Minimum
                  </label>
                  <input
                    type="number"
                    value={formData.minStock}
                    onChange={(e) => handleInputChange('minStock', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                  />
                </div>

                {/* Max Stock Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stok Maksimum
                  </label>
                  <input
                    type="number"
                    value={formData.maxStock}
                    onChange={(e) => handleInputChange('maxStock', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="0"
                  />
                </div>
              </div>

              {/* Description Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deskripsi
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Deskripsi item (opsional)"
                />
              </div>

              {/* Location Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MapPin className="h-4 w-4 inline mr-2" />
                  Lokasi Penyimpanan
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Rak A1, Gudang B, dll (opsional)"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => router.push(`/inventory/${id}`)}
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
