import React from 'react';
import { RegistrationData } from '../../types/registration';

interface KTPStepProps {
  formData: RegistrationData;
  setFormData: React.Dispatch<React.SetStateAction<RegistrationData>>;
  ktpPhoto: File | null;
  setKtpPhoto: React.Dispatch<React.SetStateAction<File | null>>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>, type: 'ktp' | 'house') => void;
}

export const KTPStep: React.FC<KTPStepProps> = ({ 
  formData, 
  setFormData, 
  ktpPhoto, 
  setKtpPhoto, 
  handleFileChange 
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Data KTP</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nomor KTP *
          </label>
          <input
            type="text"
            name="ktpNumber"
            value={formData.ktpNumber}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="16 digit nomor KTP"
            maxLength={16}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nama Sesuai KTP *
          </label>
          <input
            type="text"
            name="ktpName"
            value={formData.ktpName}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Nama sesuai KTP"
            required
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Alamat Sesuai KTP *
          </label>
          <textarea
            name="ktpAddress"
            value={formData.ktpAddress}
            onChange={handleInputChange}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Alamat sesuai KTP"
            required
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Foto KTP *
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFileChange(e, 'ktp')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
          <p className="text-sm text-gray-500 mt-1">
            Format: JPG, PNG. Maksimal 5MB
          </p>
          {ktpPhoto && (
            <div className="mt-2 text-sm text-green-600">
              ✅ File terpilih: {ktpPhoto.name}
            </div>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Link Google Maps (Opsional)
          </label>
          <input
            type="url"
            name="shareLocation"
            value={formData.shareLocation}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="https://maps.google.com/..."
          />
          <p className="text-sm text-gray-500 mt-1">
            Share lokasi dari Google Maps untuk memudahkan teknisi
          </p>
        </div>
      </div>
    </div>
  );
};
