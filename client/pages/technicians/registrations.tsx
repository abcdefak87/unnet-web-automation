import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Layout from '../../components/Layout';
import { toast } from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { api } from '../../lib/api';

interface TechnicianRegistration {
  id: string;
  telegramChatId: string;
  telegramUsername?: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  approvedBy?: { name: string };
  rejectedBy?: { name: string };
}

interface ApprovalFormData {
  name: string;
  phone: string;
}

const TechnicianRegistrations: React.FC = () => {
  const router = useRouter();
  const [registrations, setRegistrations] = useState<TechnicianRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegistration, setSelectedRegistration] = useState<TechnicianRegistration | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ApprovalFormData>({
    defaultValues: {
      name: '',
      phone: ''
    }
  });

  useEffect(() => {
    fetchRegistrations();
  }, []);

  const fetchRegistrations = async () => {
    try {
      const response = await api.get('/registrations');
      setRegistrations(response.data.data.registrations);
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Gagal memuat data registrasi');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (registration: TechnicianRegistration) => {
    setSelectedRegistration(registration);
    reset({
      name: `${registration.firstName} ${registration.lastName || ''}`.trim(),
      phone: registration.phone || ''
    });
    setShowApprovalModal(true);
  };

  const handleReject = (registration: TechnicianRegistration) => {
    setSelectedRegistration(registration);
    setRejectionReason('');
    setShowRejectionModal(true);
  };

  const processApproval = async (data: ApprovalFormData) => {
    if (!selectedRegistration) return;

    setProcessing(true);
    try {
      await api.post(`/registrations/${selectedRegistration.id}/approve`, data);
      toast.success('Registrasi teknisi disetujui!');
      setShowApprovalModal(false);
      fetchRegistrations();
    } catch (error: any) {
      console.error('Approval error:', error);
      toast.error(error.response?.data?.error || 'Terjadi kesalahan saat memproses');
    } finally {
      setProcessing(false);
    }
  };

  const processRejection = async () => {
    if (!selectedRegistration || !rejectionReason.trim()) return;

    setProcessing(true);
    try {
      await api.post(`/registrations/${selectedRegistration.id}/reject`, { reason: rejectionReason });
      toast.success('Registrasi teknisi ditolak');
      setShowRejectionModal(false);
      fetchRegistrations();
    } catch (error: any) {
      console.error('Rejection error:', error);
      toast.error(error.response?.data?.error || 'Terjadi kesalahan saat memproses');
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

  const getStatusBadge = (status: string) => {
    const badges = {
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'APPROVED': 'bg-green-100 text-green-800',
      'REJECTED': 'bg-red-100 text-red-800'
    };
    const labels = {
      'PENDING': '⏳ Menunggu',
      'APPROVED': '✅ Disetujui',
      'REJECTED': '❌ Ditolak'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[status as keyof typeof badges]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const pendingCount = registrations.filter(r => r.status === 'PENDING').length;

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
        <title>Registrasi Teknisi - UNNET Management</title>
      </Head>

      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Registrasi Teknisi</h1>
              <p className="text-gray-600">Kelola registrasi teknisi baru dari Telegram bot</p>
            </div>
            <div className="flex space-x-4">
              <div className="bg-yellow-100 px-4 py-2 rounded-lg">
                <span className="text-yellow-800 font-medium">
                  {pendingCount} Menunggu Persetujuan
                </span>
              </div>
              <button
                onClick={() => router.push('/technicians')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Lihat Semua Teknisi
              </button>
            </div>
          </div>

          {/* Registrations List */}
          {registrations.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Tidak Ada Registrasi</h3>
              <p className="text-gray-600">Belum ada registrasi teknisi baru dari Telegram bot</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {registrations.map((registration) => (
                <div key={registration.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {registration.firstName} {registration.lastName || ''}
                        </h3>
                        {getStatusBadge(registration.status)}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Telegram:</span> @{registration.telegramUsername || 'tidak ada'}
                        </div>
                        <div>
                          <span className="font-medium">Chat ID:</span> <code>{registration.telegramChatId}</code>
                        </div>
                        {registration.phone && (
                          <div>
                            <span className="font-medium">Nomor HP:</span> {registration.phone}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Mendaftar:</span> {formatDate(registration.createdAt)}
                        </div>
                        {registration.status === 'APPROVED' && registration.approvedAt && (
                          <div>
                            <span className="font-medium">Disetujui:</span> {formatDate(registration.approvedAt)}
                            {registration.approvedBy && <span> oleh {registration.approvedBy.name}</span>}
                          </div>
                        )}
                        {registration.status === 'REJECTED' && registration.rejectedAt && (
                          <div className="col-span-2">
                            <div>
                              <span className="font-medium">Ditolak:</span> {formatDate(registration.rejectedAt)}
                              {registration.rejectedBy && <span> oleh {registration.rejectedBy.name}</span>}
                            </div>
                            {registration.rejectionReason && (
                              <div className="mt-1">
                                <span className="font-medium">Alasan:</span> {registration.rejectionReason}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {registration.status === 'PENDING' && (
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => handleApprove(registration)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                        >
                          ✅ Setujui
                        </button>
                        <button
                          onClick={() => handleReject(registration)}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                        >
                          ❌ Tolak
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Approval Modal */}
        {showApprovalModal && selectedRegistration && (
          <div className="fixed inset-0 bg-white/20 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-4">Setujui Registrasi Teknisi</h3>
              
              <form onSubmit={handleSubmit(processApproval)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Lengkap *
                  </label>
                  <input
                    {...register('name', { required: 'Nama wajib diisi', minLength: { value: 2, message: 'Nama minimal 2 karakter' } })}
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Masukkan nama lengkap"
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nomor HP *
                  </label>
                  <input
                    {...register('phone', { 
                      required: 'Nomor HP wajib diisi',
                      pattern: { value: /^(\+62|62|0)[0-9]{9,13}$/, message: 'Format nomor HP tidak valid' }
                    })}
                    type="tel"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="08xxxxxxxxxx"
                  />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
                </div>

                <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
                  <p className="font-medium mb-1">ℹ️ Informasi:</p>
                  <p>Teknisi akan otomatis menerima notifikasi job dan dapat mengambil serta menyelesaikan pekerjaan.</p>
                  <p className="mt-1"><strong>Admin Bot:</strong> User dengan role superadmin/admin otomatis memiliki akses admin bot.</p>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowApprovalModal(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    disabled={processing}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={processing}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processing ? 'Memproses...' : 'Setujui & Buat Teknisi'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Rejection Modal */}
        {showRejectionModal && selectedRegistration && (
          <div className="fixed inset-0 bg-white/20 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-4">Tolak Registrasi Teknisi</h3>
              
              <p className="text-gray-600 mb-4">
                Anda akan menolak registrasi <strong>{selectedRegistration.firstName} {selectedRegistration.lastName || ''}</strong>. 
                Mohon berikan alasan penolakan.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Alasan Penolakan *
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Contoh: Data tidak lengkap, tidak memenuhi syarat, dll."
                  required
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowRejectionModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  disabled={processing}
                >
                  Batal
                </button>
                <button
                  onClick={processRejection}
                  disabled={processing || !rejectionReason.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? 'Memproses...' : 'Tolak Registrasi'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Layout>
    </>
  );
};

export default TechnicianRegistrations;
