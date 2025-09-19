import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../../contexts/AuthContext'
import Layout from '../../components/Layout'
import ProtectedRoute from '../../components/ProtectedRoute'
import { api } from '../../lib/api'
import { 
  ArrowLeft, 
  Plus, 
  Package,
  Calendar,
  User,
  FileText,
  Truck
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

export default function BarangMasuk() {
  const { user } = useAuth()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [searchItems, setSearchItems] = useState('')
  const [formData, setFormData] = useState({
    type: 'MASUK',
    itemId: '',
    quantity: '',
    notes: '',
    supplier: '',
    invoiceNumber: '',
    receivedDate: new Date().toISOString().split('T')[0]
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
    item.name.toLowerCase().includes(searchItems.toLowerCase()) ||
    item.code.toLowerCase().includes(searchItems.toLowerCase())
  )

  const selectedItem = items.find(item => item.id === formData.itemId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.itemId || !formData.quantity) {
      toast.error('Pilih barang dan masukkan jumlah')
      return
    }

    if (parseInt(formData.quantity) <= 0) {
      toast.error('Jumlah harus lebih dari 0')
      return
    }

    try {
      setIsLoading(true)
      
      await api.post('/inventory/stock/add', {
        itemId: formData.itemId,
        quantity: parseInt(formData.quantity),
        notes: `BARANG MASUK - ${formData.notes}${formData.supplier ? ` | Supplier: ${formData.supplier}` : ''}${formData.invoiceNumber ? ` | Invoice: ${formData.invoiceNumber}` : ''}`,
        type: 'MASUK',
        supplier: formData.supplier,
        invoiceNumber: formData.invoiceNumber,
        receivedDate: formData.receivedDate
      })

      toast.success('Barang masuk berhasil dicatat')
      router.push('/inventory')
    } catch (error: any) {
      console.error('Failed to add stock:', error)
      const message = error.response?.data?.error || 'Gagal mencatat barang masuk'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ProtectedRoute>
      <Layout title="Barang Masuk">
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
              <div className="p-2 bg-green-100 rounded-lg">
                <Truck className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Barang Masuk</h1>
                <p className="text-gray-600">Catat penerimaan barang baru</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Informasi Barang
              </h2>
              
              <div className="space-y-4">
                {/* Item Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pilih Barang *
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
                      <option value="">Pilih barang...</option>
                      {filteredItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.code}) - Stok: {item.currentStock} {item.unit}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Selected Item Info */}
                {selectedItem && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <Package className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <h3 className="font-medium text-blue-900">{selectedItem.name}</h3>
                        <p className="text-sm text-blue-700">
                          Kode: {selectedItem.code} | Kategori: {
                            selectedItem.category === 'TEKNISI' ? 'Barang Teknisi' : 
                            selectedItem.category === 'KEPERLUAN_BERSAMA' ? 'Keperluan Bersama' : 
                            selectedItem.category === 'MODEM' ? 'Modem' : selectedItem.category
                          }
                          {selectedItem.subcategory && ` - ${selectedItem.subcategory.replace('_', ' ')}`}
                        </p>
                        <p className="text-sm text-blue-700">
                          Stok saat ini: {selectedItem.currentStock} {selectedItem.unit}
                        </p>
                        <p className="text-sm text-blue-700">
                          Harga: Rp {selectedItem.price?.toLocaleString('id-ID') || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Quantity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Jumlah Masuk *
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      min="1"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className="form-input flex-1"
                      placeholder="0"
                      required
                    />
                    <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-700">
                      {selectedItem?.unit || 'Unit'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Detail Penerimaan
              </h2>
              
              <div className="space-y-4">
                {/* Supplier */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <User className="h-4 w-4 inline mr-1" />
                    Supplier
                  </label>
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    className="form-input"
                    placeholder="Nama supplier..."
                  />
                </div>

                {/* Invoice Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <FileText className="h-4 w-4 inline mr-1" />
                    Nomor Invoice/Faktur
                  </label>
                  <input
                    type="text"
                    value={formData.invoiceNumber}
                    onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                    className="form-input"
                    placeholder="Nomor invoice..."
                  />
                </div>

                {/* Received Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    Tanggal Terima *
                  </label>
                  <input
                    type="date"
                    value={formData.receivedDate}
                    onChange={(e) => setFormData({ ...formData, receivedDate: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Catatan
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="form-input"
                    rows={3}
                    placeholder="Catatan tambahan..."
                  />
                </div>
              </div>
            </div>

            {/* Summary */}
            {selectedItem && formData.quantity && (
              <div className="card p-6 bg-green-50 border-green-200">
                <h3 className="font-medium text-green-900 mb-3">Ringkasan</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-700">Barang:</span>
                    <span className="font-medium text-green-900">{selectedItem.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Jumlah masuk:</span>
                    <span className="font-medium text-green-900">
                      {formData.quantity} {selectedItem.unit}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Stok sebelum:</span>
                    <span className="font-medium text-green-900">
                      {selectedItem.currentStock} {selectedItem.unit}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-green-300 pt-2">
                    <span className="text-green-700 font-medium">Stok setelah:</span>
                    <span className="font-bold text-green-900">
                      {selectedItem.currentStock + parseInt(formData.quantity || '0')} {selectedItem.unit}
                    </span>
                  </div>
                  {selectedItem.price && (
                    <div className="flex justify-between">
                      <span className="text-green-700">Nilai total:</span>
                      <span className="font-medium text-green-900">
                        Rp {(selectedItem.price * parseInt(formData.quantity || '0')).toLocaleString('id-ID')}
                      </span>
                    </div>
                  )}
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
                className="btn-primary flex-1"
                disabled={isLoading || !formData.itemId || !formData.quantity}
              >
                {isLoading ? 'Menyimpan...' : 'Catat Barang Masuk'}
              </button>
            </div>
          </form>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}

