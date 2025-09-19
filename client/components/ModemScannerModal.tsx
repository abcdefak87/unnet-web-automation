import React, { useState, useEffect, useRef } from 'react'
import { X, Scan, Package, Plus, Check, AlertCircle } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { api } from '../lib/api'

interface ModemCategory {
  subcategory: string
  name: string
  icon: string
  color: string
  scannedItems: ScannedItem[]
}

interface ScannedItem {
  id: string
  serialNumber: string
  timestamp: Date
}

interface ModemScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function ModemScannerModal({ isOpen, onClose, onSuccess }: ModemScannerModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [scannerInput, setScannerInput] = useState('')
  const [categories, setCategories] = useState<ModemCategory[]>([
    {
      subcategory: 'ZTE_V3',
      name: 'ZTE V3',
      icon: '📡',
      color: 'bg-blue-500',
      scannedItems: []
    },
    {
      subcategory: 'ZTE_5G',
      name: 'ZTE 5G',
      icon: '🚀',
      color: 'bg-green-500',
      scannedItems: []
    },
    {
      subcategory: 'HUAWEI_5H5',
      name: 'Huawei 5H5',
      icon: '📶',
      color: 'bg-red-500',
      scannedItems: []
    },
    {
      subcategory: 'HUAWEI_5V5',
      name: 'Huawei 5V5',
      icon: '📡',
      color: 'bg-orange-500',
      scannedItems: []
    },
    {
      subcategory: 'VIBERHOME',
      name: 'ViberHome',
      icon: '🏠',
      color: 'bg-purple-500',
      scannedItems: []
    }
  ])
  const [existingSerials, setExistingSerials] = useState<Set<string>>(new Set())
  const scannerRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      fetchExistingSerials()
      if (activeCategory && scannerRef.current) {
        scannerRef.current.focus()
      }
    }
  }, [isOpen, activeCategory])

  const fetchExistingSerials = async () => {
    try {
      const response = await api.get('/inventory/modem/serial-status')
      const data = response.data.data
      
      // Get all serials that are currently IN inventory
      const currentlyInSerials = new Set<string>(data.available || [])
      setExistingSerials(currentlyInSerials)
    } catch (error) {
      console.error('Failed to fetch existing serials:', error)
      // Don't show error to user, just log it
    }
  }

  const handleScannerInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && scannerInput.trim() && activeCategory) {
      addScannedItem(activeCategory, scannerInput.trim())
      setScannerInput('')
    }
  }

  const addScannedItem = (categoryId: string, serialNumber: string) => {
    const upperSerial = serialNumber.toUpperCase()
    
    // Check if serial number already exists in inventory
    if (existingSerials.has(upperSerial)) {
      toast.error(`❌ ${serialNumber} - Serial number sudah ada di inventory`)
      return
    }
    
    // Check if serial number already exists in current scan session
    const existsInCategory = categories.find(cat => 
      cat.scannedItems.some(item => item.serialNumber.toUpperCase() === upperSerial)
    )

    if (existsInCategory) {
      toast.error(`❌ ${serialNumber} - Sudah di-scan di kategori ${existsInCategory.name}`)
      return
    }

    const newItem: ScannedItem = {
      id: Date.now().toString(),
      serialNumber,
      timestamp: new Date()
    }

    setCategories(prev => prev.map(cat => 
      cat.subcategory === categoryId 
        ? { ...cat, scannedItems: [...cat.scannedItems, newItem] }
        : cat
    ))

    toast.success(`✅ ${serialNumber} ditambahkan ke ${categories.find(c => c.subcategory === categoryId)?.name}`)
  }

  const removeScannedItem = (categoryId: string, itemId: string) => {
    setCategories(prev => prev.map(cat => 
      cat.subcategory === categoryId 
        ? { ...cat, scannedItems: cat.scannedItems.filter(item => item.id !== itemId) }
        : cat
    ))
  }

  const getTotalScannedItems = () => {
    return categories.reduce((total, cat) => total + cat.scannedItems.length, 0)
  }

  const handleSaveToInventory = async () => {
    const itemsToSave = categories.filter(cat => cat.scannedItems.length > 0)
    
    if (itemsToSave.length === 0) {
      toast.error('Belum ada item yang discan')
      return
    }

    try {
      setIsLoading(true)

      // Smart consolidation: Check if items exist for same category and date
      for (const category of itemsToSave) {
        const serialNumbers = category.scannedItems.map(item => item.serialNumber)
        
        // Use smart consolidation API endpoint
        await api.post('/inventory/modem/smart-add', {
          subcategory: category.subcategory,
          serialNumbers: serialNumbers,
          categoryName: category.name
        })
      }

      toast.success(`${getTotalScannedItems()} modem berhasil disimpan ke inventory`)
      onSuccess()
      handleClose()
    } catch (error: any) {
      console.error('Failed to save scanned items:', error)
      const message = error.response?.data?.error || 'Gagal menyimpan data scan'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setCategories(prev => prev.map(cat => ({ ...cat, scannedItems: [] })))
    setActiveCategory(null)
    setScannerInput('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-white/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Scan className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Scanner Modem</h2>
              <p className="text-sm text-gray-600">Scan barcode/QR code modem langsung ke kategori yang sesuai</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Summary */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-blue-900">Total Item Terscan</h3>
                <p className="text-2xl font-bold text-blue-600">{getTotalScannedItems()} unit</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-blue-700">
                  {categories.filter(cat => cat.scannedItems.length > 0).length} kategori aktif
                </p>
              </div>
            </div>
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {categories.map((category) => (
              <div
                key={category.subcategory}
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  activeCategory === category.subcategory
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setActiveCategory(category.subcategory)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 ${category.color} rounded-lg flex items-center justify-center text-white text-lg`}>
                      {category.icon}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{category.name}</h3>
                      <p className="text-sm text-gray-600">{category.subcategory}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                      {category.scannedItems.length}
                    </span>
                    {activeCategory === category.subcategory && (
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    )}
                  </div>
                </div>

                {/* Scanned Items Preview */}
                {category.scannedItems.length > 0 && (
                  <div className="space-y-1 max-h-20 overflow-y-auto">
                    {category.scannedItems.slice(-3).map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-xs bg-white p-2 rounded">
                        <span className="font-mono text-gray-700">{item.serialNumber}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            removeScannedItem(category.subcategory, item.id)
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {category.scannedItems.length > 3 && (
                      <p className="text-xs text-gray-500 text-center">
                        +{category.scannedItems.length - 3} lainnya
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Scanner Input */}
          <div className="bg-gray-50 p-6 rounded-lg border-2 border-dashed border-gray-300">
            {activeCategory ? (
              <div className="text-center">
                <div className="flex items-center justify-center mb-4">
                  <div className="p-3 bg-blue-100 rounded-full">
                    <Scan className="h-8 w-8 text-blue-600" />
                  </div>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Scan ke kategori: {categories.find(c => c.subcategory === activeCategory)?.name}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Arahkan scanner ke barcode/QR code modem atau ketik manual
                </p>
                <div className="max-w-md mx-auto">
                  <input
                    ref={scannerRef}
                    type="text"
                    value={scannerInput}
                    onChange={(e) => setScannerInput(e.target.value)}
                    onKeyDown={handleScannerInput}
                    className="w-full px-4 py-3 text-center text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Scan atau ketik serial number..."
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Tekan Enter setelah scan atau ketik manual
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="flex items-center justify-center mb-4">
                  <div className="p-3 bg-gray-100 rounded-full">
                    <Package className="h-8 w-8 text-gray-400" />
                  </div>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Pilih Kategori Modem
                </h3>
                <p className="text-sm text-gray-600">
                  Klik salah satu kategori di atas untuk mulai scanning
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-6 border-t mt-6">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              Batal
            </button>
            <button
              onClick={handleSaveToInventory}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center justify-center space-x-2"
              disabled={isLoading || getTotalScannedItems() === 0}
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Simpan ke Inventory ({getTotalScannedItems()})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
