import React, { useState } from 'react'
import { useRouter } from 'next/router'
import { useForm } from 'react-hook-form'
import { useAuth } from '../../contexts/AuthContext'
import Layout from '../../components/Layout'
import ProtectedRoute from '../../components/ProtectedRoute'
import { api } from '../../lib/api'
import { Package, Hash, DollarSign, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

interface ItemForm {
  name: string
  code: string
  category: 'CABLE' | 'ROUTER' | 'MODEM' | 'TOOLS' | 'ACCESSORIES'
  description?: string
  quantity: number
  minStock: number
  price?: number
  unit: string
  location?: string
}

export default function CreateItem() {
  const { user } = useAuth()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ItemForm>()

  const onSubmit = async (data: ItemForm) => {
    setIsLoading(true)
    try {
      await api.post('/inventory', {
        ...data,
        quantity: parseInt(data.quantity.toString()),
        minStock: parseInt(data.minStock.toString()),
        price: data.price ? parseFloat(data.price.toString()) : 0
      })

      toast.success('Item berhasil ditambahkan!')
      router.push('/inventory')
    } catch (error: any) {
      const message = error.response?.data?.error || 'Gagal menambahkan item'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ProtectedRoute>
      <Layout title="Tambah Item Inventory">
        <div className="max-w-4xl mx-auto">
          <div className="card p-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Tambah Item Inventory</h1>
              <p className="text-gray-600">Tambahkan item baru ke inventory</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="form-label">Nama Item *</label>
                  <div className="relative">
                    <Package className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      {...register('name', { required: 'Nama item wajib diisi' })}
                      className="form-input pl-10"
                      placeholder="Contoh: Kabel UTP Cat6"
                    />
                  </div>
                  {errors.name && (
                    <p className="form-error">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="form-label">Kode Item *</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      {...register('code', { required: 'Kode item wajib diisi' })}
                      className="form-input pl-10"
                      placeholder="Contoh: CBL-UTP-CAT6"
                    />
                  </div>
                  {errors.code && (
                    <p className="form-error">{errors.code.message}</p>
                  )}
                </div>
              </div>

              {/* Category and Unit */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="form-label">Kategori *</label>
                  <select
                    {...register('category', { required: 'Kategori wajib dipilih' })}
                    className="form-input"
                  >
                    <option value="">Pilih kategori</option>
                    <option value="CABLE">Kabel</option>
                    <option value="ROUTER">Router</option>
                    <option value="MODEM">Modem</option>
                    <option value="TOOLS">Peralatan</option>
                    <option value="ACCESSORIES">Aksesoris</option>
                  </select>
                  {errors.category && (
                    <p className="form-error">{errors.category.message}</p>
                  )}
                </div>

                <div>
                  <label className="form-label">Satuan *</label>
                  <input
                    type="text"
                    {...register('unit', { required: 'Satuan wajib diisi' })}
                    className="form-input"
                    placeholder="Contoh: meter, pcs, box"
                  />
                  {errors.unit && (
                    <p className="form-error">{errors.unit.message}</p>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="form-label">Deskripsi</label>
                <textarea
                  {...register('description')}
                  className="form-input"
                  rows={3}
                  placeholder="Deskripsi detail item (opsional)"
                />
              </div>

              {/* Stock Information */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="form-label">Stok Awal *</label>
                  <input
                    type="number"
                    min="0"
                    {...register('quantity', { 
                      required: 'Stok awal wajib diisi',
                      min: { value: 0, message: 'Stok tidak boleh negatif' }
                    })}
                    className="form-input"
                    placeholder="0"
                  />
                  {errors.quantity && (
                    <p className="form-error">{errors.quantity.message}</p>
                  )}
                </div>

                <div>
                  <label className="form-label">Stok Minimum *</label>
                  <div className="relative">
                    <AlertTriangle className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                      type="number"
                      min="0"
                      {...register('minStock', { 
                        required: 'Stok minimum wajib diisi',
                        min: { value: 0, message: 'Stok minimum tidak boleh negatif' }
                      })}
                      className="form-input pl-10"
                      placeholder="5"
                    />
                  </div>
                  {errors.minStock && (
                    <p className="form-error">{errors.minStock.message}</p>
                  )}
                </div>

                <div>
                  <label className="form-label">Harga Satuan</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      {...register('price', {
                        min: { value: 0, message: 'Harga tidak boleh negatif' }
                      })}
                      className="form-input pl-10"
                      placeholder="0"
                    />
                  </div>
                  {errors.price && (
                    <p className="form-error">{errors.price.message}</p>
                  )}
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="form-label">Lokasi Penyimpanan</label>
                <input
                  type="text"
                  {...register('location')}
                  className="form-input"
                  placeholder="Contoh: Gudang A - Rak 1"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-4 pt-6 border-t">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="btn-outline"
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
                    'Simpan Item'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}

