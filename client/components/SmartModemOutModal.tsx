import React, { useState, useEffect, useRef } from 'react'
import { X, Scan, Package, Minus, Plus, Check, AlertCircle, Search, Zap } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { api } from '../lib/api'

interface ModemItem {
  id: string
  name: string
  code: string
  category: string
  subcategory?: string
  currentStock: number
  unit: string
  serialNumbers?: string
  isBatch?: boolean
}

interface ScannedOutItem {
  id: string
  serialNumber: string
  matchedItem: ModemItem | null
  quantity: number
  timestamp: Date
  status: 'found' | 'not_found' | 'processing'
}

interface SmartModemOutModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function SmartModemOutModal({ isOpen, onClose, onSuccess }: SmartModemOutModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [modemItems, setModemItems] = useState<ModemItem[]>([])
  const [scannerInput, setScannerInput] = useState('')
  const [scannedItems, setScannedItems] = useState<ScannedOutItem[]>([])
  const [isScanning, setIsScanning] = useState(true)
  const [notes, setNotes] = useState('')
  const [technicianId, setTechnicianId] = useState('')
  const [jobId, setJobId] = useState('')
  const [scannedInSerials, setScannedInSerials] = useState<Set<string>>(new Set())
  const scannerRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      fetchModemItems()
      if (scannerRef.current) {
        scannerRef.current.focus()
      }
    }
  }, [isOpen])

  const fetchModemItems = async () => {
    try {
      const response = await api.get('/inventory/items?category=MODEM')
      const items = response.data.data?.items || []
      setModemItems(items.filter((item: ModemItem) => item.currentStock > 0))
      
      // Fetch all scanned-in serial numbers from inventory logs
      await fetchScannedInSerials()
    } catch (error) {
      console.error('Failed to fetch modem items:', error)
      toast.error('Gagal memuat data modem')
    }
  }

  const fetchScannedInSerials = async () => {
    try {
      const response = await api.get('/inventory/modem/serial-status')
      const data = response.data.data
      
      // Get all serials that are currently available (IN status)
      const availableSerials = new Set<string>(data.available || [])
      setScannedInSerials(availableSerials)
    } catch (error) {
      console.error('Failed to fetch scanned-in serials:', error)
      // Don't show error to user, just log it
    }
  }

  const getSubcategoryName = (subcategory?: string) => {
    switch (subcategory) {
      case 'ZTE_V3': return 'ZTE V3'
      case 'ZTE_5G': return 'ZTE 5G'
      case 'HUAWEI_5H5': return 'Huawei 5H5'
      case 'HUAWEI_5V5': return 'Huawei 5V5'
      case 'VIBERHOME': return 'ViberHome'
      default: return subcategory
    }
  }

  const detectModemTypeFromSerial = (serialNumber: string): string | null => {
    const serial = serialNumber.toUpperCase()
    
    // Common modem brand patterns
    if (serial.includes('ZTE') || serial.match(/^[A-Z0-9]*ZTE/)) return 'ZTE_5G'
    if (serial.includes('HUAWEI') || serial.match(/^[A-Z0-9]*HW/)) return 'HUAWEI_5V5'
    if (serial.includes('VIBE') || serial.includes('VH')) return 'VIBERHOME'
    
    // Pattern-based detection
    if (serial.match(/^[A-F0-9]{12}$/)) return 'ZTE_5G' // 12-digit hex pattern
    if (serial.match(/^[0-9A-F]{8,16}$/)) return 'HUAWEI_5V5' // 8-16 digit hex
    if (serial.match(/^VH[0-9A-F]+/)) return 'VIBERHOME'
    
    // Default fallback
    return 'ZTE_5G'
  }

  const findOrCreateModemMatch = (serialNumber: string): ModemItem | null => {
    const searchSerial = serialNumber.trim().toUpperCase()
    
    // CRITICAL: Only allow scan out if serial was previously scanned IN
    if (!scannedInSerials.has(searchSerial)) {
      return null // Serial not found in scanned-in records
    }
    
    // 1. Try exact matching first - only return if serial exists in inventory
    for (const item of modemItems) {
      if (item.serialNumbers) {
        try {
          const serialArray = JSON.parse(item.serialNumbers)
          if (serialArray.some((serial: string) => serial.toUpperCase() === searchSerial)) {
            return item
          }
        } catch (e) {
          // Handle string format serial numbers
          if (item.serialNumbers.toUpperCase().includes(searchSerial)) {
            return item
          }
        }
      }
    }
    
    // 2. If serial was scanned in but not found in current inventory,
    // try to find matching item by detected type
    const detectedType = detectModemTypeFromSerial(searchSerial)
    if (detectedType) {
      const matchingItem = modemItems.find(item => 
        item.subcategory === detectedType && item.currentStock > 0
      )
      if (matchingItem) {
        return matchingItem
      }
    }
    
    // 3. Last resort: find any available modem of same category
    // Only if serial was definitely scanned in before
    const availableModem = modemItems.find(item => item.currentStock > 0)
    return availableModem || null
  }

  const handleScannerInput = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && scannerInput.trim()) {
      const serialNumber = scannerInput.trim()
      
      // Check if already scanned
      const existingItem = scannedItems.find(item => item.serialNumber === serialNumber)
      if (existingItem) {
        // Increase quantity if already exists
        setScannedItems(prev => prev.map(item => 
          item.serialNumber === serialNumber 
            ? { ...item, quantity: item.quantity + 1, timestamp: new Date() }
            : item
        ))
        toast.success(`Quantity ${serialNumber} ditambah menjadi ${existingItem.quantity + 1}`)
      } else {
        // Add new scanned item
        const newScannedItem: ScannedOutItem = {
          id: Date.now().toString(),
          serialNumber,
          matchedItem: null,
          quantity: 1,
          timestamp: new Date(),
          status: 'processing'
        }
        
        setScannedItems(prev => [...prev, newScannedItem])
        
        // Smart matching
        const matchedItem = findOrCreateModemMatch(serialNumber)
        
        setTimeout(() => {
          setScannedItems(prev => prev.map(item => 
            item.id === newScannedItem.id 
              ? { 
                  ...item, 
                  matchedItem, 
                  status: matchedItem ? 'found' : 'not_found' 
                }
              : item
          ))
          
          if (matchedItem) {
            const detectedType = detectModemTypeFromSerial(serialNumber)
            const isExactMatch = matchedItem.serialNumbers && 
              JSON.parse(matchedItem.serialNumbers || '[]').includes(serialNumber)
            
            if (isExactMatch) {
              toast.success(`✅ ${serialNumber} → ${matchedItem.name} (${getSubcategoryName(matchedItem.subcategory)})`)
            } else {
              toast.success(`🔍 ${serialNumber} → ${matchedItem.name} (${getSubcategoryName(matchedItem.subcategory)}) - Auto-detected`)
            }
          } else {
            // Check if serial was never scanned in
            if (!scannedInSerials.has(serialNumber.toUpperCase())) {
              toast.error(`❌ ${serialNumber} - Modem belum pernah di-scan masuk ke inventory`)
            } else {
              toast.error(`❌ ${serialNumber} - Modem sudah keluar atau tidak tersedia`)
            }
          }
        }, 500) // Simulate processing time
      }
      
      setScannerInput('')
    }
  }

  const removeScannedItem = (itemId: string) => {
    setScannedItems(prev => prev.filter(item => item.id !== itemId))
  }

  const updateItemQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeScannedItem(itemId)
    } else {
      setScannedItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, quantity } : item
      ))
    }
  }

  const getValidItems = () => scannedItems.filter(item => item.matchedItem && item.status === 'found')
  const getInvalidItems = () => scannedItems.filter(item => !item.matchedItem || item.status === 'not_found')
  const getTotalQuantity = () => getValidItems().reduce((sum, item) => sum + item.quantity, 0)

  const handleProcessOut = async () => {
    const validItems = getValidItems()
    
    if (validItems.length === 0) {
      toast.error('Tidak ada item valid untuk dikeluarkan')
      return
    }

    try {
      setIsLoading(true)
      
      // Group by matched item to combine quantities
      const groupedItems = validItems.reduce((acc, scannedItem) => {
        const itemId = scannedItem.matchedItem!.id
        if (acc[itemId]) {
          acc[itemId].quantity += scannedItem.quantity
          acc[itemId].serialNumbers.push(scannedItem.serialNumber)
        } else {
          acc[itemId] = {
            item: scannedItem.matchedItem!,
            quantity: scannedItem.quantity,
            serialNumbers: [scannedItem.serialNumber]
          }
        }
        return acc
      }, {} as Record<string, { item: ModemItem, quantity: number, serialNumbers: string[] }>)

      // Process each grouped item
      for (const [itemId, groupedItem] of Object.entries(groupedItems)) {
        const notesWithSerial = `${notes ? notes + ' | ' : ''}Serial: ${groupedItem.serialNumbers.join(', ')}`
        
        await api.post(`/inventory/items/${itemId}/stock/remove`, {
          quantity: groupedItem.quantity,
          notes: notesWithSerial,
          technicianId: technicianId || undefined,
          jobId: jobId || undefined
        })
      }

      toast.success(`${getTotalQuantity()} modem berhasil dikeluarkan dari inventory`)
      onSuccess()
      handleClose()
    } catch (error: any) {
      console.error('Failed to process modem out:', error)
      const message = error.response?.data?.error || 'Gagal mengeluarkan modem'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setScannedItems([])
    setScannerInput('')
    setNotes('')
    setTechnicianId('')
    setJobId('')
    setScannedInSerials(new Set())
    setIsScanning(true)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-white/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Zap className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Smart Modem Scanner - Keluar</h2>
              <p className="text-sm text-gray-600">Scan serial number modem untuk mengeluarkan dari inventory</p>
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
          {/* Summary Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700">Total Scan</p>
                  <p className="text-2xl font-bold text-blue-600">{scannedItems.length}</p>
                </div>
                <Scan className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700">Valid</p>
                  <p className="text-2xl font-bold text-green-600">{getValidItems().length}</p>
                </div>
                <Check className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-700">Tidak Ditemukan</p>
                  <p className="text-2xl font-bold text-red-600">{getInvalidItems().length}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-700">Total Keluar</p>
                  <p className="text-2xl font-bold text-purple-600">{getTotalQuantity()}</p>
                </div>
                <Package className="h-8 w-8 text-purple-500" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Scanner Input */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Scanner Input</h3>
              
              <div className="bg-gray-50 p-6 rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-4">
                    <div className={`p-3 rounded-full ${isScanning ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <Scan className={`h-8 w-8 ${isScanning ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                    {isScanning ? 'Scanner Aktif' : 'Scanner Nonaktif'}
                  </h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Scan barcode/QR code atau ketik serial number modem
                  </p>
                  <div className="max-w-md mx-auto">
                    <input
                      ref={scannerRef}
                      type="text"
                      value={scannerInput}
                      onChange={(e) => setScannerInput(e.target.value)}
                      onKeyDown={handleScannerInput}
                      className="w-full px-4 py-3 text-center text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="Scan atau ketik serial number..."
                      autoFocus
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Tekan Enter setelah scan atau input manual
                    </p>
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Catatan
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                    rows={2}
                    placeholder="Catatan pengeluaran modem..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teknisi ID (opsional)
                    </label>
                    <input
                      type="text"
                      value={technicianId}
                      onChange={(e) => setTechnicianId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="ID Teknisi"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Job ID (opsional)
                    </label>
                    <input
                      type="text"
                      value={jobId}
                      onChange={(e) => setJobId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="ID Job"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Scanned Items */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Item Terscan</h3>
              
              <div className="max-h-96 overflow-y-auto space-y-2">
                {scannedItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Belum ada item yang discan</p>
                  </div>
                ) : (
                  scannedItems.map((scannedItem) => (
                    <div
                      key={scannedItem.id}
                      className={`p-4 rounded-lg border-2 ${
                        scannedItem.status === 'found'
                          ? 'border-green-200 bg-green-50'
                          : scannedItem.status === 'not_found'
                          ? 'border-red-200 bg-red-50'
                          : 'border-yellow-200 bg-yellow-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="font-mono text-sm font-medium">
                              {scannedItem.serialNumber}
                            </span>
                            {scannedItem.status === 'found' && (
                              <Check className="h-4 w-4 text-green-600" />
                            )}
                            {scannedItem.status === 'not_found' && (
                              <AlertCircle className="h-4 w-4 text-red-600" />
                            )}
                            {scannedItem.status === 'processing' && (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                            )}
                          </div>
                          
                          {scannedItem.matchedItem ? (
                            <div className="text-sm">
                              <p className="font-medium text-gray-900">
                                {scannedItem.matchedItem.name}
                              </p>
                              <p className="text-gray-600">
                                {scannedItem.matchedItem.code} • {getSubcategoryName(scannedItem.matchedItem.subcategory)}
                              </p>
                              <p className="text-gray-500">
                                Stok: {scannedItem.matchedItem.currentStock} {scannedItem.matchedItem.unit}
                              </p>
                            </div>
                          ) : scannedItem.status === 'not_found' ? (
                            <p className="text-sm text-red-600">Item tidak ditemukan di inventory</p>
                          ) : (
                            <p className="text-sm text-yellow-600">Mencari item...</p>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-4">
                          {scannedItem.status === 'found' && (
                            <>
                              <button
                                onClick={() => updateItemQuantity(scannedItem.id, scannedItem.quantity - 1)}
                                className="p-1 text-red-600 hover:bg-red-100 rounded"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <span className="w-8 text-center font-medium">{scannedItem.quantity}</span>
                              <button
                                onClick={() => updateItemQuantity(scannedItem.id, scannedItem.quantity + 1)}
                                className="p-1 text-green-600 hover:bg-green-100 rounded"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => removeScannedItem(scannedItem.id)}
                            className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-500 mt-2">
                        {scannedItem.timestamp.toLocaleTimeString('id-ID')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-6 border-t mt-6">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500"
              disabled={isLoading}
            >
              Batal
            </button>
            <button
              onClick={handleProcessOut}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 flex items-center justify-center space-x-2"
              disabled={isLoading || getValidItems().length === 0}
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Proses Keluar ({getTotalQuantity()} item)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
