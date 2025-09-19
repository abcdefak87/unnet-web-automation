import React from 'react';
import { RegistrationData, PackageOption } from '../../types/registration';

interface PackageStepProps {
  formData: RegistrationData;
  setFormData: React.Dispatch<React.SetStateAction<RegistrationData>>;
  housePhoto: File | null;
  setHousePhoto: React.Dispatch<React.SetStateAction<File | null>>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>, type: 'ktp' | 'house') => void;
}

export const PackageStep: React.FC<PackageStepProps> = ({ 
  formData, 
  setFormData, 
  housePhoto, 
  setHousePhoto, 
  handleFileChange 
}) => {
  const packageOptions: PackageOption[] = [
    { value: '10MBPS', label: '10 Mbps - Rp 200.000/bulan' },
    { value: '20MBPS', label: '20 Mbps - Rp 300.000/bulan' },
    { value: '50MBPS', label: '50 Mbps - Rp 500.000/bulan' },
    { value: '100MBPS', label: '100 Mbps - Rp 800.000/bulan' }
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Pilih Paket & Upload Foto</h3>
      
      <div>
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
          <option value="">Pilih paket internet</option>
          {packageOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Upload Foto Rumah/Lokasi Pemasangan *
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleFileChange(e, 'house')}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
        <p className="text-sm text-gray-500 mt-1">
          Format: JPG, PNG. Maksimal 5MB. Foto bagian depan rumah atau lokasi pemasangan.
        </p>
        {housePhoto && (
          <div className="mt-2 text-sm text-green-600">
            ✅ File terpilih: {housePhoto.name}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">📋 Ringkasan Pendaftaran</h4>
        <div className="text-sm text-blue-800 space-y-1">
          <div><strong>Nama:</strong> {formData.name || '-'}</div>
          <div><strong>HP:</strong> {formData.phone || '-'}</div>
          <div><strong>Paket:</strong> {formData.packageType ? packageOptions.find(p => p.value === formData.packageType)?.label : '-'}</div>
          <div><strong>Lokasi GPS:</strong> {formData.latitude && formData.longitude ? '✅ Tersedia' : '❌ Belum ada'}</div>
        </div>
      </div>
    </div>
  );
};
