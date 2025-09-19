import React from 'react'
import Head from 'next/head'
import RegistrationForm from '../components/RegistrationForm'

const CustomerRegistration: React.FC = () => {
  return (
    <>
      <Head>
        <title>Daftar Pelanggan Baru - UNNET Management</title>
        <meta name="description" content="Daftar sebagai pelanggan baru UNNET dengan perlindungan keamanan lengkap" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                UNNET MANAGEMENT
              </h1>
              <p className="text-gray-600 mt-2">Pendaftaran Pelanggan Baru</p>
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-green-600">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                <span>Formulir aman dengan perlindungan keamanan lengkap</span>
              </div>
            </div>

            {/* Secure Registration Form */}
            <RegistrationForm />

            {/* Security Info */}
            <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-green-800 mb-4">Perlindungan Keamanan</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-green-700">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <strong>Enkripsi Data:</strong> Semua data dilindungi dengan enkripsi end-to-end
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <strong>Validasi GPS:</strong> Memastikan lokasi berada di Indonesia
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <strong>Rate Limiting:</strong> Mencegah spam dan serangan brute force
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="text-center mt-8 text-sm text-gray-600">
              <p>Butuh bantuan? Hubungi kami di WhatsApp: <strong>0812-3456-7890</strong></p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CustomerRegistration;
