import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../contexts/AuthContext'
import { useRealtime } from '../contexts/RealtimeContext'
import { useRealtimeData } from '../hooks/useRealtimeData'
import Layout from '../components/Layout'
import { api } from '../lib/api'
import toast from 'react-hot-toast'
import DualCustomerModal from '../components/modals/DualCustomerModal'
import { MapPin, Calendar, Edit, Trash2 } from 'lucide-react'

interface Customer {
  id: string
  name: string
  phone: string
  address: string
  createdAt: string
  _count: {
    jobs: number
  }
}

interface EditCustomerModalProps {
  isOpen: boolean
  onClose: () => void
  customer: Customer | null
  onCustomerUpdated: (customer: Customer) => void
}

function EditCustomerModal({ isOpen, onClose, customer, onCustomerUpdated }: EditCustomerModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: ''
  })
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || '',
        phone: customer.phone || '',
        address: customer.address || ''
      })
    } else {
      setFormData({
        name: '',
        phone: '',
        address: ''
      })
    }
  }, [customer])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customer) return

    setIsLoading(true)
    try {
      const response = await api.put(`/customers/${customer.id}`, formData)
      toast.success('Pelanggan berhasil diperbarui!')
      onCustomerUpdated(response.data.data.customer)
      onClose()
    } catch (error: any) {
      const message = error.response?.data?.error || 'Gagal memperbarui pelanggan'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen || !customer) return null

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Edit Pelanggan</h2>
        </div>
        <div className="modal-body">
          <form id="edit-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">Nama *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="form-input"
                required
              />
            </div>

            <div>
              <label className="form-label">No. Telepon *</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="form-input"
                required
              />
            </div>

            <div>
              <label className="form-label">Alamat *</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                className="form-input"
                rows={3}
                required
              />
            </div>
          </form>
        </div>
        
        <div className="modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="btn-outline"
            disabled={isLoading}
          >
            Batal
          </button>
          <button
            type="submit"
            form="edit-form"
            disabled={isLoading}
            className="btn-primary"
          >
            {isLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface DeleteConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  customer: Customer | null
  onCustomerDeleted: () => void
}

function DeleteConfirmModal({ isOpen, onClose, customer, onCustomerDeleted }: DeleteConfirmModalProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleDeleteCustomer = async (customerId: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus pelanggan ini?')) {
      return
    }

    try {
      await api.delete(`/customers/${customerId}`)
      toast.success('Pelanggan berhasil dihapus')
      // Real-time update will handle the UI refresh automatically
    } catch (error: any) {
      console.error('Error deleting customer:', error)
      const message = error.response?.data?.error || 'Gagal menghapus pelanggan'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen || !customer) return null

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Konfirmasi Hapus</h2>
        </div>
        
        <div className="modal-body">
          <p className="text-sm text-gray-600">
            Apakah Anda yakin ingin menghapus pelanggan <strong>{customer.name}</strong>?
            Tindakan ini tidak dapat dibatalkan.
          </p>
        </div>
        
        <div className="modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="btn-outline"
            disabled={isLoading}
          >
            Batal
          </button>
          <button
            onClick={() => {
              setIsLoading(true)
              handleDeleteCustomer(customer.id)
              onCustomerDeleted()
              onClose()
            }}
            disabled={isLoading}
            className="btn-danger"
          >
            {isLoading ? 'Menghapus...' : 'Hapus'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PelangganPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  
  // Real-time data hook
  const { data: customers, loading, updateData, refetch } = useRealtimeData<Customer>({
    endpoint: '/customers',
    dependencies: []
  })
  
  const { isConnected } = useRealtime()
  
  // Filter customers based on search term
  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.includes(searchTerm) ||
    customer.address.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  useEffect(() => {
    refetch()
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    refetch()
  }

  const handleCustomerAdded = (newCustomer: Customer) => {
    setShowAddModal(false)
    toast.success('Pelanggan berhasil ditambahkan!')
    // Real-time update will handle adding the customer to the list
  }

  const handleCustomerUpdated = (updatedCustomer: Customer) => {
    updateData(updatedCustomer, 'updated')
    toast.success('Pelanggan berhasil diperbarui!')
  }

  const handleCustomerDeleted = () => {
    // Real-time update will handle removing the customer from the list
    toast.success('Pelanggan berhasil dihapus!')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  return (
    <Layout title="Pelanggan">
      <div className="container-responsive section-padding">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manajemen Pelanggan</h1>
            <p className="text-gray-600">Kelola data pelanggan dan informasi kontak</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-white rounded-md border border-transparent hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            + Tambah Pelanggan
          </button>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Cari nama, telepon, atau alamat..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input pl-10"
              />
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            <button type="submit" className="btn-primary">
              Cari
            </button>
          </form>
        </div>

        {/* Customer List */}
        <div className="bg-white rounded-xl shadow-lg">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center">
              <svg className="h-6 w-6 mr-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Daftar Pelanggan
            </h2>
            <p className="mt-2 text-sm text-gray-600">Kelola data pelanggan ISP Anda dengan mudah</p>
          </div>

          {loading ? (
            <div className="flex-center h-64">
              <div className="loading-spinner w-12 h-12"></div>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-2 text-lg font-medium text-red-600">Belum ada data pelanggan</div>
              <p className="text-gray-600">Silakan tambahkan pelanggan baru</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th>Telepon</th>
                      <th>Alamat</th>
                      <th>Pekerjaan</th>
                      <th>Dibuat</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((customer, index) => (
                      <tr key={customer.id || `customer-${index}`}>
                        <td>
                          <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                        </td>
                        <td>
                          <div className="text-sm text-gray-900">{customer.phone}</div>
                        </td>
                        <td>
                          <div className="text-sm text-gray-900 max-w-xs truncate">{customer.address}</div>
                        </td>
                        <td>
                          <span className="status-online">
                            {customer._count.jobs} pekerjaan
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center text-sm text-gray-500">
                            <Calendar className="w-4 h-4 mr-1" />
                            {new Date(customer.createdAt).toLocaleDateString('id-ID')}
                          </div>
                        </td>
                        <td>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                setSelectedCustomer(customer)
                                setShowEditModal(true)
                              }}
                              className="p-1 text-blue-600 rounded transition-colors duration-200 hover:text-blue-900 hover:bg-blue-50"
                              title="Edit pelanggan"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedCustomer(customer)
                                setShowDeleteModal(true)
                              }}
                              className="p-1 text-red-600 rounded transition-colors duration-200 hover:text-red-900 hover:bg-red-50"
                              title="Hapus pelanggan"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {Math.ceil(filteredCustomers.length / itemsPerPage) > 1 && (
                <div className="flex-between mt-6">
                  <div className="text-sm text-gray-700">
                    Menampilkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredCustomers.length)} dari {filteredCustomers.length} pelanggan
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="btn-outline btn-sm"
                    >
                      Sebelumnya
                    </button>
                    
                    {Array.from({ length: Math.ceil(filteredCustomers.length / itemsPerPage) }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`btn-sm ${
                          currentPage === page
                            ? 'btn-primary'
                            : 'btn-outline'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredCustomers.length / itemsPerPage)))}
                      disabled={currentPage === Math.ceil(filteredCustomers.length / itemsPerPage)}
                      className="btn-outline btn-sm"
                    >
                      Selanjutnya
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <DualCustomerModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCustomerCreated={handleCustomerAdded}
        jobType="NEW_INSTALLATION"
      />

      <EditCustomerModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setSelectedCustomer(null)
        }}
        customer={selectedCustomer}
        onCustomerUpdated={handleCustomerUpdated}
      />

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setSelectedCustomer(null)
        }}
        customer={selectedCustomer}
        onCustomerDeleted={handleCustomerDeleted}
      />
    </Layout>
  )
}

