import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'superadmin' | 'admin' | 'gudang' | 'user'
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Don't redirect automatically, let the component handle it
        // The user state change will trigger re-render and show appropriate UI
        return
      }
      
      if (requiredRole && user.role !== requiredRole && user.role !== 'superadmin') {
        // Don't redirect automatically, show access denied UI instead
        return
      }
    }
  }, [user, loading, router, requiredRole])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (requiredRole && user.role !== requiredRole && user.role !== 'superadmin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Akses Ditolak</h1>
          <p className="text-gray-600">Anda tidak memiliki izin untuk mengakses halaman ini.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

