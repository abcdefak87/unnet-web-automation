import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

interface SetupResponse {
  setupNeeded: boolean;
  userCount: number;
}

interface CreateUserData {
  name: string;
  username: string;
  password: string;
  confirmPassword: string;
  role: string;
}

export default function Setup() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState<CreateUserData>({
    name: '',
    username: '',
    password: '',
    confirmPassword: '',
    role: 'superadmin'
  });

  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      const response = await fetch('/api/setup/check');
      const data: SetupResponse = await response.json();
      
      if (!data.setupNeeded) {
        // Setup already completed, redirect to login
        router.push('/login');
        return;
      }
      
      setSetupNeeded(true);
    } catch (error) {
      console.error('Failed to check setup status:', error);
      setError('Gagal memeriksa status setup');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: CreateUserData) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!formData.name || !formData.username || !formData.password || !formData.role) {
      setError('Silakan isi semua field yang diperlukan');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Password tidak cocok');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password harus minimal 8 karakter');
      return;
    }

    setCreating(true);

    try {
      const response = await fetch('/api/setup/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          username: formData.username,
          password: formData.password,
          role: formData.role
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gagal membuat user');
      }

      setSuccess('User berhasil dibuat! Mengarahkan ke login...');
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login');
      }, 2000);

    } catch (error: any) {
      setError(error.message || 'Gagal membuat user');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memeriksa status setup...</p>
        </div>
      </div>
    );
  }

  if (!setupNeeded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Setup sudah selesai. Mengarahkan...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Setup User - Sistem Manajemen ISP</title>
      </Head>
      
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Setup Akun User
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Buat akun user pertama untuk Sistem Manajemen ISP Anda
            </p>
          </div>
          
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-md shadow-sm space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Nama Lengkap *
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Masukkan nama lengkap Anda"
                />
              </div>
              
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                  Username *
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={handleInputChange}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Masukkan username untuk login"
                />
              </div>
              
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                  Role *
                </label>
                <select
                  id="role"
                  name="role"
                  required
                  value={formData.role}
                  onChange={handleInputChange}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                >
                  <option value="superadmin">Super Admin</option>
                  <option value="admin">Admin</option>
                  <option value="gudang">Gudang</option>
                  <option value="user">User</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password *
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Masukkan password yang kuat"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Harus minimal 8 karakter dengan huruf besar, huruf kecil, angka, dan karakter khusus
                </p>
              </div>
              
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Konfirmasi Password *
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Konfirmasi password Anda"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                {success}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={creating}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Membuat User...
                  </>
                ) : (
                  'Buat Akun User'
                )}
              </button>
            </div>
          </form>
          
          <div className="text-center">
            <p className="text-xs text-gray-500">
              Ini akan membuat akun user dengan akses role yang dipilih
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
