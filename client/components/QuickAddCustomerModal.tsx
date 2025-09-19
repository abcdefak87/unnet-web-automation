import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { X, User, Phone, MapPin } from 'lucide-react'
import { api } from '../lib/api'
import toast from 'react-hot-toast'

interface CustomerForm {
  name: string
  phone: string
  address: string
}

interface QuickAddCustomerModalProps {
  isOpen: boolean
  onClose: () => void
  onCustomerAdded: (customer: any) => void
}

export default function QuickAddCustomerModal({ 
  isOpen, 
  onClose, 
  onCustomerAdded 
}: QuickAddCustomerModalProps) {
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerForm>()

  const onSubmit = async (data: CustomerForm) => {
    setIsLoading(true)
    try {
      const response = await api.post('/customers', data)
      const newCustomer = response.data
      
      toast.success('Pelanggan berhasil ditambahkan!')
      onCustomerAdded(newCustomer)
      reset()
      onClose()
    } catch (error: any) {
      console.error('Customer creation error:', error)
      const message = error.response?.data?.error || 
                     error.response?.data?.errors?.[0]?.msg || 
                     'Gagal menambahkan pelanggan'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-white/20 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Tambah Pelanggan Baru</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name */}
          <div>
            <label className="form-label">Nama *</label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="text"
                {...register('name', { required: 'Nama wajib diisi' })}
                className="form-input pl-10"
                placeholder="Nama lengkap pelanggan"
              />
            </div>
            {errors.name && (
              <p className="form-error">{errors.name.message}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="form-label">No. Telepon *</label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="tel"
                {...register('phone', { 
                  required: 'No. telepon wajib diisi',
                  pattern: {
                    value: /^[0-9+\-\s()]+$/,
                    message: 'Format nomor telepon tidak valid'
                  }
                })}
                className="form-input pl-10"
                placeholder="081234567890"
              />
            </div>
            {errors.phone && (
              <p className="form-error">{errors.phone.message}</p>
            )}
          </div>


          {/* Address */}
          <div>
            <label className="form-label">Alamat *</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <textarea
                {...register('address', { required: 'Alamat wajib diisi' })}
                className="form-input pl-10"
                rows={3}
                placeholder="Alamat lengkap pelanggan"
              />
            </div>
            {errors.address && (
              <p className="form-error">{errors.address.message}</p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="btn-outline"
              disabled={isLoading}
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
                'Tambah Pelanggan'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
