import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../../contexts/AuthContext'
import Layout from '../../components/Layout'
import ProtectedRoute from '../../components/ProtectedRoute'
import { api } from '../../lib/api'
import { 
  ArrowLeft, 
  Package, 
  Edit, 
  Trash2,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Calendar,
  User,
  Hash,
  MapPin
} from 'lucide-react'
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
  _count?: {
    inventoryLogs: number
  }
}

interface InventoryLog {
  id: string
  type: 'IN' | 'OUT' | 'ADJUSTMENT'
  quantity: number
  previousQuantity: number
  newQuantity: number
  notes?: string
  createdAt: string
  user: {
    name: string
  }
  job?: {
    id: string
    jobNumber: string
    customerName: string
  }
}

export default function InventoryDetailPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { id } = router.query
  const [item, setItem] = useState<InventoryItem | null>(null)
  const [logs, setLogs] = useState<InventoryLog[]>([])
  const [loading, setLoading] = useState(true)
  const [logsLoading, setLogsLoading] = useState(true)

  useEffect(() => {
    if (id) {
      fetchItem()
      fetchLogs()
    }
  }, [id])

  const fetchItem = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/inventory/${id}`)
      setItem(response.data)
    } catch (error) {
      console.error('Failed to fetch inventory item:', error)
      toast.error('Gagal memuat data item')
      router.push('/inventory')
    } finally {
      setLoading(false)
    }
  }

  const fetchLogs = async () => {
    try {
      setLogsLoading(true)
      const response = await api.get(`/inventory/${id}/logs`)
      setLogs(response.data)
    } catch (error) {
      console.error('Failed to fetch inventory logs:', error)
    } finally {
      setLogsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!item) return
    
    if (!confirm(`Apakah Anda yakin ingin menghapus item ${item.name}?`)) {
      return
    }

    try {
      await api.delete(`/inventory/${id}`)
      toast.success('Item berhasil dihapus')
      router.push('/inventory')
    } catch (error: any) {
      console.error('Failed to delete item:', error)
      toast.error(error.response?.data?.error || 'Gagal menghapus item')
    }
  }

  const getStockStatus = (quantity: number, minStock: number, maxStock: number) => {
    if (quantity <= minStock) {
      return { status: 'low', color: 'text-red-600', bgColor: 'bg-red-100', icon: AlertTriangle }
    } else if (quantity >= maxStock) {
      return { status: 'high', color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: TrendingUp }
    } else {
      return { status: 'normal', color: 'text-green-600', bgColor: 'bg-green-100', icon: CheckCircle }
    }
  }

  const getLogTypeColor = (type: string) => {
    switch (type) {
      case 'IN': return 'bg-green-100 text-green-800'
      case 'OUT': return 'bg-red-100 text-red-800'
      case 'ADJUSTMENT': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getLogTypeIcon = (type: string) => {
    switch (type) {
      case 'IN': return <TrendingUp className="h-4 w-4" />
      case 'OUT': return <TrendingDown className="h-4 w-4" />
      case 'ADJUSTMENT': return <Edit className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const getLogTypeName = (type: string) => {
    switch (type) {
      case 'IN': return 'Masuk'
      case 'OUT': return 'Keluar'
      case 'ADJUSTMENT': return 'Penyesuaian'
      default: return type
    }
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

  if (!item) {
    return (
      <ProtectedRoute>
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

  const stockStatus = getStockStatus(item.quantity, item.minStock, item.maxStock)
  const StatusIcon = stockStatus.icon

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/inventory')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Kembali"
                >
                  <ArrowLeft className="h-5 w-5 text-gray-600" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                    <Package className="h-8 w-8 text-blue-600 mr-3" />
                    {item.name}
                  </h1>
                  <p className="text-gray-600 mt-1">
                    Detail informasi item inventory
                  </p>
                </div>
              </div>
              
              {(user?.role === 'superadmin' || user?.role === 'admin' || user?.role === 'gudang') && (
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => router.push(`/inventory/${id}/edit`)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors flex items-center"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Hapus
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Item Info */}
            <div className="lg:col-span-1">
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Informasi Item</h2>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Package className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Nama Item</p>
                      <p className="font-medium">{item.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Hash className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">SKU</p>
                      <p className="font-medium">{item.sku}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Package className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Kategori</p>
                      <p className="font-medium">{item.category}</p>
                    </div>
                  </div>

                  {item.description && (
                    <div className="flex items-start space-x-3">
                      <Package className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500">Deskripsi</p>
                        <p className="font-medium">{item.description}</p>
                      </div>
                    </div>
                  )}

                  {item.location && (
                    <div className="flex items-center space-x-3">
                      <MapPin className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Lokasi</p>
                        <p className="font-medium">{item.location}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center space-x-3">
                    <Calendar className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Dibuat</p>
                      <p className="font-medium">
                        {new Date(item.createdAt).toLocaleDateString('id-ID', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Stock Status */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Status Stok</h3>
                  <div className={`flex items-center space-x-2 p-3 rounded-lg ${stockStatus.bgColor}`}>
                    <StatusIcon className={`h-5 w-5 ${stockStatus.color}`} />
                    <div>
                      <p className={`font-medium ${stockStatus.color}`}>
                        {item.quantity} {item.unit}
                      </p>
                      <p className="text-xs text-gray-600">
                        Min: {item.minStock} • Max: {item.maxStock}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Harga</h3>
                  <p className="text-2xl font-bold text-gray-900">
                    Rp {item.price.toLocaleString('id-ID')}
                  </p>
                  <p className="text-sm text-gray-500">per {item.unit}</p>
                </div>

                {/* Statistics */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Statistik</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Total Transaksi</span>
                      <span className="font-medium">{item._count?.inventoryLogs || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Nilai Stok</span>
                      <span className="font-medium">
                        Rp {(item.quantity * item.price).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Transaction History */}
            <div className="lg:col-span-2">
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Riwayat Transaksi
                </h2>

                {logsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div key={index}>
                        <div className="h-16 bg-gray-200 rounded-lg"></div>
                      </div>
                    ))}
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Belum ada transaksi</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Item ini belum memiliki riwayat transaksi.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {logs.map((log) => (
                      <div key={log.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getLogTypeColor(log.type)}`}>
                                {getLogTypeIcon(log.type)}
                                <span className="ml-1">{getLogTypeName(log.type)}</span>
                              </span>
                              <span className="text-sm font-medium">
                                {log.type === 'OUT' ? '-' : '+'}{log.quantity} {item.unit}
                              </span>
                            </div>
                            
                            <div className="text-sm text-gray-600 mb-2">
                              <span className="font-medium">Stok:</span> {log.previousQuantity} → {log.newQuantity} {item.unit}
                            </div>
                            
                            {log.notes && (
                              <p className="text-sm text-gray-600 mb-2">
                                <span className="font-medium">Catatan:</span> {log.notes}
                              </p>
                            )}

                            {log.job && (
                              <p className="text-sm text-gray-600 mb-2">
                                <span className="font-medium">Job:</span> {log.job.jobNumber} - {log.job.customerName}
                              </p>
                            )}
                            
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <span className="flex items-center">
                                <User className="h-3 w-3 mr-1" />
                                {log.user.name}
                              </span>
                              <span className="flex items-center">
                                <Calendar className="h-3 w-3 mr-1" />
                                {new Date(log.createdAt).toLocaleDateString('id-ID', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
