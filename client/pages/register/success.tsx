import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { CheckCircle, Ticket, Wifi, Clock, Phone, MapPin, ArrowRight } from 'lucide-react'

export default function RegistrationSuccess() {
  const router = useRouter()
  const { id, jobNumber } = router.query
  const [customerData, setCustomerData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      // Simulate fetching customer data
      setTimeout(() => {
        setCustomerData({
          id: id,
          name: 'Pelanggan Baru',
          phone: '08xxxxxxxxxx',
          packageType: '20MBPS',
          jobNumber: jobNumber || `PSB-${Date.now()}-0001`
        })
        setLoading(false)
      }, 1000)
    }
  }, [id, jobNumber])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat data pendaftaran...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Pendaftaran Berhasil - UNNET Management</title>
        <meta name="description" content="Pendaftaran pelanggan berhasil" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            {/* Success Header */}
            <div className="text-center mb-8">
              <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Pendaftaran Berhasil!
              </h1>
              <p className="text-gray-600 text-lg">
                Terima kasih telah mendaftar sebagai pelanggan UNNET
              </p>
            </div>

            {/* Ticket Card */}
            <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
              <div className="flex items-center mb-6">
                <Ticket className="w-8 h-8 text-blue-600 mr-3" />
                <h2 className="text-2xl font-bold text-gray-900">Tiket PSB Anda</h2>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-blue-600 font-medium">Nomor Tiket</p>
                    <p className="text-2xl font-bold text-blue-900">{customerData?.jobNumber || 'PSB-XXXX-XXXX'}</p>
                  </div>
                  <div className="bg-blue-600 text-white px-4 py-2 rounded-lg">
                    <span className="text-sm font-medium">PSB</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center">
                    <Wifi className="w-4 h-4 text-blue-600 mr-2" />
                    <span className="text-gray-700">Paket: {customerData?.packageType || '20MBPS'}</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 text-blue-600 mr-2" />
                    <span className="text-gray-700">Status: Menunggu Pemasangan</span>
                  </div>
                </div>
              </div>

              {/* Next Steps */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Langkah Selanjutnya:</h3>
                
                <div className="space-y-3">
                  <div className="flex items-start">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3 mt-1">
                      <span className="text-sm font-bold text-blue-600">1</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Verifikasi Data</p>
                      <p className="text-sm text-gray-600">Tim kami akan memverifikasi data pendaftaran Anda</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3 mt-1">
                      <span className="text-sm font-bold text-blue-600">2</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Penjadwalan Pemasangan</p>
                      <p className="text-sm text-gray-600">Kami akan menghubungi Anda untuk jadwal pemasangan</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3 mt-1">
                      <span className="text-sm font-bold text-blue-600">3</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Pemasangan WiFi</p>
                      <p className="text-sm text-gray-600">Teknisi akan datang untuk memasang WiFi di lokasi Anda</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Informasi Kontak</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center">
                  <Phone className="w-5 h-5 text-green-600 mr-3" />
                  <div>
                    <p className="font-medium text-gray-900">WhatsApp</p>
                    <p className="text-sm text-gray-600">0812-3456-7890</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Clock className="w-5 h-5 text-green-600 mr-3" />
                  <div>
                    <p className="font-medium text-gray-900">Jam Operasional</p>
                    <p className="text-sm text-gray-600">Senin - Jumat: 08:00 - 17:00</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => window.open('https://wa.me/6281234567890', '_blank')}
                className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center"
              >
                <Phone className="w-5 h-5 mr-2" />
                Hubungi WhatsApp
              </button>
              
              <button
                onClick={() => router.push('/')}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
              >
                <MapPin className="w-5 h-5 mr-2" />
                Kembali ke Beranda
              </button>
            </div>

            {/* Footer Info */}
            <div className="text-center mt-8 text-sm text-gray-500">
              <p>Kami akan menghubungi Anda dalam 1x24 jam untuk konfirmasi jadwal pemasangan.</p>
              <p className="mt-2">Terima kasih telah mempercayai UNNET sebagai penyedia internet Anda!</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}