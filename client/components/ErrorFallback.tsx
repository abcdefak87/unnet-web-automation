import React from 'react'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'
import Link from 'next/link'

interface ErrorFallbackProps {
  error: Error
  resetError: () => void
  context?: string
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({ 
  error, 
  resetError, 
  context = 'application' 
}) => {
  const isNetworkError = error.message.includes('Network Error') || 
                        error.message.includes('fetch')
  const isAuthError = error.message.includes('401') || 
                     error.message.includes('Unauthorized')

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-4">
        <div className="card text-center">
          {/* Error Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>

          {/* Error Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Ups! Terjadi kesalahan
          </h1>

          {/* Error Description */}
          <p className="text-gray-600 mb-6">
            {isNetworkError && "Sepertinya ada masalah koneksi. Silakan periksa koneksi internet Anda."}
            {isAuthError && "Sesi Anda telah berakhir. Silakan login kembali."}
            {!isNetworkError && !isAuthError && `Terjadi kesalahan yang tidak terduga di ${context}.`}
          </p>

          {/* Error Details (Development Only) */}
          {process.env.NODE_ENV === 'development' && (
            <details className="mb-6 text-left">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 mb-2">
                <Bug className="w-4 h-4 inline mr-1" />
                Detail Kesalahan (Development)
              </summary>
              <div className="bg-gray-100 p-3 rounded-lg text-xs font-mono text-gray-700 overflow-auto">
                <div className="mb-2">
                  <strong>Pesan:</strong> {error.message}
                </div>
                {error.stack && (
                  <div>
                    <strong>Stack:</strong>
                    <pre className="whitespace-pre-wrap mt-1">{error.stack}</pre>
                  </div>
                )}
              </div>
            </details>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={resetError}
              className="btn-primary flex items-center justify-center"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Coba Lagi
            </button>
            
            <Link href="/dashboard" className="btn-secondary flex items-center justify-center">
              <Home className="w-4 h-4 mr-2" />
              Ke Dashboard
            </Link>
          </div>

          {/* Additional Help */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Jika masalah ini berlanjut, silakan hubungi dukungan.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Network Error Component
export const NetworkErrorFallback: React.FC<{ retry: () => void }> = ({ retry }) => (
  <div className="card text-center p-8">
    <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
      <AlertTriangle className="w-6 h-6 text-yellow-600" />
    </div>
    <h3 className="text-lg font-semibold text-gray-900 mb-2">
      Koneksi Hilang
    </h3>
    <p className="text-gray-600 mb-4">
      Silakan periksa koneksi internet Anda dan coba lagi.
    </p>
    <button onClick={retry} className="btn-primary">
      <RefreshCw className="w-4 h-4 mr-2" />
      Coba Koneksi Lagi
    </button>
  </div>
)

// Loading Error Component
export const LoadingErrorFallback: React.FC<{ 
  retry: () => void
  message?: string 
}> = ({ retry, message = "Gagal memuat data" }) => (
  <div className="card text-center p-6">
    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
      <AlertTriangle className="w-5 h-5 text-red-600" />
    </div>
    <h3 className="text-md font-semibold text-gray-900 mb-2">
      {message}
    </h3>
    <button onClick={retry} className="btn-primary text-sm">
      <RefreshCw className="w-4 h-4 mr-1" />
      Coba Lagi
    </button>
  </div>
)

// Empty State with Error
export const EmptyStateWithError: React.FC<{
  title: string
  description: string
  retry?: () => void
  action?: React.ReactNode
}> = ({ title, description, retry, action }) => (
  <div className="card text-center p-8">
    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
      <AlertTriangle className="w-6 h-6 text-gray-400" />
    </div>
    <h3 className="text-lg font-semibold text-gray-900 mb-2">
      {title}
    </h3>
    <p className="text-gray-600 mb-4">
      {description}
    </p>
    <div className="flex justify-center gap-3">
      {retry && (
        <button onClick={retry} className="btn-primary">
          <RefreshCw className="w-4 h-4 mr-2" />
          Coba Lagi
        </button>
      )}
      {action}
    </div>
  </div>
)

export default ErrorFallback
