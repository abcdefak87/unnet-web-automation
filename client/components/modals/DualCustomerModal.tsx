import React, { useState } from 'react'
import { X, UserPlus, Users, ArrowRight, FileText, Camera } from 'lucide-react'
import EnhancedCustomerModal from './EnhancedCustomerModal'
import QuickAddCustomerModal from '../QuickAddCustomerModal'

interface DualCustomerModalProps {
  isOpen: boolean
  onClose: () => void
  onCustomerCreated: (customer: any) => void
  jobType?: 'NEW_INSTALLATION' | 'REPAIR' | 'MAINTENANCE'
}

export default function DualCustomerModal({ 
  isOpen, 
  onClose, 
  onCustomerCreated, 
  jobType = 'NEW_INSTALLATION' 
}: DualCustomerModalProps) {
  const [selectedOption, setSelectedOption] = useState<'existing' | 'new' | null>(null)
  const [showEnhancedModal, setShowEnhancedModal] = useState(false)
  const [showQuickModal, setShowQuickModal] = useState(false)

  const handleOptionSelect = (option: 'existing' | 'new') => {
    setSelectedOption(option)
    
    if (option === 'existing') {
      setShowQuickModal(true)
    } else {
      setShowEnhancedModal(true)
    }
  }

  const handleModalClose = () => {
    setShowEnhancedModal(false)
    setShowQuickModal(false)
    setSelectedOption(null)
  }

  const handleCustomerCreated = (customer: any) => {
    onCustomerCreated(customer)
    handleModalClose()
    onClose()
  }

  if (!isOpen) return null

  // Show the appropriate modal based on selection
  if (showEnhancedModal) {
    return (
      <EnhancedCustomerModal
        isOpen={true}
        onClose={handleModalClose}
        onCustomerCreated={handleCustomerCreated}
        jobType={jobType}
      />
    )
  }

  if (showQuickModal) {
    return (
      <QuickAddCustomerModal
        isOpen={true}
        onClose={handleModalClose}
        onCustomerAdded={handleCustomerCreated}
      />
    )
  }

  // Show option selection modal
  return (
    <div className="fixed inset-0 bg-white/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Pilih Jenis Pelanggan
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Pilih apakah pelanggan sudah terdaftar atau pelanggan baru
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Existing Customer Option */}
            <div 
              onClick={() => handleOptionSelect('existing')}
              className="border-2 border-gray-200 rounded-lg p-6 cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 group"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center group-hover:bg-green-200 transition-colors">
                  <Users className="w-8 h-8 text-green-600" />
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Pelanggan Lama
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Untuk pelanggan yang sudah pernah menggunakan layanan sebelumnya
                  </p>
                </div>

                <div className="space-y-2 text-xs text-gray-500">
                  <div className="flex items-center justify-center">
                    <span>✓ Registrasi cepat</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <span>✓ Tanpa KTP</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <span>✓ Data dasar saja</span>
                  </div>
                </div>

                <div className="flex items-center text-blue-600 group-hover:text-blue-700 font-medium">
                  <span>Pilih</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </div>
            </div>

            {/* New Customer Option */}
            <div 
              onClick={() => handleOptionSelect('new')}
              className="border-2 border-gray-200 rounded-lg p-6 cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 group"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <UserPlus className="w-8 h-8 text-blue-600" />
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Pelanggan Baru
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Untuk pemasangan WiFi baru dengan verifikasi KTP lengkap
                  </p>
                </div>

                <div className="space-y-2 text-xs text-gray-500">
                  <div className="flex items-center justify-center">
                    <FileText className="w-3 h-3 mr-1" />
                    <span>Data KTP lengkap</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <Camera className="w-3 h-3 mr-1" />
                    <span>Foto KTP wajib</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <span>✓ Share location</span>
                  </div>
                </div>

                <div className="flex items-center text-blue-600 group-hover:text-blue-700 font-medium">
                  <span>Pilih</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </div>
            </div>
          </div>

          {/* Information Box */}
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Informasi Penting
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    <strong>Pelanggan Baru:</strong> Wajib melengkapi data KTP dan foto untuk pemasangan WiFi baru sesuai regulasi.
                  </p>
                  <p className="mt-1">
                    <strong>Pelanggan Lama:</strong> Cukup data dasar untuk layanan maintenance atau perbaikan.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  )
}
