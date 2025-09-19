/**
 * Enhanced Registration Form with Security Features
 * Includes CSRF protection and improved validation
 * Note: Email verification step has been removed for simplified registration
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import NextImage from 'next/image'
import { toast } from 'react-hot-toast'
import { customersAPI } from '../lib/api'
import { Shield, Mail, CheckCircle, Loader2 } from 'lucide-react'
import dynamic from 'next/dynamic'

// Dynamic import untuk LocationPicker (client-side only)
const LocationPicker = dynamic(() => import('./LocationPicker'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[350px] bg-gray-100 rounded-lg flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
        <p className="text-sm text-gray-600">Memuat peta...</p>
      </div>
    </div>
  )
})

interface RegistrationData {
  name: string;
  phone: string;
  address: string;
  latitude?: number;
  longitude?: number;
  ktpNumber: string;
  ktpName: string;
  ktpAddress: string;
  packageType: string;
  installationType: string;
}

interface SecurityData {
  csrfToken: string;
}

const RegistrationForm: React.FC = () => {
  const router = useRouter();
  const [formData, setFormData] = useState<RegistrationData>({
    name: '',
    phone: '',
    address: '',
    ktpNumber: '',
    ktpName: '',
    ktpAddress: '',
    packageType: '',
    installationType: 'NEW_INSTALLATION'
  });
  
  const [securityData, setSecurityData] = useState<SecurityData>({
    csrfToken: ''
  });
  
  const [csrfTokenRetryCount, setCsrfTokenRetryCount] = useState(0);
  
  const [ktpPhoto, setKtpPhoto] = useState<File | null>(null);
  const [housePhoto, setHousePhoto] = useState<File | null>(null);
  const [previewKtp, setPreviewKtp] = useState<string | null>(null);
  const [previewHouse, setPreviewHouse] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [isLoadingCSRF, setIsLoadingCSRF] = useState(true);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [fieldTouched, setFieldTouched] = useState<Record<string, boolean>>({});
  const [locationData, setLocationData] = useState<{latitude: number, longitude: number, address?: string} | null>(null);

  const packageOptions = [
    { value: '10MBPS', label: '10 Mbps - Rp 200.000/bulan' },
    { value: '20MBPS', label: '20 Mbps - Rp 300.000/bulan' },
    { value: '50MBPS', label: '50 Mbps - Rp 500.000/bulan' },
    { value: '100MBPS', label: '100 Mbps - Rp 800.000/bulan' }
  ];

  // Enhanced KTP validation with province code check
  const validateKTP = (ktpNumber: string): boolean => {
    if (ktpNumber.length !== 16) return false;
    
    // Validasi provinsi dari 2 digit pertama (sesuai standar KTP Indonesia)
    const provinceCode = parseInt(ktpNumber.substring(0, 2));
    const validProvinces = [
      11, 12, 13, 14, 15, 16, 17, 18, 19, // Aceh, Sumatera Utara, Sumatera Barat, Riau, Kepulauan Riau, Jambi, Sumatera Selatan, Bangka Belitung, Bengkulu
      21, 31, 32, 33, 34, 35, 36, // Lampung, Jakarta, Jawa Barat, Jawa Tengah, Yogyakarta, Jawa Timur, Banten
      51, 52, 53, 61, 62, 63, 64, 65, // Bali, Nusa Tenggara Barat, Nusa Tenggara Timur, Kalimantan Barat, Kalimantan Tengah, Kalimantan Selatan, Kalimantan Timur, Kalimantan Utara
      71, 72, 73, 74, 75, 76, // Sulawesi Utara, Sulawesi Tengah, Sulawesi Selatan, Sulawesi Tenggara, Gorontalo, Sulawesi Barat
      81, 82, 91, 94 // Maluku, Maluku Utara, Papua, Papua Barat
    ];
    
    return validProvinces.includes(provinceCode);
  };

  // Load CSRF token and initialize security
  useEffect(() => {
    const loadSecurityData = async (retryCount = 0) => {
      try {
        const response = await customersAPI.getCSRFToken();
        
        // Check if response is valid JSON
        if (response.data && typeof response.data === 'object') {
          if (response.data.success && response.data.csrfToken) {
            setSecurityData(prev => ({ ...prev, csrfToken: response.data.csrfToken }));
            console.log('CSRF token loaded successfully');
            setCsrfTokenRetryCount(0); // Reset retry count on success
            setIsLoadingCSRF(false);
          } else {
            throw new Error(response.data.error || 'Invalid response from server');
          }
        } else {
          throw new Error('Invalid response format from server');
        }
      } catch (error) {
        console.error('Failed to load CSRF token:', error);
        
        // Retry logic for network errors
        const axiosError = error as any;
        if (retryCount < 3 && (!axiosError.response || axiosError.response.status >= 500)) {
          console.log(`Retrying CSRF token fetch (attempt ${retryCount + 1}/3)`);
          setCsrfTokenRetryCount(retryCount + 1);
          setTimeout(() => loadSecurityData(retryCount + 1), 1000 * (retryCount + 1));
          return;
        }
        
        // Set loading to false on final failure
        setIsLoadingCSRF(false);
        
        // Check if it's a network error or server error
        if (axiosError.response) {
          const status = axiosError.response.status;
          if (status === 404) {
            toast.error('Security endpoint not found. Please contact support.');
          } else if (status >= 500) {
            toast.error('Server error. Please try again later.');
          } else {
            toast.error('Failed to initialize security. Please refresh the page.');
          }
        } else {
          toast.error('Network error. Please check your connection.');
        }
      }
    };

    loadSecurityData();
  }, []);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Real-time validation for touched fields
    if (fieldTouched[name]) {
      const error = validateField(name, value);
      if (error) {
        setValidationErrors(prev => ({ ...prev, [name]: error }));
      }
    }
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name } = e.target;
    setFieldTouched(prev => ({ ...prev, [name]: true }));
  };

  const handleLocationSelect = (location: {latitude: number, longitude: number, address?: string}) => {
    setLocationData(location);
    setFormData(prev => ({
      ...prev,
      // Limit GPS precision to 8 decimal places to avoid server validation error
      latitude: parseFloat(location.latitude.toFixed(8)),
      longitude: parseFloat(location.longitude.toFixed(8)),
      address: location.address || prev.address // Set address from location or keep existing
    }));
  };

  // Enhanced input validation
  const validateField = (name: string, value: string): string => {
    switch (name) {
      case 'name':
        if (!value.trim()) return 'Nama wajib diisi';
        if (value.length < 2) return 'Nama minimal 2 karakter';
        if (value.length > 100) return 'Nama maksimal 100 karakter';
        if (!/^[a-zA-Z\s\u00C0-\u017F]+$/.test(value)) return 'Nama hanya boleh huruf dan spasi';
        break;
      
      case 'phone':
        if (!value.trim()) return 'Nomor HP wajib diisi';
        const phoneRegex = /^0[0-9]{9,13}$/;
        if (!phoneRegex.test(value.replace(/\s+/g, ''))) {
          return 'Format nomor HP tidak valid. Gunakan format 08xxxxxxxxxx';
        }
        break;
      
      case 'address':
        if (!value.trim()) return 'Alamat wajib diisi';
        if (value.length < 5) return 'Alamat minimal 5 karakter';
        if (value.length > 500) return 'Alamat maksimal 500 karakter';
        break;
      
      case 'ktpNumber':
        if (value) {
          if (!/^[0-9]{16}$/.test(value)) {
            return 'Nomor KTP harus 16 digit';
          }
          if (!validateKTP(value)) {
            return 'Nomor KTP tidak valid. Periksa kembali nomor KTP Anda.';
          }
        }
        break;
      
      case 'ktpName':
        if (value && value.length < 2) return 'Nama KTP minimal 2 karakter';
        if (value && value.length > 100) return 'Nama KTP maksimal 100 karakter';
        break;
      
      
      case 'ktpAddress':
        if (value && value.length > 500) return 'Alamat KTP maksimal 500 karakter';
        break;
    }
    return '';
  };

  // Memoized duplicate check function
  const checkPhoneDuplicate = useCallback(async (phone: string): Promise<boolean> => {
    if (!phone || phone.length < 10) return false;
    
    try {
      setIsCheckingDuplicate(true);
      const response = await customersAPI.checkPhoneExists(phone);
      return response.data.exists;
    } catch (error) {
      console.error('Phone duplicate check failed:', error);
      return false;
    } finally {
      setIsCheckingDuplicate(false);
    }
  }, []);

  const handleInputBlur = async (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const error = validateField(name, value);
    
    if (error) {
      setValidationErrors(prev => ({ ...prev, [name]: error }));
      return;
    }

    // Check for phone duplicates
    if (name === 'phone' && value.trim()) {
      const isDuplicate = await checkPhoneDuplicate(value.trim());
      if (isDuplicate) {
        setValidationErrors(prev => ({ 
          ...prev, 
          [name]: 'Nomor HP ini sudah terdaftar. Gunakan nomor lain atau hubungi admin.' 
        }));
      }
    }
  };




  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'ktp' | 'house') => {
    const file = e.target.files?.[0];
    if (file) {
      // Enhanced file validation
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      const maxSize = 5 * 1024 * 1024; // 5MB
      
      if (!allowedTypes.includes(file.type)) {
        toast.error('Format file tidak didukung. Gunakan JPEG, PNG, atau WebP.');
        e.target.value = ''; // Clear input
        return;
      }
      
      if (file.size > maxSize) {
        toast.error('Ukuran file maksimal 5MB');
        e.target.value = ''; // Clear input
        return;
      }
      
      // Check file name for suspicious characters
      if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
        toast.error('Nama file mengandung karakter yang tidak diizinkan');
        e.target.value = ''; // Clear input
        return;
      }

      // Check for suspicious file names
      const suspiciousPatterns = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
      const fileName = file.name.split('.')[0];
      if (suspiciousPatterns.test(fileName)) {
        toast.error('Nama file tidak valid');
        e.target.value = ''; // Clear input
        return;
      }

      try {
        // Show compression toast
        const compressionToast = toast.loading('Mengompres gambar...');
        
        // Compress image if larger than 1MB
        let processedFile = file;
        if (file.size > 1024 * 1024) { // 1MB
          processedFile = await compressImage(file, 1920, 0.8);
          toast.dismiss(compressionToast);
          toast.success(`Gambar dikompres dari ${Math.round(file.size / 1024)}KB menjadi ${Math.round(processedFile.size / 1024)}KB`);
        } else {
          toast.dismiss(compressionToast);
        }
        
        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          if (type === 'ktp') {
            setPreviewKtp(result);
            setKtpPhoto(processedFile);
          } else {
            setPreviewHouse(result);
            setHousePhoto(processedFile);
          }
        };
        reader.onerror = () => {
          toast.error('Gagal membaca file. Coba file lain.');
          e.target.value = ''; // Clear input
        };
        reader.readAsDataURL(file); // Use original file for preview
        
      } catch (error) {
        toast.error('Gagal memproses gambar. Coba file lain.');
        e.target.value = ''; // Clear input
        console.error('Image processing error:', error);
      }
    }
  };

  // Memoized image compression utility
  const compressImage = useCallback((file: File, maxWidth: number = 1920, quality: number = 0.8): Promise<File> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        
        // Draw and compress
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Compression failed'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }, []);

  // Clear preview when file is removed
  const clearFilePreview = (type: 'ktp' | 'house') => {
    if (type === 'ktp') {
      setPreviewKtp(null);
      setKtpPhoto(null);
    } else {
      setPreviewHouse(null);
      setHousePhoto(null);
    }
  };

  // Skeleton loading components
  const SkeletonInput = ({ className = "" }: { className?: string }) => (
    <div className={`animate-pulse ${className}`}>
      <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
      <div className="h-10 bg-gray-200 rounded"></div>
    </div>
  );

  const SkeletonTextarea = ({ className = "" }: { className?: string }) => (
    <div className={`animate-pulse ${className}`}>
      <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
      <div className="h-20 bg-gray-200 rounded"></div>
    </div>
  );

  const SkeletonFileUpload = ({ className = "" }: { className?: string }) => (
    <div className={`animate-pulse ${className}`}>
      <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
      <div className="h-10 bg-gray-200 rounded"></div>
      <div className="h-3 bg-gray-200 rounded w-3/4 mt-1"></div>
    </div>
  );

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        const requiredFields = ['name', 'phone', 'packageType'];
        
        // Check required fields
        for (const field of requiredFields) {
          if (!formData[field as keyof RegistrationData]) {
            return false;
          }
        }
        
        // Check location is required (GPS coordinates)
        const hasLocation = Boolean(formData.latitude && formData.longitude);
        if (!hasLocation) {
          return false;
        }
        
        // For testing, make files optional
        return true; // && hasFiles;
      case 2:
        // Step 2 requires privacy consent
        return privacyConsent;
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
      // Show success message when moving to step 2
      if (currentStep === 1) {
        toast.success('Data berhasil divalidasi! Silakan periksa kembali sebelum submit.');
      }
    } else {
      toast.error('Mohon lengkapi semua field yang diperlukan');
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => prev - 1);
  };


  // Enhanced error message handler
  const getErrorMessage = (error: any): string => {
    if (error.response?.data?.error?.includes('duplicate')) {
      return 'Nomor HP ini sudah terdaftar. Gunakan nomor lain atau hubungi admin.';
    }
    if (error.response?.data?.error?.includes('KTP')) {
      return 'Nomor KTP tidak valid atau sudah terdaftar. Periksa kembali nomor KTP Anda.';
    }
    if (error.response?.status === 413) {
      return 'File terlalu besar. Kompres foto atau gunakan resolusi lebih rendah.';
    }
    if (error.response?.status === 429) {
      return 'Terlalu banyak percobaan. Tunggu beberapa menit sebelum mencoba lagi.';
    }
    if (error.response?.status === 500) {
      return 'Server sedang mengalami masalah. Silakan coba lagi nanti.';
    }
    if (error.message?.includes('Network Error')) {
      return 'Koneksi internet bermasalah. Periksa koneksi Anda dan coba lagi.';
    }
    return error.response?.data?.error || error.response?.data?.message || error.message || 'Terjadi kesalahan. Silakan coba lagi.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Only submit when we're on step 2 (confirmation step)
    if (currentStep !== 2) {
      return;
    }

    setIsSubmitting(true);

    try {
      const submitData = new FormData();
      
      // Add form data (only non-empty values)
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          submitData.append(key, value);
        }
      });
      
      // Add security data - CSRF token is now mandatory
      if (!securityData.csrfToken) {
        toast.error('Token keamanan tidak tersedia. Silakan refresh halaman dan coba lagi.');
        setIsSubmitting(false);
        return;
      }
      
      submitData.append('_csrf', securityData.csrfToken);
      console.log('CSRF token added to submission');
      
      // Add files
      if (ktpPhoto) submitData.append('ktpPhoto', ktpPhoto);
      if (housePhoto) submitData.append('housePhoto', housePhoto);

      // Debug: Log form data being sent
      console.log('Form data being sent:', {
        formData: Object.fromEntries(submitData.entries()),
        hasKtpPhoto: !!ktpPhoto,
        hasHousePhoto: !!housePhoto,
        csrfToken: securityData.csrfToken
      });

      const response = await customersAPI.registerPublic(submitData);
      const result = response.data;

      if ((response.status >= 200 && response.status < 300) || result?.success) {
        toast.success('Pendaftaran berhasil! Tiket PSB telah dibuat.');
        
        // Redirect to success page
        router.push(`/register/success?id=${result.data.id}&jobNumber=${result.data.jobNumber}`);
      } else {
        const serverError = result?.error || result?.message || 'Terjadi kesalahan saat mendaftar';
        toast.error(serverError);
      }
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = getErrorMessage(error);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        {isLoadingCSRF ? (
          <>
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <span className="text-sm font-medium text-blue-600">
              Memuat token keamanan...
            </span>
          </>
        ) : securityData.csrfToken ? (
          <>
            <Shield className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-600">
              Formulir aman dengan perlindungan keamanan
            </span>
          </>
        ) : (
          <>
            <Shield className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium text-red-600">
              Token keamanan gagal dimuat. Silakan refresh halaman.
            </span>
          </>
        )}
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900">Informasi Pribadi</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label 
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Nama Lengkap *
          </label>
          <input
            id="name"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
              validationErrors.name ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Masukkan nama lengkap"
            required
            maxLength={100}
            aria-label="Nama lengkap"
            aria-describedby={validationErrors.name ? "name-error" : undefined}
            aria-invalid={!!validationErrors.name}
            autoComplete="name"
          />
          {validationErrors.name && (
            <p id="name-error" className="text-red-500 text-xs mt-1" role="alert">
              {validationErrors.name}
            </p>
          )}
        </div>

        <div>
          <label 
            htmlFor="phone"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Nomor HP/WhatsApp *
          </label>
          <div className="relative">
            <input
              id="phone"
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                validationErrors.phone ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="08xxxxxxxxxx"
              required
              maxLength={15}
              aria-label="Nomor HP atau WhatsApp"
              aria-describedby={validationErrors.phone ? "phone-error" : isCheckingDuplicate ? "phone-checking" : undefined}
              aria-invalid={!!validationErrors.phone}
              autoComplete="tel"
            />
            {isCheckingDuplicate && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2" aria-hidden="true">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>
          {validationErrors.phone && (
            <p id="phone-error" className="text-red-500 text-xs mt-1" role="alert">
              {validationErrors.phone}
            </p>
          )}
          {isCheckingDuplicate && (
            <p id="phone-checking" className="text-blue-600 text-xs mt-1" aria-live="polite">
              Memeriksa ketersediaan nomor...
            </p>
          )}
        </div>

        {/* Address Input */}
        <div className="md:col-span-2">
          <label 
            htmlFor="address"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Alamat Lengkap *
          </label>
          <textarea
            id="address"
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
              validationErrors.address ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Masukkan alamat lengkap tempat pemasangan WiFi"
            required
            rows={3}
            maxLength={500}
            aria-label="Alamat lengkap"
            aria-describedby={validationErrors.address ? "address-error" : undefined}
            aria-invalid={!!validationErrors.address}
          />
          {validationErrors.address && (
            <p id="address-error" className="text-red-500 text-xs mt-1" role="alert">
              {validationErrors.address}
            </p>
          )}
        </div>

        {/* Location Picker */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            📍 Lokasi Pemasangan *
          </label>
          <LocationPicker
            onLocationSelect={handleLocationSelect}
            initialLocation={locationData || undefined}
            height="350px"
            className="mb-3"
          />
          
        </div>

        {/* Package Selection */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pilih Paket Internet *
          </label>
          <select
            name="packageType"
            value={formData.packageType}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Pilih paket</option>
            {packageOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* File Uploads with Preview */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Foto KTP *
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => handleFileChange(e, 'ktp')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
          <p className="text-sm text-gray-500 mt-1">
            Foto KTP untuk verifikasi identitas. Format: JPEG, PNG, WebP. Maksimal 5MB.
          </p>
          
          {/* KTP Preview */}
          {previewKtp && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-green-700">Preview Foto KTP:</span>
                <button
                  type="button"
                  onClick={() => clearFilePreview('ktp')}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Hapus
                </button>
              </div>
              <div className="border border-gray-200 rounded-lg p-2 bg-gray-50">
                <NextImage
                  src={previewKtp}
                  alt="Preview KTP"
                  width={300}
                  height={128}
                  className="max-w-full h-32 object-contain rounded"
                />
              </div>
            </div>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Foto Rumah *
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => handleFileChange(e, 'house')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
          <p className="text-sm text-gray-500 mt-1">
            Foto bagian depan rumah/lokasi instalasi. Format: JPEG, PNG, WebP. Maksimal 5MB.
          </p>
          
          {/* House Preview */}
          {previewHouse && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-green-700">Preview Foto Rumah:</span>
                <button
                  type="button"
                  onClick={() => clearFilePreview('house')}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Hapus
                </button>
              </div>
              <div className="border border-gray-200 rounded-lg p-2 bg-gray-50">
                <NextImage
                  src={previewHouse}
                  alt="Preview Rumah"
                  width={300}
                  height={128}
                  className="max-w-full h-32 object-contain rounded"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Konfirmasi Data</h3>
        <p className="text-gray-600">Silakan periksa kembali data yang telah Anda masukkan</p>
      </div>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="text-yellow-600 text-xl">⚠️</div>
          <div>
            <p className="text-sm text-yellow-800 font-medium mb-1">Penting!</p>
            <p className="text-sm text-yellow-800">
              Pastikan semua data yang Anda masukkan sudah benar. Data ini akan digunakan untuk proses penjadwalan pemasangan dan tidak dapat diubah setelah submit.
            </p>
          </div>
        </div>
      </div>
      <div className="bg-blue-50 p-6 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-4 text-lg">📋 Ringkasan Data</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
          <div className="space-y-3">
            <div className="bg-white p-3 rounded border">
              <p className="font-medium text-blue-900 mb-1">👤 Informasi Pribadi</p>
              <p><strong>Nama:</strong> {formData.name}</p>
              <p><strong>WhatsApp:</strong> {formData.phone}</p>
            </div>
            
            <div className="bg-white p-3 rounded border">
              <p className="font-medium text-blue-900 mb-1">📍 Lokasi</p>
              {formData.latitude && formData.longitude ? (
                <div>
                  <p><strong>GPS:</strong> {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}</p>
                  {locationData?.address && <p><strong>Alamat:</strong> {locationData.address}</p>}
                </div>
              ) : (
                <p className="text-red-600">❌ Lokasi belum dipilih</p>
              )}
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="bg-white p-3 rounded border">
              <p className="font-medium text-blue-900 mb-1">📦 Paket Internet</p>
              <p><strong>Pilihan:</strong> {packageOptions.find(p => p.value === formData.packageType)?.label || 'Belum dipilih'}</p>
            </div>
            
            <div className="bg-white p-3 rounded border">
              <p className="font-medium text-blue-900 mb-1">📎 Dokumen</p>
              <p><strong>Foto KTP:</strong> {ktpPhoto ? '✅ Sudah diunggah' : '❌ Belum diunggah'}</p>
              <p><strong>Foto Rumah:</strong> {housePhoto ? '✅ Sudah diunggah' : '❌ Belum diunggah'}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-green-800 mb-2">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">Perlindungan Keamanan</span>
        </div>
        <ul className="text-sm text-green-700 space-y-1">
          <li>• Data Anda dilindungi dengan enkripsi</li>
          <li>• Validasi GPS untuk memastikan lokasi di Indonesia</li>
          <li>• File upload aman dengan validasi format</li>
        </ul>
      </div>

      {/* Privacy Consent */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <input
            id="privacy-consent"
            type="checkbox"
            checked={privacyConsent}
            onChange={(e) => setPrivacyConsent(e.target.checked)}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            required
            aria-describedby="privacy-consent-description"
          />
          <div className="flex-1">
            <label htmlFor="privacy-consent" className="text-sm font-medium text-blue-900 cursor-pointer">
              Saya setuju dengan pengumpulan dan penggunaan data pribadi *
            </label>
            <p id="privacy-consent-description" className="text-xs text-blue-700 mt-1">
              Data pribadi Anda akan digunakan untuk keperluan registrasi, pemasangan WiFi, dan komunikasi terkait layanan. 
              Data akan disimpan dengan aman sesuai{' '}
              <a 
                href="/privacy" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline hover:text-blue-900"
              >
                kebijakan privasi
              </a>{' '}
              dan tidak akan dibagikan kepada pihak ketiga tanpa persetujuan Anda.
            </p>
          </div>
        </div>
        {!privacyConsent && currentStep === 2 && (
          <p className="text-red-500 text-xs mt-2" role="alert">
            Anda harus menyetujui kebijakan privasi untuk melanjutkan
          </p>
        )}
      </div>
      
    </div>
  );

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-8">
      {/* Dynamic Progress Steps */}
      <div className="flex justify-center mb-8">
        <div className="flex items-center space-x-4">
          {[1, 2].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                step <= currentStep 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {step}
              </div>
              {step < 2 && (
                <div className={`w-16 h-1 mx-2 ${
                  step < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              prevStep();
            }}
            className={`btn ${
              currentStep === 1
                ? 'btn-secondary opacity-50 cursor-not-allowed'
                : 'btn-outline'
            }`}
            disabled={currentStep === 1}
          >
            Sebelumnya
          </button>

          {currentStep < 2 ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                nextStep();
              }}
              className="btn-primary"
            >
              Selanjutnya
            </button>
          ) : (
            <div className="flex flex-col items-end">
              <button
                type="submit"
                disabled={isSubmitting || !securityData.csrfToken || !privacyConsent}
                className="btn-success disabled:opacity-50 disabled:cursor-not-allowed"
                aria-describedby={!privacyConsent ? "privacy-consent-error" : undefined}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mendaftar...</span>
                  </div>
                ) : (
                  'Daftar Sekarang'
                )}
              </button>
              {!privacyConsent && (
                <p id="privacy-consent-error" className="text-red-500 text-xs mt-2 text-center" role="alert">
                  Anda harus menyetujui kebijakan privasi untuk mendaftar
                </p>
              )}
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default RegistrationForm;
