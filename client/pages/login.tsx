import { useState, useEffect } from 'react'
import { useRouter } from '../lib/router'
import { useForm } from 'react-hook-form'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, Wifi, Key, Phone } from 'lucide-react'
import { loadCredentials } from '../lib/storage'
import { api } from '../lib/api'
import toast from 'react-hot-toast'

interface LoginForm {
  username: string
  password: string
  rememberMe: boolean
}

export default function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [showOtpModal, setShowOtpModal] = useState(false)
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false)
  const [forgotPasswordIdentifier, setForgotPasswordIdentifier] = useState('')
  const [userId, setUserId] = useState('') // Store the user ID returned from forgot-password
  const [otpCode, setOtpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const { login, user, loading } = useAuth()
  const router = useRouter()

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginForm>({
    defaultValues: {
      rememberMe: false
    }
  })

  useEffect(() => {
    if (!loading && user) {
      // Prevent redirect if already on dashboard
      if (router.pathname !== '/dashboard') {
        router.replace('/dashboard')
      }
    }
  }, [user, loading, router])

  useEffect(() => {
    // Load saved credentials on component mount
    const savedCredentials = loadCredentials()
    if (savedCredentials && savedCredentials.rememberMe) {
      setValue('username', savedCredentials.username)
      setValue('password', savedCredentials.password)
      setValue('rememberMe', savedCredentials.rememberMe)
    }
  }, [setValue])

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    try {
      const success = await login(data.username, data.password, data.rememberMe)
      if (success) {
        // Check if there's a saved path to restore
        const savedPath = localStorage.getItem('lastVisitedPath')
        
        if (savedPath && savedPath !== '/login' && savedPath !== '/') {
          router.push(savedPath)
        } else {
          router.push('/dashboard')
        }
      } else {
        setIsLoading(false)
      }
    } catch (error) {
      setIsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-primary-600">
            <Wifi className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            UNNET MANAGEMENT
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sistem Manajemen Jaringan & Layanan Internet
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="username" className="form-label">
                Username
              </label>
              <input
                {...register('username', { 
                  required: 'Username wajib diisi' 
                })}
                id="username"
                type="text"
                autoComplete="username"
                className="form-input"
                placeholder="Masukkan username"
              />
              {errors.username && (
                <p className="form-error">{errors.username.message}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <div className="relative">
                <input
                  {...register('password', { 
                    required: 'Password wajib diisi',
                    minLength: {
                      value: 6,
                      message: 'Password minimal 6 karakter'
                    }
                  })}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="form-input pr-10"
                  placeholder="Masukkan password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="form-error">{errors.password.message}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                {...register('rememberMe')}
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                Ingat saya
              </label>
            </div>
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-primary-600 hover:text-primary-500 font-medium"
            >
              Lupa Password?
            </button>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                'Masuk'
              )}
            </button>
          </div>

        </form>

        {/* Forgot Password Modal */}
        {showForgotPassword && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <Key className="h-5 w-5 mr-2" />
                Lupa Password
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Masukkan username atau nomor WhatsApp yang terdaftar
              </p>
              <form onSubmit={async (e) => {
                e.preventDefault()
                setIsLoading(true)
                try {
                  const response = await api.post('/auth/forgot-password', {
                    identifier: forgotPasswordIdentifier
                  })
                  // Store the user ID returned from the backend
                  if (response.data.identifier) {
                    setUserId(response.data.identifier)
                  }
                  toast.success('OTP telah dikirim ke WhatsApp')
                  setShowForgotPassword(false)
                  setShowOtpModal(true)
                } catch (error: any) {
                  toast.error(error.response?.data?.error || 'Gagal mengirim OTP')
                } finally {
                  setIsLoading(false)
                }
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Username atau Nomor WhatsApp</label>
                    <input
                      type="text"
                      value={forgotPasswordIdentifier}
                      onChange={(e) => setForgotPasswordIdentifier(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      placeholder="username atau 628xxx"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false)
                      setForgotPasswordIdentifier('')
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Mengirim...' : 'Kirim OTP'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* OTP Verification Modal */}
        {showOtpModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <Phone className="h-5 w-5 mr-2" />
                Verifikasi OTP
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Masukkan kode OTP yang telah dikirim ke WhatsApp Anda
              </p>
              <form onSubmit={async (e) => {
                e.preventDefault()
                setIsVerifying(true)
                try {
                  const response = await api.post('/auth/verify-reset-otp', {
                    identifier: userId, // Use the stored user ID, not the original identifier
                    otp: otpCode
                  })
                  setResetToken(response.data.resetToken)
                  toast.success('OTP berhasil diverifikasi')
                  setShowOtpModal(false)
                  setShowResetPasswordModal(true)
                  setOtpCode('')
                } catch (error: any) {
                  toast.error(error.response?.data?.error || 'OTP tidak valid')
                } finally {
                  setIsVerifying(false)
                }
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Kode OTP</label>
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-center text-lg font-mono"
                      placeholder="000000"
                      maxLength={6}
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center mt-6">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await api.post('/auth/resend-reset-otp', {
                          identifier: userId // Use the stored user ID for resending OTP
                        })
                        toast.success('OTP telah dikirim ulang')
                      } catch (error) {
                        toast.error('Gagal mengirim ulang OTP')
                      }
                    }}
                    className="text-sm text-primary-600 hover:text-primary-800"
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
                      }}
                      className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                      disabled={isVerifying}
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                      disabled={isVerifying || otpCode.length !== 6}
                    >
                      {isVerifying ? 'Memverifikasi...' : 'Verifikasi'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reset Password Modal */}
        {showResetPasswordModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <Key className="h-5 w-5 mr-2" />
                Reset Password
              </h3>
              <form onSubmit={async (e) => {
                e.preventDefault()
                if (newPassword !== confirmPassword) {
                  toast.error('Password tidak cocok')
                  return
                }
                setIsLoading(true)
                try {
                  await api.post('/auth/reset-password', {
                    resetToken,
                    newPassword
                  })
                  toast.success('Password berhasil direset. Silakan login dengan password baru.')
                  setShowResetPasswordModal(false)
                  setNewPassword('')
                  setConfirmPassword('')
                  setForgotPasswordIdentifier('')
                  setUserId('')
                  setResetToken('')
                } catch (error: any) {
                  toast.error(error.response?.data?.error || 'Gagal mereset password')
                } finally {
                  setIsLoading(false)
                }
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Password Baru</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      placeholder="Minimal 6 karakter"
                      minLength={6}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Konfirmasi Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      placeholder="Ulangi password baru"
                      minLength={6}
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetPasswordModal(false)
                      setNewPassword('')
                      setConfirmPassword('')
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                    disabled={isLoading || newPassword.length < 6}
                  >
                    {isLoading ? 'Mereset...' : 'Reset Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

