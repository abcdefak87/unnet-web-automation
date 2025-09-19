import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../../contexts/AuthContext'
import Layout from '../../components/Layout'
import ProtectedRoute from '../../components/ProtectedRoute'
import InventoryCreateModal from '../../components/modals/InventoryCreateModal'
import InventoryOutModal from '../../components/modals/InventoryOutModal'
import ModemScannerModal from '../../components/ModemScannerModal'
import SmartModemOutModal from '../../components/SmartModemOutModal'
import SmartModemReturnModal from '../../components/SmartModemReturnModal'
import { api } from '../../lib/api'
import { 
  Search, 
  Plus, 
  Package, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Eye,
  Edit,
  Trash2,
  Scan
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function Inventory() {
  const { user } = useAuth()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showOutModal, setShowOutModal] = useState(false)
  const [showScannerModal, setShowScannerModal] = useState(false)
  const [showSmartOutModal, setShowSmartOutModal] = useState(false)
  const [showReturnModal, setShowReturnModal] = useState(false)

  const fetchItems = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await api.get(`/inventory/items?search=${search}&category=${categoryFilter}`)
      setItems(response.data.data?.items || [])
    } catch (error: any) {
      console.error('Failed to fetch items:', error)
      if (error.response?.status === 403) {
        toast.error('Akses ditolak - Anda tidak memiliki izin untuk melihat inventory')
      } else {
        toast.error('Gagal memuat data inventory')
      }
    } finally {
      setIsLoading(false)
    }
  }, [search, categoryFilter])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const getStockStatus = (item: any) => {
    if (item.currentStock <= item.minStock) {
      return { status: 'low', color: 'text-red-600', bg: 'bg-red-100', icon: AlertTriangle }
    } else if (item.currentStock <= item.minStock * 2) {
      return { status: 'medium', color: 'text-yellow-600', bg: 'bg-yellow-100', icon: TrendingDown }
    } else {
      return { status: 'good', color: 'text-green-600', bg: 'bg-green-100', icon: TrendingUp }
    }
  }

  const deleteItem = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus item ini?')) return

    try {
      await api.delete(`/inventory/items/${id}`)
      toast.success('Item berhasil dihapus')
      fetchItems()
    } catch (error: any) {
      const message = error.response?.data?.error || 'Gagal menghapus item'
      toast.error(message)
    }
  }

  return (
    <ProtectedRoute>
      <Layout title="Kelola Inventory">
        <div className="space-y-6">
          {/* Header Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-4">
                <div className="relative flex-1 max-w-md">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className="form-input pl-10"
                    placeholder="Cari nama item atau kode..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                
                <select
                  className="form-input"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="">Semua Kategori</option>
                  <option value="TEKNISI">Barang untuk Teknisi</option>
                  <option value="KEPERLUAN_BERSAMA">Keperluan Bersama</option>
                  <option value="MODEM">Modem</option>
                </select>
              </div>
            </div>
            
            <div className="inventory-buttons mt-4 sm:mt-0 sm:ml-4 grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
              <button
                onClick={() => setShowScannerModal(true)}
                className="btn-primary w-full sm:w-auto"
              >
                <Scan className="h-5 w-5 mr-2" />
                Scan Masuk
              </button>
              <button
                onClick={() => setShowSmartOutModal(true)}
                className="btn-danger w-full sm:w-auto"
              >
                <Scan className="h-5 w-5 mr-2" />
                Smart Keluar
              </button>
              <button
                onClick={() => setShowReturnModal(true)}
                className="btn-success w-full sm:w-auto"
              >
                <Scan className="h-5 w-5 mr-2" />
                Smart Kembali
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary w-full sm:w-auto"
              >
                <Plus className="h-5 w-5 mr-2" />
                Tambah Item
              </button>
              <button
                onClick={() => setShowOutModal(true)}
                className="btn-outline w-full sm:w-auto"
              >
                <TrendingDown className="h-5 w-5 mr-2" />
                Item Keluar
              </button>
              <button
                onClick={() => router.push('/inventory/logs')}
                className="btn-outline w-full sm:w-auto"
              >
                <Eye className="h-5 w-5 mr-2" />
                Lihat Log
              </button>
            </div>
          </div>

          {/* Items Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Item
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kategori
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stok
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Harga
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-gray-300 rounded"></div>
                            <div className="ml-4">
                              <div className="h-4 bg-gray-300 rounded w-32 mb-2"></div>
                              <div className="h-3 bg-gray-300 rounded w-24"></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="h-4 bg-gray-300 rounded w-20"></div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="h-4 bg-gray-300 rounded w-16"></div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="h-4 bg-gray-300 rounded w-24"></div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="h-6 bg-gray-300 rounded w-20"></div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex space-x-2">
                            <div className="w-8 h-8 bg-gray-300 rounded"></div>
                            <div className="w-8 h-8 bg-gray-300 rounded"></div>
                            <div className="w-8 h-8 bg-gray-300 rounded"></div>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <Package className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">Belum ada item</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          Mulai dengan menambahkan item pertama.
                        </p>
                        <div className="mt-6">
                          <button
                            onClick={() => setShowCreateModal(true)}
                            className="btn-primary"
                          >
                            <Plus className="h-5 w-5 mr-2" />
                            Tambah Item
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    items.map((item: any) => {
                      const stockStatus = getStockStatus(item)
                      const StatusIcon = stockStatus.icon
                      
                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10">
                                <div className="h-10 w-10 rounded bg-primary-100 flex items-center justify-center">
                                  <Package className="h-5 w-5 text-primary-600" />
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {item.name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {item.code}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="space-y-1">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {item.category === 'TEKNISI' ? 'Barang Teknisi' : 
                                 item.category === 'KEPERLUAN_BERSAMA' ? 'Keperluan Bersama' : 
                                 item.category === 'MODEM' ? 'Modem' : item.category}
                              </span>
                              {item.subcategory && (
                                <div className="text-xs text-gray-500">
                                  {item.subcategory.replace('_', ' ')}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {item.currentStock} {item.unit}
                            </div>
                            <div className="text-sm text-gray-500">
                              Min: {item.minStock}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            Rp {item.price?.toLocaleString('id-ID') || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stockStatus.bg} ${stockStatus.color}`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {stockStatus.status === 'low' && 'Stok Rendah'}
                              {stockStatus.status === 'medium' && 'Perlu Restock'}
                              {stockStatus.status === 'good' && 'Stok Aman'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => router.push(`/inventory/${item.id}`)}
                                className="text-gray-400 hover:text-primary-600 transition-colors"
                                title="Lihat detail"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => router.push(`/inventory/${item.id}/edit`)}
                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => deleteItem(item.id)}
                                className="text-gray-400 hover:text-red-600 transition-colors"
                                title="Hapus"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Category Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Barang Teknisi */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Barang untuk Teknisi</h3>
                <Package className="h-8 w-8 text-blue-600" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Items:</span>
                  <span className="font-semibold">
                    {items.filter((item: any) => item.category === 'TEKNISI').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Stok:</span>
                  <span className="font-semibold">
                    {items.filter((item: any) => item.category === 'TEKNISI')
                          .reduce((total: number, item: any) => total + item.currentStock, 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Stok Rendah:</span>
                  <span className="font-semibold text-red-600">
                    {items.filter((item: any) => item.category === 'TEKNISI' && item.currentStock <= item.minStock).length}
                  </span>
                </div>
              </div>
            </div>

            {/* Keperluan Bersama */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Keperluan Bersama</h3>
                <Package className="h-8 w-8 text-green-600" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Items:</span>
                  <span className="font-semibold">
                    {items.filter((item: any) => item.category === 'KEPERLUAN_BERSAMA').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Stok:</span>
                  <span className="font-semibold">
                    {items.filter((item: any) => item.category === 'KEPERLUAN_BERSAMA')
                          .reduce((total: number, item: any) => total + item.currentStock, 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Stok Rendah:</span>
                  <span className="font-semibold text-red-600">
                    {items.filter((item: any) => item.category === 'KEPERLUAN_BERSAMA' && item.currentStock <= item.minStock).length}
                  </span>
                </div>
              </div>
            </div>

            {/* Modem */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Modem</h3>
                <Package className="h-8 w-8 text-purple-600" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Items:</span>
                  <span className="font-semibold">
                    {items.filter((item: any) => item.category === 'MODEM').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Stok:</span>
                  <span className="font-semibold">
                    {items.filter((item: any) => item.category === 'MODEM')
                          .reduce((total: number, item: any) => total + item.currentStock, 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Stok Rendah:</span>
                  <span className="font-semibold text-red-600">
                    {items.filter((item: any) => item.category === 'MODEM' && item.currentStock <= item.minStock).length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Modem Breakdown */}
          {items.filter((item: any) => item.category === 'MODEM').length > 0 && (
            <div className="card p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Detail Stok Modem</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {['ZTE_V3', 'ZTE_5G', 'HUAWEI_5H5', 'HUAWEI_5V5', 'VIBERHOME'].map((subcategory) => {
                  const modemItems = items.filter((item: any) => 
                    item.category === 'MODEM' && item.subcategory === subcategory
                  );
                  const totalStock = modemItems.reduce((total: number, item: any) => total + item.currentStock, 0);
                  const lowStock = modemItems.filter((item: any) => item.currentStock <= item.minStock).length;
                  
                  return (
                    <div key={subcategory} className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-2">
                        {subcategory.replace('_', ' ')}
                      </h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Stok:</span>
                          <span className="font-semibold">{totalStock}</span>
                        </div>
                        {lowStock > 0 && (
                          <div className="flex justify-between">
                            <span className="text-red-600">Rendah:</span>
                            <span className="font-semibold text-red-600">{lowStock}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Package className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Total Items</p>
                  <p className="text-lg font-semibold text-gray-900">{items.length}</p>
                </div>
              </div>
            </div>
            
            <div className="card p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Stok Rendah</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {items.filter((item: any) => item.currentStock <= item.minStock).length}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="card p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <TrendingUp className="h-8 w-8 text-green-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Total Nilai</p>
                  <p className="text-lg font-semibold text-gray-900">
                    Rp {items.reduce((total: number, item: any) => total + (item.currentStock * (item.price || 0)), 0).toLocaleString('id-ID')}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="card p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Package className="h-8 w-8 text-purple-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Kategori</p>
                  <p className="text-lg font-semibold text-gray-900">3</p>
                </div>
              </div>
            </div>
          </div>

          {showCreateModal && (
          <InventoryCreateModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false)
              fetchItems()
            }}
          />
        )}

        {showOutModal && (
          <InventoryOutModal
            isOpen={showOutModal}
            onClose={() => setShowOutModal(false)}
            onSuccess={() => {
              setShowOutModal(false)
              fetchItems()
            }}
          />
        )}

        {showScannerModal && (
          <ModemScannerModal
            isOpen={showScannerModal}
            onClose={() => setShowScannerModal(false)}
            onSuccess={() => {
              setShowScannerModal(false)
              fetchItems()
            }}
          />
        )}

        {showSmartOutModal && (
          <SmartModemOutModal
            isOpen={showSmartOutModal}
            onClose={() => setShowSmartOutModal(false)}
            onSuccess={() => {
              setShowSmartOutModal(false)
              fetchItems()
            }}
          />
        )}

        {showReturnModal && (
          <SmartModemReturnModal
            isOpen={showReturnModal}
            onClose={() => setShowReturnModal(false)}
            onSuccess={() => {
              setShowReturnModal(false)
              fetchItems()
            }}
          />
        )}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}

