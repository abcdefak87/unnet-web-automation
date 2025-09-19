import React, { useState, useEffect } from 'react'
import { X, TrendingDown } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { api } from '../../lib/api'

interface Item {
  id: string
  name: string
  code: string
  category: string
  subcategory?: string
  currentStock: number
  unit: string
  minStock: number
}

interface InventoryOutModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function InventoryOutModal({ isOpen, onClose, onSuccess }: InventoryOutModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [searchItems, setSearchItems] = useState('')
  const [formData, setFormData] = useState({
    itemId: '',
    quantity: '',
    location: '',
    technician: '',
    usedDate: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    if (isOpen) {
      fetchItems()
    }
  }, [isOpen])

  const fetchItems = async () => {
    try {
      const response = await api.get('/inventory/items')
      setItems(response.data.data?.items || [])
    } catch (error) {
      console.error('Failed to fetch items:', error)
      toast.error('Gagal memuat data item')
    }
  }

  const filteredItems = items.filter(item =>
    item.currentStock > 0 && 
    item.category !== 'MODEM' && // Exclude modems - use Smart Keluar instead
    (
      item.name.toLowerCase().includes(searchItems.toLowerCase()) ||
      item.code.toLowerCase().includes(searchItems.toLowerCase())
    )
  )

  const selectedItem = items.find(item => item.id === formData.itemId)

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'TEKNISI': return 'Barang untuk Teknisi'
      case 'KEPERLUAN_BERSAMA': return 'Keperluan Bersama'
      case 'MODEM': return 'Modem'
      default: return category
    }
  }

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
      
      await api.post(`/inventory/items/${formData.itemId}/stock/remove`, {
        quantity: quantity,
        notes: `ITEM KELUAR - ${formData.usedDate}${formData.technician ? ` | PIC: ${formData.technician}` : ''}${formData.location ? ` | Tujuan: ${formData.location}` : ''}`,
        technicianId: formData.technician || undefined
      })

      toast.success('Item keluar berhasil dicatat')
      onSuccess()
      handleClose()
    } catch (error: any) {
      console.error('Failed to remove stock:', error)
      const message = error.response?.data?.error || 'Gagal mencatat item keluar'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      itemId: '',
      quantity: '',
      location: '',
      technician: '',
      usedDate: new Date().toISOString().split('T')[0]
    })
    setSearchItems('')
    onClose()
  }

  const getStockWarning = () => {
    if (!selectedItem || !formData.quantity) return null
    
    const quantity = parseInt(formData.quantity)
    if (isNaN(quantity) || quantity <= 0) return null
    
    if (quantity > selectedItem.currentStock) {
      return {
        type: 'error',
        message: `Stok tidak mencukupi! Tersedia: ${selectedItem.currentStock} ${selectedItem.unit}`
      }
    }
    
    const remainingStock = selectedItem.currentStock - quantity
    if (remainingStock <= selectedItem.minStock) {
      return {
        type: 'warning',
        message: `Peringatan: Stok akan menjadi ${remainingStock} ${selectedItem.unit} (di bawah minimum ${selectedItem.minStock})`
      }
    }
    
    return null
  }

  const stockWarning = getStockWarning()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-white/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingDown className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Item Keluar - Non Modem</h2>
              <p className="text-sm text-gray-600">Catat pengeluaran barang teknisi & keperluan bersama</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Pilih Item */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pilih Item *
            </label>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Cari barang teknisi atau keperluan bersama..."
                value={searchItems}
                onChange={(e) => setSearchItems(e.target.value)}
                className="form-input"
              />
              <p className="text-xs text-gray-500 mt-1">
                Untuk modem, gunakan &quot;Smart Keluar&quot; (tombol merah)
              </p>
              
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

          {/* Jumlah */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Jumlah *
            </label>
            <input
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              className="form-input"
              placeholder="Masukkan jumlah"
              min="1"
              required
            />
          </div>

          {/* Lokasi & Teknisi */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lokasi/Tujuan
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="form-input"
                placeholder="Lokasi penggunaan atau tujuan"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Teknisi/PIC
              </label>
              <input
                type="text"
                value={formData.technician || ''}
                onChange={(e) => setFormData({ ...formData, technician: e.target.value })}
                className="form-input"
                placeholder="Nama teknisi yang mengambil"
              />
            </div>
          </div>

          {/* Tanggal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tanggal *
            </label>
            <input
              type="date"
              value={formData.usedDate}
              onChange={(e) => setFormData({ ...formData, usedDate: e.target.value })}
              className="form-input"
              required
            />
          </div>

          {/* Item Preview */}
          {selectedItem && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Detail Item</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Nama:</span>
                  <p className="font-medium">{selectedItem.name}</p>
                </div>
                <div>
                  <span className="text-gray-600">Kode:</span>
                  <p className="font-medium">{selectedItem.code}</p>
                </div>
                <div>
                  <span className="text-gray-600">Kategori:</span>
                  <p className="font-medium">
                    {getCategoryName(selectedItem.category)}
                    {selectedItem.subcategory && ` - ${selectedItem.subcategory}`}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">Stok Saat Ini:</span>
                  <p className="font-medium">{selectedItem.currentStock} {selectedItem.unit}</p>
                </div>
              </div>
            </div>
          )}

          {/* Stock Warning */}
          {stockWarning && (
            <div className={`p-4 rounded-lg ${
              stockWarning.type === 'error' 
                ? 'bg-red-50 border border-red-200 text-red-700' 
                : 'bg-yellow-50 border border-yellow-200 text-yellow-700'
            }`}>
              <p className="text-sm font-medium">{stockWarning.message}</p>
            </div>
          )}

          {/* Summary */}
          {selectedItem && formData.quantity && !stockWarning?.type && (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <h4 className="font-medium text-red-900 mb-2">Ringkasan</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-red-700">Item:</span>
                  <span className="font-medium text-red-900">{selectedItem.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-700">Jumlah keluar:</span>
                  <span className="font-medium text-red-900">{formData.quantity} {selectedItem.unit}</span>
                </div>
                <div className="flex justify-between border-t border-red-300 pt-2">
                  <span className="text-red-700 font-medium">Stok setelah:</span>
                  <span className="font-bold text-red-900">
                    {selectedItem.currentStock - parseInt(formData.quantity || '0')} {selectedItem.unit}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-4 pt-4 border-t">
            <button
              type="button"
              onClick={handleClose}
              className="btn-outline flex-1"
              disabled={isLoading}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={isLoading || !formData.itemId || !formData.quantity || stockWarning?.type === 'error'}
            >
              {isLoading ? 'Menyimpan...' : 'Catat Item Keluar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
