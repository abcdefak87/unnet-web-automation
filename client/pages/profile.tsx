import React, { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { User, Mail, Shield, Calendar, Save, Eye, EyeOff } from 'lucide-react'
import { api } from '../lib/api'

export default function Profile() {
  const { user } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email || ''
      }))
    }
  }, [user])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    try {
      // Validate password confirmation if changing password
      if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
        throw new Error('Password baru tidak cocok')
      }

      const updateData: any = {
        name: formData.name,
        email: formData.email
      }

      // Only include password fields if user is changing password
      if (formData.newPassword) {
        updateData.currentPassword = formData.currentPassword
        updateData.newPassword = formData.newPassword
      }

      const response = await api.put('/auth/profile', updateData)
      const data = response.data

      // Note: User context will be updated automatically via API interceptor

      setMessage({ type: 'success', text: 'Profile updated successfully!' })
      setIsEditing(false)
      
      // Clear password fields
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }))

    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to update profile' })
    } finally {
      setLoading(false)
    }
  }

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'superadmin': return 'Super Admin'
      case 'admin': return 'Admin'
      case 'gudang': return 'Gudang'
      case 'user': return 'User'
      default: return role
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'superadmin': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'admin': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'gudang': return 'bg-green-100 text-green-800 border-green-200'
      case 'user': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <Layout title="Profile Settings">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-8 border-b border-gray-200/50">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
                <User className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{user?.name || user?.email}</h1>
                <div className="flex items-center space-x-3 mt-2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getRoleBadgeColor(user?.role || '')}`}>
                    <Shield className="h-4 w-4 mr-1" />
                    {getRoleDisplayName(user?.role || '')}
                  </span>
                  <span className="text-sm text-gray-500 flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    Member since {new Date().toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Message */}
            {message.text && (
              <div className={`mb-6 p-4 rounded-xl border ${
                message.type === 'success' 
                  ? 'bg-green-50 border-green-200 text-green-800' 
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Informasi Dasar</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                      Nama Lengkap
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                        !isEditing ? 'bg-gray-50 text-gray-500' : 'bg-white'
                      }`}
                      placeholder="Masukkan nama lengkap Anda"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Alamat Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className={`w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                          !isEditing ? 'bg-gray-50 text-gray-500' : 'bg-white'
                        }`}
                        placeholder="Masukkan alamat email Anda"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Password Section */}
              {isEditing && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Ubah Password</h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-2">
                        Password Saat Ini
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          id="currentPassword"
                          name="currentPassword"
                          value={formData.currentPassword}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                          placeholder="Masukkan password saat ini"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                          Password Baru
                        </label>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          id="newPassword"
                          name="newPassword"
                          value={formData.newPassword}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                          placeholder="Masukkan password baru"
                        />
                      </div>
                      <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                          Konfirmasi Password Baru
                        </label>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          id="confirmPassword"
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                          placeholder="Konfirmasi password baru"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                <div>
                  {!isEditing ? (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                    >
                      <User className="h-4 w-4 mr-2" />
                      Edit Profil
                    </button>
                  ) : (
                    <div className="flex space-x-3">
                      <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditing(false)
                          setFormData(prev => ({
                            ...prev,
                            name: user?.name || '',
                            email: user?.email || '',
                            currentPassword: '',
                            newPassword: '',
                            confirmPassword: ''
                          }))
                          setMessage({ type: '', text: '' })
                        }}
                        className="inline-flex items-center px-6 py-3 border border-gray-300 text-sm font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                      >
                        Batal
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  )
}
