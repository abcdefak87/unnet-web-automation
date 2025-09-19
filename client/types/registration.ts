export interface RegistrationData {
  name: string;
  phone: string;
  address: string;
  latitude: string;
  longitude: string;
  ktpNumber: string;
  ktpName: string;
  ktpAddress: string;
  shareLocation: string;
  packageType: string;
  installationType: string;
}

export interface PackageOption {
  value: string;
  label: string;
}

export interface GPSReading {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface LocationValidationResult {
  isValid: boolean;
  isInIndonesia: boolean;
  isNetworkPositioning: boolean;
  accuracy: number;
  message?: string;
}
