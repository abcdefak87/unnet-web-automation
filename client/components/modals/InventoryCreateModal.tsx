import React, { useState } from 'react'
import { X, Package, AlertCircle } from 'lucide-react'
import { api } from '../../lib/api'
import toast from 'react-hot-toast'

interface InventoryCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const CATEGORIES = [
  { value: 'TEKNISI', label: 'Barang untuk Teknisi' },
  { value: 'KEPERLUAN_BERSAMA', label: 'Keperluan Bersama' }
]

const COMMON_ITEMS = {
  TEKNISI: [
    'Tang Crimping', 'Kabel UTP', 'Connector RJ45', 'Tester Kabel',
    'Obeng Set', 'Tang Potong', 'Isolasi', 'Cable Ties',
    'Multimeter', 'Solder', 'Timah Solder', 'Heat Gun'
  ],
  KEPERLUAN_BERSAMA: [
    'Kertas A4', 'Tinta Printer', 'Pulpen', 'Spidol',
    'Stapler', 'Isi Stapler', 'Penggaris', 'Gunting',
    'Lakban', 'Amplop', 'Map Folder', 'Baterai AA/AAA'
  ]
}

export default function InventoryCreateModal({ isOpen, onClose, onSuccess }: InventoryCreateModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    quantity: '',
    location: '',
    price: '',
    supplier: '',
    description: '',
    receivedDate: new Date().toISOString().split('T')[0]
  })
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.category || !formData.quantity) {
      toast.error('Nama, kategori, dan jumlah wajib diisi')
      return
    }

    if (formData.category === 'MODEM') {
      toast.error('Gunakan fitur "Scan Masuk" untuk menambah modem')
      return
    }

    try {
      setIsLoading(true)
      
      // Generate smart code based on category and name
      const categoryPrefix = formData.category === 'TEKNISI' ? 'TKN' : 'KPB'
      const namePrefix = formData.name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '')
      const timestamp = Date.now().toString().slice(-4)
      const code = `${categoryPrefix}_${namePrefix}_${timestamp}`
      
      const payload = {
        name: formData.name,
        code: code,
        category: formData.category,
        unit: 'pcs',
        quantity: parseInt(formData.quantity) || 0,
        minStock: Math.max(1, Math.floor(parseInt(formData.quantity) * 0.2)), // 20% of initial stock
        price: parseFloat(formData.price) || 0,
        location: formData.location,
        description: formData.description || `${formData.supplier ? `Supplier: ${formData.supplier} | ` : ''}Ditambahkan pada ${formData.receivedDate}`
      }

      await api.post('/inventory/items', payload)
      
      toast.success('Item berhasil ditambahkan')
      onSuccess()
      handleClose()
    } catch (error: any) {
      console.error('Failed to create item:', error)
      const message = error.response?.data?.error || 'Gagal menambahkan item'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      name: '',
      category: '',
      quantity: '',
      location: '',
      price: '',
      supplier: '',
      description: '',
      receivedDate: new Date().toISOString().split('T')[0]
    })
    setSuggestions([])
    setShowSuggestions(false)
    onClose()
  }

  const handleNameChange = (value: string) => {
    setFormData({ ...formData, name: value })
    
    if (value.length > 1 && formData.category) {
      const categoryItems = COMMON_ITEMS[formData.category as keyof typeof COMMON_ITEMS] || []
      const filtered = categoryItems.filter(item => 
        item.toLowerCase().includes(value.toLowerCase())
      )
      setSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const selectSuggestion = (suggestion: string) => {
    setFormData({ ...formData, name: suggestion })
    setShowSuggestions(false)
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="modal-title">Tambah Item Baru</h2>
                <p className="modal-subtitle">Buat item inventory baru</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-lg hover:bg-gray-100"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Nama dengan Smart Suggestions */}
          <div className="relative">
            <label className="form-label form-label-required">
              Nama Item
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="form-input"
              placeholder="Ketik nama item... (akan muncul saran otomatis)"
              required
            />
            
            {/* Smart Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => selectSuggestion(suggestion)}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Kategori */}
          <div>
            <label className="form-label form-label-required">
              Kategori
            </label>
            <select
              value={formData.category}
              onChange={(e) => {
                setFormData({ ...formData, category: e.target.value })
                setShowSuggestions(false) // Reset suggestions when category changes
              }}
              className="form-input"
              required
            >
              <option value="">Pilih kategori...</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Untuk modem, gunakan fitur &quot;Scan Masuk&quot; (tombol biru)
            </p>
          </div>

          {/* Jumlah & Harga */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label form-label-required">
                Jumlah
              </label>
              <input
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="form-input"
                placeholder="0"
                required
              />
            </div>
            <div>
              <label className="form-label">
                Harga per Unit (Rp)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="form-input"
                placeholder="0"
              />
            </div>
          </div>

          {/* Lokasi & Supplier */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                Lokasi Penyimpanan
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="form-input"
                placeholder="Gudang A, Rak 1..."
              />
            </div>
            <div>
              <label className="form-label">
                Supplier/Vendor
              </label>
              <input
                type="text"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                className="form-input"
                placeholder="Nama supplier..."
              />
            </div>
          </div>

          {/* Deskripsi */}
          <div>
            <label className="form-label">
              Deskripsi/Catatan
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="form-input"
              placeholder="Deskripsi item, spesifikasi, atau catatan lainnya..."
              rows={3}
            />
          </div>

          {/* Tanggal */}
          <div>
            <label className="form-label form-label-required">
              Tanggal Diterima
            </label>
            <input
              type="date"
              value={formData.receivedDate}
              onChange={(e) => setFormData({ ...formData, receivedDate: e.target.value })}
              className="form-input"
              required
            />
          </div>

          {/* Smart Code Preview */}
          {formData.name && formData.category && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Preview Item</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-blue-700">Kode Otomatis:</span>
                  <p className="font-mono font-medium text-blue-900">
                    {formData.category === 'TEKNISI' ? 'TKN' : 'KPB'}_{formData.name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '')}_XXXX
                  </p>
                </div>
                <div>
                  <span className="text-blue-700">Min Stock (20%):</span>
                  <p className="font-medium text-blue-900">
                    {formData.quantity ? Math.max(1, Math.floor(parseInt(formData.quantity) * 0.2)) : 0} pcs
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="btn-secondary flex-1"
              disabled={isLoading}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={isLoading || !formData.name || !formData.category || !formData.quantity}
            >
              {isLoading ? 'Menyimpan...' : 'Tambah Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
