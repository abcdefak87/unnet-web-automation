import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import ProtectedRoute from '../components/ProtectedRoute'
import { api } from '../lib/api'
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Shield,
  ShieldCheck,
  UserCheck,
  Settings,
  Eye,
  EyeOff,
  Bot
} from 'lucide-react'
import toast from 'react-hot-toast'

interface User {
  id: string
  email?: string
  username: string
  name: string
  role: string
  isActive: boolean
  lastLogin?: string
  whatsappNumber?: string
  telegramChatId?: string
}

export default function UsersPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [userForm, setUserForm] = useState({
    name: '',
    whatsappNumber: '',
    username: '',
    password: '',
    role: 'user',
    isActive: true
  })
  const [showOtpModal, setShowOtpModal] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [tempUserData, setTempUserData] = useState<any>(null)
  const [isVerifying, setIsVerifying] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const response = await api.get('/users')
      setUsers(response.data.data || [])
    } catch (error) {
      console.error('Failed to fetch users:', error)
      toast.error('Gagal memuat data users')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await api.post('/users', userForm)
      if (response.data.tempData) {
        // OTP sent, show verification modal
        setTempUserData(response.data.tempData)
        setShowOtpModal(true)
        setShowCreateModal(false)
        toast.success('OTP telah dikirim ke WhatsApp')
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal membuat user')
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsVerifying(true)
    try {
      await api.post('/users/verify-otp', {
        otp: otpCode,
        ...tempUserData
      })
      toast.success('User berhasil dibuat')
      setShowOtpModal(false)
      setOtpCode('')
      setTempUserData(null)
      setUserForm({ name: '', whatsappNumber: '', username: '', password: '', role: 'user', isActive: true })
      fetchUsers()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'OTP tidak valid')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResendOtp = async () => {
    try {
      await api.post('/users/resend-otp', {
        whatsappNumber: tempUserData.whatsappNumber,
        type: 'REGISTRATION'
      })
      toast.success('OTP telah dikirim ulang')
    } catch (error) {
      toast.error('Gagal mengirim ulang OTP')
    }
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.put(`/users/${editingUser?.id}`, userForm)
      toast.success('User berhasil diupdate')
      setEditingUser(null)
      setUserForm({ name: '', whatsappNumber: '', username: '', password: '', role: 'user', isActive: true })
      fetchUsers()
    } catch (error) {
      toast.error('Gagal mengupdate user')
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Yakin ingin menghapus user ini?')) return
    
    try {
      await api.delete(`/users/${userId}`)
      toast.success('User berhasil dihapus')
      fetchUsers()
    } catch (error) {
      toast.error('Gagal menghapus user')
    }
  }

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await api.patch(`/users/${userId}/toggle-status`)
      toast.success(`User ${!currentStatus ? 'diaktifkan' : 'dinonaktifkan'}`)
      
      // Update local state instead of refetching all users
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === userId 
            ? { ...user, isActive: !currentStatus }
            : user
        )
      )
    } catch (error) {
      toast.error('Gagal mengubah status user')
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'superadmin':
        return <ShieldCheck className="h-4 w-4 text-red-600" />
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-600" />
      case 'gudang':
        return <Settings className="h-4 w-4 text-green-600" />
      case 'user':
        return <UserCheck className="h-4 w-4 text-gray-600" />
      default:
        return <Shield className="h-4 w-4 text-gray-600" />
    }
  }

  const getRoleName = (role: string) => {
    switch (role) {
      case 'superadmin':
        return 'Super Admin'
      case 'admin':
        return 'Admin'
      case 'gudang':
        return 'Gudang Admin'
      case 'user':
        return 'User'
      default:
        return role
    }
  }


  if (isLoading) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </Layout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                  <Users className="h-8 w-8 text-blue-600 mr-3" />
                  Manajemen User
                </h1>
                <p className="text-gray-600 mt-1">
                  Kelola user sistem dan perizinan mereka
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Tambah User
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="table-container">
            <div className="table-wrapper">
              <table className="table">
                <thead>
                <tr>
                  <th className="table-cell-nowrap">
                    User
                  </th>
                  <th className="table-cell-nowrap">
                    Role
                  </th>
                  <th className="table-cell-nowrap">
                    Status
                  </th>
                  <th className="table-cell-nowrap">
                    Login Terakhir
                  </th>
                  <th className="table-cell-right table-cell-nowrap">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((userData) => (
                  <tr key={userData.id} className="hover:bg-gray-50">
                    <td className="table-cell-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{userData.name}</div>
                        <div className="text-sm text-gray-500">@{userData.username}</div>
                        {userData.whatsappNumber && (
                          <div className="text-xs text-gray-400">WA: {userData.whatsappNumber}</div>
                        )}
                      </div>
                    </td>
                    <td className="table-cell-nowrap">
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center">
                          {getRoleIcon(userData.role)}
                          <span className="ml-2 text-sm text-gray-900">{getRoleName(userData.role)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell-nowrap">
                      <span className={`badge ${
                        userData.isActive 
                          ? 'badge-success' 
                          : 'badge-danger'
                      }`}>
                        {userData.isActive ? 'Aktif' : 'Tidak Aktif'}
                      </span>
                    </td>
                    <td className="table-cell-nowrap text-sm text-gray-500">
                      {userData.lastLogin ? new Date(userData.lastLogin).toLocaleString('id-ID', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      }) : 'Belum Pernah'}
                    </td>
                    <td className="table-cell-right">
                      <div className="table-actions">
                        <button
                          onClick={() => toggleUserStatus(userData.id, userData.isActive)}
                          className="table-action-btn-view"
                          title={userData.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        >
                          {userData.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => {
                            setEditingUser(userData)
                            setUserForm({
                              name: userData.name,
                              whatsappNumber: userData.whatsappNumber || '',
                              username: userData.username,
                              password: '',
                              role: userData.role,
                              isActive: userData.isActive
                            })
                          }}
                          className="table-action-btn-edit"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        {userData.id !== user?.id && (
                          <button
                            onClick={() => handleDeleteUser(userData.id)}
                            className="table-action-btn-delete"
                            title="Hapus"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {/* Create/Edit Modal */}
          {(showCreateModal || editingUser) && (
            <div className="modal-overlay">
              <div className="modal-content">
                <div className="modal-header">
                  <h3 className="modal-title">
                    {editingUser ? 'Edit User' : 'Buat User Baru'}
                  </h3>
                </div>
                <div className="modal-body">
                  <form id="user-form" onSubmit={editingUser ? handleUpdateUser : handleCreateUser}>
                    <div className="space-y-4">
                      <div>
                        <label className="form-label">Nama</label>
                        <input
                          type="text"
                          value={userForm.name}
                          onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                          className="form-input"
                          placeholder="Nama lengkap"
                          required
                        />
                      </div>
                      <div>
                        <label className="form-label">Nomor WhatsApp</label>
                        <input
                          type="text"
                          value={userForm.whatsappNumber}
                          onChange={(e) => setUserForm({ ...userForm, whatsappNumber: e.target.value })}
                          className="form-input"
                          placeholder="628xxx atau 08xxx"
                          required={!editingUser}
                        />
                      </div>
                      <div>
                        <label className="form-label">Username</label>
                        <input
                          type="text"
                          value={userForm.username}
                          onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                          className="form-input"
                          placeholder="Username untuk login"
                          required={!editingUser}
                          disabled={editingUser ? true : false}
                        />
                      </div>
                      <div>
                        <label className="form-label">
                          Password {editingUser && '(kosongkan untuk tetap menggunakan yang lama)'}
                        </label>
                        <input
                          type="password"
                          value={userForm.password}
                          onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                          className="form-input"
                          autoComplete="current-password"
                          required={!editingUser}
                        />
                      </div>
                      <div>
                        <label className="form-label">Role</label>
                        <select
                          value={userForm.role}
                          onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                          className="form-input"
                        >
                          <option value="superadmin">Super Admin</option>
                          <option value="admin">Admin</option>
                          <option value="gudang">Gudang Admin</option>
                          <option value="user">User</option>
                        </select>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="isActive"
                          checked={userForm.isActive}
                          onChange={(e) => setUserForm({ ...userForm, isActive: e.target.checked })}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                        />
                        <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
                          Aktif
                        </label>
                      </div>
                    </div>
                  </form>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false)
                      setEditingUser(null)
                      setUserForm({ name: '', whatsappNumber: '', username: '', password: '', role: 'user', isActive: true })
                    }}
                    className="btn-outline"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    form="user-form"
                    className="btn-primary"
                  >
                    {editingUser ? 'Update' : 'Buat'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* OTP Verification Modal */}
          {showOtpModal && (
            <div className="modal-overlay">
              <div className="modal-content">
                <div className="modal-header">
                  <h3 className="modal-title">
                    Verifikasi OTP
                  </h3>
                  <p className="modal-subtitle">
                    Masukkan kode OTP yang telah dikirim ke WhatsApp {tempUserData?.whatsappNumber}
                  </p>
                </div>
                <div className="modal-body">
                  <form id="otp-form" onSubmit={handleVerifyOtp}>
                    <div className="space-y-4">
                      <div>
                        <label className="form-label">Kode OTP</label>
                        <input
                          type="text"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="form-input text-center text-lg font-mono"
                          placeholder="000000"
                          maxLength={6}
                          required
                          autoFocus
                        />
                      </div>
                    </div>
                  </form>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className="text-sm text-blue-600 hover:text-blue-800"
                    disabled={isVerifying}
                  >
                    Kirim ulang OTP
                  </button>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowOtpModal(false)
                        setOtpCode('')
                        setTempUserData(null)
                      }}
                      className="btn-outline"
                      disabled={isVerifying}
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      form="otp-form"
                      className="btn-primary disabled:opacity-50"
                      disabled={isVerifying || otpCode.length !== 6}
                    >
                      {isVerifying ? 'Memverifikasi...' : 'Verifikasi'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
