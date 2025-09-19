import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Layout from '../../components/Layout';
import { toast } from 'react-hot-toast';

interface PendingRegistration {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address: string;
  ktpNumber: string;
  ktpName: string;
  ktpAddress: string;
  packageType: string;
  ktpPhotoUrl?: string;
  housePhotoUrl?: string;
  shareLocation?: string;
  registeredAt: string;
  registrationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
}

const PendingRegistrations: React.FC = () => {
  const router = useRouter();
  const [registrations, setRegistrations] = useState<PendingRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegistration, setSelectedRegistration] = useState<PendingRegistration | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchPendingRegistrations();
  }, []);

  const fetchPendingRegistrations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/customers/registrations/pending', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRegistrations(data.data);
      } else {
        toast.error('Gagal memuat data pendaftaran');
      }
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Terjadi kesalahan saat memuat data');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (registration: PendingRegistration, action: 'approve' | 'reject') => {
    setSelectedRegistration(registration);
    setActionType(action);
    setShowModal(true);
    setRejectionReason('');
  };

  const processAction = async () => {
    if (!selectedRegistration) return;

    setProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const endpoint = actionType === 'approve' 
        ? `/api/customers/registrations/${selectedRegistration.id}/approve`
        : `/api/customers/registrations/${selectedRegistration.id}/reject`;

      const body = actionType === 'reject' ? { reason: rejectionReason } : {};

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        toast.success(
          actionType === 'approve' 
            ? 'Pendaftaran disetujui!' 
            : 'Pendaftaran ditolak!'
        );
        setShowModal(false);
        fetchPendingRegistrations(); // Refresh list
      } else {
        const error = await response.json();
        toast.error(error.error || 'Terjadi kesalahan');
      }
    } catch (error) {
      console.error('Action error:', error);
      toast.error('Terjadi kesalahan saat memproses');
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPackageLabel = (packageType: string) => {
    const packages: Record<string, string> = {
      '10MBPS': '10 Mbps - Rp 200.000/bulan',
      '20MBPS': '20 Mbps - Rp 300.000/bulan',
      '50MBPS': '50 Mbps - Rp 500.000/bulan',
      '100MBPS': '100 Mbps - Rp 800.000/bulan'
    };
    return packages[packageType] || packageType;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <>
      <Head>
        <title>Pendaftaran Pelanggan - UNNET Management</title>
      </Head>

      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pendaftaran Pelanggan</h1>
              <p className="text-gray-600">Kelola pendaftaran pelanggan baru yang menunggu persetujuan</p>
            </div>
            <div className="bg-blue-100 px-4 py-2 rounded-lg">
              <span className="text-blue-800 font-medium">
                {registrations.length} Pendaftaran Menunggu
              </span>
            </div>
          </div>

          {/* Registrations List */}
          {registrations.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Tidak Ada Pendaftaran</h3>
              <p className="text-gray-600">Belum ada pendaftaran pelanggan baru yang menunggu persetujuan</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {registrations.map((registration) => (
                <div key={registration.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{registration.name}</h3>
                      <p className="text-sm text-gray-500">
                        Mendaftar: {formatDate(registration.registeredAt)}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleAction(registration, 'approve')}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        ✅ Setujui
                      </button>
                      <button
                        onClick={() => handleAction(registration, 'reject')}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        ❌ Tolak
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Telepon</label>
                      <p className="text-gray-900">{registration.phone}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Email</label>
                      <p className="text-gray-900">{registration.email || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Paket</label>
                      <p className="text-gray-900">{getPackageLabel(registration.packageType)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Alamat Instalasi</label>
                      <p className="text-gray-900">{registration.address}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Data KTP</label>
                      <p className="text-gray-900">
                        <strong>Nama:</strong> {registration.ktpName}<br />
                        <strong>No. KTP:</strong> {registration.ktpNumber}<br />
                        <strong>Alamat:</strong> {registration.ktpAddress}
                      </p>
                    </div>
                  </div>

                  {/* Photos */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {registration.ktpPhotoUrl && (
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-2">Foto KTP</label>
                        <img 
                          src={registration.ktpPhotoUrl} 
                          alt="KTP" 
                          className="w-full h-32 object-cover rounded-lg border"
                        />
                      </div>
                    )}
                    {registration.housePhotoUrl && (
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-2">Foto Rumah</label>
                        <img 
                          src={registration.housePhotoUrl} 
                          alt="Rumah" 
                          className="w-full h-32 object-cover rounded-lg border"
                        />
                      </div>
                    )}
                  </div>

                  {registration.shareLocation && (
                    <div className="mt-4">
                      <label className="text-sm font-medium text-gray-700">Lokasi Google Maps</label>
                      <a 
                        href={registration.shareLocation} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 block"
                      >
                        📍 Lihat Lokasi
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Modal */}
        {showModal && selectedRegistration && (
          <div className="fixed inset-0 bg-white/20 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-4">
                {actionType === 'approve' ? 'Setujui Pendaftaran' : 'Tolak Pendaftaran'}
              </h3>
              
              <p className="text-gray-600 mb-4">
                {actionType === 'approve' 
                  ? `Anda akan menyetujui pendaftaran ${selectedRegistration.name}. Job instalasi akan otomatis dibuat dan dikirim ke teknisi.`
                  : `Anda akan menolak pendaftaran ${selectedRegistration.name}. Mohon berikan alasan penolakan.`
                }
              </p>

              {actionType === 'reject' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Alasan Penolakan *
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Masukkan alasan penolakan..."
                    required
                  />
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  disabled={processing}
                >
                  Batal
                </button>
                <button
                  onClick={processAction}
                  disabled={processing || (actionType === 'reject' && !rejectionReason.trim())}
                  className={`px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                    actionType === 'approve' 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {processing ? 'Memproses...' : (actionType === 'approve' ? 'Setujui' : 'Tolak')}
                </button>
              </div>
            </div>
          </div>
        )}
      </Layout>
    </>
  );
};

export default PendingRegistrations;
