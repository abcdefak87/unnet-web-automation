import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../../contexts/AuthContext'
import Layout from '../../components/Layout'
import ProtectedRoute from '../../components/ProtectedRoute'
import { api } from '../../lib/api'
import { 
  ArrowLeft, 
  Minus, 
  Package,
  Calendar,
  User,
  FileText,
  TrendingDown,
  AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Item {
  id: string
  name: string
  code: string
  category: string
  subcategory?: string
  unit: string
  price: number
  currentStock: number
  minStock: number
}

export default function BarangKeluar() {
  const { user } = useAuth()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [searchItems, setSearchItems] = useState('')
  const [formData, setFormData] = useState({
    itemId: '',
    quantity: '',
    location: '',
    usedDate: new Date().toISOString().split('T')[0]
  })


  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    try {
      const response = await api.get('/inventory/items')
      setItems(response.data.data?.items || [])
    } catch (error) {
      console.error('Failed to fetch items:', error)
      toast.error('Gagal memuat data barang')
    }
  }

  const filteredItems = items.filter(item => 
    item.currentStock > 0 && (
      item.name.toLowerCase().includes(searchItems.toLowerCase()) ||
      item.code.toLowerCase().includes(searchItems.toLowerCase())
    )
  )

  const selectedItem = items.find(item => item.id === formData.itemId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.itemId || !formData.quantity) {
      toast.error('Pilih item dan masukkan jumlah')
      return
    }

    const quantity = parseInt(formData.quantity)
    if (quantity <= 0) {
      toast.error('Jumlah harus lebih dari 0')
      return
    }

    if (selectedItem && quantity > selectedItem.currentStock) {
      toast.error(`Stok tidak mencukupi. Stok tersedia: ${selectedItem.currentStock} ${selectedItem.unit}`)
      return
    }

    try {
      setIsLoading(true)
      
      await api.post('/inventory/items/:id/stock/remove', {
        itemId: formData.itemId,
        quantity: quantity,
        notes: `ITEM KELUAR - Dikeluarkan pada ${formData.usedDate}${formData.location ? ` | Lokasi: ${formData.location}` : ''}`
      })

      toast.success('Item keluar berhasil dicatat')
      router.push('/inventory')
    } catch (error: any) {
      console.error('Failed to remove stock:', error)
      const message = error.response?.data?.error || 'Gagal mencatat item keluar'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const getStockWarning = () => {
    if (!selectedItem || !formData.quantity) return null
    
    const quantity = parseInt(formData.quantity)
    const newStock = selectedItem.currentStock - quantity
    
    if (newStock < 0) {
      return { type: 'error', message: 'Stok tidak mencukupi!' }
    } else if (newStock <= selectedItem.minStock) {
      return { type: 'warning', message: 'Stok akan menjadi rendah setelah pengeluaran ini!' }
    }
    
    return null
  }

  const stockWarning = getStockWarning()

  return (
    <ProtectedRoute>
      <Layout title="Barang Keluar">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <button
              onClick={() => router.back()}
              className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Kembali
            </button>
            
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Item Keluar</h1>
                <p className="text-gray-600">Catat pengeluaran item dari inventory</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Informasi Item
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pilih Item *
                  </label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Cari nama barang atau kode..."
                      value={searchItems}
                      onChange={(e) => setSearchItems(e.target.value)}
                      className="form-input"
                    />
                    
                    <select
                      value={formData.itemId}
                      onChange={(e) => setFormData({ ...formData, itemId: e.target.value })}
                      className="form-input"
                      required
                    >
                      <option value="">Pilih item...</option>
                      {filteredItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.code}) - Stok: {item.currentStock} {item.unit}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Jumlah *
                  </label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="input"
                    placeholder="Masukkan jumlah"
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lokasi
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="input"
                    placeholder="Lokasi penggunaan"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tanggal *
                  </label>
                  <input
                    type="date"
                    value={formData.usedDate}
                    onChange={(e) => setFormData({ ...formData, usedDate: e.target.value })}
                    className="input"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Summary */}
            {selectedItem && formData.quantity && (
              <div className="card p-6 bg-red-50 border-red-200">
                <h3 className="font-medium text-red-900 mb-3">Ringkasan</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-red-700">Barang:</span>
                    <span className="font-medium text-red-900">{selectedItem.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-700">Jumlah keluar:</span>
                    <span className="font-medium text-red-900">
                      {formData.quantity} {selectedItem.unit}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-700">Stok sebelum:</span>
                    <span className="font-medium text-red-900">
                      {selectedItem.currentStock} {selectedItem.unit}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-red-300 pt-2">
                    <span className="text-red-700 font-medium">Stok setelah:</span>
                    <span className={`font-bold ${
                      selectedItem.currentStock - parseInt(formData.quantity || '0') <= selectedItem.minStock
                        ? 'text-red-900' 
                        : 'text-red-900'
                    }`}>
                      {selectedItem.currentStock - parseInt(formData.quantity || '0')} {selectedItem.unit}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="btn-outline flex-1"
                disabled={isLoading}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn-secondary flex-1"
                disabled={isLoading || !formData.itemId || !formData.quantity || stockWarning?.type === 'error'}
              >
                {isLoading ? 'Menyimpan...' : 'Catat Item Keluar'}
              </button>
            </div>
          </form>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}

