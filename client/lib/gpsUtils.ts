import { toast } from 'react-hot-toast';
import { GPSReading, LocationValidationResult } from '../types/registration';

// GPS validation for Indonesia region
export const validateIndonesianGPS = (lat: number, lng: number): boolean => {
  // Indonesia bounds: roughly -11°S to 6°N, 95°E to 141°E
  const indonesiaBounds = {
    north: 6.0,
    south: -11.0,
    east: 141.0,
    west: 95.0
  };
  
  return lat >= indonesiaBounds.south && lat <= indonesiaBounds.north &&
         lng >= indonesiaBounds.west && lng <= indonesiaBounds.east;
};

// Calculate distance between two GPS points (Haversine formula)
export const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Detect network positioning (WiFi/Cell Tower)
export const isNetworkPositioning = (latitude: number, longitude: number, accuracy: number): boolean => {
  const jakartaLat = -6.2088;
  const jakartaLng = 106.8456;
  const distanceFromJakarta = calculateDistance(latitude, longitude, jakartaLat, jakartaLng);
  
  return (
    (distanceFromJakarta < 50 && accuracy > 100) || // Jakarta area with low accuracy
    (accuracy > 200) || // Very low accuracy indicates network positioning
    (latitude.toString().includes('-6.2') && longitude.toString().includes('106.') && accuracy > 50) // Jakarta coordinates with poor accuracy
  );
};

// Handle GPS errors with user-friendly messages
export const handleLocationError = (error: GeolocationPositionError, setShowManualInput: (show: boolean) => void, setIsGettingLocation: (loading: boolean) => void) => {
  let errorMessage = '❌ GPS Gagal';
  let suggestion = '';
  let action = '';
  
  switch (error.code) {
    case error.PERMISSION_DENIED:
      errorMessage = '🚫 Akses GPS Ditolak';
      suggestion = '• Klik ikon 🔒 di address bar\n• Pilih "Allow" untuk Location\n• Refresh halaman dan coba lagi';
      action = 'Izinkan akses lokasi untuk GPS akurat';
      break;
    case error.POSITION_UNAVAILABLE:
      errorMessage = '📡 GPS Tidak Tersedia';
      suggestion = '• Pastikan GPS/Location Services aktif\n• **MATIKAN WiFi** - Paksa GPS satelit\n• Coba di tempat terbuka (dekat jendela)\n• Gunakan data seluler, bukan WiFi\n• Restart browser jika perlu';
      action = 'MATIKAN WiFi dan aktifkan GPS satelit';
      break;
    case error.TIMEOUT:
      errorMessage = '⏱️ GPS Timeout';
      suggestion = '• **MATIKAN WiFi** - Paksa GPS satelit\n• Sinyal GPS lemah atau terhalang\n• Coba di luar ruangan\n• Tunggu 3-5 menit untuk lock satelit\n• Matikan VPN jika aktif';
      action = 'MATIKAN WiFi dan coba di tempat terbuka';
      break;
    default:
      errorMessage = '❌ GPS Error';
      suggestion = '• Coba refresh halaman\n• Pastikan browser mendukung GPS\n• Coba browser lain (Chrome/Firefox)';
      action = 'Gunakan input manual koordinat';
      break;
  }
  
  toast.error(`${errorMessage}\n\n${suggestion}\n\n💡 ${action}`, { 
    duration: 8000,
    style: {
      maxWidth: '400px',
      fontSize: '14px'
    }
  });
  
  // Auto-show manual input after GPS failure
  setTimeout(() => {
    setShowManualInput(true);
    toast('📝 Input manual koordinat tersedia di bawah', { icon: '💡', duration: 3000 });
  }, 2000);
  
  setIsGettingLocation(false);
};

// Validate GPS reading
export const validateGPSReading = (position: GeolocationPosition): LocationValidationResult => {
  const { latitude, longitude, accuracy } = position.coords;
  
  const result: LocationValidationResult = {
    isValid: false,
    isInIndonesia: validateIndonesianGPS(latitude, longitude),
    isNetworkPositioning: isNetworkPositioning(latitude, longitude, accuracy),
    accuracy
  };
  
  if (!result.isInIndonesia) {
    result.message = `GPS menunjukkan lokasi di luar Indonesia! Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`;
    return result;
  }
  
  if (result.isNetworkPositioning) {
    const jakartaLat = -6.2088;
    const jakartaLng = 106.8456;
    const distanceFromJakarta = calculateDistance(latitude, longitude, jakartaLat, jakartaLng);
    result.message = `DETEKSI WIFI/CELL TOWER - Lokasi: Jakarta area (${distanceFromJakarta.toFixed(1)}km), Akurasi: ±${Math.round(accuracy)}m`;
    return result;
  }
  
  if (accuracy > 500) {
    result.message = `Akurasi GPS rendah (±${Math.round(accuracy)}m)`;
    return result;
  }
  
  result.isValid = true;
  return result;
};
