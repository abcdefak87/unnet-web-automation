import React, { useState, useRef } from 'react'
import { X, Upload, MapPin, User, Phone, Home, Camera, FileText } from 'lucide-react'
import { api } from '../../lib/api'
import toast from 'react-hot-toast'

interface EnhancedCustomerModalProps {
  isOpen: boolean
  onClose: () => void
  onCustomerCreated: (customer: any) => void
  jobType?: 'NEW_INSTALLATION' | 'REPAIR' | 'MAINTENANCE'
}

export default function EnhancedCustomerModal({ 
  isOpen, 
  onClose, 
  onCustomerCreated, 
  jobType = 'NEW_INSTALLATION' 
}: EnhancedCustomerModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    latitude: '',
    longitude: '',
    ktpName: '',
    ktpNumber: '',
    shareLocation: '',
    installationType: jobType
  })
  
  const [ktpPhoto, setKtpPhoto] = useState<File | null>(null)
  const [ktpPhotoPreview, setKtpPhotoPreview] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [showManualInput, setShowManualInput] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isNewInstallation = jobType === 'NEW_INSTALLATION'

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // GPS validation for Indonesia region
  const validateIndonesianGPS = (lat: number, lng: number) => {
    // Indonesia bounds: roughly -11°S to 6°N, 95°E to 141°E
    const indonesiaBounds = {
      north: 6.0,
      south: -11.0,
      east: 141.0,
      west: 95.0
    }
    
    return lat >= indonesiaBounds.south && lat <= indonesiaBounds.north &&
           lng >= indonesiaBounds.west && lng <= indonesiaBounds.east
  }
  
  // Calculate distance between two GPS points (Haversine formula)
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371 // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('🚫 Browser tidak mendukung GPS. Gunakan input manual.')
      setShowManualInput(true)
      return
    }

    setIsGettingLocation(true)
    toast('🛰️ Mengakses GPS satelit presisi tinggi...', { duration: 3000 })
    
    // Enhanced GPS readings with multiple validation layers
    const readings: GeolocationPosition[] = []
    let attempts = 0
    const maxAttempts = 8 // Increased for maximum accuracy
    const requiredReadings = 3 // Minimum readings for validation
    
    const tryGetLocation = () => {
      attempts++
      
      // Progressive timeout strategy
      const timeoutDuration = attempts <= 3 ? 45000 : attempts <= 6 ? 30000 : 20000
      const enableHighAccuracy = attempts <= 5 // Use high accuracy for first 5 attempts
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy, altitude, altitudeAccuracy, heading, speed } = position.coords
          
          console.log(`🛰️ GPS Reading ${attempts}/${maxAttempts}:`, {
            latitude: latitude.toFixed(8),
            longitude: longitude.toFixed(8),
            accuracy: Math.round(accuracy),
            altitude,
            altitudeAccuracy,
            heading,
            speed,
            timestamp: new Date(position.timestamp).toLocaleString('id-ID'),
            highAccuracy: enableHighAccuracy
          })
          
          // Critical validation: Indonesia bounds check
          if (!validateIndonesianGPS(latitude, longitude)) {
            console.warn('❌ GPS coordinates outside Indonesia:', { latitude, longitude })
            toast.error(`❌ GPS menunjukkan lokasi di luar Indonesia!\nLat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}\nSilakan coba lagi atau gunakan input manual.`)
            
            if (attempts < maxAttempts) {
              setTimeout(() => tryGetLocation(), 4000)
              toast(`🔄 Mencoba GPS lagi... (${attempts}/${maxAttempts})`, { icon: '🛰️', duration: 2000 })
              return
            } else {
              toast.error('GPS tidak dapat menemukan lokasi di Indonesia. Gunakan input manual.')
              setShowManualInput(true)
              setIsGettingLocation(false)
              return
            }
          }
          
          // Enhanced network positioning detection
          const jakartaLat = -6.2088
          const jakartaLng = 106.8456
          const distanceFromJakarta = calculateDistance(latitude, longitude, jakartaLat, jakartaLng)
          
          // Detect WiFi/Cell Tower positioning (common in Jakarta area)
          const isNetworkPositioning = (
            (distanceFromJakarta < 50 && accuracy > 100) || // Jakarta area with low accuracy
            (accuracy > 200) || // Very low accuracy indicates network positioning
            (latitude.toString().includes('-6.2') && longitude.toString().includes('106.') && accuracy > 50) // Jakarta coordinates with poor accuracy
          )
          
          if (isNetworkPositioning) {
            console.warn('🚫 Network positioning detected:', {
              location: `Jakarta ${distanceFromJakarta.toFixed(1)}km`,
              accuracy: `±${Math.round(accuracy)}m`,
              coords: { lat: latitude.toFixed(6), lng: longitude.toFixed(6) },
              source: 'WiFi/Cell Tower'
            })
            
            toast.error(`🚫 DETEKSI WIFI/CELL TOWER\n📍 Lokasi: Jakarta area (${distanceFromJakarta.toFixed(1)}km)\n🎯 Akurasi: ±${Math.round(accuracy)}m\n\n⚠️ Bukan GPS satelit murni!\nMemaksa GPS satelit...`, { duration: 4000 })
            
            if (attempts < maxAttempts) {
              // Force satellite GPS by disabling network positioning
              setTimeout(() => {
                // Clear any cached positions and force fresh satellite reading
                if ('geolocation' in navigator && 'clearWatch' in navigator.geolocation) {
                  // Clear any existing watches
                }
                tryGetLocation()
              }, 8000) // Longer delay to allow satellite lock
              
              toast(`🛰️ MEMAKSA GPS SATELIT... (${attempts}/${maxAttempts})\n📡 Mencari sinyal satelit langsung`, { icon: '🛰️', duration: 4000 })
              return
            } else {
              toast.error('🚫 GPS terus menunjukkan WiFi/Cell Tower.\n💡 Coba matikan WiFi dan gunakan data seluler, atau gunakan input manual.')
              setShowManualInput(true)
              setIsGettingLocation(false)
              return
            }
          }
          
          // Accuracy validation
          if (accuracy > 500) {
            console.warn(`⚠️ Low GPS accuracy: ±${Math.round(accuracy)}m`)
            if (attempts < maxAttempts) {
              toast(`⚠️ Akurasi GPS rendah (±${Math.round(accuracy)}m). Mencoba lagi...`, { icon: '🛰️' })
              setTimeout(() => tryGetLocation(), 3000)
              return
            }
          }
          
          readings.push(position)
          
          // Consistency validation between readings
          if (readings.length >= 2) {
            const lastReading = readings[readings.length - 1]
            const prevReading = readings[readings.length - 2]
            const distance = calculateDistance(
              lastReading.coords.latitude, lastReading.coords.longitude,
              prevReading.coords.latitude, prevReading.coords.longitude
            )
            
            // Check for GPS drift/inconsistency
            if (distance > 0.5) { // 500m tolerance
              console.warn('⚠️ GPS readings inconsistent:', {
                distance: `${(distance * 1000).toFixed(0)}m`,
                reading1: { lat: prevReading.coords.latitude.toFixed(6), lng: prevReading.coords.longitude.toFixed(6) },
                reading2: { lat: lastReading.coords.latitude.toFixed(6), lng: lastReading.coords.longitude.toFixed(6) }
              })
              
              if (attempts < maxAttempts && distance > 2.0) { // Major inconsistency
                toast(`⚠️ GPS tidak stabil (jarak ${(distance * 1000).toFixed(0)}m). Mencoba lagi...`, { icon: '🛰️' })
                setTimeout(() => tryGetLocation(), 4000)
                return
              }
            }
          }
          
          // Success criteria: enough readings with good accuracy
          if (readings.length >= requiredReadings || accuracy <= 20) {
            // Use the most accurate reading
            const bestReading = readings.reduce((best, current) => 
              current.coords.accuracy < best.coords.accuracy ? current : best
            )
            
            const { latitude: bestLat, longitude: bestLng, accuracy: bestAccuracy } = bestReading.coords
            
            // Final accuracy check
            if (bestAccuracy > 1000) {
              toast.error(`❌ GPS tidak cukup akurat (±${Math.round(bestAccuracy)}m)\nCoba di tempat terbuka atau gunakan input manual.`)
              setShowManualInput(true)
              setIsGettingLocation(false)
              return
            }
            
            // SUCCESS - Apply validated coordinates
            setFormData(prev => ({
              ...prev,
              latitude: bestLat.toFixed(8),
              longitude: bestLng.toFixed(8),
              shareLocation: 'gps_coordinates'
            }))
            
            const locationText = `GPS Satelit: ${bestLat.toFixed(8)}, ${bestLng.toFixed(8)} (±${Math.round(bestAccuracy)}m)`
            setFormData(prev => ({
              ...prev,
              address: prev.address || locationText
            }))
            
            const accuracyLevel = bestAccuracy <= 5 ? 'SANGAT PRESISI' : 
                                bestAccuracy <= 15 ? 'PRESISI TINGGI' : 
                                bestAccuracy <= 50 ? 'AKURAT' : 'CUKUP AKURAT'
            
            toast.success(`✅ GPS SATELIT BERHASIL!\n${accuracyLevel} (±${Math.round(bestAccuracy)}m)\nDari ${readings.length} pembacaan GPS`, { duration: 4000 })
            setIsGettingLocation(false)
            return
          }
          
          // Continue collecting readings
          if (attempts < maxAttempts) {
            toast(`🛰️ Mengumpulkan data GPS... (${readings.length}/${requiredReadings} readings)`, { icon: '📡', duration: 2000 })
            setTimeout(() => tryGetLocation(), 2000)
          }
        },
        (error) => {
          console.error(`❌ GPS Error (attempt ${attempts}/${maxAttempts}):`, {
            code: error.code,
            message: error.message,
            timestamp: new Date().toLocaleString('id-ID')
          })
          
          if (attempts < maxAttempts) {
            const delay = Math.min(attempts * 1500, 8000) // Progressive delay, max 8s
            
            setTimeout(() => {
              // Adaptive GPS options based on attempt
              const fallbackOptions = {
                enableHighAccuracy: attempts <= 4, // High accuracy for first attempts
                timeout: attempts <= 3 ? 45000 : 25000,
                maximumAge: attempts <= 2 ? 0 : 10000 // Fresh reading for first attempts
              }
              
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  readings.push(position)
                  tryGetLocation()
                },
                (retryError) => {
                  console.error('GPS retry failed:', retryError)
                  if (attempts >= maxAttempts) {
                    handleLocationError(retryError)
                  } else {
                    setTimeout(() => tryGetLocation(), 2000)
                  }
                },
                fallbackOptions
              )
            }, delay)
            
            const method = attempts <= 4 ? 'satelit presisi tinggi' : 'mode cepat'
            toast(`🔄 GPS gagal, mencoba ${method}... (${attempts}/${maxAttempts})`, { icon: '🛰️', duration: 2000 })
          } else {
            handleLocationError(error)
          }
        },
        {
          enableHighAccuracy: true, // Always use high accuracy
          timeout: timeoutDuration,
          maximumAge: 0 // Always force fresh reading to avoid cached network positions
        }
      )
    }
    
    const handleLocationError = (error: GeolocationPositionError) => {
      let errorMessage = '❌ GPS Gagal'
      let suggestion = ''
      let action = ''
      
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = '🚫 Akses GPS Ditolak'
          suggestion = '• Klik ikon 🔒 di address bar\n• Pilih "Allow" untuk Location\n• Refresh halaman dan coba lagi'
          action = 'Izinkan akses lokasi untuk GPS akurat'
          break
        case error.POSITION_UNAVAILABLE:
          errorMessage = '📡 GPS Tidak Tersedia'
          suggestion = '• Pastikan GPS/Location Services aktif\n• **MATIKAN WiFi** - Paksa GPS satelit\n• Coba di tempat terbuka (dekat jendela)\n• Gunakan data seluler, bukan WiFi\n• Restart browser jika perlu'
          action = 'MATIKAN WiFi dan aktifkan GPS satelit'
          break
        case error.TIMEOUT:
          errorMessage = '⏱️ GPS Timeout'
          suggestion = '• **MATIKAN WiFi** - Paksa GPS satelit\n• Sinyal GPS lemah atau terhalang\n• Coba di luar ruangan\n• Tunggu 3-5 menit untuk lock satelit\n• Matikan VPN jika aktif'
          action = 'MATIKAN WiFi dan coba di tempat terbuka'
          break
        default:
          errorMessage = '❌ GPS Error'
          suggestion = '• Coba refresh halaman\n• Pastikan browser mendukung GPS\n• Coba browser lain (Chrome/Firefox)'
          action = 'Gunakan input manual koordinat'
          break
      }
      
      toast.error(`${errorMessage}\n\n${suggestion}\n\n💡 ${action}`, { 
        duration: 8000,
        style: {
          maxWidth: '400px',
          fontSize: '14px'
        }
      })
      
      // Auto-show manual input after GPS failure
      setTimeout(() => {
        setShowManualInput(true)
        toast('📝 Input manual koordinat tersedia di bawah', { icon: '💡', duration: 3000 })
      }, 2000)
      
      setIsGettingLocation(false)
    }
    
    // Start the GPS acquisition process
    tryGetLocation()
  }

  const openGoogleMaps = () => {
    if (formData.latitude && formData.longitude) {
      const url = `https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`
      window.open(url, '_blank')
    } else {
      toast.error('Lokasi belum didapatkan')
    }
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Ukuran file maksimal 5MB')
        return
      }
      
      setKtpPhoto(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setKtpPhotoPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadKtpPhoto = async (): Promise<string | null> => {
    if (!ktpPhoto) return null
    
    const uploadFormData = new FormData()
    uploadFormData.append('ktpPhoto', ktpPhoto)
    
    try {
      const response = await fetch('/api/upload/ktp', {
        method: 'POST',
        body: uploadFormData
      })
      
      const result = await response.json()
      if (result.success) {
        return result.fileUrl
      }
      throw new Error(result.error)
    } catch (error) {
      console.error('Photo upload error:', error)
      toast.error('Gagal upload foto KTP')
      return null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Validate required fields for new installation
      if (isNewInstallation) {
        if (!formData.ktpName || !formData.ktpNumber || !formData.shareLocation) {
          toast.error('Data KTP wajib diisi untuk pemasangan baru')
          setIsLoading(false)
          return
        }
        
        if (!ktpPhoto) {
          toast.error('Foto KTP wajib diupload untuk pemasangan baru')
          setIsLoading(false)
          return
        }
      }

      let ktpPhotoUrl = null
      if (ktpPhoto) {
        ktpPhotoUrl = await uploadKtpPhoto()
        if (!ktpPhotoUrl) {
          setIsLoading(false)
          return
        }
      }

      const customerData = {
        ...formData,
        ktpPhotoUrl,
        isVerified: false
      }

      const response = await api.post('/customers', customerData)
      
      toast.success('Pelanggan berhasil ditambahkan')
      onCustomerCreated(response.data)
      onClose()
      resetForm()
    } catch (error: any) {
      console.error('Customer creation error:', error)
      toast.error(error.response?.data?.error || 'Gagal menambahkan pelanggan')
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      address: '',
      latitude: '',
      longitude: '',
      ktpName: '',
      ktpNumber: '',
      shareLocation: '',
      installationType: jobType
    })
    setKtpPhoto(null)
    setKtpPhotoPreview('')
    setCurrentStep(1)
  }

  const nextStep = () => {
    if (currentStep === 1) {
      if (!formData.name || !formData.phone) {
        toast.error('Mohon lengkapi nama dan nomor telepon')
        return
      }
      if (!formData.latitude || !formData.longitude) {
        toast.error('Mohon share lokasi terlebih dahulu')
        return
      }
    }
    setCurrentStep(prev => prev + 1)
  }

  const prevStep = () => {
    setCurrentStep(prev => prev - 1)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-white/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                {isNewInstallation ? 'Registrasi Pelanggan Baru' : 'Tambah Pelanggan'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {isNewInstallation ? 'Lengkapi data untuk instalasi baru' : 'Tambahkan data pelanggan'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-lg hover:bg-gray-100"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Progress Steps */}
          {isNewInstallation && (
            <div className="flex items-center justify-center space-x-4 mb-4">
              <div className={`flex items-center ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                  1
                </div>
                <span className="ml-2 text-sm">Data Dasar</span>
              </div>
              <div className={`w-8 h-px ${currentStep >= 2 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
              <div className={`flex items-center ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                  2
                </div>
                <span className="ml-2 text-sm">Lokasi GPS</span>
              </div>
              <div className={`w-8 h-px ${currentStep >= 3 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
              <div className={`flex items-center ${currentStep >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                  3
                </div>
                <span className="ml-2 text-sm">Foto KTP</span>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Step 1: Basic Data */}
          {(!isNewInstallation || currentStep === 1) && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Data Dasar Pelanggan</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4 inline mr-1" />
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Phone className="w-4 h-4 inline mr-1" />
                  Nomor Telepon *
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>


              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Lokasi Pemasangan *
                </label>
                
                {/* Location Buttons */}
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={getCurrentLocation}
                      disabled={isGettingLocation}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {isGettingLocation ? (
                        <>
                          <span className="animate-spin text-lg">🛰️</span>
                          <span>Mencari Satelit GPS...</span>
                        </>
                      ) : (
                        <>
                          <MapPin className="w-4 h-4" />
                          <span>🛰️ Dapatkan GPS Akurat</span>
                        </>
                      )}
                    </button>
                    
                    {formData.latitude && formData.longitude && (
                      <button
                        type="button"
                        onClick={openGoogleMaps}
                        className="px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
                      >
                        <MapPin className="w-4 h-4" />
                        Lihat di Maps
                      </button>
                    )}
                  </div>
                  
                  {/* Location Info Display */}
                  {formData.latitude && formData.longitude && (
                    <div className="bg-green-50 border border-green-200 rounded-md p-4">
                      <div className="flex items-center gap-2 text-green-800 mb-2">
                        <MapPin className="w-4 h-4" />
                        <span className="font-medium">Lokasi GPS Terdeteksi:</span>
                      </div>
                      <div className="text-sm text-green-700 space-y-2">
                        <div className="font-mono bg-green-100 p-3 rounded">
                          <div className="grid grid-cols-1 gap-1">
                            <div><strong>Latitude:</strong> {formData.latitude}</div>
                            <div><strong>Longitude:</strong> {formData.longitude}</div>
                            <div className="text-xs text-green-600 mt-1">
                              📱 Koordinat presisi tinggi (8 digit desimal)
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-green-600 flex items-center gap-1">
                            ✅ <span>Lokasi GPS siap untuk teknisi</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const coords = `${formData.latitude},${formData.longitude}`
                              navigator.clipboard.writeText(coords)
                              toast.success('Koordinat disalin ke clipboard!')
                            }}
                            className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                          >
                            📋 Salin Koordinat
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Manual Coordinate Input */}
                  {showManualInput && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                      <div className="text-sm text-blue-800 mb-3">
                        <div className="font-semibold">📍 Input Koordinat Manual</div>
                        <div className="text-xs mt-1">Masukkan koordinat GPS yang akurat dari aplikasi Maps atau GPS lainnya</div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-blue-700 mb-1">Latitude</label>
                          <input
                            type="text"
                            placeholder="-7.264895"
                            value={formData.latitude}
                            onChange={(e) => setFormData(prev => ({ ...prev, latitude: e.target.value }))}
                            className="w-full px-3 py-2 border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-blue-700 mb-1">Longitude</label>
                          <input
                            type="text"
                            placeholder="111.762509"
                            value={formData.longitude}
                            onChange={(e) => setFormData(prev => ({ ...prev, longitude: e.target.value }))}
                            className="w-full px-3 py-2 border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (formData.latitude && formData.longitude) {
                              const lat = parseFloat(formData.latitude)
                              const lng = parseFloat(formData.longitude)
                              if (validateIndonesianGPS(lat, lng)) {
                                setFormData(prev => ({ ...prev, shareLocation: 'manual_coordinates' }))
                                toast.success('✅ Koordinat manual tersimpan!')
                              } else {
                                toast.error('❌ Koordinat di luar Indonesia')
                              }
                            } else {
                              toast.error('❌ Masukkan kedua koordinat')
                            }
                          }}
                          className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        >
                          ✅ Simpan Koordinat
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowManualInput(false)}
                          className="px-3 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                        >
                          ❌ Batal
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Manual Address Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Home className="w-4 h-4 inline mr-1" />
                      Alamat Lengkap (Opsional)
                    </label>
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      rows={2}
                      placeholder="Contoh: Jl. Merdeka No. 123, RT 01/RW 02, Kelurahan ABC"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      💡 Alamat akan otomatis terisi dari GPS, atau Anda bisa menambahkan detail manual
                    </p>
                  </div>
                  
                  {!formData.latitude && !formData.longitude && !showManualInput && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                      <div className="text-sm text-yellow-800 space-y-2">
                        <div className="font-semibold">🛰️ Tips GPS Satelit Akurat:</div>
                        <ul className="text-xs space-y-1 ml-4">
                          <li>• <strong>MATIKAN WiFi</strong> - Paksa GPS satelit murni</li>
                          <li>• Keluar ruangan untuk sinyal satelit langsung</li>
                          <li>• Tunggu 2-3 menit untuk lock satelit</li>
                          <li>• Matikan VPN jika aktif</li>
                          <li>• Gunakan data seluler, bukan WiFi</li>
                          <li>• Aktifkan &quot;High Accuracy&quot; di pengaturan lokasi</li>
                        </ul>
                        <div className="mt-2 pt-2 border-t border-yellow-300">
                          <div className="text-xs text-yellow-700 mb-2">
                            ⚠️ <strong>Jika GPS terus menunjukkan Jakarta:</strong> Matikan WiFi dan coba lagi
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowManualInput(true)}
                            className="text-xs bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700"
                          >
                            📝 Input Koordinat Manual
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: KTP Data (Only for New Installation) */}
          {isNewInstallation && currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Data KTP (Wajib untuk Pemasangan Baru)</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Nama Lengkap Sesuai KTP *
                </label>
                <input
                  type="text"
                  name="ktpName"
                  value={formData.ktpName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required={isNewInstallation}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Nomor KTP *
                </label>
                <input
                  type="text"
                  name="ktpNumber"
                  value={formData.ktpNumber}
                  onChange={handleInputChange}
                  maxLength={16}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required={isNewInstallation}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Share Location *
                </label>
                <div className="space-y-2">
                  <select
                    name="shareLocation"
                    value={formData.shareLocation}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required={isNewInstallation}
                  >
                    <option value="">Pilih metode share location</option>
                    <option value="google_maps">Google Maps Link</option>
                    <option value="whatsapp_location">WhatsApp Location</option>
                    <option value="gps_coordinates">GPS Coordinates</option>
                    <option value="manual_address">Alamat + Patokan</option>
                  </select>
                  
                  {/* Helper text berdasarkan pilihan */}
                  {formData.shareLocation === 'google_maps' && (
                    <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                      💡 <strong>Tips:</strong> Buka Google Maps → Tap lokasi → Share → Copy link
                    </div>
                  )}
                  {formData.shareLocation === 'whatsapp_location' && (
                    <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
                      💡 <strong>Tips:</strong> Minta customer kirim lokasi via WhatsApp
                    </div>
                  )}
                  {formData.shareLocation === 'gps_coordinates' && (
                    <div className="text-xs text-purple-600 bg-purple-50 p-2 rounded">
                      💡 <strong>Format:</strong> -6.200000, 106.816666 (latitude, longitude)
                    </div>
                  )}
                  {formData.shareLocation === 'manual_address' && (
                    <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
                      💡 <strong>Tips:</strong> Sertakan patokan jelas (warung, sekolah, dll)
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Camera className="w-4 h-4 inline mr-1" />
                  Foto KTP *
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  {ktpPhotoPreview ? (
                    <div className="relative">
                      <img 
                        src={ktpPhotoPreview} 
                        alt="Preview KTP" 
                        className="max-w-full h-48 object-contain mx-auto rounded"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setKtpPhoto(null)
                          setKtpPhotoPreview('')
                        }}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                        >
                          Pilih Foto KTP
                        </button>
                        <p className="mt-2 text-sm text-gray-600">
                          PNG, JPG, JPEG hingga 5MB
                        </p>
                      </div>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between pt-6 border-t mt-6">
            <div>
              {isNewInstallation && currentStep > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Kembali
                </button>
              )}
            </div>
            
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Batal
              </button>
              
              {isNewInstallation && currentStep === 1 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Lanjut
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? 'Menyimpan...' : 'Simpan Pelanggan'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
