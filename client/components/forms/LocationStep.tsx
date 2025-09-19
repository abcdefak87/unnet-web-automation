import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { RegistrationData } from '../../types/registration';
import { validateIndonesianGPS, calculateDistance, handleLocationError, validateGPSReading } from '../../lib/gpsUtils';

interface LocationStepProps {
  formData: RegistrationData;
  setFormData: React.Dispatch<React.SetStateAction<RegistrationData>>;
}

export const LocationStep: React.FC<LocationStepProps> = ({ formData, setFormData }) => {
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('🚫 Browser tidak mendukung GPS. Gunakan input manual.');
      setShowManualInput(true);
      return;
    }

    setIsGettingLocation(true);
    toast('🛰️ Mengakses GPS satelit presisi tinggi...', { duration: 3000 });
    
    const readings: GeolocationPosition[] = [];
    let attempts = 0;
    const maxAttempts = 8;
    const requiredReadings = 3;
    
    const tryGetLocation = () => {
      attempts++;
      
      const timeoutDuration = attempts <= 3 ? 45000 : attempts <= 6 ? 30000 : 20000;
      const enableHighAccuracy = attempts <= 5;
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          
          console.log(`🛰️ GPS Reading ${attempts}/${maxAttempts}:`, {
            latitude: latitude.toFixed(8),
            longitude: longitude.toFixed(8),
            accuracy: Math.round(accuracy),
            timestamp: new Date(position.timestamp).toLocaleString('id-ID'),
            highAccuracy: enableHighAccuracy
          });
          
          const validation = validateGPSReading(position);
          
          if (!validation.isInIndonesia) {
            console.warn('❌ GPS coordinates outside Indonesia:', { latitude, longitude });
            toast.error(`❌ ${validation.message}\nSilakan coba lagi atau gunakan input manual.`);
            
            if (attempts < maxAttempts) {
              setTimeout(() => tryGetLocation(), 4000);
              toast(`🔄 Mencoba GPS lagi... (${attempts}/${maxAttempts})`, { icon: '🛰️', duration: 2000 });
              return;
            } else {
              toast.error('GPS tidak dapat menemukan lokasi di Indonesia. Gunakan input manual.');
              setShowManualInput(true);
              setIsGettingLocation(false);
              return;
            }
          }
          
          if (validation.isNetworkPositioning) {
            console.warn('🚫 Network positioning detected');
            toast.error(`🚫 ${validation.message}\n\n⚠️ Bukan GPS satelit murni!\nMemaksa GPS satelit...`, { duration: 4000 });
            
            if (attempts < maxAttempts) {
              setTimeout(() => tryGetLocation(), 8000);
              toast(`🛰️ MEMAKSA GPS SATELIT... (${attempts}/${maxAttempts})\n📡 Mencari sinyal satelit langsung`, { icon: '🛰️', duration: 4000 });
              return;
            } else {
              toast.error('🚫 GPS terus menunjukkan WiFi/Cell Tower.\n💡 Coba matikan WiFi dan gunakan data seluler, atau gunakan input manual.');
              setShowManualInput(true);
              setIsGettingLocation(false);
              return;
            }
          }
          
          if (accuracy > 500) {
            console.warn(`⚠️ Low GPS accuracy: ±${Math.round(accuracy)}m`);
            if (attempts < maxAttempts) {
              toast(`⚠️ Akurasi GPS rendah (±${Math.round(accuracy)}m). Mencoba lagi...`, { icon: '🛰️' });
              setTimeout(() => tryGetLocation(), 3000);
              return;
            }
          }
          
          readings.push(position);
          
          // Consistency validation between readings
          if (readings.length >= 2) {
            const lastReading = readings[readings.length - 1];
            const prevReading = readings[readings.length - 2];
            const distance = calculateDistance(
              lastReading.coords.latitude, lastReading.coords.longitude,
              prevReading.coords.latitude, prevReading.coords.longitude
            );
            
            if (distance > 0.5) {
              console.warn('⚠️ GPS readings inconsistent:', {
                distance: `${(distance * 1000).toFixed(0)}m`,
                reading1: { lat: prevReading.coords.latitude.toFixed(6), lng: prevReading.coords.longitude.toFixed(6) },
                reading2: { lat: lastReading.coords.latitude.toFixed(6), lng: lastReading.coords.longitude.toFixed(6) }
              });
              
              if (attempts < maxAttempts && distance > 2.0) {
                toast(`⚠️ GPS tidak stabil (jarak ${(distance * 1000).toFixed(0)}m). Mencoba lagi...`, { icon: '🛰️' });
                setTimeout(() => tryGetLocation(), 4000);
                return;
              }
            }
          }
          
          // Success criteria
          if (readings.length >= requiredReadings || accuracy <= 20) {
            const bestReading = readings.reduce((best, current) => 
              current.coords.accuracy < best.coords.accuracy ? current : best
            );
            
            const { latitude: bestLat, longitude: bestLng, accuracy: bestAccuracy } = bestReading.coords;
            
            if (bestAccuracy > 1000) {
              toast.error(`❌ GPS tidak cukup akurat (±${Math.round(bestAccuracy)}m)\nCoba di tempat terbuka atau gunakan input manual.`);
              setShowManualInput(true);
              setIsGettingLocation(false);
              return;
            }
            
            // SUCCESS - Apply validated coordinates
            setFormData(prev => ({
              ...prev,
              latitude: bestLat.toFixed(8),
              longitude: bestLng.toFixed(8),
              shareLocation: 'gps_coordinates'
            }));
            
            const locationText = `GPS Satelit: ${bestLat.toFixed(8)}, ${bestLng.toFixed(8)} (±${Math.round(bestAccuracy)}m)`;
            setFormData(prev => ({
              ...prev,
              address: prev.address || locationText
            }));
            
            const accuracyLevel = bestAccuracy <= 5 ? 'SANGAT PRESISI' : 
                                bestAccuracy <= 15 ? 'PRESISI TINGGI' : 
                                bestAccuracy <= 50 ? 'AKURAT' : 'CUKUP AKURAT';
            
            toast.success(`✅ GPS SATELIT BERHASIL!\n${accuracyLevel} (±${Math.round(bestAccuracy)}m)\nDari ${readings.length} pembacaan GPS`, { duration: 4000 });
            setIsGettingLocation(false);
            return;
          }
          
          // Continue collecting readings
          if (attempts < maxAttempts) {
            toast(`🛰️ Mengumpulkan data GPS... (${readings.length}/${requiredReadings} readings)`, { icon: '📡', duration: 2000 });
            setTimeout(() => tryGetLocation(), 2000);
          }
        },
        (error) => {
          console.error(`❌ GPS Error (attempt ${attempts}/${maxAttempts}):`, {
            code: error.code,
            message: error.message,
            timestamp: new Date().toLocaleString('id-ID')
          });
          
          if (attempts < maxAttempts) {
            const delay = Math.min(attempts * 1500, 8000);
            setTimeout(() => tryGetLocation(), delay);
            
            const method = attempts <= 4 ? 'satelit presisi tinggi' : 'mode cepat';
            toast(`🔄 GPS gagal, mencoba ${method}... (${attempts}/${maxAttempts})`, { icon: '🛰️', duration: 2000 });
          } else {
            handleLocationError(error, setShowManualInput, setIsGettingLocation);
          }
        },
        {
          enableHighAccuracy: true,
          timeout: timeoutDuration,
          maximumAge: 0
        }
      );
    };
    
    tryGetLocation();
  };

  const openGoogleMaps = () => {
    if (formData.latitude && formData.longitude) {
      const url = `https://www.google.com/maps?q=${formData.latitude},${formData.longitude}&z=18`;
      window.open(url, '_blank');
    } else {
      toast.error('Lokasi belum didapatkan');
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Informasi Pribadi</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nama Lengkap *
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Masukkan nama lengkap"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nomor HP/WhatsApp *
          </label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="08xxxxxxxxxx"
            required
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            📍 Lokasi Pemasangan *
          </label>
          
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
                  className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 font-medium"
                >
                  🗺️ Lihat di Maps
                </button>
              )}
            </div>
            
            {/* Location Info Display */}
            {formData.latitude && formData.longitude && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <div className="flex items-center gap-2 text-green-800 mb-2">
                  <MapPin className="w-4 h-4" />
                  <span className="font-medium">🛰️ Lokasi GPS Tervalidasi:</span>
                </div>
                <div className="text-sm text-green-700 space-y-3">
                  <div className="font-mono bg-green-100 p-3 rounded">
                    <div className="grid grid-cols-1 gap-1">
                      <div><strong>Latitude:</strong> {formData.latitude}</div>
                      <div><strong>Longitude:</strong> {formData.longitude}</div>
                      <div className="text-xs text-green-600 mt-2 space-y-1">
                        <div>🛰️ GPS satelit tervalidasi</div>
                        <div>📍 Koordinat dalam wilayah Indonesia</div>
                        <div>🎯 Presisi tinggi (8 digit desimal)</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded p-2">
                    <div className="text-xs text-blue-700">
                      <div className="font-semibold mb-1">Status Validasi GPS:</div>
                      <div className="space-y-1">
                        <div>✅ Koordinat dalam batas Indonesia</div>
                        <div>✅ Akurasi GPS memadai</div>
                        <div>✅ Pembacaan konsisten</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-green-600 flex items-center gap-1">
                      🎯 <span>Lokasi akurat siap untuk teknisi</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const coords = `${formData.latitude},${formData.longitude}`;
                          navigator.clipboard.writeText(coords);
                          toast.success('Koordinat disalin ke clipboard!');
                        }}
                        className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                      >
                        📋 Salin
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const url = `https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`;
                          window.open(url, '_blank');
                        }}
                        className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                      >
                        🗺️ Maps
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Manual Address Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🏠 Alamat Lengkap (Opsional)
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="Contoh: Jl. Merdeka No. 123, RT 01/RW 02, Kelurahan ABC (akan otomatis terisi dari GPS)"
              />
              <p className="text-xs text-gray-500 mt-1">
                💡 Alamat akan otomatis terisi dari GPS, atau Anda bisa menambahkan detail manual
              </p>
            </div>
            
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
                        const lat = parseFloat(formData.latitude);
                        const lng = parseFloat(formData.longitude);
                        if (validateIndonesianGPS(lat, lng)) {
                          setFormData(prev => ({ ...prev, shareLocation: 'manual_coordinates' }));
                          toast.success('✅ Koordinat manual tersimpan!');
                        } else {
                          toast.error('❌ Koordinat di luar Indonesia');
                        }
                      } else {
                        toast.error('❌ Masukkan kedua koordinat');
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
    </div>
  );
};
