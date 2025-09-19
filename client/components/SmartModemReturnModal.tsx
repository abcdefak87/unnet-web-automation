import React, { useState, useEffect, useRef } from 'react'
import { X, Scan, Package, Plus, Minus, Check, AlertCircle, RotateCcw } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { api } from '../lib/api'

interface ModemItem {
  id: string
  name: string
  code: string
  category: string
  subcategory?: string
  currentStock: number
  serialNumbers?: string
}

interface ScannedReturnItem {
  id: string
  serialNumber: string
  matchedItem: ModemItem | null
  quantity: number
  timestamp: Date
  status: 'processing' | 'found' | 'not_found'
}

interface SmartModemReturnModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function SmartModemReturnModal({ isOpen, onClose, onSuccess }: SmartModemReturnModalProps) {
  const [modemItems, setModemItems] = useState<ModemItem[]>([])
  const [scannedItems, setScannedItems] = useState<ScannedReturnItem[]>([])
  const [scannerInput, setScannerInput] = useState('')
  const [notes, setNotes] = useState('')
  const [technicianId, setTechnicianId] = useState('')
  const [jobId, setJobId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isScanning, setIsScanning] = useState(true)
  const [scannedOutSerials, setScannedOutSerials] = useState<Set<string>>(new Set())
  const scannerRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      fetchModemItems()
      fetchScannedOutSerials()
      // Auto focus on scanner input
      setTimeout(() => {
        scannerRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  const fetchModemItems = async () => {
    try {
      const response = await api.get('/inventory/items?category=MODEM&limit=100')
      setModemItems(response.data.data?.items || [])
    } catch (error) {
      console.error('Failed to fetch modem items:', error)
      toast.error('Gagal memuat data modem')
    }
  }

  const fetchScannedOutSerials = async () => {
    try {
      const response = await api.get('/inventory/modem/serial-status')
      const data = response.data.data
      
      // Get all serials that are currently OUT (unavailable for return)
      const unavailableSerials = new Set<string>(data.unavailable || [])
      setScannedOutSerials(unavailableSerials)
    } catch (error) {
      console.error('Failed to fetch scanned-out serials:', error)
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
    
    // 1. Try exact matching first
    for (const item of modemItems) {
      if (item.serialNumbers) {
        try {
          const serialArray = JSON.parse(item.serialNumbers)
          if (serialArray.some((serial: string) => serial.toUpperCase() === searchSerial)) {
            return item
          }
        } catch (e) {
          if (item.serialNumbers.toUpperCase().includes(searchSerial)) {
            return item
          }
        }
      }
    }
    
    // 2. Try pattern matching with existing items
    for (const item of modemItems) {
      // Check subcategory pattern match
      if (item.subcategory) {
        const subcategoryPattern = item.subcategory.replace('_', '').toUpperCase()
        if (searchSerial.includes(subcategoryPattern)) {
          return item
        }
      }
      
      // Check brand patterns
      const modemPatterns = ['ZTE', 'HUAWEI', 'VIBE', '5G', 'V3', '5H5', '5V5']
      for (const pattern of modemPatterns) {
        if (searchSerial.includes(pattern) && 
            (item.name.toUpperCase().includes(pattern) || 
             item.subcategory?.toUpperCase().includes(pattern))) {
          return item
        }
      }
    }
    
    // 3. Find best match by detected type
    const detectedType = detectModemTypeFromSerial(searchSerial)
    if (detectedType) {
      const matchingItem = modemItems.find(item => item.subcategory === detectedType)
      if (matchingItem) {
        return matchingItem
      }
    }
    
    // 4. Fallback to any modem item (for return, we can add to any category)
    const availableModem = modemItems.find(item => item.category === 'MODEM')
    return availableModem || null
  }

  const handleScannerInput = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && scannerInput.trim()) {
      const serialNumber = scannerInput.trim()
      const upperSerial = serialNumber.toUpperCase()
      
      // CRITICAL: Only allow return if serial was previously scanned OUT
      if (!scannedOutSerials.has(upperSerial)) {
        toast.error(`❌ ${serialNumber} - Serial number belum pernah keluar dari inventory atau sudah dikembalikan`)
        setScannerInput('')
        return
      }
      
      // Check if already scanned in current session
      const existingItem = scannedItems.find(item => item.serialNumber.toUpperCase() === upperSerial)
      if (existingItem) {
        // Increase quantity if already exists
        setScannedItems(prev => prev.map(item => 
          item.serialNumber.toUpperCase() === upperSerial 
            ? { ...item, quantity: item.quantity + 1, timestamp: new Date() }
            : item
        ))
        toast.success(`✅ Quantity ${serialNumber} ditambah menjadi ${existingItem.quantity + 1}`)
      } else {
        // Add new scanned item
        const newScannedItem: ScannedReturnItem = {
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
            const isExactMatch = matchedItem.serialNumbers && 
              JSON.parse(matchedItem.serialNumbers || '[]').includes(serialNumber)
            
            if (isExactMatch) {
              toast.success(`✅ ${serialNumber} → ${matchedItem.name} (${getSubcategoryName(matchedItem.subcategory)})`)
            } else {
              toast.success(`🔍 ${serialNumber} → ${matchedItem.name} (${getSubcategoryName(matchedItem.subcategory)}) - Auto-detected`)
            }
          } else {
            toast.error(`❌ ${serialNumber} - Tidak dapat menentukan kategori modem`)
          }
        }, 500)
      }
      
      setScannerInput('')
    }
  }

  const removeScannedItem = (itemId: string) => {
    setScannedItems(prev => prev.filter(item => item.id !== itemId))
  }

  const adjustQuantity = (itemId: string, delta: number) => {
    setScannedItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQuantity = Math.max(1, item.quantity + delta)
        return { ...item, quantity: newQuantity }
      }
      return item
    }))
  }

  const getValidItems = () => scannedItems.filter(item => item.status === 'found')
  const getInvalidItems = () => scannedItems.filter(item => item.status === 'not_found')
  const getTotalQuantity = () => getValidItems().reduce((sum, item) => sum + item.quantity, 0)

  const handleReturn = async () => {
    const validItems = getValidItems()
    if (validItems.length === 0) {
      toast.error('Tidak ada modem valid untuk dikembalikan')
      return
    }

    setIsLoading(true)
    try {
      // Group items by matched item ID
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
        const notesWithSerial = `RETURN: ${notes ? notes + ' | ' : ''}Serial: ${groupedItem.serialNumbers.join(', ')}`
        
        await api.post(`/inventory/items/${itemId}/stock/add`, {
          quantity: groupedItem.quantity,
          notes: notesWithSerial,
          technicianId: technicianId || undefined
        })
      }

      toast.success(`${getTotalQuantity()} modem berhasil dikembalikan ke inventory`)
      onSuccess()
      handleClose()
    } catch (error: any) {
      console.error('Failed to return modems:', error)
      const message = error.response?.data?.error || 'Gagal mengembalikan modem'
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
    setIsScanning(true)
    setScannedOutSerials(new Set())
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-white/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <RotateCcw className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Smart Modem Return - Kembali</h2>
              <p className="text-sm text-gray-600">Scan serial number modem untuk mengembalikan ke inventory</p>
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
                  <p className="text-sm text-red-700">Tidak Dikenali</p>
                  <p className="text-2xl font-bold text-red-600">{getInvalidItems().length}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-700">Total Kembali</p>
                  <p className="text-2xl font-bold text-purple-600">{getTotalQuantity()}</p>
                </div>
                <Package className="h-8 w-8 text-purple-500" />
              </div>
            </div>
          </div>

          {/* Scanner Input */}
          <div className="mb-6">
            <div className="flex items-center space-x-4 mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Scan className="inline h-4 w-4 mr-1" />
                  Scan Serial Number Modem
                </label>
                <input
                  ref={scannerRef}
                  type="text"
                  value={scannerInput}
                  onChange={(e) => setScannerInput(e.target.value)}
                  onKeyDown={handleScannerInput}
                  placeholder="Scan atau ketik serial number..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-lg font-mono"
                  disabled={isLoading}
                />
                <p className="text-xs text-gray-500 mt-1">Tekan Enter setelah scan atau ketik manual</p>
              </div>
            </div>
          </div>

          {/* Scanned Items List */}
          {scannedItems.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Modem yang Akan Dikembalikan</h3>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {scannedItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 rounded-lg border-2 ${
                      item.status === 'found' 
                        ? 'border-green-200 bg-green-50' 
                        : item.status === 'not_found'
                        ? 'border-red-200 bg-red-50'
                        : 'border-blue-200 bg-blue-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <span className="font-mono text-sm font-semibold">{item.serialNumber}</span>
                          {item.status === 'found' && <Check className="h-4 w-4 text-green-600" />}
                          {item.status === 'not_found' && <AlertCircle className="h-4 w-4 text-red-600" />}
                          {item.status === 'processing' && (
                            <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                          )}
                        </div>
                        {item.matchedItem && (
                          <p className="text-sm text-gray-600 mt-1">
                            → {item.matchedItem.name} ({getSubcategoryName(item.matchedItem.subcategory)})
                          </p>
                        )}
                        {item.status === 'not_found' && (
                          <p className="text-sm text-red-600 mt-1">Tidak dapat menentukan kategori modem</p>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => adjustQuantity(item.id, -1)}
                            className="p-1 hover:bg-gray-200 rounded"
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="px-2 py-1 bg-white rounded border min-w-[2rem] text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => adjustQuantity(item.id, 1)}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeScannedItem(item.id)}
                          className="p-1 hover:bg-red-100 rounded text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Additional Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Catatan Return
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Alasan return, kondisi modem, dll..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ID Teknisi
              </label>
              <input
                type="text"
                value={technicianId}
                onChange={(e) => setTechnicianId(e.target.value)}
                placeholder="ID teknisi yang mengembalikan"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Job ID (Opsional)
              </label>
              <input
                type="text"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                placeholder="ID pekerjaan terkait"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4">
            <button
              onClick={handleClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
              disabled={isLoading}
            >
              Batal
            </button>
            <button
              onClick={handleReturn}
              disabled={getValidItems().length === 0 || isLoading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isLoading && <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>}
              <RotateCcw className="h-4 w-4" />
              <span>Kembalikan {getTotalQuantity()} Modem</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
