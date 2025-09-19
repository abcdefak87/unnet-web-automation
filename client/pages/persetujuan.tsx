import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import { toast } from 'react-hot-toast';
import { api } from '../lib/api';
import Cookies from 'js-cookie';

interface Job {
  id: string;
  jobNumber: string;
  type: string;
  title?: string;
  description?: string;
  address: string;
  priority: string;
  approvalStatus: string;
  createdAt: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    address: string;
    ktpName?: string;
    ktpNumber?: string;
    installationType?: string;
  };
  createdBy?: {
    id: string;
    name: string;
  };
}

const JobApprovalPage: React.FC = () => {
  const { user } = useAuth();
  const [pendingJobs, setPendingJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Check if user has admin permissions
  const canApproveJobs = user?.role === 'admin' || user?.role === 'superadmin';

  useEffect(() => {
    if (canApproveJobs) {
      fetchPendingJobs();
    }
  }, [canApproveJobs]);

  const fetchPendingJobs = async () => {
    try {
      const token = Cookies.get('token');
      if (!token) {
        toast.error('Token tidak ditemukan, silakan login ulang');
        return;
      }

      const response = await api.get('/jobs/pending-approval');
      setPendingJobs(response.data.data);
    } catch (error: any) {
      console.error('Error fetching pending jobs:', error);
      if (error.response?.status === 403) {
        // Silently handle 403 errors for persetujuan page - user might not have access
        console.warn('User does not have permission to access approval jobs');
      } else if (error.response?.status === 401) {
        toast.error('Sesi Anda telah berakhir, silakan login ulang');
      } else {
        toast.error('Terjadi kesalahan saat memuat data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (jobId: string) => {
    setProcessingJobId(jobId);
    try {
      await api.put(`/jobs/${jobId}/approve`);
      toast.success('Pekerjaan disetujui dan dikirim ke teknisi!');
      fetchPendingJobs(); // Refresh list
    } catch (error: any) {
      console.error('Error approving job:', error);
      toast.error(error.response?.data?.error || 'Gagal menyetujui pekerjaan');
    } finally {
      setProcessingJobId(null);
    }
  };

  const handleReject = async () => {
    if (!selectedJobId || !rejectionReason.trim()) {
      toast.error('Alasan penolakan harus diisi');
      return;
    }

    setProcessingJobId(selectedJobId);
    try {
      await api.put(`/jobs/${selectedJobId}/reject`, { reason: rejectionReason });
      toast.success('Pekerjaan ditolak');
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedJobId(null);
      fetchPendingJobs(); // Refresh list
    } catch (error: any) {
      console.error('Error rejecting job:', error);
      toast.error(error.response?.data?.error || 'Gagal menolak pekerjaan');
    } finally {
      setProcessingJobId(null);
    }
  };

  const openRejectModal = (jobId: string) => {
    setSelectedJobId(jobId);
    setShowRejectModal(true);
  };

  const closeRejectModal = () => {
    setShowRejectModal(false);
    setRejectionReason('');
    setSelectedJobId(null);
  };

  if (!canApproveJobs) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Akses Ditolak</h2>
            <p className="text-gray-500">Anda tidak memiliki izin untuk mengakses halaman ini.</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Persetujuan Pekerjaan</h1>
          <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
            {pendingJobs.length} Menunggu Persetujuan
          </div>
        </div>

        {pendingJobs.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Tidak Ada Pekerjaan Menunggu</h3>
            <p className="text-gray-500">Semua pekerjaan telah disetujui atau ditolak.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {pendingJobs.map((job) => (
              <div key={job.id} className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{job.jobNumber}</h3>
                    <div className="flex items-center space-x-4 mt-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        job.type === 'INSTALLATION' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {job.type === 'INSTALLATION' ? 'Pemasangan' : 'Perbaikan'}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        job.priority === 'HIGH' ? 'bg-red-100 text-red-800' :
                        job.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {job.priority === 'HIGH' ? 'Tinggi' : 
                         job.priority === 'MEDIUM' ? 'Sedang' : 'Rendah'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <div>Dibuat: {new Date(job.createdAt).toLocaleDateString('id-ID')}</div>
                    {job.createdBy && <div>Oleh: {job.createdBy.name}</div>}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Informasi Pelanggan</h4>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div><strong>Nama:</strong> {job.customer.name}</div>
                      <div><strong>Telepon:</strong> {job.customer.phone}</div>
                      <div><strong>Alamat:</strong> {job.customer.address}</div>
                      {job.customer.ktpName && (
                        <div><strong>Nama KTP:</strong> {job.customer.ktpName}</div>
                      )}
                      {job.customer.ktpNumber && (
                        <div><strong>No. KTP:</strong> {job.customer.ktpNumber}</div>
                      )}
                      {job.customer.installationType && (
                        <div><strong>Tipe:</strong> {job.customer.installationType}</div>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Detail Pekerjaan</h4>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div><strong>Alamat Kerja:</strong> {job.address}</div>
                      {job.title && <div><strong>Judul:</strong> {job.title}</div>}
                      {job.description && <div><strong>Deskripsi:</strong> {job.description}</div>}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => openRejectModal(job.id)}
                    disabled={processingJobId === job.id}
                    className="px-4 py-2 text-red-600 border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processingJobId === job.id ? 'Memproses...' : 'Tolak'}
                  </button>
                  <button
                    onClick={() => handleApprove(job.id)}
                    disabled={processingJobId === job.id}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processingJobId === job.id ? 'Memproses...' : 'Setujui & Kirim ke Teknisi'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-white/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tolak Pekerjaan</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Alasan Penolakan *
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                rows={4}
                placeholder="Masukkan alasan penolakan..."
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={closeRejectModal}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectionReason.trim() || processingJobId === selectedJobId}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processingJobId === selectedJobId ? 'Memproses...' : 'Tolak Pekerjaan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default JobApprovalPage;

