/**
 * LocationPicker Component with Leaflet Map
 * Interactive map for selecting location with geolocation and reverse geocoding
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { toast } from 'react-hot-toast';
import { MapPin, Navigation, Loader2, CheckCircle } from 'lucide-react';

// Fix for default markers in Leaflet with Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  accuracy?: number;
}

interface LocationPickerProps {
  onLocationSelect: (location: LocationData) => void;
  initialLocation?: LocationData;
  height?: string;
  className?: string;
}

// Custom marker icon
const createCustomIcon = (color: string = '#3B82F6') => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 30px;
        height: 30px;
        border-radius: 50% 50% 50% 0;
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          color: white;
          font-size: 16px;
          transform: rotate(45deg);
          margin-top: -2px;
        ">📍</div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
  });
};

// Map events component
const MapEvents: React.FC<{
  onLocationSelect: (location: LocationData) => void;
  isGettingLocation: boolean;
}> = ({ onLocationSelect, isGettingLocation }) => {
  const [position, setPosition] = useState<[number, number] | null>(null);

  useMapEvents({
    click: (e) => {
      if (isGettingLocation) return;
      
      const { lat, lng } = e.latlng;
      setPosition([lat, lng]);
      
      // Reverse geocoding
      reverseGeocode(lat, lng).then((address) => {
        onLocationSelect({
          latitude: lat,
          longitude: lng,
          address: address
        });
      });
    },
  });

  return position ? (
    <Marker position={position} icon={createCustomIcon('#10B981')}>
      <Popup>
        <div className="text-center">
          <p className="font-medium">📍 Lokasi Dipilih</p>
          <p className="text-sm text-gray-600">
            {position[0].toFixed(6)}, {position[1].toFixed(6)}
          </p>
        </div>
      </Popup>
    </Marker>
  ) : null;
};

// Enhanced reverse geocoding with multiple providers and fallback
const enhancedReverseGeocode = async (lat: number, lng: number): Promise<string> => {
  const providers = [
    // Primary: Nominatim (OpenStreetMap)
    {
      name: 'Nominatim',
      url: `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=id&zoom=18`,
      parser: (data: any) => data?.display_name
    },
    // Fallback: Photon (OpenStreetMap alternative)
    {
      name: 'Photon',
      url: `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=id`,
      parser: (data: any) => {
        if (data?.features?.[0]?.properties) {
          const props = data.features[0].properties;
          return `${props.name || ''} ${props.street || ''} ${props.city || ''} ${props.state || ''} ${props.country || ''}`.trim();
        }
        return null;
      }
    }
  ];

  for (const provider of providers) {
    try {
      console.log(`🗺️ Trying ${provider.name} reverse geocoding...`);
      
      const response = await fetch(provider.url, {
        headers: {
          'User-Agent': 'ISP-Management-System/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const address = provider.parser(data);
      
      if (address && address.trim().length > 0) {
        console.log(`✅ ${provider.name} success:`, address);
        return address;
      }
    } catch (error) {
      console.warn(`❌ ${provider.name} failed:`, error);
    }
  }

  // Final fallback
  return `Koordinat: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
};

// Legacy reverse geocoding function (kept for compatibility)
const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  return enhancedReverseGeocode(lat, lng);
};

const LocationPicker: React.FC<LocationPickerProps> = ({
  onLocationSelect,
  initialLocation,
  height = '400px',
  className = ''
}) => {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(initialLocation || null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-7.250445, 112.768845]); // Surabaya default
  const [isMapReady, setIsMapReady] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [calibrationStatus, setCalibrationStatus] = useState('');
  const mapRef = useRef<L.Map>(null);

  // Initialize map center
  useEffect(() => {
    if (initialLocation) {
      setMapCenter([initialLocation.latitude, initialLocation.longitude]);
      setCurrentLocation(initialLocation);
    }
  }, [initialLocation]);

  // Filter outliers using IQR (Interquartile Range) method
  const filterOutliers = useCallback((readings: Array<{lat: number, lng: number, accuracy: number, timestamp: number}>) => {
    if (readings.length <= 2) return readings;

    // Calculate distances from centroid
    const centroid = {
      lat: readings.reduce((sum, r) => sum + r.lat, 0) / readings.length,
      lng: readings.reduce((sum, r) => sum + r.lng, 0) / readings.length
    };

    const distances = readings.map(r => 
      Math.sqrt(Math.pow(r.lat - centroid.lat, 2) + Math.pow(r.lng - centroid.lng, 2))
    );

    // Sort distances
    distances.sort((a, b) => a - b);

    // Calculate Q1, Q3, and IQR
    const q1Index = Math.floor(distances.length * 0.25);
    const q3Index = Math.floor(distances.length * 0.75);
    const q1 = distances[q1Index];
    const q3 = distances[q3Index];
    const iqr = q3 - q1;

    // Filter outliers (keep readings within 1.5 * IQR)
    const threshold = q3 + (1.5 * iqr);
    
    return readings.filter((_, index) => distances[index] <= threshold);
  }, []);

  // Calculate consistency score
  const calculateConsistency = useCallback((readings: Array<{lat: number, lng: number, accuracy: number, timestamp: number}>, centerLat: number, centerLng: number) => {
    if (readings.length <= 1) return readings[0]?.accuracy || 100;

    const distances = readings.map(r => 
      Math.sqrt(Math.pow(r.lat - centerLat, 2) + Math.pow(r.lng - centerLng, 2))
    );

    // Convert to meters (approximate)
    const distancesInMeters = distances.map(d => d * 111000); // 1 degree ≈ 111km
    
    // Calculate standard deviation
    const mean = distancesInMeters.reduce((sum, d) => sum + d, 0) / distancesInMeters.length;
    const variance = distancesInMeters.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / distancesInMeters.length;
    const stdDev = Math.sqrt(variance);

    // Consistency score: lower stdDev = higher consistency
    return Math.max(5, stdDev * 2); // Minimum 5m accuracy
  }, []);

  // Calibrate GPS readings using advanced algorithms
  const calibrateGPSReadings = useCallback((readings: Array<{lat: number, lng: number, accuracy: number, timestamp: number}>) => {
    if (readings.length === 1) {
      return {
        latitude: readings[0].lat,
        longitude: readings[0].lng,
        accuracy: readings[0].accuracy
      };
    }

    // Filter out outliers using statistical methods
    const filteredReadings = filterOutliers(readings);
    
    // Calculate weighted average based on accuracy
    let totalWeight = 0;
    let weightedLat = 0;
    let weightedLng = 0;
    let minAccuracy = Infinity;

    filteredReadings.forEach(reading => {
      // Higher accuracy (lower number) = higher weight
      const weight = 1 / (reading.accuracy + 1);
      weightedLat += reading.lat * weight;
      weightedLng += reading.lng * weight;
      totalWeight += weight;
      minAccuracy = Math.min(minAccuracy, reading.accuracy);
    });

    const calibratedLat = weightedLat / totalWeight;
    const calibratedLng = weightedLng / totalWeight;

    // Calculate final accuracy based on consistency
    const consistency = calculateConsistency(filteredReadings, calibratedLat, calibratedLng);
    const finalAccuracy = Math.max(minAccuracy, consistency);

    return {
      latitude: calibratedLat,
      longitude: calibratedLng,
      accuracy: finalAccuracy
    };
  }, [filterOutliers, calculateConsistency]);

  // Advanced GPS calibration with multiple readings
  const getCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      toast.error('Browser tidak mendukung GPS. Klik pada peta untuk memilih lokasi.');
      return;
    }

    setIsGettingLocation(true);
    setCalibrationProgress(0);
    setCalibrationStatus('Memulai kalibrasi GPS...');
    toast('📍 Kalibrasi GPS untuk akurasi maksimal...', { duration: 3000 });

    try {
      // Step 1: Get multiple GPS readings for calibration
      const readings = await getMultipleGPSReadings();
      
      if (readings.length === 0) {
        throw new Error('Tidak ada pembacaan GPS yang valid');
      }

      // Step 2: Filter and average readings
      setCalibrationStatus('Mengkalibrasi koordinat...');
      setCalibrationProgress(95);
      const calibratedLocation = calibrateGPSReadings(readings);
      
      console.log('📍 Calibrated GPS result:', {
        readings: readings.length,
        finalLatitude: calibratedLocation.latitude.toFixed(8),
        finalLongitude: calibratedLocation.longitude.toFixed(8),
        finalAccuracy: Math.round(calibratedLocation.accuracy),
        timestamp: new Date().toLocaleString('id-ID')
      });

      // Validate Indonesia bounds
      const isInIndonesia = calibratedLocation.latitude >= -11.0 && calibratedLocation.latitude <= 6.0 && 
                           calibratedLocation.longitude >= 95.0 && calibratedLocation.longitude <= 141.0;
      
      if (!isInIndonesia) {
        toast.error('❌ Koordinat di luar Indonesia. Klik pada peta untuk memilih lokasi.');
        setIsGettingLocation(false);
        return;
      }

      // Step 3: Enhanced reverse geocoding
      const address = await enhancedReverseGeocode(calibratedLocation.latitude, calibratedLocation.longitude);
      
      const locationData: LocationData = {
        latitude: calibratedLocation.latitude,
        longitude: calibratedLocation.longitude,
        address,
        accuracy: Math.round(calibratedLocation.accuracy)
      };

      setCurrentLocation(locationData);
      setMapCenter([calibratedLocation.latitude, calibratedLocation.longitude]);
      
      // Center map on location with appropriate zoom
      if (mapRef.current) {
        const zoomLevel = calibratedLocation.accuracy <= 10 ? 18 : 
                         calibratedLocation.accuracy <= 50 ? 16 : 14;
        mapRef.current.setView([calibratedLocation.latitude, calibratedLocation.longitude], zoomLevel);
      }

      onLocationSelect(locationData);

      const accuracyLevel = calibratedLocation.accuracy <= 3 ? 'SANGAT PRESISI' : 
                          calibratedLocation.accuracy <= 8 ? 'PRESISI TINGGI' : 
                          calibratedLocation.accuracy <= 20 ? 'AKURAT' : 
                          calibratedLocation.accuracy <= 100 ? 'CUKUP AKURAT' : 'AKURAT RENDAH';

      toast.success(`✅ Lokasi dikalibrasi!\n${accuracyLevel} (±${Math.round(calibratedLocation.accuracy)}m)\n${readings.length} pembacaan GPS`, { 
        duration: 5000 
      });
      
    } catch (error) {
      console.error('GPS Calibration Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat kalibrasi GPS';
      toast.error(`❌ ${errorMessage}\nKlik pada peta untuk memilih lokasi manual.`);
    } finally {
      setIsGettingLocation(false);
    }
  }, [onLocationSelect, calibrateGPSReadings]);

  // Get multiple GPS readings for better accuracy
  const getMultipleGPSReadings = async (): Promise<Array<{lat: number, lng: number, accuracy: number, timestamp: number}>> => {
    const readings: Array<{lat: number, lng: number, accuracy: number, timestamp: number}> = [];
    const maxReadings = 5;
    const minReadings = 2;
    const readingInterval = 1000; // 1 second between readings

    return new Promise((resolve, reject) => {
      let readingCount = 0;
      let timeoutId: NodeJS.Timeout;

      const getReading = () => {
        setCalibrationStatus(`Membaca GPS ${readingCount + 1}/${maxReadings}...`);
        setCalibrationProgress((readingCount / maxReadings) * 100);

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            
            readings.push({
              lat: latitude,
              lng: longitude,
              accuracy: accuracy,
              timestamp: Date.now()
            });

            readingCount++;
            console.log(`📍 GPS Reading ${readingCount}:`, {
              lat: latitude.toFixed(8),
              lng: longitude.toFixed(8),
              accuracy: Math.round(accuracy)
            });

            // Continue if we need more readings and haven't reached max
            if (readingCount < maxReadings) {
              setTimeout(getReading, readingInterval);
            } else {
              setCalibrationStatus('Menganalisis pembacaan GPS...');
              setCalibrationProgress(90);
              clearTimeout(timeoutId);
              resolve(readings);
            }
          },
          (error) => {
            console.warn(`GPS Reading ${readingCount + 1} failed:`, error);
            
            // If we have minimum readings, proceed
            if (readings.length >= minReadings) {
              setCalibrationStatus('Menganalisis pembacaan GPS...');
              setCalibrationProgress(90);
              clearTimeout(timeoutId);
              resolve(readings);
            } else if (readingCount >= maxReadings - 1) {
              // Last attempt failed and we don't have enough readings
              clearTimeout(timeoutId);
              reject(new Error('Tidak cukup pembacaan GPS yang valid'));
            } else {
              // Try again after a short delay
              setTimeout(getReading, readingInterval);
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
          }
        );
      };

      // Start first reading
      getReading();

      // Overall timeout
      timeoutId = setTimeout(() => {
        if (readings.length >= minReadings) {
          setCalibrationStatus('Menganalisis pembacaan GPS...');
          setCalibrationProgress(90);
          resolve(readings);
        } else {
          reject(new Error('Timeout: Tidak cukup pembacaan GPS'));
        }
      }, 45000); // 45 seconds total timeout
    });
  };

  // Handle map ready
  const handleMapReady = useCallback(() => {
    setIsMapReady(true);
  }, []);

  return (
    <div className={`w-full ${className}`}>
      {/* Controls */}
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={getCurrentLocation}
          disabled={isGettingLocation}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
        >
          {isGettingLocation ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Kalibrasi...</span>
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4" />
              <span>📍 Lokasi Saya</span>
            </>
          )}
        </button>
        
        <button
          type="button"
          onClick={() => window.open('https://maps.google.com', '_blank')}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
        >
          <MapPin className="w-4 h-4" />
          <span>🗺️ Google Maps</span>
        </button>
      </div>

      {/* Calibration Progress */}
      {isGettingLocation && (
        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span className="text-sm font-medium text-blue-800">{calibrationStatus}</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${calibrationProgress}%` }}
            ></div>
          </div>
          <p className="text-xs text-blue-600 mt-1">
            {calibrationProgress < 50 ? 'Mengambil pembacaan GPS...' : 
             calibrationProgress < 90 ? 'Menganalisis data...' : 
             'Menyelesaikan kalibrasi...'}
          </p>
        </div>
      )}

      {/* Map Container */}
      <div 
        className="border border-gray-300 rounded-lg overflow-hidden"
        style={{ height }}
      >
        <MapContainer
          center={mapCenter}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
          whenReady={handleMapReady}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* Current location marker */}
          {currentLocation && (
            <Marker 
              position={[currentLocation.latitude, currentLocation.longitude]}
              icon={createCustomIcon('#3B82F6')}
            >
              <Popup>
                <div className="text-center">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="font-medium">📍 Lokasi Terpilih</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                  </p>
                  {currentLocation.accuracy && (
                    <p className="text-xs text-blue-600">
                      Akurasi: ±{currentLocation.accuracy}m
                    </p>
                  )}
                  {currentLocation.address && (
                    <p className="text-xs text-gray-500 mt-2 max-w-xs">
                      {currentLocation.address}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          )}
          
          {/* Map click events */}
          <MapEvents 
            onLocationSelect={onLocationSelect}
            isGettingLocation={isGettingLocation}
          />
        </MapContainer>
      </div>

      {/* Instructions */}
      <div className="mt-3 text-xs text-gray-500 bg-gray-50 p-3 rounded">
        <div className="flex items-start gap-2">
          <span className="text-blue-600">💡</span>
          <div>
            <p className="font-medium text-gray-700 mb-1">Cara menggunakan:</p>
            <ul className="space-y-1 text-gray-600">
              <li>• Klik <strong>&quot;📍 Lokasi Saya&quot;</strong> untuk kalibrasi GPS otomatis (5 pembacaan)</li>
              <li>• Klik pada peta untuk memilih lokasi manual</li>
              <li>• Drag marker untuk menyesuaikan posisi</li>
              <li>• Klik <strong>&quot;🗺️ Google Maps&quot;</strong> untuk referensi</li>
            </ul>
            <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
              <strong>💡 Kalibrasi GPS:</strong> Mengambil 5 pembacaan GPS dan menggunakan algoritma statistik untuk akurasi maksimal (±3-20m)
            </div>
          </div>
        </div>
      </div>

      {/* Location Info */}
      {currentLocation && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-800 mb-2">
            <CheckCircle className="w-4 h-4" />
            <span className="font-medium">Lokasi Terpilih</span>
          </div>
          <div className="text-sm text-green-700 space-y-1">
            <div className="font-mono bg-green-100 p-2 rounded text-xs">
              <div><strong>Latitude:</strong> {currentLocation.latitude.toFixed(8)}</div>
              <div><strong>Longitude:</strong> {currentLocation.longitude.toFixed(8)}</div>
              {currentLocation.accuracy && (
                <div><strong>Akurasi:</strong> ±{currentLocation.accuracy}m</div>
              )}
            </div>
            {currentLocation.address && (
              <div className="mt-2">
                <strong>Alamat:</strong> {currentLocation.address}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationPicker;
